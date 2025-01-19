import { Server } from 'http';
import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { WebSocketServer, createWebSocketServer } from '../websocketServer';
import { BinanceService } from '../binanceService';
import { MarketTrade, OrderBook, MarketTicker } from '@project-aria/shared';
import logger from '../../utils/logger';
import { AppError, ErrorCodes } from '../../utils/errors';
import { streams } from '../../utils/stream';

// Mock dependencies
jest.mock('ws');
jest.mock('../binanceService');
jest.mock('http');
jest.mock('../../utils/logger');

describe('WebSocketServer', () => {
    let wsServer: WebSocketServer;
    let mockWSServer: jest.Mocked<WSServer>;
    let mockWebSocket: jest.Mocked<WebSocket>;
    let mockBinanceService: jest.Mocked<BinanceService>;
    let mockHttpServer: jest.Mocked<Server>;
    let wsHandlers: { [event: string]: Function } = {};
    let binanceHandlers: { [event: string]: Function } = {};

    beforeEach(() => {
        jest.clearAllMocks();
        wsHandlers = {};
        binanceHandlers = {};

        // Mock WebSocket client
        mockWebSocket = {
            send: jest.fn(),
            on: jest.fn().mockImplementation((event: string, callback: Function) => {
                wsHandlers[event] = callback;
                return mockWebSocket;
            }),
            readyState: WebSocket.OPEN,
        } as unknown as jest.Mocked<WebSocket>;

        // Mock WebSocket server
        mockWSServer = {
            on: jest.fn().mockImplementation((event: string, callback: Function) => {
                wsHandlers[event] = callback;
                return mockWSServer;
            }),
            close: jest.fn(),
            clients: new Set([mockWebSocket]),
        } as unknown as jest.Mocked<WSServer>;

        (WSServer as unknown as jest.Mock).mockImplementation(() => mockWSServer);

        // Mock HTTP server
        mockHttpServer = {
            on: jest.fn(),
        } as unknown as jest.Mocked<Server>;

        // Mock Binance service
        mockBinanceService = {
            connect: jest.fn(),
            disconnect: jest.fn(),
            subscribe: jest.fn().mockResolvedValue(undefined),
            unsubscribe: jest.fn(),
            on: jest.fn().mockImplementation((event: string, callback: Function) => {
                binanceHandlers[event] = callback;
                return mockBinanceService;
            }),
        } as unknown as jest.Mocked<BinanceService>;

        (BinanceService as unknown as jest.Mock).mockImplementation(() => mockBinanceService);

        // Create WebSocket server instance
        wsServer = createWebSocketServer(mockHttpServer);
    });

    describe('initialization', () => {
        it('should initialize the server and setup WebSocket handlers', () => {
            expect(mockWSServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
            expect(mockBinanceService.connect).toHaveBeenCalled();
        });

        it('should setup Binance service event handlers', () => {
            expect(mockBinanceService.on).toHaveBeenCalledWith('trade', expect.any(Function));
            expect(mockBinanceService.on).toHaveBeenCalledWith('depth', expect.any(Function));
            expect(mockBinanceService.on).toHaveBeenCalledWith('ticker', expect.any(Function));
            expect(mockBinanceService.on).toHaveBeenCalledWith('error', expect.any(Function));
        });
    });

    describe('client connections', () => {
        beforeEach(() => {
            // Simulate client connection
            wsHandlers.connection(mockWebSocket);
        });

        it('should handle client connections', () => {
            expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
            expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
            expect(mockWebSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(logger.info).toHaveBeenCalledWith('Client connected');
        });

        it('should handle client subscriptions', () => {
            const subscribeMessage = JSON.stringify({
                type: 'subscribe',
                symbol: 'BTCUSDT'
            });

            wsHandlers.message(Buffer.from(subscribeMessage));

            expect(mockBinanceService.subscribe).toHaveBeenCalledWith('BTCUSDT', streams);
            expect(logger.info).toHaveBeenCalledWith('Client subscribed to BTCUSDT');
        });

        it('should handle invalid subscription messages', () => {
            const invalidMessage = 'invalid json';

            wsHandlers.message(Buffer.from(invalidMessage));

            expect(mockWebSocket.send).toHaveBeenCalledWith(
                JSON.stringify({ type: 'error', message: 'Invalid message format' })
            );
        });

        it('should handle client unsubscriptions', () => {
            // First subscribe
            const subscribeMessage = JSON.stringify({
                type: 'subscribe',
                symbol: 'BTCUSDT'
            });
            wsHandlers.message(Buffer.from(subscribeMessage));

            // Then unsubscribe
            const unsubscribeMessage = JSON.stringify({
                type: 'unsubscribe',
                symbol: 'BTCUSDT'
            });
            wsHandlers.message(Buffer.from(unsubscribeMessage));

            expect(mockBinanceService.unsubscribe).toHaveBeenCalledWith('BTCUSDT', streams);
            expect(logger.info).toHaveBeenCalledWith('Client unsubscribed from BTCUSDT');
        });

        it('should handle client disconnections', () => {
            wsHandlers.close();

            expect(logger.info).toHaveBeenCalledWith('Client disconnected');
        });
    });

    describe('market data broadcasting', () => {
        beforeEach(() => {
            // Simulate client connection and subscription
            wsHandlers.connection(mockWebSocket);
            const subscribeMessage = JSON.stringify({
                type: 'subscribe',
                symbol: 'BTCUSDT'
            });
            wsHandlers.message(Buffer.from(subscribeMessage));
        });

        it('should broadcast trade data', () => {
            const mockTrade: MarketTrade = {
                symbol: 'BTCUSDT',
                price: '50000',
                quantity: '1',
                timestamp: 123456789,
                isBuyerMaker: false,
                tradeId: 1
            };

            binanceHandlers.trade(mockTrade);

            expect(mockWebSocket.send).toHaveBeenCalledWith(
                JSON.stringify({
                    type: 'trade',
                    data: mockTrade
                })
            );
        });

        it('should broadcast depth data', () => {
            const mockOrderBook: OrderBook = {
                symbol: 'BTCUSDT',
                bids: [[50000, 1, 2]],
                asks: [[50001, 2, 3]]
            };

            binanceHandlers.depth(mockOrderBook);

            expect(mockWebSocket.send).toHaveBeenCalledWith(
                JSON.stringify({
                    type: 'depth20',
                    data: mockOrderBook
                })
            );
        });

        it('should broadcast ticker data', () => {
            const mockTicker: MarketTicker = {
                symbol: 'BTCUSDT',
                lastPrice: '50000',
                priceChange: '1000',
                priceChangePercent: '2',
                volume: '100',
                quoteVolume: '5000000',
                openPrice: '49000',
                highPrice: '51000',
                lowPrice: '48000'
            };

            binanceHandlers.ticker(mockTicker);

            expect(mockWebSocket.send).toHaveBeenCalledWith(
                JSON.stringify({
                    type: 'ticker',
                    data: mockTicker
                })
            );
        });

        it('should broadcast error messages to all clients', () => {
            const error = new AppError('Market data error', ErrorCodes.WEBSOCKET_CONNECTION_FAILED);

            binanceHandlers.error(error);

            expect(mockWebSocket.send).toHaveBeenCalledWith(
                JSON.stringify({
                    type: 'error',
                    data: {
                        message: 'Market data service error',
                        code: ErrorCodes.WEBSOCKET_CONNECTION_FAILED
                    }
                })
            );
        });
    });

    describe('close', () => {
        it('should close the server and cleanup resources', () => {
            wsServer.close();

            expect(mockWSServer.close).toHaveBeenCalled();
            expect(mockBinanceService.disconnect).toHaveBeenCalled();
        });
    });
});
