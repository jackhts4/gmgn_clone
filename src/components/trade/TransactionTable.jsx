import { getRecentTransactions } from '../../utils/transactions';
import { formatNumber, formatLargeNumber } from '../../utils/amm';
import { getSolPriceUSD } from '../../utils/storage';

function TransactionTable({ tokenAddress, updateTrigger }) {
  const transactions = getRecentTransactions(tokenAddress, 20);
  const solPriceUSD = getSolPriceUSD();

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Helper to get USD values (handles both old and new format)
  const getAmountUSD = (tx) => tx.amountUSD || (tx.solAmount * solPriceUSD);
  const getMarketCapUSD = (tx) => tx.marketCapUSD || (tx.marketCapSOL ? tx.marketCapSOL * solPriceUSD : 0);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2">Time</th>
              <th className="text-left py-2">Type</th>
              <th className="text-right py-2">Market Cap</th>
              <th className="text-right py-2">Amount</th>
              <th className="text-right py-2">USD</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 text-gray-400">
                  {formatTime(tx.timestamp)}
                </td>
                <td className="py-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    tx.type === 'buy' 
                      ? 'bg-green-500/20 text-green-500' 
                      : 'bg-red-500/20 text-red-500'
                  }`}>
                    {tx.type === 'buy' ? 'Buy' : 'Sell'}
                  </span>
                </td>
                <td className="text-right text-white">
                  ${formatLargeNumber(getMarketCapUSD(tx))}
                </td>
                <td className="text-right text-gray-300">
                  {formatNumber(tx.tokenAmount)}
                </td>
                <td className="text-right text-white">
                  ${formatLargeNumber(getAmountUSD(tx))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {transactions.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No transactions yet
          </div>
        )}
      </div>
    </div>
  );
}

export default TransactionTable;
