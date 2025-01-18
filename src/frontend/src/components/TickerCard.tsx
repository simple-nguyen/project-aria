import { MarketTicker } from '@project-aria/shared';

interface TickerCardProps {
  data: MarketTicker;
  onUnsubscribe: (symbol: string) => void;
}

export default function TickerCard({ data, onUnsubscribe }: TickerCardProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{data.symbol}</h2>
        <button
          onClick={() => onUnsubscribe(data.symbol)}
          className="text-red-500 hover:text-red-600"
        >
          Unsubscribe
        </button>
      </div>
      
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
      </div>
    </div>
  );
}
