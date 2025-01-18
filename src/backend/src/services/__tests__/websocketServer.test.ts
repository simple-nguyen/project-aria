import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import { WebSocketServer, createWebSocketServer } from '../websocketServer';
import { BinanceService, createBinanceService } from '../binanceService';
import { MarketTrade, OrderBook, MarketTicker } from '@project-aria/shared';
import logger from '../../utils/logger';
import { AppError, ErrorCodes } from '../../utils/errors';

// Mock dependencies
jest.mock('socket.io');
jest.mock('../binanceService');
jest.mock('http');
jest.mock('../../utils/logger');

describe('WebSocketServer', () => {
    let wsServer: WebSocketServer;
    let mockServer: jest.Mocked<Server>;
    let mockSocket: jest.Mocked<Socket>;
    let mockBinanceService: jest.Mocked<BinanceService>;
    let mockHttpServer: any;
    let socketHandlers: { [event: string]: Function } = {};
    let binanceHandlers: { [event: string]: Function } = {};

    beforeEach(() => {
        jest.clearAllMocks();
        socketHandlers = {};
        binanceHandlers = {};

        // Mock Socket.IO server
        mockServer = {
            on: jest.fn().mockImplementation((event: string, callback: Function) => {
                socketHandlers[event] = callback;
                return mockServer;
            }),
            emit: jest.fn(),
            to: jest.fn().mockReturnThis(),
            close: jest.fn(),
            sockets: {
                adapter: {
                    rooms: new Map()
                }
            }
        } as unknown as jest.Mocked<Server>;

        // Mock Socket.IO socket
        mockSocket = {
            id: 'test-client',
            on: jest.fn().mockImplementation((event: string, callback: Function) => {
                socketHandlers[event] = callback;
                return mockSocket;
            }),
            join: jest.fn(),
            leave: jest.fn(),
            emit: jest.fn(),
            to: jest.fn().mockReturnThis()
        } as unknown as jest.Mocked<Socket>;

        // Mock HTTP server
        mockHttpServer = {
            listen: jest.fn(),
            close: jest.fn()
        };
        (createServer as jest.Mock).mockReturnValue(mockHttpServer);

        // Mock Socket.IO constructor
        (Server as unknown as jest.Mock).mockImplementation(() => mockServer);

        // Mock Binance service
        mockBinanceService = {
            connect: jest.fn(),
            disconnect: jest.fn(),
            subscribe: jest.fn().mockResolvedValue(undefined),
            unsubscribe: jest.fn(),
            on: jest.fn().mockImplementation((event: string, callback: Function) => {
                binanceHandlers[event] = callback;
                return mockBinanceService;
            })
        } as unknown as jest.Mocked<BinanceService>;
        (createBinanceService as jest.Mock).mockReturnValue(mockBinanceService);

        // Create WebSocket server instance
        wsServer = createWebSocketServer(8080);
    });

    describe('start', () => {
        it('should start the server and setup WebSocket handlers', () => {
            wsServer.start();

            expect(mockHttpServer.listen).toHaveBeenCalledWith(8080);
            expect(mockBinanceService.connect).toHaveBeenCalled();
            expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
        });

        it('should setup Binance service event handlers', () => {
            wsServer.start();

            expect(mockBinanceService.on).toHaveBeenCalledWith('trade', expect.any(Function));
            expect(mockBinanceService.on).toHaveBeenCalledWith('depth', expect.any(Function));
            expect(mockBinanceService.on).toHaveBeenCalledWith('ticker', expect.any(Function));
            expect(mockBinanceService.on).toHaveBeenCalledWith('error', expect.any(Function));
        });

        it('should handle server start errors', () => {
            const error = new Error('Server start failed');
            mockHttpServer.listen.mockImplementation(() => {
                throw error;
            });

            expect(() => wsServer.start()).toThrow(error);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('client connections', () => {
        beforeEach(() => {
            wsServer.start();
            socketHandlers.connection(mockSocket);
        });

        it('should handle client connections', () => {
            expect(mockSocket.on).toHaveBeenCalledWith('subscribe', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('unsubscribe', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
            expect(logger.info).toHaveBeenCalledWith('Client connected', { clientId: 'test-client' });
        });

        it('should handle client subscriptions', async () => {
            await socketHandlers.subscribe('BTCUSDT');

            expect(mockBinanceService.subscribe).toHaveBeenCalledWith('BTCUSDT', ['trade', 'depth', 'ticker']);
            expect(mockSocket.join).toHaveBeenCalledWith('BTCUSDT');
            expect(logger.info).toHaveBeenCalledWith('Client subscribed to symbol', {
                clientId: 'test-client',
                symbol: 'BTCUSDT'
            });
        });

        it('should handle subscription errors', async () => {
            const error = new AppError('Subscription failed', ErrorCodes.WEBSOCKET_SUBSCRIPTION_FAILED, 500);
            mockBinanceService.subscribe.mockRejectedValue(error);

            await socketHandlers.subscribe('BTCUSDT');

            expect(mockSocket.emit).toHaveBeenCalledWith('error', {
                code: ErrorCodes.WEBSOCKET_SUBSCRIPTION_FAILED,
                message: error.message
            });
            expect(logger.error).toHaveBeenCalled();
        });

        it('should handle client unsubscriptions', () => {
            socketHandlers.unsubscribe('BTCUSDT');

            expect(mockSocket.leave).toHaveBeenCalledWith('BTCUSDT');
            expect(mockBinanceService.unsubscribe).toHaveBeenCalledWith('BTCUSDT');
            expect(logger.info).toHaveBeenCalledWith('Client unsubscribed from symbol', {
                clientId: 'test-client',
                symbol: 'BTCUSDT'
            });
        });

        it('should handle client disconnections', () => {
            socketHandlers.disconnect();

            expect(logger.info).toHaveBeenCalledWith('Client disconnected', { clientId: 'test-client' });
        });
    });

    describe('market data broadcasting', () => {
        beforeEach(() => {
            wsServer.start();
        });

        it('should broadcast trade data', () => {
            const mockTrade: MarketTrade = {
                symbol: 'BTCUSDT',
                price: '50000',
                quantity: '1',
                timestamp: 123456789,
                buyerOrderId: 'buyer',
                sellerOrderId: 'seller',
                tradeId: 12345,
                isBuyerMaker: true
            };

            binanceHandlers.trade(mockTrade);

            expect(mockServer.to).toHaveBeenCalledWith('BTCUSDT');
            expect(mockServer.emit).toHaveBeenCalledWith('market_data', {
                type: 'trade',
                data: mockTrade
            });
        });

        it('should broadcast depth data', () => {
            const mockOrderBook: OrderBook = {
                symbol: 'BTCUSDT',
                timestamp: 123456789,
                firstUpdateId: 100,
                finalUpdateId: 200,
                bids: [['50000', '1']],
                asks: [['50001', '2']]
            };

            binanceHandlers.depth(mockOrderBook);

            expect(mockServer.to).toHaveBeenCalledWith('BTCUSDT');
            expect(mockServer.emit).toHaveBeenCalledWith('market_data', {
                type: 'depth',
                data: mockOrderBook
            });
        });

        it('should broadcast ticker data', () => {
            const mockTicker: MarketTicker = {
                symbol: 'BTCUSDT',
                priceChange: '1000',
                priceChangePercent: '2',
                weightedAvgPrice: '50000',
                lastPrice: '51000',
                lastQty: '1',
                bidPrice: '50999',
                askPrice: '51001',
                openPrice: '49000',
                highPrice: '52000',
                lowPrice: '48000',
                volume: '100',
                quoteVolume: '5000000',
                openTime: 123456789,
                closeTime: 123556789,
                firstId: 1000,
                lastId: 2000,
                count: 1000
            };

            binanceHandlers.ticker(mockTicker);

            expect(mockServer.to).toHaveBeenCalledWith('BTCUSDT');
            expect(mockServer.emit).toHaveBeenCalledWith('market_data', {
                type: 'ticker',
                data: mockTicker
            });
        });

        it('should handle broadcast errors', () => {
            mockServer.emit.mockImplementation(() => {
                throw new Error('Broadcast failed');
            });

            const mockTrade: MarketTrade = {
                symbol: 'BTCUSDT',
                price: '50000',
                quantity: '1',
                timestamp: 123456789,
                buyerOrderId: 'buyer',
                sellerOrderId: 'seller',
                tradeId: 12345,
                isBuyerMaker: true
            };

            binanceHandlers.trade(mockTrade);

            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('close', () => {
        it('should close the server and cleanup resources', () => {
            wsServer.close();

            expect(mockBinanceService.disconnect).toHaveBeenCalled();
            expect(mockServer.close).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('WebSocket server closed');
        });

        it('should handle close errors', () => {
            const error = new Error('Close failed');
            mockServer.close.mockImplementation(() => {
                throw error;
            });

            expect(() => wsServer.close()).toThrow(error);
            expect(logger.error).toHaveBeenCalled();
        });
    });
});
