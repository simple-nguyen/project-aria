import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import { createBinanceService, BinanceService } from './binanceService';
import { MarketTrade, OrderBook, MarketTicker, StreamType, WebSocketMessage } from '@project-aria/shared';
import logger from '../utils/logger';
import { AppError, ErrorCodes } from '../utils/errors';

export class WebSocketServer {
    private io: Server;
    private binanceService: BinanceService;
    private activeSymbols: Set<string>;
    private httpServer: ReturnType<typeof createServer>;

    constructor(private readonly port: number) {
        this.httpServer = createServer();
        this.io = new Server(this.httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"]
            }
        });
        this.binanceService = createBinanceService();
        this.activeSymbols = new Set();
    }

    public start(): void {
        try {
            this.setupWebSocket();
            this.httpServer.listen(this.port);
            logger.info('WebSocket server started', { port: this.port });
        } catch (error) {
            logger.error('Failed to start WebSocket server', {
                port: this.port,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    public close(): void {
        try {
            this.binanceService.disconnect();
            this.io.close();
            logger.info('WebSocket server closed');
        } catch (error) {
            logger.error('Error closing WebSocket server', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    private setupWebSocket(): void {
        this.binanceService.connect();

        // Handle Binance events
        this.binanceService.on('trade', (trade: MarketTrade) => {
            this.broadcastMessage('trade', trade);
        });

        this.binanceService.on('depth', (orderBook: OrderBook) => {
            this.broadcastMessage('depth', orderBook);
        });

        this.binanceService.on('ticker', (ticker: MarketTicker) => {
            this.broadcastMessage('ticker', ticker);
        });

        this.binanceService.on('error', (error: Error) => {
            logger.error('Binance service error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                code: error instanceof AppError ? error.code : 'UNKNOWN_ERROR'
            });

            // Notify all connected clients about the error
            this.io.emit('service_error', {
                message: 'Market data service error',
                code: error instanceof AppError ? error.code : ErrorCodes.WEBSOCKET_CONNECTION_FAILED
            });
        });

        // Handle client connections
        this.io.on('connection', (socket: Socket) => {
            logger.info('Client connected', { clientId: socket.id });

            socket.on('subscribe', async (symbol: string) => {
                await this.handleSubscribe(socket, symbol);
            });

            socket.on('unsubscribe', (symbol: string) => {
                this.handleUnsubscribe(socket, symbol);
            });

            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });

            socket.on('error', (error: Error) => {
                logger.error('Socket error', {
                    clientId: socket.id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            });
        });
    }

    private broadcastMessage(type: StreamType, data: MarketTrade | OrderBook | MarketTicker): void {
        try {
            const message: WebSocketMessage = { type, data };
            this.io.to(data.symbol).emit('market_data', message);
            logger.debug('Broadcasting market data', { 
                type, 
                symbol: data.symbol 
            });
        } catch (error) {
            logger.error('Error broadcasting message', {
                type,
                symbol: data?.symbol,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async handleSubscribe(socket: Socket, symbol: string): Promise<void> {
        try {
            if (!symbol || typeof symbol !== 'string') {
                throw new AppError(
                    'Invalid symbol provided',
                    ErrorCodes.WEBSOCKET_SUBSCRIPTION_FAILED,
                    400
                );
            }

            if (!this.activeSymbols.has(symbol)) {
                await this.binanceService.subscribe(symbol, ['trade', 'depth', 'ticker']);
                this.activeSymbols.add(symbol);
                logger.info('New symbol subscription', { symbol });
            }

            socket.join(symbol);
            logger.info('Client subscribed to symbol', {
                clientId: socket.id,
                symbol
            });
        } catch (error) {
            const errorMessage = error instanceof AppError ? error.message : 'Subscription failed';
            const errorCode = error instanceof AppError ? error.code : ErrorCodes.WEBSOCKET_SUBSCRIPTION_FAILED;
            
            logger.error('Error subscribing to symbol', {
                clientId: socket.id,
                symbol,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            socket.emit('error', { 
                message: errorMessage,
                code: errorCode
            });
        }
    }

    private handleUnsubscribe(socket: Socket, symbol: string): void {
        try {
            socket.leave(symbol);
            logger.info('Client unsubscribed from symbol', {
                clientId: socket.id,
                symbol
            });

            // Check if there are any clients still subscribed to this symbol
            const room = this.io.sockets.adapter.rooms.get(symbol);
            if (!room || room.size === 0) {
                this.binanceService.unsubscribe(symbol);
                this.activeSymbols.delete(symbol);
                logger.info('Removed symbol subscription', { symbol });
            }
        } catch (error) {
            logger.error('Error unsubscribing from symbol', {
                clientId: socket.id,
                symbol,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private handleDisconnect(socket: Socket): void {
        try {
            logger.info('Client disconnected', { clientId: socket.id });
            this.cleanupSubscriptions();
        } catch (error) {
            logger.error('Error handling client disconnect', {
                clientId: socket.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private cleanupSubscriptions(): void {
        try {
            // Check all active symbols and remove those with no subscribers
            for (const symbol of this.activeSymbols) {
                const room = this.io.sockets.adapter.rooms.get(symbol);
                if (!room || room.size === 0) {
                    this.binanceService.unsubscribe(symbol);
                    this.activeSymbols.delete(symbol);
                    logger.info('Cleaned up subscription', { symbol });
                }
            }
        } catch (error) {
            logger.error('Error cleaning up subscriptions', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}

export const createWebSocketServer = (port: number): WebSocketServer => {
    return new WebSocketServer(port);
};
