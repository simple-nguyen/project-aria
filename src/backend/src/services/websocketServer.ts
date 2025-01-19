import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { BinanceService, createBinanceService } from './binanceService';
import { MarketTicker, MarketTrade, OrderBook, WebSocketMessage } from '@project-aria/shared';
import logger from '../utils/logger';
import { streams } from '../utils/stream';
import { AppError } from '../utils/errors';

export class WebSocketServer {
  private wss: WSServer;
  private binanceService: BinanceService;
  private subscriptions: Map<string, Set<WebSocket>> = new Map();
  private clientSubscriptions: Map<WebSocket, Set<string>> = new Map();

  constructor(wss: WSServer) {
    this.wss = wss;
    this.binanceService = createBinanceService();
    this.setupBinanceHandlers();
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers() {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('Client connected');

      this.clientSubscriptions.set(ws, new Set());

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          if (!message.type || !message.symbol) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
            return;
          }

          switch (message.type) {
            case 'subscribe':
              this.subscribe(ws, message.symbol);
              break;
            case 'unsubscribe':
              this.unsubscribe(ws, message.symbol);
              break;
            default:
              ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
          }
        } catch (error) {
          logger.error('Error parsing message:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
        logger.info('Client disconnected');
      });

      ws.on('error', error => {
        logger.error('WebSocket error:', { error: error.message });
      });
    });
  }

  private setupBinanceHandlers() {
    this.binanceService.connect();

    this.binanceService.on('trade', (trade: MarketTrade) => {
      this.broadcastToSymbol(trade.symbol, { type: 'trade', data: trade });
    });

    this.binanceService.on('depth', (depth: OrderBook) => {
      this.broadcastToSymbol(depth.symbol, { type: 'depth20', data: depth });
    });

    this.binanceService.on('ticker', (ticker: MarketTicker) => {
      this.broadcastToSymbol(ticker.symbol, { type: 'ticker', data: ticker });
    });

    this.binanceService.on('error', (error: AppError) => {
      logger.error('Binance service error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: error.code,
      });
      this.broadcastToAll({
        type: 'error',
        data: {
          message: 'Market data service error',
          code: error.code,
        },
      });
    });
  }

  private subscribe(client: WebSocket, symbol: string) {
    if (!symbol) {
      client.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      return;
    }

    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, new Set());
      this.binanceService.subscribe(symbol, streams);
    }
    this.subscriptions.get(symbol)?.add(client);
    this.clientSubscriptions.get(client)?.add(symbol);
    logger.info(`Client subscribed to ${symbol}`);
  }

  private unsubscribe(client: WebSocket, symbol: string) {
    if (!symbol) return;

    this.subscriptions.get(symbol)?.delete(client);
    if (this.subscriptions.get(symbol)?.size === 0) {
      this.subscriptions.delete(symbol);
      this.binanceService.unsubscribe(symbol, streams);
    }
    this.clientSubscriptions.get(client)?.delete(symbol);
    logger.info(`Client unsubscribed from ${symbol}`);
  }

  private handleDisconnect(client: WebSocket) {
    const clientSubs = this.clientSubscriptions.get(client);
    if (clientSubs) {
      for (const symbol of clientSubs) {
        this.subscriptions.get(symbol)?.delete(client);
        if (this.subscriptions.get(symbol)?.size === 0) {
          this.subscriptions.delete(symbol);
          this.binanceService.unsubscribe(symbol, streams);
        }
      }
    }
    this.clientSubscriptions.delete(client);
  }

  private broadcastToSymbol(symbol: string, message: WebSocketMessage) {
    const clients = this.subscriptions.get(symbol);
    if (!clients) return;

    const messageStr = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }

  private broadcastToAll(message: WebSocketMessage) {
    const messageStr = JSON.stringify(message);
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  public close() {
    this.wss.close();
    this.binanceService.disconnect();
  }
}

export function createWebSocketServer(wss: WSServer): WebSocketServer {
  return new WebSocketServer(wss);
}
