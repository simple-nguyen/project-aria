export type StreamType = 'trade' | 'depth' | 'ticker';

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
    firstUpdateId: number;
    finalUpdateId: number;
}

export interface MarketTicker {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    weightedAvgPrice: string;
    lastPrice: string;
    lastQty: string;
    bidPrice: string;
    askPrice: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
    openTime: number;
    closeTime: number;
    firstId: number;
    lastId: number;
    count: number;
}

export interface WebSocketMessage {
    type: StreamType;
    data: MarketTrade | OrderBook | MarketTicker;
}
