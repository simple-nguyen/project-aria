import { useState, useCallback } from 'react';
import AllChart from './AllChart';
import SymbolTabs from './SymbolTabs';
import { useMarketError } from '../hooks/useMarketData';
import { AVAILABLE_SYMBOLS } from '../utils/symbols';

export default function Dashboard() {
  const { error, isConnected } = useMarketError();
  const [activeSymbol, setActiveSymbol] = useState<string>(AVAILABLE_SYMBOLS[0]);

  const handleSymbolChange = useCallback((symbol: string) => {
    setActiveSymbol(symbol);
  }, []);

  console.log('[DASHBOARD] Initialised');

  return (
    <div className="min-h-screen bg-secondary">
      <div className="container mx-auto px-4 py-8 space-y-2">
        {!isConnected && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg">
            Connecting to market data service...
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <SymbolTabs
          activeSymbol={activeSymbol}
          onSymbolChange={handleSymbolChange}
          tickers={AVAILABLE_SYMBOLS}
        />

        <div className="w-full">
          <AllChart symbol={activeSymbol} />
        </div>
      </div>
    </div>
  );
}
