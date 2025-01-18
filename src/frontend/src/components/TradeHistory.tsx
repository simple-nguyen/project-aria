import { MarketTrade } from '@project-aria/shared';

interface TradeHistoryProps {
  trades: MarketTrade[];
}

export default function TradeHistory({ trades }: TradeHistoryProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="text-left text-sm font-medium text-gray-600 pb-2">Price</th>
              <th className="text-right text-sm font-medium text-gray-600 pb-2">Amount</th>
              <th className="text-right text-sm font-medium text-gray-600 pb-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.tradeId}>
                <td className="text-left text-sm py-1">{trade.price}</td>
                <td className="text-right text-sm py-1">{trade.quantity}</td>
                <td className="text-right text-sm py-1">
                  {new Date(trade.timestamp).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
