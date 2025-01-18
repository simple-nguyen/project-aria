import React, { useState } from 'react';
import { useMarket } from '../context/MarketContext';
import { MarketTicker } from '@project-aria/shared';

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

  const handleUnsubscribe = (symbol: string) => {
    unsubscribe(symbol);
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from(state.subscribedSymbols).map((symbol) => {
          const data: MarketTicker | undefined = state.marketData[symbol];
          return (
            <div key={symbol} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{symbol}</h2>
                <button
                  onClick={() => handleUnsubscribe(symbol)}
                  className="text-red-500 hover:text-red-600"
                >
                  Unsubscribe
                </button>
              </div>
              
              {data ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-gray-600">Last Price</p>
                      <p className="font-semibold">{data.lastPrice}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">24h Change</p>
                      <p className={`font-semibold ${
                        parseFloat(data.priceChangePercent) >= 0 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {data.priceChangePercent}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">24h High</p>
                      <p className="font-semibold">{data.highPrice}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">24h Low</p>
                      <p className="font-semibold">{data.lowPrice}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Volume</p>
                      <p className="font-semibold">{data.volume}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Quote Volume</p>
                      <p className="font-semibold">{data.quoteVolume}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-gray-600">Bid</p>
                        <p className="font-semibold">{data.bidPrice}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Ask</p>
                        <p className="font-semibold">{data.askPrice}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Loading data...</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
