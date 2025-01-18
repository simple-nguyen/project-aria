import { memo } from 'react';
import { useMarketTicker, useMarketPrecision } from '../hooks/useMarketData';
import { formatCrypto, formatFiat } from '../utils/parser';

interface TickerProps {
  symbol: string;
}

function Ticker({ symbol }: TickerProps) {
  const ticker = useMarketTicker(symbol);
  const precision = useMarketPrecision(symbol);

  const [base, quote] = symbol.split('_');

  if (!ticker) {
    return (
      <div className="animate-pulse bg-primary rounded-lg shadow-lg p-4">
        <div className="h-8 bg-white-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-6 bg-white-200 rounded"></div>
          <div className="h-6 bg-white-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  const priceChangePercent = parseFloat(ticker.priceChangePercent);
  const priceChange = parseFloat(ticker.priceChange);
  const isPriceUp = priceChangePercent >= 0;

  return (
    <div className="bg-primary p-4 rounded-lg shadow">
      <div className="flex items-start justify-between flex-col sm:flex-row">
        <div className="flex items-center mb-4 sm:mb-0">
          <div className="text-2xl font-bold text-white">{symbol.replace('_', '/')}</div>
          <div className="flex items-center ml-5">
            <span className="text-xl font-semibold text-white top-[2px] relative">
              {quote.includes('USD') ? formatFiat(ticker.lastPrice, { minimumFractionDigits: precision.price }) : formatCrypto(ticker.lastPrice, { minimumFractionDigits: precision.price })}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-6 lg:gap-4 text-sm">
          <div>
            <p className="text-gray-600">24h Change</p>
            <p className={`font-medium ${isPriceUp ? 'text-green-400' : 'text-red-400'}`}>
              {priceChange} {isPriceUp ? '↑' : '↓'} {Math.abs(priceChangePercent).toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-gray-600">24h High</p>
            <p className="font-medium text-white">{quote.includes('USD') ? formatFiat(ticker.highPrice, { minimumFractionDigits: precision.price }) : formatCrypto(ticker.highPrice, { minimumFractionDigits: precision.price })}</p>
          </div>
          <div>
            <p className="text-gray-600">24h Low</p>
            <p className="font-medium text-white">{quote.includes('USD') ? formatFiat(ticker.lowPrice, { minimumFractionDigits: precision.price }) : formatCrypto(ticker.lowPrice, { minimumFractionDigits: precision.price })}</p>
          </div>
          <div>
            <p className="text-gray-600">{`24h Volume (${base})`}</p>
            <p className="font-medium text-white">{base.includes('USD') ? formatFiat(ticker.volume, { minimumFractionDigits: precision.amount }) : formatCrypto(ticker.volume, { minimumFractionDigits: precision.amount })}</p>
          </div>
          <div>
            <p className="text-gray-600">{`24h Volume (${quote})`}</p>
            <p className={`font-medium ${isPriceUp ? 'text-green-400' : 'text-red-400'}`}>
              ${quote.includes('USD') ? formatFiat(ticker.quoteVolume) : formatCrypto(ticker.quoteVolume)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(Ticker);
