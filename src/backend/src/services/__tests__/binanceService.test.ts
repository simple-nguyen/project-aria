import WebSocket from 'ws';
import { BinanceService, createBinanceService } from '../binanceService';
import { AppError, ErrorCodes } from '../../utils/errors';
import logger from '../../utils/logger';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('ws');
jest.mock('../../utils/logger');

describe('BinanceService', () => {
    let binanceService: BinanceService;
    let mockWs: jest.Mocked<WebSocket> & { readyState: number };
    let mockEmit: jest.SpyInstance;
    let messageHandlers: { [event: string]: Function } = {};
    const mockNow = 1234567890;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        messageHandlers = {};

        // Mock Date.now
        jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

        // Mock WebSocket
        mockWs = {
            on: jest.fn().mockImplementation((event: string, callback: Function) => {
                messageHandlers[event] = callback;

                return mockWs;
            }),
            send: jest.fn(),
            close: jest.fn(),
            readyState: WebSocket.OPEN
        } as unknown as jest.Mocked<WebSocket> & { readyState: number };

        (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

        // Setup binance service
        binanceService = createBinanceService();
        mockEmit = jest.spyOn(binanceService, 'emit').mockImplementation(() => {
            return true;  // Return true to indicate the event had listeners
        });
    });

    afterEach(() => {
        mockEmit.mockRestore();
        messageHandlers = {};
        binanceService.disconnect();
        jest.useRealTimers();
    });

    describe('connect', () => {
        it('should connect to Binance WebSocket', () => {
            binanceService.connect();

            expect(WebSocket).toHaveBeenCalledWith('wss://stream.binance.com:9443/ws');
            expect(mockWs.on).toHaveBeenCalledWith('open', expect.any(Function));
            expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
            expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
        });

        it('should handle connection errors', () => {
            const error = new Error('Connection failed');
            (WebSocket as unknown as jest.Mock).mockImplementation(() => {
                throw error;
            });

            expect(() => binanceService.connect()).toThrow(
                new AppError('Failed to connect to Binance WebSocket', ErrorCodes.WEBSOCKET_CONNECTION_FAILED, 500)
            );
            expect(logger.error).toHaveBeenCalledWith('Failed to connect to Binance WebSocket:', { error });
        });

        it('should handle WebSocket errors', () => {
            binanceService.connect();
            const error = new Error('WebSocket error');
            messageHandlers.error(error);

            expect(mockEmit).toHaveBeenCalledWith('error', new AppError(
                'WebSocket connection error',
                ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
                500
            ));
        });

        it('should handle WebSocket close', () => {
            binanceService.connect();
            messageHandlers.close();

            expect(logger.warn).toHaveBeenCalledWith('WebSocket connection closed');
            expect(logger.info).toHaveBeenCalledWith('Attempting to reconnect', {
                attempt: 1,
                maxAttempts: 5
            });

            jest.advanceTimersByTime(5000);
        });
    });

    describe('subscribe', () => {
        it('should subscribe to market data', async () => {
            binanceService.connect();

            await binanceService.subscribe('BTCUSDT', ['trade', 'depth', 'ticker']);

            expect(mockWs.send).toHaveBeenCalledWith(
                JSON.stringify({
                    method: 'SUBSCRIBE',
                    params: ['btcusdt@trade', 'btcusdt@depth', 'btcusdt@ticker'],
                    id: mockNow
                })
            );
            expect(logger.info).toHaveBeenCalledWith('Subscribed to market data', {
                symbol: 'BTCUSDT',
                streams: ['trade', 'depth', 'ticker']
            });
        });

        it('should handle subscription errors when WebSocket is not connected', async () => {
            mockWs.readyState = WebSocket.CLOSED;

            await expect(binanceService.subscribe('BTCUSDT', ['trade'])).rejects.toThrow(
                new AppError('WebSocket is not connected', ErrorCodes.WEBSOCKET_CONNECTION_FAILED, 500)
            );
        });

        it('should handle subscription errors when sending message fails', async () => {
            binanceService.connect();
            const error = new Error('Send failed');
            mockWs.send.mockImplementation(() => {
                throw error;
            });

            await expect(binanceService.subscribe('BTCUSDT', ['trade'])).rejects.toThrow(
                new AppError('Failed to subscribe to market data', ErrorCodes.WEBSOCKET_SUBSCRIPTION_FAILED, 500)
            );
            expect(logger.error).toHaveBeenCalledWith('Failed to subscribe to market data:', {
                error,
                symbol: 'BTCUSDT'
            });
        });
    });

    describe('unsubscribe', () => {
        it('should unsubscribe from market data', () => {
            binanceService.connect();

            binanceService.unsubscribe('BTCUSDT');

            expect(mockWs.send).toHaveBeenCalledWith(
                JSON.stringify({
                    method: 'UNSUBSCRIBE',
                    params: ['btcusdt@trade', 'btcusdt@depth', 'btcusdt@ticker'],
                    id: mockNow
                })
            );
            expect(logger.info).toHaveBeenCalledWith('Unsubscribed from market data', { symbol: 'BTCUSDT' });
        });

        it('should handle unsubscription errors', () => {
            binanceService.connect();
            const error = new Error('Send failed');
            mockWs.send.mockImplementation(() => {
                throw error;
            });

            binanceService.unsubscribe('BTCUSDT');

            expect(logger.error).toHaveBeenCalledWith('Failed to unsubscribe from market data:', {
                error,
                symbol: 'BTCUSDT'
            });
        });
    });

    describe('disconnect', () => {
        it('should disconnect from WebSocket', () => {
            binanceService.connect();

            binanceService.disconnect();

            expect(mockWs.close).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Disconnecting from Binance WebSocket');
        });
    });

    describe('message handling', () => {
        beforeEach(() => {
            binanceService.connect();
        });

        it('should handle trade messages', () => {
            const mockTradeMessage = {
                e: 'trade',
                s: 'BTCUSDT',
                p: '50000',
                q: '1',
                T: 123456789,
                b: 'buyer',
                a: 'seller',
                t: 12345,
                m: true
            };

            messageHandlers.message(JSON.stringify(mockTradeMessage));

            expect(mockEmit).toHaveBeenCalledWith('trade', {
                symbol: 'BTCUSDT',
                price: '50000',
                quantity: '1',
                timestamp: 123456789,
                buyerOrderId: 'buyer',
                sellerOrderId: 'seller',
                tradeId: 12345,
                isBuyerMaker: true
            });
        });

        it('should handle depth messages', () => {
            const mockDepthMessage = {
                e: 'depthUpdate',
                s: 'BTCUSDT',
                T: 123456789,
                U: 100,
                u: 200,
                b: [['50000', '1']],
                a: [['50001', '2']]
            };

            messageHandlers.message(JSON.stringify(mockDepthMessage));

            expect(mockEmit).toHaveBeenCalledWith('depth', {
                symbol: 'BTCUSDT',
                timestamp: 123456789,
                firstUpdateId: 100,
                finalUpdateId: 200,
                bids: [['50000', '1']],
                asks: [['50001', '2']]
            });
        });

        it('should handle ticker messages', () => {
            const mockTickerMessage = {
                e: '24hrTicker',
                s: 'BTCUSDT',
                p: '1000',
                P: '2',
                w: '50000',
                c: '51000',
                Q: '1',
                b: '50999',
                a: '51001',
                o: '49000',
                h: '52000',
                l: '48000',
                v: '100',
                q: '5000000',
                O: 123456789,
                C: 123556789,
                F: 1000,
                L: 2000,
                n: 1000
            };

            messageHandlers.message(JSON.stringify(mockTickerMessage));

            expect(mockEmit).toHaveBeenCalledWith('ticker', {
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
            });
        });

        it('should handle message parsing errors', () => {
            messageHandlers.message('invalid json');
            expect(logger.error).toHaveBeenCalledWith('Error parsing WebSocket message:', {
                error: expect.any(Error)
            });
            expect(mockEmit).toHaveBeenCalledWith('error', new AppError(
                'Failed to parse market data',
                ErrorCodes.INVALID_MARKET_DATA,
                500
            ));
        });

        it('should handle invalid market data', () => {
            const invalidMessage = {
                e: 'trade',
                s: 'BTCUSDT'
                // Missing required fields
            };

            messageHandlers.message(JSON.stringify(invalidMessage));

            expect(logger.warn).toHaveBeenCalledWith('Invalid market data received:', {
                error: expect.any(Error),
                message: invalidMessage
            });
            expect(mockEmit).toHaveBeenCalledWith('error', new AppError(
                'Invalid market data received',
                ErrorCodes.INVALID_MARKET_DATA,
                400
            ));
        });

        it('should handle unknown message types', () => {
            const unknownMessage = {
                e: 'unknown',
                s: 'BTCUSDT'
            };

            messageHandlers.message(JSON.stringify(unknownMessage));

            expect(logger.warn).toHaveBeenCalledWith('Invalid market data received:', {
                error: expect.any(Error),
                message: unknownMessage
            });
            expect(mockEmit).toHaveBeenCalledWith('error', new AppError(
                'Invalid market data received',
                ErrorCodes.INVALID_MARKET_DATA,
                400
            ));
        });
    });
});
