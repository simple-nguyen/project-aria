import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { OrderBook, MarketTicker } from '@project-aria/shared';

interface OrderBookChartProps {
  data: OrderBook;
  ticker: MarketTicker;
  width?: number;
  height?: number;
}

interface DepthPoint {
  price: number;
  total: number;
  type: 'bid' | 'ask';
}

const DEPTH_DISTANCE_PERCENT = 0.001;

export default function OrderBookChart({ data, ticker, width = 600, height = 300 }: OrderBookChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data || !ticker) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    const currentPrice = parseFloat(ticker.lastPrice);
    const lowerBound = currentPrice * (1 - DEPTH_DISTANCE_PERCENT);
    const upperBound = currentPrice * (1 + DEPTH_DISTANCE_PERCENT);

    // Prepare data with cumulative totals
    const processOrders = (orders: [string, string][], type: 'bid' | 'ask'): DepthPoint[] => {
      let cumulative = 0;
      return orders
        .map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity),
        }))
        .filter(({ price }) => price >= lowerBound && price <= upperBound)
        .sort((a, b) => type === 'bid' ? b.price - a.price : a.price - b.price)
        .map(({ price, quantity }) => {
          cumulative += quantity;
          return {
            price,
            total: cumulative,
            type,
          };
        });
    };

    const bids = processOrders(data.bids, 'bid');
    const asks = processOrders(data.asks, 'ask');

    // Add start and end points for area charts
    if (bids.length > 0) {
      bids.push({
        price: lowerBound,
        total: bids[bids.length - 1].total,
        type: 'bid'
      });
    }

    if (asks.length > 0) {
      asks.push({
        price: upperBound,
        total: asks[asks.length - 1].total,
        type: 'ask'
      });
    }

    const allPoints = [...bids, ...asks];

    // Set up margins
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create scales
    const xScale = d3.scaleLinear()
      .domain([lowerBound, upperBound])
      .range([0, innerWidth])
      .nice();

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(allPoints, d => d.total) || 0])
      .range([innerHeight, 0])
      .nice();

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create chart group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create area generators
    const bidArea = d3.area<DepthPoint>()
      .x(d => xScale(d.price))
      .y0(innerHeight)
      .y1(d => yScale(d.total))
      .curve(d3.curveStepAfter);

    const askArea = d3.area<DepthPoint>()
      .x(d => xScale(d.price))
      .y0(innerHeight)
      .y1(d => yScale(d.total))
      .curve(d3.curveStepAfter);

    // Add areas
    g.append('path')
      .datum(bids)
      .attr('class', 'depth-bid')
      .attr('fill', '#22c55e')
      .attr('fill-opacity', 0.5)
      .attr('stroke', '#16a34a')
      .attr('stroke-width', 1)
      .attr('d', bidArea);

    g.append('path')
      .datum(asks)
      .attr('class', 'depth-ask')
      .attr('fill', '#ef4444')
      .attr('fill-opacity', 0.5)
      .attr('stroke', '#dc2626')
      .attr('stroke-width', 1)
      .attr('d', askArea);

    // Add current price line
    g.append('line')
      .attr('x1', xScale(currentPrice))
      .attr('x2', xScale(currentPrice))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#6b7280')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    // Add current price label
    g.append('text')
      .attr('x', xScale(currentPrice))
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#6b7280')
      .text(`Current: ${currentPrice.toFixed(2)}`);

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .append('text')
      .attr('x', innerWidth / 2)
      .attr('y', 35)
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .text('Price');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -innerHeight / 2)
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .text('Cumulative Size');

    // Add crosshair and tooltip
    const tooltip = d3.select('body')
      .selectAll('.depth-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'depth-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'white')
      .style('padding', '8px')
      .style('border', '1px solid #ddd')
      .style('border-radius', '4px')
      .style('pointer-events', 'none')
      .style('z-index', '10');

    const verticalLine = g.append('line')
      .attr('class', 'crosshair-vertical')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1)
      .style('display', 'none');

    const horizontalLine = g.append('line')
      .attr('class', 'crosshair-horizontal')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1)
      .style('display', 'none');

    // Add overlay for mouse events
    g.append('rect')
      .attr('class', 'overlay')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mousemove', (event) => {
        const [mouseX, mouseY] = d3.pointer(event);
        const price = xScale.invert(mouseX);
        const total = yScale.invert(mouseY);

        verticalLine
          .attr('x1', mouseX)
          .attr('x2', mouseX)
          .style('display', null);

        horizontalLine
          .attr('y1', mouseY)
          .attr('y2', mouseY)
          .style('display', null);

        const isBidSide = price < currentPrice;
        const points = isBidSide ? bids : asks;
        const nearestPoint = d3.least(points, d => Math.abs(d.price - price));

        if (nearestPoint) {
          const priceChange = ((price - currentPrice) / currentPrice * 100).toFixed(2);
          tooltip
            .style('visibility', 'visible')
            .style('top', (event.pageY - 10) + 'px')
            .style('left', (event.pageX + 10) + 'px')
            .html(`
              <div class="text-sm">
                <div class="font-semibold">${isBidSide ? 'Bid' : 'Ask'} Side</div>
                <div>Price: ${price.toFixed(2)} (${priceChange}%)</div>
                <div>Cumulative Size: ${nearestPoint.total.toFixed(6)}</div>
              </div>
            `);
        }
      })
      .on('mouseleave', () => {
        verticalLine.style('display', 'none');
        horizontalLine.style('display', 'none');
        tooltip.style('visibility', 'hidden');
      });

    // Add legend
    const legend = g.append('g')
      .attr('transform', `translate(${innerWidth - 100}, 20)`);

    legend.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', '#22c55e')
      .attr('fill-opacity', 0.5);

    legend.append('text')
      .attr('x', 25)
      .attr('y', 12)
      .text('Bids')
      .attr('font-size', '12px');

    legend.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('y', 20)
      .attr('fill', '#ef4444')
      .attr('fill-opacity', 0.5);

    legend.append('text')
      .attr('x', 25)
      .attr('y', 32)
      .text('Asks')
      .attr('font-size', '12px');

  }, [data, ticker, width, height]);

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Order Book Depth</h3>
      <div className="overflow-x-auto">
        <svg ref={svgRef} className="w-full" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${width} ${height}`} />
      </div>
    </div>
  );
}
