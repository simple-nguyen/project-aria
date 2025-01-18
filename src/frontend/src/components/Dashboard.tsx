import React, { useState } from 'react';
import { useMarket } from '../context/MarketContext';
import TickerCard from './TickerCard';
import OrderBookChart from './OrderBookChart';
import TradeHistory from './TradeHistory';

export default function Dashboard() {
  const { state, subscribe, unsubscribe } = useMarket();
  const [newSymbol, setNewSymbol] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSymbol) {
      subscribe(newSymbol);
      setNewSymbol('');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Crypto Market Dashboard</h1>
      
      {state.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {state.error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="Enter symbol (e.g., BTCUSDT)"
            className="flex-1 p-2 border rounded"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Subscribe
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-6">
        {Array.from(state.subscribedSymbols).map((symbol) => {
          const ticker = state.tickers[symbol];
          const orderBook = state.orderBooks[symbol];
          const trades = state.trades[symbol] || [];

          return (
            <div key={symbol} className="space-y-4">
              {ticker && (
                <TickerCard 
                  data={ticker} 
                  onUnsubscribe={unsubscribe} 
                />
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orderBook && ticker && (
                  <div className="md:col-span-2">
                    <OrderBookChart 
                      data={orderBook} 
                      ticker={ticker}
                    />
                  </div>
                )}
                {trades.length > 0 && (
                  <div className="md:col-span-2">
                    <TradeHistory trades={trades} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
