import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { createWebSocketServer } from './services/websocketServer';
import { Pool } from 'pg';

// Load environment variables
config();

const app = express();
const port = process.env.PORT || 4000;
const wsPort = process.env.WS_PORT || 4001;

// Database connection
const pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'cryptodata',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    port: 5432,
});

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000"
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Get available trading pairs
app.get('/api/symbols', async (req, res) => {
    try {
        // For now, we'll return a static list of popular trading pairs
        // In a production environment, you might want to fetch this from Binance's API
        const symbols = [
            'BTCUSDT',
            'ETHUSDT',
            'BNBUSDT',
            'ADAUSDT',
            'DOGEUSDT',
            'XRPUSDT'
        ];
        res.json(symbols);
    } catch (error) {
        console.error('Error fetching symbols:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Initialize WebSocket server
const wsServer = createWebSocketServer(Number(wsPort));
wsServer.start();

// Start HTTP server
const server = app.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
});

// Handle graceful shutdown
const cleanup = () => {
    console.log('Shutting down servers...');
    wsServer.close();
    pool.end();
    server.close(() => {
        console.log('Servers closed');
        process.exit(0);
    });
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
