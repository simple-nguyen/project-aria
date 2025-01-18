import { useContext } from 'react';
import { MarketDataContext, MarketErrorContext, MarketActionsContext } from '../context/MarketContext';
import { MarketTicker, OrderBook, MarketTrade } from '@project-aria/shared';
import { useDeepCompareMemo } from 'use-deep-compare';

interface DecimalPrecision {
  price: number;
  amount: number;
}

function useMarketData() {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketData must be used within a MarketProvider');
  }
  return context;
}

export function useMarketTicker(symbol: string): MarketTicker | undefined {
  const { tickers } = useMarketData();
  const processedSymbol = symbol.replace('_', '');
  const ticker = tickers[processedSymbol];
  
  return useDeepCompareMemo(() => {
    if (!ticker || typeof ticker.lastPrice !== 'string') {
      return undefined;
    }
    
    return {
      symbol: ticker.symbol,
      lastPrice: ticker.lastPrice,
      priceChange: ticker.priceChange,
      priceChangePercent: ticker.priceChangePercent,
      volume: ticker.volume,
      quoteVolume: ticker.quoteVolume,
      openPrice: ticker.openPrice,
      highPrice: ticker.highPrice,
      lowPrice: ticker.lowPrice,
    };
  }, [ticker]);
}

export function useMarketOrderBook(symbol: string): OrderBook | undefined {
  const { orderBooks } = useMarketData();
  const processedSymbol = symbol.replace('_', '');
  const orderBook = orderBooks[processedSymbol];
  
  return useDeepCompareMemo(() => {
    if (!orderBook || !Array.isArray(orderBook.asks) || !Array.isArray(orderBook.bids)) {
      return undefined;
    }
    
    return {
      symbol: orderBook.symbol,
      asks: [...orderBook.asks],
      bids: [...orderBook.bids],
    };
  }, [orderBook]);
}

export function useMarketTrades(symbol: string): MarketTrade[] {
  const { trades } = useMarketData();
  const processedSymbol = symbol.replace('_', '');
  const symbolTrades = trades[processedSymbol];
  
  return useDeepCompareMemo(() => {
    if (!Array.isArray(symbolTrades)) {
      return [];
    }
    
    return symbolTrades.map(trade => ({
      symbol: trade.symbol,
      price: trade.price,
      quantity: trade.quantity,
      timestamp: trade.timestamp,
      tradeId: trade.tradeId,
      isBuyerMaker: trade.isBuyerMaker
    }));
  }, [symbolTrades]);
}

export function useMarketPrecision(symbol: string): DecimalPrecision {
  const { decimalPrecision } = useMarketData();
  const processedSymbol = symbol.replace('_', '');
  return useDeepCompareMemo(() => {
    return decimalPrecision[processedSymbol] || { price: 2, amount: 6 };
  }, [decimalPrecision, processedSymbol]);
}

export function useMarketError(): { error: string | null; isConnected: boolean } {
  const context = useContext(MarketErrorContext);
  if (!context) {
    throw new Error('useMarketError must be used within a MarketProvider');
  }
  return context;
}

export function useMarketActions() {
  const actions = useContext(MarketActionsContext);
  if (!actions) {
    throw new Error('useMarketActions must be used within a MarketProvider');
  }
  return actions;
}

export function useMarketConnected(): boolean {
  const { isConnected } = useMarketError();
  return isConnected;
}
