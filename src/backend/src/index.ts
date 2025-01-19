import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { createWebSocketServer } from './services/websocketServer';
import logger from './utils/logger';

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 4001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ['GET', 'POST']
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = createWebSocketServer(server);

// Start server
server.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});

// Handle shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    wss.close();
    process.exit(0);
  });
});
