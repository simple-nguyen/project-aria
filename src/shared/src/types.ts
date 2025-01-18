export type StreamType = 'trade' | 'depth20@100ms' | 'depth20' | 'ticker';

export interface MarketTrade {
    symbol: string;
    price: string;
    quantity: string;
    timestamp: number;
    tradeId: number;
}

export interface OrderBook {
    symbol: string;
    bids: [string, string][];
    asks: [string, string][];
}

export interface MarketTicker {
    symbol: string;
    priceChangePercent: string;
    openPrice: string;
    lastPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
}

export interface WebSocketMessage {
    type: StreamType;
    data: MarketTrade | OrderBook | MarketTicker;
}
