import { config } from 'dotenv';

// Load environment variables from .env.test if it exists
config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.WS_PORT = '4001';
process.env.FRONTEND_URL = 'http://localhost:3000';

// Mock Winston logger
jest.mock('../utils/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));
