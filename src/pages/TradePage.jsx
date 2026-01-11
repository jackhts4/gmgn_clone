import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTokenByAddress, getPoolByToken, getSolPriceUSD } from '../utils/storage';
import { getCurrentPrice, formatNumber, formatSOL, formatLargeNumber } from '../utils/amm';
import { generateInitialTransactions, calculate24hVolume, calculate24hTxCount, calculate24hChange } from '../utils/transactions';
import PriceChart from '../components/trade/PriceChart';
import TradeForm from '../components/trade/TradeForm';
import TransactionTable from '../components/trade/TransactionTable';

function TradePage() {
  const { tokenAddress } = useParams();
  const [token, setToken] = useState(null);
  const [pool, setPool] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const solPriceUSD = getSolPriceUSD();

  const loadData = () => {
    const tokenData = getTokenByAddress(tokenAddress);
    const poolData = getPoolByToken(tokenAddress);
    const price = getCurrentPrice(tokenAddress);

    setToken(tokenData);
    setPool(poolData);
    setCurrentPrice(price);
    setUpdateTrigger(prev => prev + 1); // Trigger chart update
  };

  useEffect(() => {
    // Check if we need to generate initial transactions
    const existingTx = localStorage.getItem('gmgn_transactions');
    const txGenerated = localStorage.getItem('gmgn_txGenerated');
    
    if (!txGenerated) {
      console.log('First time setup - generating transactions...');
      generateInitialTransactions();
      localStorage.setItem('gmgn_txGenerated', 'true');
    }
    
    loadData();
  }, [tokenAddress]);

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-white">Token not found</div>
      </div>
    );
  }

  // Calculate USD price and market cap
  const priceInUsd = currentPrice * solPriceUSD;
  // Market cap = Total SOL in pool × SOL price in USD
  const marketCapUsd = (pool?.solReserve || 0) * solPriceUSD;
  
  // Calculate real 24h stats from transactions
  const volume24hSol = calculate24hVolume(tokenAddress);
  const volume24hUsd = volume24hSol * solPriceUSD;
  const txCount24h = calculate24hTxCount(tokenAddress);
  const change24h = calculate24hChange(tokenAddress);

  return (
    <div className="container mx-auto px-4 py-6 pb-20 md:pb-6">
      {/* Back Button */}
      <Link 
        to="/" 
        className="inline-flex items-center text-gray-400 hover:text-white mb-4 transition"
      >
        <span className="mr-2">←</span>
        Back to Market
      </Link>

      {/* Token Header */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-4xl">{token.icon}</div>
            <div>
              <h1 className="text-2xl font-bold text-white">{token.symbol}</h1>
              <p className="text-gray-400">{token.name}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              ${formatNumber(priceInUsd)}
            </div>
            <div className="text-sm text-gray-500">
              {formatNumber(currentPrice)} SOL
            </div>
            <div className={`text-sm ${change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}% (24h)
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-700">
          <div>
            <div className="text-xs text-gray-400 mb-1">Market Cap</div>
            <div className="text-white font-semibold">${formatLargeNumber(marketCapUsd)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">24h Volume</div>
            <div className="text-white font-semibold">${formatLargeNumber(volume24hUsd)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">24h Transactions</div>
            <div className="text-white font-semibold">{txCount24h}</div>
          </div>
        </div>
      </div>

      {/* Main Content: Chart + Trade Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Chart - Takes 2 columns on desktop */}
        <div className="lg:col-span-2">
          <PriceChart 
            tokenAddress={tokenAddress} 
            currentPrice={currentPrice}
            onDataUpdate={updateTrigger}
          />
        </div>

        {/* Trade Form - Takes 1 column on desktop */}
        <div>
          <TradeForm 
            token={token} 
            currentPrice={currentPrice}
            onTradeComplete={loadData}
          />
        </div>
      </div>

      {/* Transaction Table - Full width */}
      <div>
        <TransactionTable 
          tokenAddress={tokenAddress}
          updateTrigger={updateTrigger}
        />
      </div>
    </div>
  );
}

export default TradePage;
