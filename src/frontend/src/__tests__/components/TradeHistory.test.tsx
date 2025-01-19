import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import TradeHistory from '../../components/TradeHistory';
import { MarketTrade } from '@project-aria/shared';

// Mock market data
const mockTrades: MarketTrade[] = [
  {
    symbol: 'BTCUSDT',
    tradeId: 1,
    price: '49000',
    quantity: '1.5',
    timestamp: new Date('2025-01-19T07:00:00.000Z').getTime(),
    isBuyerMaker: false,
  },
  {
    symbol: 'BTCUSDT',
    tradeId: 2,
    price: '48900',
    quantity: '2.0',
    timestamp: new Date('2025-01-19T07:00:01.000Z').getTime(),
    isBuyerMaker: true,
  },
];

const mockUseMarketTrades = vi.fn().mockReturnValue(mockTrades);
const mockUseMarketPrecision = vi.fn().mockReturnValue({ price: 2, amount: 8 });

vi.mock('../../hooks/useMarketData', () => ({
  useMarketTrades: () => mockUseMarketTrades(),
  useMarketPrecision: () => mockUseMarketPrecision(),
}));

// Mock formatters
vi.mock('../../utils/parser', () => ({
  formatFiat: (value: string, options: { minimumFractionDigits: number }) =>
    parseFloat(value).toFixed(options.minimumFractionDigits),
  formatCrypto: (value: string, options: { minimumFractionDigits: number }) =>
    parseFloat(value).toFixed(options.minimumFractionDigits),
}));

describe('TradeHistory', () => {
  it('renders trade history table', () => {
    render(<TradeHistory symbol="BTCUSDT" />);
    expect(screen.getByText('Recent Trades')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
  });

  it('displays trades with correct formatting', () => {
    render(<TradeHistory symbol="BTCUSDT" />);

    // Check prices are displayed with correct color
    const prices = screen.getAllByRole('cell');
    expect(prices[0]).toHaveClass('text-red-400'); // Sell trade
    expect(prices[3]).toHaveClass('text-green-400'); // Buy trade

    // Check formatted values
    expect(screen.getByText('49000.00')).toBeInTheDocument();
    expect(screen.getByText('48900.00')).toBeInTheDocument();
    expect(screen.getByText('1.50000000')).toBeInTheDocument();
    expect(screen.getByText('2.00000000')).toBeInTheDocument();

    // Check times are displayed
    expect(screen.getByText('15:00:00')).toBeInTheDocument();
    expect(screen.getByText('15:00:01')).toBeInTheDocument();
  });

  it('displays empty state when trades array is empty', () => {
    mockUseMarketTrades.mockReturnValueOnce([]);
    render(<TradeHistory symbol="BTCUSDT" />);
    expect(screen.queryByRole('cell')).not.toBeInTheDocument();
  });

  it('displays loading state when trades are undefined', () => {
    mockUseMarketTrades.mockReturnValueOnce(undefined);
    render(<TradeHistory symbol="BTCUSDT" />);
    expect(screen.queryByRole('cell')).not.toBeInTheDocument();
  });
});
