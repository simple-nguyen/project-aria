import { createContext, useContext, useEffect, useReducer, ReactNode, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { MarketTicker, MarketTrade, OrderBook, WebSocketMessage } from '@project-aria/shared';

const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:4001';
const MAX_TRADES = 10;

if (!import.meta.env.VITE_WEBSOCKET_URL) {
  console.warn('VITE_WEBSOCKET_URL not set in environment variables, using default: http://localhost:4001');
}

interface MarketState {
  tickers: { [symbol: string]: MarketTicker };
  orderBooks: { [symbol: string]: OrderBook };
  trades: { [symbol: string]: MarketTrade[] };
  subscribedSymbols: Set<string>;
  error: string | null;
}

type MarketAction =
  | { type: 'SET_TICKER'; payload: MarketTicker }
  | { type: 'SET_ORDER_BOOK'; payload: OrderBook }
  | { type: 'ADD_TRADE'; payload: MarketTrade }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'ADD_SYMBOL'; payload: string }
  | { type: 'REMOVE_SYMBOL'; payload: string };

const initialState: MarketState = {
  tickers: {},
  orderBooks: {},
  trades: {},
  subscribedSymbols: new Set(),
  error: null,
};

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
    case 'SET_ORDER_BOOK':
      return {
        ...state,
        orderBooks: {
          ...state.orderBooks,
          [action.payload.symbol]: action.payload,
        },
      };
    case 'ADD_TRADE':
      const currentTrades = state.trades[action.payload.symbol] || [];
      return {
        ...state,
        trades: {
          ...state.trades,
          [action.payload.symbol]: [
            action.payload,
            ...currentTrades.slice(0, MAX_TRADES - 1)
          ],
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
    case 'ADD_SYMBOL':
      return {
        ...state,
        subscribedSymbols: new Set([...state.subscribedSymbols, action.payload]),
      };
    case 'REMOVE_SYMBOL':
      const newSymbols = new Set(state.subscribedSymbols);
      newSymbols.delete(action.payload);
      const { 
        [action.payload]: removedTicker, 
        ...remainingTickers 
      } = state.tickers;
      const {
        [action.payload]: removedOrderBook,
        ...remainingOrderBooks
      } = state.orderBooks;
      const {
        [action.payload]: removedTrades,
        ...remainingTrades
      } = state.trades;
      return {
        ...state,
        subscribedSymbols: newSymbols,
        tickers: remainingTickers,
        orderBooks: remainingOrderBooks,
        trades: remainingTrades,
      };
    default:
      return state;
  }
}

const MarketContext = createContext<{
  state: MarketState;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
} | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(marketReducer, initialState);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = io(WEBSOCKET_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to WebSocket server');
      dispatch({ type: 'CLEAR_ERROR' });
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      dispatch({ type: 'SET_ERROR', payload: 'WebSocket connection lost' });
    });

    socketRef.current.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
    });

    socketRef.current.on('service_error', (error: { message: string; code: string }) => {
      console.error('Service error:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
    });

    socketRef.current.on('market_data', (message: WebSocketMessage) => {
      switch (message.type) {
        case 'ticker':
          dispatch({ type: 'SET_TICKER', payload: message.data as MarketTicker });
          break;
        case 'depth':
          dispatch({ type: 'SET_ORDER_BOOK', payload: message.data as OrderBook });
          break;
        case 'trade':
          dispatch({ type: 'ADD_TRADE', payload: message.data as MarketTrade });
          break;
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const subscribe = (symbol: string) => {
    if (!symbol || !socketRef.current) return;
    const formattedSymbol = symbol.toUpperCase();
    socketRef.current.emit('subscribe', formattedSymbol);
    dispatch({ type: 'ADD_SYMBOL', payload: formattedSymbol });
  };

  const unsubscribe = (symbol: string) => {
    if (!symbol || !socketRef.current) return;
    const formattedSymbol = symbol.toUpperCase();
    socketRef.current.emit('unsubscribe', formattedSymbol);
    dispatch({ type: 'REMOVE_SYMBOL', payload: formattedSymbol });
  };

  return (
    <MarketContext.Provider value={{ state, subscribe, unsubscribe }}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
}
