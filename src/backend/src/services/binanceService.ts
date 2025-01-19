import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { MarketTrade, OrderBook, MarketTicker, StreamType } from '@project-aria/shared';
import { AppError, ErrorCodes } from '../utils/errors';
import logger from '../utils/logger';
import { streams } from '../utils/stream';
import { parseDepthFloats, sortDepthAsc, sortDepthDesc, reduceDepthWithTotal } from '../utils/helper';

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/stream';

export class BinanceService extends EventEmitter {
    private ws: WebSocket | null = null;
    private activeSymbols: Set<string> = new Set();
    private subscriptionId = 1;
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 5;
    private readonly reconnectDelay = 1000;

    public connect(): void {
        try {
            this.ws = new WebSocket(BINANCE_WS_URL);

            this.ws.on('open', () => {
                logger.info('Connected to Binance WebSocket');
                this.reconnectAttempts = 0;
                this.resubscribe();
            });

            this.ws.on('message', this.handleMessage.bind(this));

            this.ws.on('close', (code: number, reason: string) => {
                logger.warn('Binance WebSocket connection closed', { code, reason });
                this.cleanup();
                this.reconnect();
            });

            this.ws.on('error', (error: Error) => {
                logger.error('Binance WebSocket error', { error: error.message });
                this.emit('error', new AppError(
                    'WebSocket connection error',
                    ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
                    500
                ));
            });

            this.ws.on('ping', (data: Buffer) => {
                if (this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.pong(data);
                }
            });

            this.ws.on('pong', (data: Buffer) => {
                logger.info('Pong received', { data });
            })

        } catch (error) {
            logger.error('Error connecting to Binance WebSocket', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw new AppError(
                'Failed to connect to market data service',
                ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
                500
            );
        }
    }

    private cleanup(): void {}

    public disconnect(): void {
        this.cleanup();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    private reconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Max reconnection attempts reached');
            this.emit('error', new AppError(
                'Failed to reconnect to market data service',
                ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
                500
            ));
            return;
        }

        this.reconnectAttempts++;
        setTimeout(() => {
            logger.info('Attempting to reconnect', { attempt: this.reconnectAttempts });
            this.connect();
        }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1));
    }

    public async subscribe(symbol: string, streams: StreamType[]): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new AppError('WebSocket not connected', ErrorCodes.WEBSOCKET_CONNECTION_CLOSED, 500);
        }

        try {
            const subscriptions = streams.map(stream => `${symbol.toLowerCase()}@${stream}`);
            const message = {
                method: 'SUBSCRIBE',
                params: subscriptions,
                id: this.subscriptionId++
            };

            this.ws.send(JSON.stringify(message));
            this.activeSymbols.add(symbol);

            logger.info('Subscribed to symbol', { symbol, streams });
        } catch (error) {
            logger.error('Error subscribing to symbol', {
                symbol,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw new AppError(
                'Failed to subscribe to market data',
                ErrorCodes.WEBSOCKET_SUBSCRIPTION_FAILED,
                500
            );
        }
    }

    public unsubscribe(symbol: string, streams: StreamType[]): void {
        try {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return;
            }

            const subscriptions = streams.map(stream => `${symbol.toLowerCase()}@${stream}`);
            const message = {
                method: 'UNSUBSCRIBE',
                params: subscriptions,
                id: this.subscriptionId++
            };

            this.ws.send(JSON.stringify(message));
            this.activeSymbols.delete(symbol);

            logger.info('Unsubscribed from symbol', { symbol, streams });
        } catch (error) {
            logger.error('Error unsubscribing from symbol', {
                symbol,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private handleMessage(data: WebSocket.Data): void {
        let parsedData: any;
        
        try {
            if (typeof data === 'string') {
                parsedData = JSON.parse(data);
            } else if (data instanceof Buffer) {
                parsedData = JSON.parse(data.toString());
            } else {
                throw new Error('Unsupported message format');
            }

            if (parsedData.result !== undefined) {
                return;
            }

            if (!parsedData.stream || !parsedData.data) {
                throw new Error('Invalid message format');
            }

            const [symbol, eventType] = parsedData.stream.split('@');
            const eventData = parsedData.data;

            switch (eventType) {
                case 'trade':
                    this.handleTradeMessage(eventData);
                    break;
                case 'depth20':
                    this.handleDepthMessage({
                        symbol: symbol.toUpperCase(),
                        bids: eventData.bids,
                        asks: eventData.asks
                    });
                    break;
                case 'ticker':
                    this.handleTickerMessage(eventData);
                    break;
                default:
                    logger.debug('Ignoring message type', { type: eventType });
            }
        } catch (error) {
            if (error instanceof SyntaxError) {
                logger.error('Invalid JSON received:', { data });
                this.emit('error', new AppError(
                    'Invalid market data received',
                    ErrorCodes.INVALID_MARKET_DATA,
                    500
                ));
            } else {
                logger.warn('Invalid market data received:', { 
                    error: error instanceof Error ? error.message : 'Unknown error',
                    data: parsedData || data 
                });
                this.emit('error', new AppError(
                    'Invalid market data received',
                    ErrorCodes.INVALID_MARKET_DATA,
                    500
                ));
            }
        }
    }

    private handleTradeMessage(message: any): void {
        if (!message.s || !message.p || !message.q || !message.T || !message.t) {
            throw new Error('Missing required fields in trade message');
        }

        const trade: MarketTrade = {
            symbol: message.s,
            price: message.p,
            quantity: message.q,
            timestamp: message.T,
            tradeId: message.t,
            isBuyerMaker: message.m
        };
        this.emit('trade', trade);
    }

    private handleDepthMessage(message: any): void {
        if (!message.symbol || !Array.isArray(message.bids) || !Array.isArray(message.asks)) {
            throw new Error('Missing required fields in depth message');
        }
        const orderBook: OrderBook = {
            symbol: message.symbol,
            bids: message.bids
            .map(parseDepthFloats)
            .sort(sortDepthDesc)
            .reduce(reduceDepthWithTotal, []),
            asks: message.asks
            .map(parseDepthFloats)
            .sort(sortDepthAsc)
            .reduce(reduceDepthWithTotal, [])
        };
        this.emit('depth', orderBook);
    }

    private handleTickerMessage(message: any): void {
        if (!message.s || !message.c || !message.P || !message.o || !message.h || !message.l || !message.v || !message.q) {
            throw new Error('Missing required fields in ticker message');
        }

        const ticker: MarketTicker = {
            symbol: message.s,
            lastPrice: message.c,
            priceChange: message.p,
            priceChangePercent: message.P,
            openPrice: message.o,
            highPrice: message.h,
            lowPrice: message.l,
            volume: message.v,
            quoteVolume: message.q
        };
        this.emit('ticker', ticker);
    }

    private resubscribe(): void {
        for (const symbol of this.activeSymbols) {
            this.subscribe(symbol, streams)
                .catch(error => {
                    logger.error('Error resubscribing to symbol', {
                        symbol,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                });
        }
    }
}

export function createBinanceService(): BinanceService {
    return new BinanceService();
}
