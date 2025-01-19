import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createWebSocketServer } from './services/websocketServer';
import logger from './utils/logger';

const app = express();
const httpPort = process.env.PORT ? parseInt(process.env.PORT) : 4000;
const wsPort = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 4001;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  })
);

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server on separate port
const wsServer = new WebSocketServer({ port: wsPort });
const wss = createWebSocketServer(wsServer);

// Start HTTP server
server.listen(httpPort, () => {
  logger.info(`HTTP server is running on port ${httpPort}`);
  logger.info(`WebSocket server is running on port ${wsPort}`);
});

// Handle shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing servers');
  server.close(() => {
    logger.info('HTTP server closed');
    wss.close();
    process.exit(0);
  });
});
