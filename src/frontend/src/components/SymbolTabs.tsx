import { memo, useEffect, useRef } from 'react';
import { AVAILABLE_SYMBOLS } from '../utils/symbols';
import SymbolTab from './SymbolTab';
import { useMarketActions } from '../hooks/useMarketData';

const SymbolTabs = ({ activeSymbol, onSymbolChange, tickers }: {
    activeSymbol: string;
    onSymbolChange: (symbol: string) => void;
    tickers: typeof AVAILABLE_SYMBOLS;
  }) => {
    const { subscribe, unsubscribe } = useMarketActions();
    const subscribedRef = useRef(false);

    useEffect(() => {
        if (!subscribedRef.current) {
        console.log('Subscribing to symbols...');
        AVAILABLE_SYMBOLS.forEach(symbol => subscribe(symbol));
        subscribedRef.current = true;
        }

        return () => {
        if (subscribedRef.current) {
            console.log('Unsubscribing from symbols...');
            AVAILABLE_SYMBOLS.forEach(symbol => unsubscribe(symbol));
            subscribedRef.current = false;
        }
        };
    }, [subscribe, unsubscribe]);

    return <div className="overflow-x-auto bg-primary p-4 rounded-lg shadow [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-sky-300 [&::-webkit-scrollbar-thumb]:bg-sky-500 [&::-webkit-scrollbar-thumb]:rounded-full">
      <div>
        <nav className="-mb-px flex space-x-8">
          {tickers.map((symbol) => (
            <SymbolTab
              key={symbol}
              symbol={symbol}
              isActive={symbol === activeSymbol}
              onClick={() => onSymbolChange(symbol)}
            />
          ))}
        </nav>
      </div>
    </div>
  };

  SymbolTabs.displayName = 'SymbolTabs';

  export default memo(SymbolTabs);