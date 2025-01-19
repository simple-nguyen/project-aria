import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { WebSocketServer, createWebSocketServer } from '../websocketServer';
import { BinanceService } from '../binanceService';
import { MarketTrade, OrderBook, MarketTicker } from '@project-aria/shared';
import logger from '../../utils/logger';
import { AppError, ErrorCodes } from '../../utils/errors';
import { streams } from '../../utils/stream';

// Mock dependencies
jest.mock('ws');
jest.mock('../binanceService', () => ({
  createBinanceService: jest.fn().mockReturnValue({
    connect: jest.fn(),
    disconnect: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    on: jest.fn(),
  }),
}));
jest.mock('http');
jest.mock('../../utils/logger');

describe('WebSocketServer', () => {
  let wsServer: WebSocketServer;
  let mockWSServer: jest.Mocked<WSServer>;
  let mockWebSocket: jest.Mocked<WebSocket>;
  let mockBinanceService: jest.Mocked<BinanceService>;
  let wsHandlers: Record<string, (data: unknown) => void> = {};
  let binanceHandlers: Record<string, (data: unknown) => void> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    wsHandlers = {};
    binanceHandlers = {};

    // Mock WebSocket client
    mockWebSocket = {
      send: jest.fn(),
      on: jest.fn().mockImplementation((event: string, callback: (data: unknown) => void) => {
        wsHandlers[event] = callback;
        return mockWebSocket;
      }),
      readyState: WebSocket.OPEN,
    } as unknown as jest.Mocked<WebSocket>;

    // Mock WebSocket server
    mockWSServer = {
      on: jest.fn().mockImplementation((event: string, callback: (data: unknown) => void) => {
        wsHandlers[event] = callback;
        return mockWSServer;
      }),
      close: jest.fn(),
      clients: new Set([mockWebSocket]),
    } as unknown as jest.Mocked<WSServer>;

    (WSServer as unknown as jest.Mock).mockImplementation(() => mockWSServer);

    // Mock Binance service
    mockBinanceService = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn(),
      on: jest.fn().mockImplementation((event: string, callback: (data: unknown) => void) => {
        binanceHandlers[event] = callback;
        return mockBinanceService;
      }),
    } as unknown as jest.Mocked<BinanceService>;

    // Update the mock implementation
    const { createBinanceService } = jest.requireMock('../binanceService');
    createBinanceService.mockReturnValue(mockBinanceService);

    // Create WebSocket server instance
    wsServer = createWebSocketServer(mockWSServer);
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
        symbol: 'BTCUSDT',
      });

      wsHandlers.message(Buffer.from(subscribeMessage));

      expect(mockBinanceService.subscribe).toHaveBeenCalledWith('BTCUSDT', streams);
      expect(logger.info).toHaveBeenCalledWith('Client subscribed to BTCUSDT');
    });

    it('should handle invalid subscription messages', () => {
      const invalidMessage = 'invalid json';

      wsHandlers.message(Buffer.from(invalidMessage));

      expect(logger.error).toHaveBeenCalledWith('Error parsing message:', expect.any(Error));
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'error', message: 'Invalid message format' })
      );
    });

    it('should handle missing symbol in subscription', () => {
      const invalidMessage = JSON.stringify({
        type: 'subscribe',
        symbol: '',
      });

      wsHandlers.message(Buffer.from(invalidMessage));

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'error', message: 'Invalid message format' })
      );
      expect(mockBinanceService.subscribe).not.toHaveBeenCalled();
    });

    it('should handle unknown message types', () => {
      const unknownMessage = JSON.stringify({
        type: 'unknown',
        symbol: 'BTCUSDT',
      });

      wsHandlers.message(Buffer.from(unknownMessage));

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'error', message: 'Unknown message type' })
      );
    });

    it('should handle client unsubscriptions', () => {
      // First subscribe
      const subscribeMessage = JSON.stringify({
        type: 'subscribe',
        symbol: 'BTCUSDT',
      });
      wsHandlers.message(Buffer.from(subscribeMessage));

      // Then unsubscribe
      const unsubscribeMessage = JSON.stringify({
        type: 'unsubscribe',
        symbol: 'BTCUSDT',
      });
      wsHandlers.message(Buffer.from(unsubscribeMessage));

      expect(mockBinanceService.unsubscribe).toHaveBeenCalledWith('BTCUSDT', streams);
      expect(logger.info).toHaveBeenCalledWith('Client unsubscribed from BTCUSDT');
    });

    it('should handle client disconnections', () => {
      // First subscribe to something
      const subscribeMessage = JSON.stringify({
        type: 'subscribe',
        symbol: 'BTCUSDT',
      });
      wsHandlers.message(Buffer.from(subscribeMessage));

      // Then disconnect
      wsHandlers.close();

      expect(mockBinanceService.unsubscribe).toHaveBeenCalledWith('BTCUSDT', streams);
      expect(logger.info).toHaveBeenCalledWith('Client disconnected');
    });

    it('should handle malformed JSON messages', () => {
      const malformedMessage = '{type:"subscribe",sym';

      wsHandlers.message(Buffer.from(malformedMessage));

      expect(logger.error).toHaveBeenCalledWith('Error parsing message:', expect.any(Error));
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'error', message: 'Invalid message format' })
      );
    });

    it('should handle missing type in message', () => {
      const invalidMessage = JSON.stringify({
        symbol: 'BTCUSDT',
      });

      wsHandlers.message(Buffer.from(invalidMessage));

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'error', message: 'Invalid message format' })
      );
    });

    it('should handle WebSocket errors', () => {
      const error = new Error('WebSocket error');
      wsHandlers.error(error);

      expect(logger.error).toHaveBeenCalledWith('WebSocket error:', { error: error.message });
    });

    it('should cleanup subscriptions on client disconnect', () => {
      // Subscribe to multiple symbols
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      symbols.forEach(symbol => {
        const subscribeMessage = JSON.stringify({
          type: 'subscribe',
          symbol,
        });
        wsHandlers.message(Buffer.from(subscribeMessage));
      });

      // Simulate disconnect
      wsHandlers.close();

      // Should unsubscribe from all symbols
      symbols.forEach(symbol => {
        expect(mockBinanceService.unsubscribe).toHaveBeenCalledWith(symbol, streams);
      });
    });
  });

  describe('market data broadcasting', () => {
    beforeEach(() => {
      // Simulate client connection and subscription
      wsHandlers.connection(mockWebSocket);
      const subscribeMessage = JSON.stringify({
        type: 'subscribe',
        symbol: 'BTCUSDT',
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
        tradeId: 1,
      };

      binanceHandlers.trade(mockTrade);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'trade',
          data: mockTrade,
        })
      );
    });

    it('should broadcast depth data', () => {
      const mockOrderBook: OrderBook = {
        symbol: 'BTCUSDT',
        bids: [[50000, 1, 2]],
        asks: [[50001, 2, 3]],
      };

      binanceHandlers.depth(mockOrderBook);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'depth20',
          data: mockOrderBook,
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
        lowPrice: '48000',
      };

      binanceHandlers.ticker(mockTicker);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'ticker',
          data: mockTicker,
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
            code: error.code,
          },
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
