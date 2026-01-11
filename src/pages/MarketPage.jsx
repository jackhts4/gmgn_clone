import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllTokens, getSolPriceUSD, getLiquidityPools } from '../utils/storage';
import { getCurrentPrice, formatNumber, formatLargeNumber } from '../utils/amm';
import { calculate24hVolume, calculate24hChange } from '../utils/transactions';

function MarketPage() {
  const [tokens, setTokens] = useState([]);
  const solPriceUSD = getSolPriceUSD();

  useEffect(() => {
    // Load tokens from storage
    const allTokens = getAllTokens();

    // Calculate current price for each token
    const tokensWithPrice = allTokens.map(token => {
      const priceInSol = getCurrentPrice(token.address);
      const priceInUsd = priceInSol * solPriceUSD;
      
      // Get pool data
      const pool = getLiquidityPools()[token.address];
      
      // Market cap = Total SOL in pool × SOL price in USD
      const marketCapUsd = (pool?.solReserve || 0) * solPriceUSD;
      
      // Calculate real 24h volume from transactions
      const volume24hSol = calculate24hVolume(token.address);
      const volume24hUsd = volume24hSol * solPriceUSD;
      
      // Calculate real 24h price change
      const change24h = calculate24hChange(token.address);
      
      return {
        ...token,
        priceInSol,
        priceInUsd,
        marketCapUsd,
        volume24hUsd,
        change24h,
      };
    });

    // Sort by market cap (highest first)
    tokensWithPrice.sort((a, b) => b.marketCapUsd - a.marketCapUsd);

    setTokens(tokensWithPrice);
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Market</h1>
        <p className="text-gray-400">Explore trending tokens</p>
      </div>

      {/* Search bar placeholder */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search tokens..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Token List */}
      <div className="space-y-3">
        {tokens.map(token => (
          <Link
            key={token.address}
            to={`/trade/${token.address}`}
            className="block bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition border border-gray-700"
          >
            <div className="flex items-center justify-between">
              {/* Token Info */}
              <div className="flex items-center space-x-3 flex-1">
                <div className="text-3xl">{token.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-white">{token.symbol}</div>
                  <div className="text-sm text-gray-400">{token.name}</div>
                </div>
              </div>

              {/* Price & Change */}
              <div className="text-right mr-4">
                <div className="font-semibold text-white">
                  ${formatNumber(token.priceInUsd)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatNumber(token.priceInSol)} SOL
                </div>
                <div className={`text-sm ${token.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Market Cap: </span>
                <span className="text-gray-300">${formatLargeNumber(token.marketCapUsd)}</span>
              </div>
              <div>
                <span className="text-gray-400">24h Vol: </span>
                <span className="text-gray-300">${formatLargeNumber(token.volume24hUsd)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Empty state if no tokens */}
      {tokens.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          No tokens found
        </div>
      )}
    </div>
  );
}

export default MarketPage;
