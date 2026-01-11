import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser, getUserTransactions, getSolPriceUSD } from '../utils/storage';
import { formatNumber, formatLargeNumber } from '../utils/amm';
import { getPortfolioSummary } from '../utils/trade';

function WalletPage() {
  const [user, setUser] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const solPriceUSD = getSolPriceUSD();

  const loadData = () => {
    const currentUser = getCurrentUser();
    setUser(currentUser);

    if (currentUser) {
      const summary = getPortfolioSummary(currentUser.id);
      setPortfolio(summary);

      const userTxs = getUserTransactions(currentUser.id);
      // Sort by timestamp descending (newest first)
      userTxs.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(userTxs);
    } else {
      setPortfolio(null);
      setTransactions([]);
    }
  };

  useEffect(() => {
    loadData();
    
    // Listen for auth changes
    const handleAuthChange = () => loadData();
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  // Not logged in state
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-6 pb-20 md:pb-6">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
          <p className="text-gray-400 mb-4">Please login to view your wallet</p>
        </div>
      </div>
    );
  }

  const totalValueUSD = portfolio?.totalValueUSD || 0;
  const profitLossUSD = portfolio?.profitLoss?.absoluteUSD || 0;
  const profitLossPercent = portfolio?.profitLoss?.percentage || 0;

  return (
    <div className="container mx-auto px-4 py-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Wallet</h1>
        <p className="text-gray-400">Your assets and transaction history</p>
      </div>

      {/* Portfolio Overview Card */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-gray-400 mb-1">Total Portfolio Value</div>
            <div className="text-3xl font-bold text-white">
              ${formatLargeNumber(totalValueUSD)}
            </div>
            <div className="text-sm text-gray-500">
              {portfolio?.totalValueSOL?.toFixed(4) || '0'} SOL
            </div>
          </div>
          <div className="mt-4 md:mt-0 md:text-right">
            <div className="text-sm text-gray-400 mb-1">Profit/Loss</div>
            <div className={`text-2xl font-bold ${profitLossUSD >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {profitLossUSD >= 0 ? '+' : '-'}${formatLargeNumber(Math.abs(profitLossUSD))}
            </div>
            <div className={`text-sm ${profitLossPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {profitLossPercent >= 0 ? '+' : ''}{profitLossPercent.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Assets Section */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Assets</h2>
        
        {/* SOL Balance */}
        <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg mb-3">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">◎</div>
            <div>
              <div className="font-semibold text-white">SOL</div>
              <div className="text-sm text-gray-400">Solana</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-white">
              {formatNumber(portfolio?.solBalance || 0)}
            </div>
            <div className="text-sm text-gray-400">
              ${formatLargeNumber((portfolio?.solBalance || 0) * solPriceUSD)}
            </div>
          </div>
        </div>

        {/* Token Holdings */}
        {portfolio?.tokens && portfolio.tokens.length > 0 && (
          <div className="space-y-2">
            {portfolio.tokens.map((token) => (
              <Link
                key={token.address}
                to={`/trade/${token.address}`}
                className="flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{token.icon || '🪙'}</div>
                  <div>
                    <div className="font-semibold text-white">{token.symbol}</div>
                    <div className="text-sm text-gray-400">{token.name}</div>
                    <div className={`text-xs ${token.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      PNL: {token.pnlUSD >= 0 ? '+' : '-'}${formatLargeNumber(Math.abs(token.pnlUSD))} ({token.pnlPercent >= 0 ? '+' : ''}{token.pnlPercent.toFixed(2)}%)
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-white">
                    {formatNumber(token.amount)}
                  </div>
                  <div className="text-sm text-gray-400">
                    ${formatLargeNumber(token.currentValueUSD)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Transaction History</h2>
        
        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                  <th className="pb-3 pr-4">Time</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Market Cap</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3">USD</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  // Handle both old and new format
                  const amountUSD = tx.amountUSD || (tx.solAmount * solPriceUSD);
                  const marketCapUSD = tx.marketCapUSD || (tx.marketCapSOL ? tx.marketCapSOL * solPriceUSD : 0);
                  
                  return (
                    <tr key={tx.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-3 pr-4 text-gray-400 text-sm">
                        {formatTime(tx.timestamp)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          tx.type === 'buy' 
                            ? 'bg-green-500/20 text-green-500' 
                            : 'bg-red-500/20 text-red-500'
                        }`}>
                          {tx.type === 'buy' ? 'Buy' : 'Sell'}
                        </span>
                        {tx.fromCopyTrading && (
                          <span className="ml-1 px-1 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                            COPY
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-white text-sm">
                        ${formatLargeNumber(marketCapUSD)}
                      </td>
                      <td className="py-3 pr-4 text-white">
                        <Link 
                          to={`/trade/${tx.tokenAddress}`}
                          className="hover:text-blue-400 transition"
                        >
                          {formatNumber(tx.tokenAmount)} {tx.tokenSymbol}
                        </Link>
                      </td>
                      <td className="py-3 text-white">
                        ${formatLargeNumber(amountUSD)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400">
            No transactions yet
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to format timestamp
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // Less than 1 minute
  if (diff < 60000) {
    const secs = Math.floor(diff / 1000);
    return `${secs}s`;
  }
  
  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m`;
  }
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h`;
  }
  
  // More than 24 hours - show date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

export default WalletPage;
