import { memo } from 'react';
import { useMarketPrecision, useMarketTrades } from '../hooks/useMarketData';
import { formatFiat, formatCrypto } from '../utils/parser';

interface TradeHistoryProps {
  symbol: string;
}

function TradeHistory({ symbol }: TradeHistoryProps) {
  const trades = useMarketTrades(symbol);
  const precision = useMarketPrecision(symbol);

  return (
    <div className="bg-primary p-4 rounded-lg shadow">
      <h3 className="text-lg text-white font-semibold mb-4">Recent Trades</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="text-left text-sm font-medium text-white pb-2">Price</th>
              <th className="text-right text-sm font-medium text-white pb-2">Amount</th>
              <th className="text-right text-sm font-medium text-white pb-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {trades && trades.map((trade) => (
              <tr key={trade.tradeId}>
                <td className={`text-left text-sm ${trade.isBuyerMaker ? 'text-green-400' : 'text-red-400'} py-1`}>{formatFiat(trade.price, { minimumFractionDigits: precision.price})}</td>
                <td className="text-right text-sm text-white py-1">{formatCrypto(trade.quantity, { minimumFractionDigits: precision.amount })}</td>
                <td className="text-right text-sm text-white py-1">
                  {new Date(trade.timestamp).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    hour12: false,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export default memo(TradeHistory);