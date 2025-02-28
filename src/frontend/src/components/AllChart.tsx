import { memo } from 'react';
import OrderBookChart from './OrderBookChart';
import OrderBookHistory from './OrderBookHistory';
import TradeHistory from './TradeHistory';
import Ticker from './Ticker';

interface AllChartProps {
  symbol: string;
}

function AllChart({ symbol }: AllChartProps) {
  return (
    <div className="space-y-2">
      <Ticker symbol={symbol} />

      <div className="gap-2 grid grid-cols-1">
        <OrderBookChart symbol={symbol} aspectRatio={2.5} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <TradeHistory symbol={symbol} />
          <OrderBookHistory symbol={symbol} />
        </div>
      </div>
    </div>
  );
}

export default memo(AllChart);
