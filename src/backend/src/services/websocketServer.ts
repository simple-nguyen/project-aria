import { Server } from 'http';
import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { MarketTicker, MarketTrade, OrderBook, WebSocketMessage } from '@project-aria/shared';
import { BinanceService } from './binanceService';
import logger from '../utils/logger';
import { AppError, ErrorCodes } from '../utils/errors';
import { streams } from '../utils/stream';

export class WebSocketServer {
  private wss: WSServer;
  private subscriptions: Map<string, Set<WebSocket>> = new Map();
  private clientSubscriptions: Map<WebSocket, Set<string>> = new Map();
  private binanceService: BinanceService;

  constructor(server: Server) {
    this.wss = new WSServer({ server });
    this.binanceService = new BinanceService();
    this.binanceService.connect();
    this.setupWebSocketServer();
    this.setupBinanceHandlers();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('Client connected');

      this.clientSubscriptions.set(ws, new Set());

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          logger.error('Error parsing message:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        logger.info('Client disconnected');
        this.handleClientDisconnect(ws);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        this.handleClientDisconnect(ws);
      });
    });
  }

  private setupBinanceHandlers() {
    this.binanceService.on('trade', (trade: MarketTrade) => {
      this.broadcastToSymbol(trade.symbol, { type: 'trade', data: trade });
    });

    this.binanceService.on('depth', (orderBook: OrderBook) => {
      this.broadcastToSymbol(orderBook.symbol, { type: 'depth20', data: orderBook });
    });

    this.binanceService.on('ticker', (ticker: MarketTicker) => {
      this.broadcastToSymbol(ticker.symbol, { type: 'ticker', data: ticker });
    });

    this.binanceService.on('error', (error: Error) => {
      logger.error('Binance service error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof AppError ? error.code : 'UNKNOWN_ERROR'
      });
      this.broadcastToAll({ 
        type: 'error', 
        data: {
          message: 'Market data service error',
          code: error instanceof AppError ? error.code : ErrorCodes.WEBSOCKET_CONNECTION_FAILED
        }
      });
    });
  }

  private handleMessage(client: WebSocket, message: any) {
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(client, message.symbol);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(client, message.symbol);
        break;
      default:
        client.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  }

  private handleSubscribe(client: WebSocket, symbol: string) {
    if (!symbol) {
      client.send(JSON.stringify({ type: 'error', message: 'Symbol is required' }));
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

  private handleUnsubscribe(client: WebSocket, symbol: string) {
    if (!symbol) return;

    this.subscriptions.get(symbol)?.delete(client);
    if (this.subscriptions.get(symbol)?.size === 0) {
      this.subscriptions.delete(symbol);
      this.binanceService.unsubscribe(symbol, streams);
    }
    this.clientSubscriptions.get(client)?.delete(symbol);
    logger.info(`Client unsubscribed from ${symbol}`);
  }

  private handleClientDisconnect(client: WebSocket) {
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
    logger.debug('Broadcasting market data', { type: message.type, symbol });
  }

  private broadcastToAll(message: WebSocketMessage) {
    const messageStr = JSON.stringify(message);
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
    logger.debug('Broadcasting to all clients', { type: message.type });
  }

  public close() {
    this.wss.close();
    this.binanceService.disconnect();
  }
}

export const createWebSocketServer = (server: Server): WebSocketServer => {
  return new WebSocketServer(server);
};
