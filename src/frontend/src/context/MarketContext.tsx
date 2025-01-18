import React, { createContext, useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { MarketTicker, MarketTrade, OrderBook, WebSocketMessage } from '@project-aria/shared';

const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:4001';

if (!import.meta.env.VITE_WEBSOCKET_URL) {
  console.warn('VITE_WEBSOCKET_URL not set in environment variables, using default: http://localhost:4001');
}

interface DecimalPrecision {
  price: number;
  amount: number;
}

interface MarketState {
  tickers: Record<string, MarketTicker>;
  trades: Record<string, MarketTrade[]>;
  orderBooks: Record<string, OrderBook>;
  error: string | null;
  isConnected: boolean;
  decimalPrecision: Record<string, DecimalPrecision>;
}

type MarketAction =
  | { type: 'SET_TICKER'; payload: MarketTicker }
  | { type: 'SET_TRADE'; payload: { symbol: string; trade: MarketTrade } }
  | { type: 'SET_ORDER_BOOK'; payload: OrderBook }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'UPDATE_DECIMAL_PRECISION'; payload: { symbol: string; precision: DecimalPrecision } };

const initialState: MarketState = {
  tickers: {},
  trades: {},
  orderBooks: {},
  error: null,
  isConnected: false,
  decimalPrecision: {},
};

// Helper function to count decimal places
function getDecimalPlaces(value: string | number): number {
  const str = value.toString();
  const decimalIndex = str.indexOf('.');
  return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
}

// Helper function to update decimal precision
function updatePrecision(current: DecimalPrecision | undefined, price: string | number, amount: string | number): DecimalPrecision {
  const priceDecimals = getDecimalPlaces(price);
  const amountDecimals = getDecimalPlaces(amount);
  
  if (!current) {
    return { price: priceDecimals, amount: amountDecimals };
  }

  return {
    price: Math.max(current.price, priceDecimals),
    amount: Math.max(current.amount, amountDecimals),
  };
}

// Separate contexts for different data types
export const MarketDataContext = createContext<{
  tickers: Record<string, MarketTicker>;
  trades: Record<string, MarketTrade[]>;
  orderBooks: Record<string, OrderBook>;
  decimalPrecision: Record<string, DecimalPrecision>;
} | null>(null);

export const MarketErrorContext = createContext<{
  error: string | null;
  isConnected: boolean;
} | null>(null);

export const MarketActionsContext = createContext<{
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
} | null>(null);

function marketReducer(state: MarketState, action: MarketAction): MarketState {
  switch (action.type) {
    case 'SET_TICKER':
      return {
        ...state,
        tickers: {
          ...state.tickers,
          [action.payload.symbol]: action.payload,
        },
      };
    case 'SET_TRADE': {
      const currentTrades = state.trades[action.payload.symbol] || [];
      const newTrades = [action.payload.trade, ...currentTrades].slice(0, 20);
      
      // Update decimal precision based on trade data
      const newPrecision = updatePrecision(
        state.decimalPrecision[action.payload.symbol],
        action.payload.trade.price,
        action.payload.trade.quantity
      );

      return {
        ...state,
        trades: {
          ...state.trades,
          [action.payload.symbol]: newTrades,
        },
        decimalPrecision: {
          ...state.decimalPrecision,
          [action.payload.symbol]: newPrecision,
        },
      };
    }
    case 'SET_ORDER_BOOK':
      return {
        ...state,
        orderBooks: {
          ...state.orderBooks,
          [action.payload.symbol]: action.payload,
        },
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'SET_CONNECTED':
      return {
        ...state,
        isConnected: action.payload,
        error: action.payload ? null : 'Disconnected from market data service',
      };
    case 'UPDATE_DECIMAL_PRECISION':
      return {
        ...state,
        decimalPrecision: {
          ...state.decimalPrecision,
          [action.payload.symbol]: action.payload.precision,
        },
      };
    default:
      return state;
  }
}

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(marketReducer, initialState);
  const [socket, setSocket] = React.useState<Socket | null>(null);
  const pendingSubscriptions = useRef<Set<string>>(new Set());

  // Memoize market data
  const marketData = useMemo(() => ({
    tickers: state.tickers,
    trades: state.trades,
    orderBooks: state.orderBooks,
    decimalPrecision: state.decimalPrecision,
  }), [state.tickers, state.trades, state.orderBooks, state.decimalPrecision]);

  // Memoize error state
  const errorState = useMemo(() => ({
    error: state.error,
    isConnected: state.isConnected,
  }), [state.error, state.isConnected]);

  // Handle subscriptions
  const handleSubscribe = useCallback((symbol: string) => {
    if (!symbol) return;
    const formattedSymbol = symbol.replace('_', '').toUpperCase();
    
    if (!socket?.connected) {
      console.log('Socket not connected, adding to pending subscriptions:', formattedSymbol);
      pendingSubscriptions.current.add(formattedSymbol);
    } else {
      console.log('Subscribing to:', formattedSymbol);
      socket.emit('subscribe', formattedSymbol);
    }
  }, [socket]);

  const handleUnsubscribe = useCallback((symbol: string) => {
    if (!symbol) return;
    const formattedSymbol = symbol.replace('_', '').toUpperCase();
    
    if (socket?.connected) {
      console.log('Unsubscribing from:', formattedSymbol);
      socket.emit('unsubscribe', formattedSymbol);
    }
    pendingSubscriptions.current.delete(formattedSymbol);
  }, [socket]);

  // Memoize actions
  const marketActions = useMemo(() => ({
    subscribe: handleSubscribe,
    unsubscribe: handleUnsubscribe,
  }), [handleSubscribe, handleUnsubscribe]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'ticker':
        dispatch({ type: 'SET_TICKER', payload: message.data as MarketTicker });
        break;
      case 'trade':
        dispatch({
          type: 'SET_TRADE',
          payload: { symbol: message.data.symbol, trade: message.data as MarketTrade },
        });
        break;
      case 'depth20':
        dispatch({ type: 'SET_ORDER_BOOK', payload: message.data as OrderBook });
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }, []);

  useEffect(() => {
    const newSocket = io(WEBSOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      dispatch({ type: 'SET_CONNECTED', payload: true });
      
      // Resubscribe to pending subscriptions
      if (pendingSubscriptions.current.size > 0) {
        console.log('Resubscribing to pending symbols:', Array.from(pendingSubscriptions.current));
        pendingSubscriptions.current.forEach(symbol => {
          newSocket.emit('subscribe', symbol);
        });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      dispatch({ type: 'SET_CONNECTED', payload: false });
    });

    newSocket.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
    });

    newSocket.on('market_data', handleMessage);

    setSocket(newSocket);

    return () => {
      pendingSubscriptions.current.clear();
      newSocket.close();
    };
  }, [handleMessage]);

  return (
    <MarketDataContext.Provider value={marketData}>
      <MarketErrorContext.Provider value={errorState}>
        <MarketActionsContext.Provider value={marketActions}>
          {children}
        </MarketActionsContext.Provider>
      </MarketErrorContext.Provider>
    </MarketDataContext.Provider>
  );
}
