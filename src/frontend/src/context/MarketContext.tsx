import React, { createContext, useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import { MarketTicker, MarketTrade, OrderBook, WebSocketMessage } from '@project-aria/shared';

const WEBSOCKET_URL = (import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:4001').replace(
  /^http/,
  'ws'
);

if (!import.meta.env.VITE_WEBSOCKET_URL) {
  console.warn(
    'VITE_WEBSOCKET_URL not set in environment variables, using default: ws://localhost:4001'
  );
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
  | { type: 'SET_TRADE'; payload: MarketTrade }
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

function getDecimalPlaces(value: string | number): number {
  const str = value.toString();
  const decimalIndex = str.indexOf('.');
  return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
}

function updatePrecision(
  current: DecimalPrecision | undefined,
  price: string | number,
  amount: string | number
): DecimalPrecision {
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
      const newTrades = [action.payload, ...currentTrades].slice(0, 20);

      const newPrecision = updatePrecision(
        state.decimalPrecision[action.payload.symbol],
        action.payload.price,
        action.payload.quantity
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
  const wsRef = useRef<WebSocket | null>(null);
  const pendingSubscriptions = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<number>();
  const reconnectAttempts = useRef(0);

  const marketData = {
    tickers: state.tickers,
    trades: state.trades,
    orderBooks: state.orderBooks,
    decimalPrecision: state.decimalPrecision,
  };

  const errorState = useMemo(
    () => ({
      error: state.error,
      isConnected: state.isConnected,
    }),
    [state.error, state.isConnected]
  );

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      switch (message.type) {
        case 'ticker':
          dispatch({ type: 'SET_TICKER', payload: message.data as MarketTicker });
          break;
        case 'trade':
          dispatch({
            type: 'SET_TRADE',
            payload: message.data as MarketTrade,
          });
          break;
        case 'depth20':
          dispatch({ type: 'SET_ORDER_BOOK', payload: message.data as OrderBook });
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WEBSOCKET_URL);

    ws.onopen = () => {
      console.warn('Connected to WebSocket server');
      dispatch({ type: 'SET_CONNECTED', payload: true });
      reconnectAttempts.current = 0;

      // Resubscribe to pending subscriptions after a short delay
      setTimeout(() => {
        if (pendingSubscriptions.current.size > 0) {
          console.warn(
            'Resubscribing to pending symbols:',
            Array.from(pendingSubscriptions.current)
          );
          pendingSubscriptions.current.forEach(symbol => {
            ws.send(JSON.stringify({ type: 'subscribe', symbol }));
          });
        }
      }, 100);
    };

    ws.onclose = () => {
      console.warn('Disconnected from WebSocket server');
      dispatch({ type: 'SET_CONNECTED', payload: false });

      // Exponential backoff with jitter for reconnection
      const baseDelay = 1000;
      const maxDelay = 30000;
      const jitter = Math.random() * 1000;
      const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts.current) + jitter, maxDelay);

      reconnectAttempts.current++;
      reconnectTimeoutRef.current = window.setTimeout(connect, delay);
    };

    ws.onerror = error => {
      console.error('WebSocket error:', error);
      dispatch({ type: 'SET_ERROR', payload: 'WebSocket connection error' });
    };

    ws.onmessage = handleMessage;

    wsRef.current = ws;
  }, [handleMessage]);

  const handleSubscribe = useCallback((symbol: string) => {
    if (!symbol) return;
    const formattedSymbol = symbol.replace('_', '').toUpperCase();

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Socket not connected, adding to pending subscriptions:', formattedSymbol);
      pendingSubscriptions.current.add(formattedSymbol);
    } else {
      console.warn('Subscribing to:', formattedSymbol);
      wsRef.current.send(JSON.stringify({ type: 'subscribe', symbol: formattedSymbol }));
    }
  }, []);

  const handleUnsubscribe = useCallback((symbol: string) => {
    if (!symbol) return;
    const formattedSymbol = symbol.replace('_', '').toUpperCase();

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.warn('Unsubscribing from:', formattedSymbol);
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', symbol: formattedSymbol }));
    }
    pendingSubscriptions.current.delete(formattedSymbol);
  }, []);

  const marketActions = {
    subscribe: handleSubscribe,
    unsubscribe: handleUnsubscribe,
  };

  useEffect(() => {
    connect();

    const cleanup = () => {
      const pendingSubs = pendingSubscriptions.current;
      const ws = wsRef.current;
      const timeout = reconnectTimeoutRef.current;

      if (timeout) {
        clearTimeout(timeout);
      }
      if (ws) {
        ws.close();
        wsRef.current = null;
      }

      if (pendingSubs.size > 0) {
        console.warn('Clearing pending subscriptions:', Array.from(pendingSubs));
        pendingSubs.clear();
      }
    };

    return cleanup;
  }, [connect]);

  return (
    <MarketErrorContext.Provider value={errorState}>
      <MarketActionsContext.Provider value={marketActions}>
        <MarketDataContext.Provider value={marketData}>{children}</MarketDataContext.Provider>
      </MarketActionsContext.Provider>
    </MarketErrorContext.Provider>
  );
}
