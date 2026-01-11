import { useState, useEffect } from 'react';
import { getCurrentUser } from '../utils/storage';
import { formatLargeNumber } from '../utils/amm';
import { 
  getLeaderboard, 
  followTrader, 
  unfollowTrader, 
  isFollowing,
  getFollowingSettings,
  getFollowingList,
  getUserCopyPositions
} from '../utils/copyTrading';
import { showToast } from '../components/common/Toast';

function CopyTradingPage() {
  const [user, setUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedTrader, setSelectedTrader] = useState(null);
  const [solAmount, setSolAmount] = useState('1');
  const [activeTab, setActiveTab] = useState('leaderboard'); // leaderboard | following | positions
  const [followingList, setFollowingList] = useState([]);
  const [copyPositions, setCopyPositions] = useState([]);

  const loadData = () => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLeaderboard(getLeaderboard());
    
    if (currentUser) {
      setFollowingList(getFollowingList(currentUser.id));
      setCopyPositions(getUserCopyPositions(currentUser.id));
    }
  };

  useEffect(() => {
    loadData();
    
    // Listen for auth changes
    const handleAuthChange = () => loadData();
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const handleFollow = () => {
    if (!user) {
      showToast('Please login to copy trade', 'error');
      return;
    }
    
    if (!selectedTrader) return;
    
    const amount = parseFloat(solAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid SOL amount', 'error');
      return;
    }
    
    try {
      followTrader(user.id, selectedTrader.userId, amount);
      showToast(`Now copying ${selectedTrader.username} with ${amount} SOL per trade`, 'success');
      setSelectedTrader(null);
      setSolAmount('1');
      loadData();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleUnfollow = (oderId) => {
    if (!user) return;
    
    try {
      unfollowTrader(user.id, oderId);
      showToast('Unfollowed successfully', 'success');
      loadData();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const checkIfFollowing = (oderId) => {
    if (!user) return false;
    return isFollowing(user.id, oderId);
  };

  const getFollowSettings = (oderId) => {
    if (!user) return null;
    return getFollowingSettings(user.id, oderId);
  };

  return (
    <div className="container mx-auto px-4 py-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Copy Trading</h1>
        <p className="text-gray-400">Follow top traders and automatically copy their trades</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 rounded-lg font-semibold transition ${
            activeTab === 'leaderboard'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Leaderboard
        </button>
        <button
          onClick={() => setActiveTab('following')}
          className={`px-4 py-2 rounded-lg font-semibold transition ${
            activeTab === 'following'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Following ({followingList.length})
        </button>
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-4 py-2 rounded-lg font-semibold transition ${
            activeTab === 'positions'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Positions ({copyPositions.length})
        </button>
      </div>

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                  <th className="px-4 py-3">Trader</th>
                  <th className="px-4 py-3 text-right">PNL</th>
                  <th className="px-4 py-3 text-right">24h Trades</th>
                  <th className="px-4 py-3 text-right">24h Volume</th>
                  <th className="px-4 py-3 text-right">Followers</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-400">
                      No traders yet. Be the first to trade!
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((trader, index) => {
                    const isCurrentUser = user?.id === trader.userId;
                    const following = checkIfFollowing(trader.userId);
                    const followSettings = getFollowSettings(trader.userId);
                    
                    return (
                      <tr 
                        key={trader.userId} 
                        className="border-b border-gray-700/50 hover:bg-gray-700/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500 text-sm w-6">#{index + 1}</span>
                            <div>
                              <div className="font-semibold text-white">
                                {trader.username}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs text-blue-400">(You)</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400">
                                {trader.totalTrades} total trades
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className={`font-semibold ${trader.pnlUSD >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {trader.pnlUSD >= 0 ? '+' : '-'}${formatLargeNumber(Math.abs(trader.pnlUSD))}
                          </div>
                          <div className={`text-xs ${trader.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {trader.pnlPercent >= 0 ? '+' : ''}{trader.pnlPercent.toFixed(2)}%
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          {trader.txCount1D}
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          ${formatLargeNumber(trader.volume1DUSD)}
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          {trader.followerCount}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isCurrentUser ? (
                            <span className="text-gray-500 text-sm">-</span>
                          ) : following ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-green-400">
                                {followSettings?.solAmount} SOL
                              </span>
                              <button
                                onClick={() => handleUnfollow(trader.userId)}
                                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition"
                              >
                                Unfollow
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSelectedTrader(trader)}
                              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                            >
                              Copy
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Following Tab */}
      {activeTab === 'following' && (
        <div className="bg-gray-800 rounded-lg p-4">
          {!user ? (
            <div className="text-center py-8 text-gray-400">
              Please login to see your following list
            </div>
          ) : followingList.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              You're not following any traders yet
            </div>
          ) : (
            <div className="space-y-3">
              {followingList.map((item) => (
                <div 
                  key={item.oderId}
                  className="flex items-center justify-between p-4 bg-gray-700 rounded-lg"
                >
                  <div>
                    <div className="font-semibold text-white">{item.username}</div>
                    <div className="text-sm text-gray-400">
                      Copying with {item.solAmount} SOL per trade
                    </div>
                    {item.stats && (
                      <div className={`text-sm ${item.stats.pnlUSD >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        PNL: {item.stats.pnlUSD >= 0 ? '+' : '-'}${formatLargeNumber(Math.abs(item.stats.pnlUSD))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleUnfollow(item.oderId)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                  >
                    Unfollow
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Positions Tab */}
      {activeTab === 'positions' && (
        <div className="bg-gray-800 rounded-lg p-4">
          {!user ? (
            <div className="text-center py-8 text-gray-400">
              Please login to see your copy positions
            </div>
          ) : copyPositions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No active copy trading positions
            </div>
          ) : (
            <div className="space-y-3">
              {copyPositions.map((position) => (
                <div 
                  key={position.id}
                  className="flex items-center justify-between p-4 bg-gray-700 rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{position.token?.icon || '🪙'}</span>
                      <div>
                        <div className="font-semibold text-white">
                          {position.token?.symbol || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-400">
                          Copied from {position.traderUsername}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">
                      {formatLargeNumber(position.remainingTokenAmount)} tokens
                    </div>
                    <div className="text-sm text-gray-400">
                      Entry: ${position.entryPriceUSD?.toFixed(8) || '0'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Copy Modal */}
      {selectedTrader && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-white mb-4">
              Copy {selectedTrader.username}
            </h2>
            
            <div className="mb-4 p-4 bg-gray-700 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">PNL</div>
                  <div className={`font-semibold ${selectedTrader.pnlUSD >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {selectedTrader.pnlUSD >= 0 ? '+' : '-'}${formatLargeNumber(Math.abs(selectedTrader.pnlUSD))}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">24h Volume</div>
                  <div className="text-white font-semibold">
                    ${formatLargeNumber(selectedTrader.volume1DUSD)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">24h Trades</div>
                  <div className="text-white font-semibold">{selectedTrader.txCount1D}</div>
                </div>
                <div>
                  <div className="text-gray-400">Followers</div>
                  <div className="text-white font-semibold">{selectedTrader.followerCount}</div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                SOL Amount Per Trade
              </label>
              <input
                type="number"
                value={solAmount}
                onChange={(e) => setSolAmount(e.target.value)}
                placeholder="1.0"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <p className="mt-2 text-xs text-gray-400">
                This amount of SOL will be used for each buy trade made by {selectedTrader.username}
              </p>
            </div>

            <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
              <p className="text-yellow-400 text-sm">
                ⚠️ When {selectedTrader.username} sells, you'll automatically sell the proportional amount of tokens you bought via copy trading.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedTrader(null);
                  setSolAmount('1');
                }}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleFollow}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
              >
                Start Copying
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CopyTradingPage;
