import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { MarketTrade, OrderBook, MarketTicker, StreamType } from '@project-aria/shared';
import { AppError, ErrorCodes } from '../utils/errors';
import logger from '../utils/logger';

export class BinanceService extends EventEmitter {
    private ws: WebSocket | null = null;
    private activeSymbols: Set<string> = new Set();
    private readonly wsUrl = 'wss://stream.binance.com:9443/ws';
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private readonly reconnectDelay: number = 5000;
    private reconnectTimer: NodeJS.Timeout | null = null;

    constructor() {
        super();
    }

    public connect(): void {
        try {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.on('open', () => {
                logger.info('Connected to Binance WebSocket');
                this.reconnectAttempts = 0;
                this.resubscribe();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    this.handleMessage(data.toString());
                } catch (error) {
                    logger.error('Error parsing WebSocket message:', { error });
                    this.emit('error', new AppError(
                        'Failed to parse market data',
                        ErrorCodes.INVALID_MARKET_DATA,
                        500
                    ));
                }
            });

            this.ws.on('error', (error: Error) => {
                logger.error('WebSocket error:', { error });
                const appError = new AppError(
                    'WebSocket connection error',
                    ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
                    500
                );
                this.emit('error', appError);
                // Close the connection to trigger reconnect
                if (this.ws) {
                    this.ws.close();
                }
            });

            this.ws.on('close', () => {
                logger.warn('WebSocket connection closed');

                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    logger.info(`Attempting to reconnect`, {
                        attempt: this.reconnectAttempts,
                        maxAttempts: this.maxReconnectAttempts
                    });
                    if (this.reconnectTimer) {
                        clearTimeout(this.reconnectTimer);
                    }
                    this.reconnectTimer = setTimeout(() => {
                        this.connect();
                        this.reconnectTimer = null;
                    }, this.reconnectDelay);
                } else {
                    const error = new AppError(
                        'Max reconnection attempts reached',
                        ErrorCodes.MAX_RECONNECTION_ATTEMPTS,
                        500
                    );
                    logger.error(error.message);
                }
            });
        } catch (error) {
            logger.error('Failed to connect to Binance WebSocket:', { error });
            throw new AppError(
                'Failed to connect to Binance WebSocket',
                ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
                500,
            );
        }
    }

    public async subscribe(symbol: string, streams: StreamType[]): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new AppError(
                'WebSocket is not connected',
                ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
                500
            );
        }
        try {
            const subscriptions = streams.map(stream => `${symbol.toLowerCase()}@${stream}`);
            const message = {
                method: 'SUBSCRIBE',
                params: subscriptions,
                id: Date.now()
            };

            this.ws.send(JSON.stringify(message));
            this.activeSymbols.add(symbol.toLowerCase());
            logger.info('Subscribed to market data', { symbol, streams });
        } catch (error) {
            logger.error('Failed to subscribe to market data:', { error, symbol });
            throw new AppError(
                'Failed to subscribe to market data',
                ErrorCodes.WEBSOCKET_SUBSCRIPTION_FAILED,
                500,
            );
        }
    }

    public unsubscribe(symbol: string): void {
        try {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return;
            }

            const streams = ['trade', 'depth', 'ticker'];
            const subscriptions = streams.map(stream => `${symbol.toLowerCase()}@${stream}`);
            const message = {
                method: 'UNSUBSCRIBE',
                params: subscriptions,
                id: Date.now()
            };

            this.ws.send(JSON.stringify(message));
            this.activeSymbols.delete(symbol.toLowerCase());
            logger.info('Unsubscribed from market data', { symbol });
        } catch (error) {
            logger.error('Failed to unsubscribe from market data:', { error, symbol });
        }
    }

    public disconnect(): void {
        logger.info('Disconnecting from Binance WebSocket');
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.activeSymbols.clear();
        }
    }

    private handleMessage(message: any): void {
        let parsedMessage: any;
    
        try {
            if (typeof message === 'string') {
                parsedMessage = JSON.parse(message);
            } else {
                parsedMessage = message;
            }

            if (!parsedMessage || typeof parsedMessage !== 'object') {
                throw new Error('Invalid message format');
            }

            if (parsedMessage.e === 'trade') {
                this.handleTradeMessage(parsedMessage);
            } else if (parsedMessage.e === 'depthUpdate') {
                this.handleDepthMessage(parsedMessage);
            } else if (parsedMessage.e === '24hrTicker') {
                this.handleTickerMessage(parsedMessage);
            } else {
                // Ignore other message types
                logger.debug('Ignoring message type', { type: parsedMessage.e });
            }
        } catch (error) {
            if (error instanceof SyntaxError) {
                logger.error('Error parsing WebSocket message:', { error });
                this.emit('error', new AppError(
                    'Failed to parse market data',
                    ErrorCodes.INVALID_MARKET_DATA,
                    500
                ));
            } else {
                console.log('message', message);
                logger.warn('Invalid market data received:', { error, message: parsedMessage || message });
                this.emit('error', new AppError(
                    'Invalid market data received',
                    ErrorCodes.INVALID_MARKET_DATA,
                    400
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
        };
        this.emit('trade', trade);
    }

    private handleDepthMessage(message: any): void {
        if (!message.s || !message.U || !message.u || !Array.isArray(message.b) || !Array.isArray(message.a)) {
            throw new Error('Missing required fields in depth message');
        }

        const orderBook: OrderBook = {
            symbol: message.s,
            firstUpdateId: message.U,
            finalUpdateId: message.u,
            bids: message.b,
            asks: message.a
        };
        this.emit('depth', orderBook);
    }

    private handleTickerMessage(message: any): void {
        if (!message.s || !message.p || !message.P || !message.w || !message.c || !message.Q || !message.b || !message.a || 
            !message.o || !message.h || !message.l || !message.v || !message.q || !message.O || !message.C || !message.F || !message.L || !message.n) {
            throw new Error('Missing required fields in ticker message');
        }

        const ticker: MarketTicker = {
            symbol: message.s,
            priceChange: message.p,
            priceChangePercent: message.P,
            weightedAvgPrice: message.w,
            lastPrice: message.c,
            lastQty: message.Q,
            bidPrice: message.b,
            askPrice: message.a,
            openPrice: message.o,
            highPrice: message.h,
            lowPrice: message.l,
            volume: message.v,
            quoteVolume: message.q,
            openTime: message.O,
            closeTime: message.C,
            firstId: message.F,
            lastId: message.L,
            count: message.n
        };
        this.emit('ticker', ticker);
    }

    private resubscribe(): void {
        for (const symbol of this.activeSymbols) {
            this.subscribe(symbol, ['trade', 'depth', 'ticker'])
                .catch(error => {
                    logger.error('Error resubscribing to symbol', {
                        symbol,
                        error: error.message
                    });
                });
        }
    }
}

export const createBinanceService = (): BinanceService => {
    return new BinanceService();
};
