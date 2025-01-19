import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import SymbolTabs from '../../components/SymbolTabs';
import { AVAILABLE_SYMBOLS } from '../../utils/symbols';

// Mock useMarketActions hook
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
const mockTicker = {
  symbol: 'BTC_USDT',
  priceChangePercent: '2.5',
};

vi.mock('../../hooks/useMarketData', () => ({
  useMarketActions: () => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  }),
  useMarketTicker: () => mockTicker,
}));

describe('SymbolTabs', () => {
  const onSymbolChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all symbols', () => {
    render(
      <SymbolTabs
        activeSymbol={AVAILABLE_SYMBOLS[0]}
        onSymbolChange={onSymbolChange}
        tickers={AVAILABLE_SYMBOLS}
      />
    );

    AVAILABLE_SYMBOLS.forEach(symbol => {
      expect(screen.getByText(symbol.replace('_', '/'))).toBeInTheDocument();
    });
  });

  it('highlights active symbol', () => {
    const activeSymbol = AVAILABLE_SYMBOLS[1];
    render(
      <SymbolTabs
        activeSymbol={activeSymbol}
        onSymbolChange={onSymbolChange}
        tickers={AVAILABLE_SYMBOLS}
      />
    );

    const activeTab = screen.getByText(activeSymbol.replace('_', '/'));
    expect(activeTab.closest('button')).toHaveClass('border-yellow-500');
  });

  it('calls onSymbolChange when clicking a symbol', () => {
    render(
      <SymbolTabs
        activeSymbol={AVAILABLE_SYMBOLS[0]}
        onSymbolChange={onSymbolChange}
        tickers={AVAILABLE_SYMBOLS}
      />
    );

    const newSymbol = AVAILABLE_SYMBOLS[2];
    fireEvent.click(screen.getByText(newSymbol.replace('_', '/')));
    expect(onSymbolChange).toHaveBeenCalledWith(newSymbol);
  });

  it('subscribes to symbols on mount', () => {
    render(
      <SymbolTabs
        activeSymbol={AVAILABLE_SYMBOLS[0]}
        onSymbolChange={onSymbolChange}
        tickers={AVAILABLE_SYMBOLS}
      />
    );

    AVAILABLE_SYMBOLS.forEach(symbol => {
      expect(mockSubscribe).toHaveBeenCalledWith(symbol);
    });
  });

  it('unsubscribes from symbols on unmount', () => {
    const { unmount } = render(
      <SymbolTabs
        activeSymbol={AVAILABLE_SYMBOLS[0]}
        onSymbolChange={onSymbolChange}
        tickers={AVAILABLE_SYMBOLS}
      />
    );

    unmount();

    AVAILABLE_SYMBOLS.forEach(symbol => {
      expect(mockUnsubscribe).toHaveBeenCalledWith(symbol);
    });
  });
});
