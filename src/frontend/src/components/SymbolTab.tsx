import { memo } from 'react';
import { useMarketTicker } from '../hooks/useMarketData';

interface SymbolTabProps {
  symbol: string;
  isActive: boolean;
  onClick: () => void;
}

function SymbolTab({ symbol, isActive, onClick }: SymbolTabProps) {
  const ticker = useMarketTicker(symbol);
  const priceChangePercent = ticker ? parseFloat(ticker.priceChangePercent) : 0;
  const isPriceUp = priceChangePercent >= 0;

  return (
    <button
      onClick={onClick}
      className={`
        whitespace-nowrap p-4 border-4 rounded-lg font-medium text-sm
        ${isActive
          ? 'border-yellow-500 text-yellow-600 bg-[rgba(255,255,50,0.1)]'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }
      `}
    >
      <span className="mr-2">{symbol.replace('_', '/')}</span>
      {ticker && (
        <span className={isPriceUp ? 'text-green-400' : 'text-red-400'}>
          {isPriceUp ? '↑' : '↓'} {Math.abs(priceChangePercent).toFixed(2)}%
        </span>
      )}
    </button>
  );
}

export default memo(SymbolTab);
