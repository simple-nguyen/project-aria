import { render, screen } from '@testing-library/react';
import { describe, it, vi, beforeEach, expect } from 'vitest';
import OrderBookChart from '../../components/OrderBookChart';
import { OrderBook } from '@project-aria/shared';

// Mock market data
const mockOrderBook: OrderBook = {
  symbol: 'BTCUSDT',
  asks: [
    [49100, 1.0, 1.0],
    [49200, 2.5, 3.5],
  ],
  bids: [
    [49000, 1.5, 1.5],
    [48900, 2.0, 3.5],
  ],
};

const mockUseMarketOrderBook = vi.fn().mockReturnValue(mockOrderBook);

vi.mock('../../hooks/useMarketData', () => ({
  useMarketOrderBook: () => mockUseMarketOrderBook(),
}));

// Mock D3
vi.mock('d3', () => ({
  select: vi.fn(() => ({
    selectAll: vi.fn(() => ({
      data: vi.fn(() => ({
        enter: vi.fn(() => ({
          append: vi.fn(() => ({
            attr: vi.fn(() => ({
              style: vi.fn(),
            })),
          })),
        })),
        exit: vi.fn(() => ({
          remove: vi.fn(),
        })),
      })),
      attr: vi.fn(() => ({
        style: vi.fn(),
      })),
      style: vi.fn(),
      remove: vi.fn(),
    })),
    append: vi.fn(() => ({
      attr: vi.fn(() => ({
        style: vi.fn(),
        call: vi.fn(),
      })),
      call: vi.fn(),
    })),
    attr: vi.fn(() => ({
      append: vi.fn(),
    })),
  })),
  scaleLinear: vi.fn(() => ({
    domain: vi.fn(() => ({
      range: vi.fn(),
    })),
    range: vi.fn(),
  })),
  axisBottom: vi.fn(),
  axisLeft: vi.fn(),
  area: vi.fn(() => ({
    x: vi.fn(() => ({
      y0: vi.fn(() => ({
        y1: vi.fn(() => ({
          curve: vi.fn(),
        })),
      })),
    })),
  })),
  curveStep: vi.fn(),
}));

describe('OrderBookChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render order book chart', () => {
    render(<OrderBookChart symbol="BTCUSDT" />);
    expect(screen.getByTestId('order-book-chart')).toBeInTheDocument();
  });

  it('should display loading state when order book is undefined', () => {
    mockUseMarketOrderBook.mockReturnValueOnce(undefined);
    render(<OrderBookChart symbol="BTCUSDT" />);
    expect(screen.getByText('Loading order book...')).toBeInTheDocument();
  });
});
