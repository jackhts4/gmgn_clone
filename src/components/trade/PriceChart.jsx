import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { buildOHLCFromTransactions } from '../../utils/transactions';

function PriceChart({ tokenAddress, currentPrice, onDataUpdate }) {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const [interval, setInterval] = useState(300); // Default 5 minutes (300 seconds)

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Custom price formatter for Y-axis - USD format
    const priceFormatter = (price) => {
      if (price === 0 || !price) return '$0';
      
      // For very small numbers, use subscript notation
      if (price < 0.0001 && price > 0) {
        const str = price.toExponential();
        const [coefficient, exponent] = str.split('e');
        const exp = Math.abs(parseInt(exponent));
        
        if (exp > 3) {
          let sig = parseFloat(coefficient).toFixed(3).replace('.', '').replace(/^1/, '');
          sig = sig.replace(/0+$/, '');
          if (sig.length === 0) sig = '0';
          
          const zeroCount = exp - 1;
          const subscriptMap = {
            '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
            '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
          };
          
          const subscript = zeroCount.toString().split('').map(d => subscriptMap[d]).join('');
          return `$0.0${subscript}${sig}`;
        }
      }
      
      if (price < 1) return '$' + price.toFixed(8).replace(/\.?0+$/, '');
      if (price < 1000) return '$' + price.toFixed(2);
      if (price < 1000000) return '$' + (price / 1000).toFixed(2) + 'K';
      return '$' + (price / 1000000).toFixed(2) + 'M';
    };

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#1f2937' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      timeScale: {
        borderColor: '#4b5563',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#4b5563',
      },
      localization: {
        priceFormatter: priceFormatter,
      },
    });

    chartRef.current = chart;

    // Add candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Add volume series on separate scale
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume', // Use separate scale for volume
    });

    // Configure volume scale to be at bottom 20%
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8, // Volume takes bottom 20%
        bottom: 0,
      },
    });

    // Get OHLC data (already in USD)
    const ohlcData = buildOHLCFromTransactions(tokenAddress, interval);
    
    if (ohlcData.length > 0) {
      // Set candlestick data
      candlestickSeries.setData(ohlcData);
      
      // Create volume data from OHLC
      const volumeData = ohlcData.map(candle => ({
        time: candle.time,
        value: candle.volume || 0,
        color: candle.close >= candle.open ? '#10b98180' : '#ef444480', // Green/red with transparency
      }));
      
      volumeSeries.setData(volumeData);
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [tokenAddress, onDataUpdate, interval]); // Re-render when interval changes

  const intervals = [
    { label: '1m', seconds: 60 },
    { label: '5m', seconds: 300 },
    { label: '15m', seconds: 900 },
    { label: '1h', seconds: 3600 },
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Price Chart (USD)</h3>
        <div className="flex gap-2">
          {intervals.map(int => (
            <button
              key={int.label}
              onClick={() => setInterval(int.seconds)}
              className={`px-3 py-1 text-sm rounded transition ${
                interval === int.seconds
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              {int.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={chartContainerRef} />
    </div>
  );
}

export default PriceChart;
