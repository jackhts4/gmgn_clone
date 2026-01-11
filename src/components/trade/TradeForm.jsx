import { useState, useEffect } from 'react';
import { calculateBuyAmount, calculateSellAmount, formatNumber } from '../../utils/amm';
import { getCurrentUser } from '../../utils/storage';
import { executeTrade } from '../../utils/trade';
import { showToast } from '../common/Toast';

function TradeForm({ token, currentPrice, onTradeComplete }) {
  const [activeTab, setActiveTab] = useState('buy'); // 'buy' or 'sell'
  const [amount, setAmount] = useState('');
  const [user, setUser] = useState(null);
  const [calculation, setCalculation] = useState(null);

  // Load user on mount and when needed
  const loadUser = () => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
  };

  useEffect(() => {
    loadUser();
    
    // Listen for auth changes
    const handleAuthChange = () => loadUser();
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  useEffect(() => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setCalculation(null);
      return;
    }

    try {
      if (activeTab === 'buy') {
        const result = calculateBuyAmount(token.address, parseFloat(amount));
        setCalculation(result);
      } else {
        const result = calculateSellAmount(token.address, parseFloat(amount));
        setCalculation(result);
      }
    } catch (error) {
      console.error('Calculation error:', error);
      setCalculation(null);
    }
  }, [amount, activeTab, token.address]);

  const handleTrade = () => {
    // Reload user right before trading
    const freshUser = getCurrentUser();
    
    if (!freshUser) {
      showToast('Please login to trade', 'error');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      executeTrade(freshUser.id, activeTab, token.address, parseFloat(amount));
      showToast(`${activeTab === 'buy' ? 'Bought' : 'Sold'} ${token.symbol} successfully!`, 'success');
      setAmount('');
      loadUser(); // Reload user to update balance display
      if (onTradeComplete) onTradeComplete();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const userBalance = user?.solBalance || 0;
  const userTokenBalance = user?.tokens?.[token.address]?.amount || 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('buy')}
          className={`flex-1 py-3 rounded-lg font-semibold transition ${
            activeTab === 'buy'
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setActiveTab('sell')}
          className={`flex-1 py-3 rounded-lg font-semibold transition ${
            activeTab === 'sell'
              ? 'bg-red-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Balance Display */}
      <div className="mb-4 p-3 bg-gray-700 rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">
            {activeTab === 'buy' ? 'SOL Balance' : `${token.symbol} Balance`}
          </span>
          <span className="text-white font-semibold">
            {activeTab === 'buy' 
              ? `${userBalance.toFixed(4)} SOL`
              : `${formatNumber(userTokenBalance)} ${token.symbol}`
            }
          </span>
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">
          {activeTab === 'buy' ? 'Amount (SOL)' : `Amount (${token.symbol})`}
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Calculation Display */}
      {calculation && (
        <div className="mb-4 p-3 bg-gray-700 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">You'll receive</span>
            <span className="text-white font-semibold">
              {activeTab === 'buy' 
                ? `${formatNumber(calculation.tokensOut)} ${token.symbol}`
                : `${calculation.solOut.toFixed(4)} SOL`
              }
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Price</span>
            <span className="text-white">
              {formatNumber(calculation.executionPrice, 8)} SOL
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Price Impact</span>
            <span className={calculation.priceImpact >= 0 ? 'text-green-500' : 'text-red-500'}>
              {calculation.priceImpact >= 0 ? '+' : ''}{calculation.priceImpact.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Quick Amount Buttons */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {['25%', '50%', '75%', '100%'].map((percent) => (
          <button
            key={percent}
            onClick={() => {
              const value = activeTab === 'buy' ? userBalance : userTokenBalance;
              const percentage = parseInt(percent) / 100;
              setAmount((value * percentage).toString());
            }}
            className="py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition"
          >
            {percent}
          </button>
        ))}
      </div>

      {/* Trade Button */}
      <button
        onClick={handleTrade}
        className={`w-full py-4 rounded-lg font-bold text-lg transition ${
          activeTab === 'buy'
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {activeTab === 'buy' ? 'Buy' : 'Sell'} {token.symbol}
      </button>
    </div>
  );
}

export default TradeForm;
