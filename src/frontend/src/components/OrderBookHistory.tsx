import { formatCrypto, formatFiat } from '../utils/parser';
import { useMarketOrderBook, useMarketPrecision } from '../hooks/useMarketData';

interface OrderBookHistoryProps {
  symbol: string;
}

export default function OrderBookHistory({ symbol }: OrderBookHistoryProps) {
  const orderbook = useMarketOrderBook(symbol);
  const precision = useMarketPrecision(symbol);

  const { bids, asks } = orderbook || { bids: [[0, 0, 0]], asks: [[0, 0, 0]] };

  const [, quote] = symbol.split('_');

  return (
    <div className="bg-primary p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 text-white">Order Book</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="text-left text-sm font-medium text-white pb-2">Price</th>
              <th className="text-right text-sm font-medium text-white pb-2">Amount</th>
              <th className="text-right text-sm font-medium text-white pb-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {asks
              .sort((a, b) => b[0] - a[0])
              .slice(-10)
              .map((ask, index) => (
                <tr key={index}>
                  <td className="text-left text-sm py-1 text-red-400">
                    {quote.includes('USD')
                      ? formatFiat(ask[0], { minimumFractionDigits: precision.price })
                      : formatCrypto(ask[0], { minimumFractionDigits: precision.amount })}
                  </td>
                  <td className="text-right text-sm py-1 text-white">
                    {quote.includes('USD')
                      ? formatCrypto(ask[1], { minimumFractionDigits: precision.amount })
                      : formatFiat(ask[1], { minimumFractionDigits: precision.amount })}
                  </td>
                  <td className="text-right text-sm py-1 text-white">
                    {quote.includes('USD')
                      ? formatFiat(ask[0] * ask[1], { minimumFractionDigits: 2 })
                      : formatCrypto(ask[0] * ask[1], { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            {bids.slice(0, 10).map((bid, index) => (
              <tr key={index}>
                <td className={`text-left text-sm py-1 text-green-400`}>
                  {quote.includes('USD')
                    ? formatFiat(bid[0], { minimumFractionDigits: precision.price })
                    : formatCrypto(bid[0], { minimumFractionDigits: precision.amount })}
                </td>
                <td className="text-right text-sm py-1 text-white">
                  {quote.includes('USD')
                    ? formatCrypto(bid[1], { minimumFractionDigits: precision.amount })
                    : formatFiat(bid[1], { minimumFractionDigits: precision.amount })}
                </td>
                <td className="text-right text-sm py-1 text-white">
                  {quote.includes('USD')
                    ? formatFiat(bid[0] * bid[1], { minimumFractionDigits: 2 })
                    : formatCrypto(bid[0] * bid[1], { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
