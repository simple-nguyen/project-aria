export type StreamType = 'trade' | 'depth20@100ms' | 'depth20' | 'ticker' | 'error';

export interface MarketTrade {
    symbol: string;
    price: string;
    quantity: string;
    timestamp: number;
    isBuyerMaker: boolean;
    tradeId: number;
}

export interface OrderBook {
    symbol: string;
    bids: [number, number, number][];
    asks: [number, number, number][];
}

export interface MarketTicker {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    openPrice: string;
    lastPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
}

export interface WSErrorMessage {
    message: string;
    code: string;
}

export interface WebSocketMessage {
    type: StreamType;
    data: MarketTrade | OrderBook | MarketTicker | WSErrorMessage;
}
