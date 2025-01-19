import WebSocket from 'ws';
import { BinanceService, createBinanceService } from '../binanceService';
import { AppError, ErrorCodes } from '../../utils/errors';
import { streams } from '../../utils/stream';

// Mock dependencies
jest.mock('ws');
jest.mock('../../utils/logger');

const mockNow = 1234567890000;

describe('BinanceService', () => {
  let binanceService: BinanceService;
  let mockWs: jest.Mocked<WebSocket> & { readyState: number };
  let mockEmit: jest.SpyInstance;
  let messageHandlers: { [key: string]: (data: any) => void } = {};

  beforeEach(() => {
    jest.useFakeTimers();
    Date.now = jest.fn(() => mockNow);

    mockWs = {
      on: jest.fn((event: string, handler: any) => {
        messageHandlers[event] = handler;
        return mockWs;
      }),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
      ping: jest.fn(),
      pong: jest.fn(),
    } as unknown as jest.Mocked<WebSocket>;

    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

    binanceService = createBinanceService();
    mockEmit = jest.spyOn(binanceService, 'emit').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.clearAllMocks();
    binanceService.disconnect();
    jest.useRealTimers();
  });

  describe('connection', () => {
    it('should connect to WebSocket successfully', () => {
      binanceService.connect();

      expect(WebSocket).toHaveBeenCalledWith('wss://stream.binance.com:9443/stream');
      expect(mockWs.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('ping', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('pong', expect.any(Function));
    });

    it('should handle connection errors', () => {
      const error = new Error('Connection failed');
      (WebSocket as unknown as jest.Mock).mockImplementationOnce(() => {
        throw error;
      });

      expect(() => binanceService.connect()).toThrow(
        new AppError(
          'Failed to connect to market data service',
          ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
          500
        )
      );
    });
  });

  describe('subscription', () => {
    it('should subscribe to market data', async () => {
      binanceService.connect();

      await binanceService.subscribe('BTCUSDT', streams);

      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('"method":"SUBSCRIBE"'));
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(
          `"params":[${streams.map(stream => `"btcusdt@${stream}"`).join(',')}]`
        )
      );
    });

    it('should handle subscription errors when WebSocket is not connected', async () => {
      mockWs.readyState = WebSocket.CLOSED;

      await expect(binanceService.subscribe('BTCUSDT', streams)).rejects.toThrow(
        new AppError('WebSocket not connected', ErrorCodes.WEBSOCKET_CONNECTION_CLOSED, 500)
      );
    });
  });

  describe('message handling', () => {
    beforeEach(() => {
      binanceService.connect();
    });

    it('should handle trade messages', () => {
      const mockMessage = {
        stream: 'btcusdt@trade',
        data: {
          s: 'BTCUSDT',
          p: '50000',
          q: '1',
          T: 123456789,
          t: 12345,
        },
      };

      messageHandlers.message(JSON.stringify(mockMessage));

      expect(mockEmit).toHaveBeenCalledWith('trade', {
        symbol: 'BTCUSDT',
        price: '50000',
        quantity: '1',
        timestamp: 123456789,
        tradeId: 12345,
      });
    });

    it('should handle depth messages', () => {
      const mockMessage = {
        stream: 'btcusdt@depth20',
        data: {
          bids: [
            ['50000', '1'],
            ['49900', '2'],
          ],
          asks: [
            ['50100', '1.5'],
            ['50200', '2.5'],
          ],
        },
      };

      messageHandlers.message(JSON.stringify(mockMessage));

      expect(mockEmit).toHaveBeenCalledWith('depth', {
        symbol: 'BTCUSDT',
        bids: [
          [50000, 1, 1],
          [49900, 2, 3],
        ],
        asks: [
          [50100, 1.5, 1.5],
          [50200, 2.5, 4],
        ],
      });
    });

    it('should handle ticker messages', () => {
      const mockMessage = {
        stream: 'btcusdt@ticker',
        data: {
          s: 'BTCUSDT',
          c: '50000',
          P: '2',
          o: '49000',
          h: '51000',
          l: '48000',
          v: '100',
          q: '5000000',
        },
      };

      messageHandlers.message(JSON.stringify(mockMessage));

      expect(mockEmit).toHaveBeenCalledWith('ticker', {
        symbol: 'BTCUSDT',
        lastPrice: '50000',
        priceChangePercent: '2',
        openPrice: '49000',
        highPrice: '51000',
        lowPrice: '48000',
        volume: '100',
        quoteVolume: '5000000',
      });
    });

    it('should handle ping frames by responding with pong', () => {
      const pingData = Buffer.from('test-ping-data');
      messageHandlers.ping(pingData);
      expect(mockWs.pong).toHaveBeenCalledWith(pingData);
    });

    it('should not send pong if connection is not open', () => {
      mockWs.readyState = WebSocket.CLOSING;
      const pingData = Buffer.from('test-ping-data');
      messageHandlers.ping(pingData);
      expect(mockWs.pong).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON messages', () => {
      messageHandlers.message('invalid json');
      expect(mockEmit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Invalid market data received',
        })
      );
    });

    it('should handle missing required fields in messages', () => {
      const invalidMessage = {
        stream: 'btcusdt@trade',
        data: {
          s: 'BTCUSDT',
        },
      };

      messageHandlers.message(JSON.stringify(invalidMessage));
      expect(mockEmit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Invalid market data received',
        })
      );
    });
  });
});
