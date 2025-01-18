import { useRef, useEffect, memo, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useMarketOrderBook } from '../hooks/useMarketData';

interface OrderBookChartProps {
  symbol: string;
  aspectRatio?: number;
}

type DepthPoint = [number, number, number]; // price, size, total

const MARGIN = { top: 20, right: 30, bottom: 40, left: 40 };
const DEFAULT_ASPECT_RATIO = 2.5;

function OrderBookChart({ symbol, aspectRatio = DEFAULT_ASPECT_RATIO }: OrderBookChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const orderbook = useMarketOrderBook(symbol);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = Math.max(200, width / aspectRatio);
        setDimensions({ width, height });
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, [aspectRatio]);

  const chartWidth = dimensions.width - MARGIN.left - MARGIN.right;
  const chartHeight = dimensions.height - MARGIN.top - MARGIN.bottom;

  const { currentPrice, bids, asks, bounds, maxTotal } = useMemo(() => {
    if (!orderbook || !orderbook.asks || !orderbook.bids || orderbook.asks.length === 0 || orderbook.bids.length === 0) {
      return {
        currentPrice: 0,
        bids: [],
        asks: [],
        bounds: { lower: 0, upper: 0 },
        maxTotal: 0
      };
    }

    const currentPrice = orderbook.asks[0][0];
    const minPrice = Math.min(...orderbook.bids.map(d => d[0]));
    const maxPrice = Math.max(...orderbook.asks.map(d => d[0]));
    const padding = (maxPrice - minPrice) * 0.005;

    return {
      currentPrice,
      bids: orderbook.bids,
      asks: orderbook.asks,
      bounds: {
        lower: minPrice - padding,
        upper: maxPrice + padding
      },
      maxTotal: [...orderbook.bids, ...orderbook.asks].reduce((acc, d) => Math.max(acc, d[2]), 0) * 1.1
    };
  }, [orderbook]);

  useEffect(() => {
    if (!svgRef.current || !currentPrice || maxTotal === 0 || dimensions.width === 0) return;

    const xScale = d3.scaleLinear()
      .domain([bounds.lower, bounds.upper])
      .range([0, chartWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, maxTotal])
      .range([chartHeight, 0]);

    // Setup SVG with static elements
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Add static elements
    g.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale));

    g.append('g')
      .call(d3.axisLeft(yScale));

    // Create area generators
    const bidArea = d3.area<DepthPoint>()
      .x(d => xScale(d[0]))
      .y0(chartHeight)
      .y1(d => yScale(d[2]))
      .curve(d3.curveStep);

    const askArea = d3.area<DepthPoint>()
      .x(d => xScale(d[0]))
      .y0(chartHeight)
      .y1(d => yScale(d[2]))
      .curve(d3.curveStep);

    // Bid fill area
    g.append('path')
      .datum(bids)
      .attr('fill', 'rgba(74, 222, 128, 1)')
      .attr('d', bidArea);

    // Ask fill area
    g.append('path')
      .datum(asks)
      .attr('fill', 'rgba(248, 113, 113, 1)')
      .attr('d', askArea);

    // Price line
    g.append('line')
      .attr('x1', xScale(currentPrice))
      .attr('x2', xScale(currentPrice))
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .attr('stroke', '#999')
      .attr('stroke-dasharray', '4,4');

    // Price text
    g.append('text')
      .attr('x', xScale(currentPrice))
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .text(currentPrice.toFixed(2));

    g.selectAll('text').style('fill', 'white');
    g.selectAll('.domain, line').style("stroke", "white");

  }, [orderbook, dimensions, chartWidth, chartHeight, currentPrice, bounds, maxTotal, bids, asks]);

  return (
    <div ref={containerRef} className="bg-primary rounded-lg p-4 w-full">
      <svg 
        ref={svgRef} 
        style={{ 
          width: '100%',
          height: dimensions.height,
          maxWidth: '100%',
        }} 
      />
    </div>
  );
}

export default memo(OrderBookChart);