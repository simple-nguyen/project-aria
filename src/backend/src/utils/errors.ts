export class AppError extends Error {
    constructor(
        public message: string,
        public code: string,
        public statusCode: number = 500
    ) {
        super(message);
        this.name = 'AppError';
        Error.captureStackTrace(this, this.constructor);
    }
}

export const ErrorCodes = {
    WEBSOCKET_CONNECTION_FAILED: 'WEBSOCKET_CONNECTION_FAILED',
    WEBSOCKET_SUBSCRIPTION_FAILED: 'WEBSOCKET_SUBSCRIPTION_FAILED',
    WEBSOCKET_MESSAGE_PARSE_ERROR: 'WEBSOCKET_MESSAGE_PARSE_ERROR',
    WEBSOCKET_CONNECTION_CLOSED: 'WEBSOCKET_CONNECTION_CLOSED',
    INVALID_MARKET_DATA: 'INVALID_MARKET_DATA',
    MAX_RECONNECTION_ATTEMPTS: 'MAX_RECONNECTION_ATTEMPTS'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
