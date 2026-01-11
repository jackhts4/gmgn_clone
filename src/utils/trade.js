import {
  getCurrentUser,
  updateUser,
  getAllUsers,
  addTransaction,
  getTokenByAddress,
  getPoolByToken,
  getSolPriceUSD,
} from './storage';
import { executeBuy, executeSell, getCurrentPrice } from './amm';
import { executeCopyBuys, executeCopySells, deductFromCopyPositions } from './copyTrading';

/**
 * Execute a buy trade for a user
 * @param {string} userId - User ID
 * @param {string} tokenAddress - Token address to buy
 * @param {number} solAmount - Amount of SOL to spend
 * @param {boolean} fromCopyTrading - Is this from copy trading?
 * @param {string} copiedFrom - If copy trade, who was copied
 */
export const buyTokens = (userId, tokenAddress, solAmount, fromCopyTrading = false, copiedFrom = null) => {
  const users = getAllUsers();
  const user = users[userId];
  const solPriceUSD = getSolPriceUSD();
  
  if (!user) throw new Error('User not found');
  if (user.solBalance < solAmount) throw new Error('Insufficient SOL balance');
  
  // Execute AMM buy (this updates the pool)
  const tradeResult = executeBuy(tokenAddress, solAmount);
  
  // Update user's SOL balance
  user.solBalance -= solAmount;
  
  // Update user's token balance
  if (!user.tokens) {
    user.tokens = {};
  }
  if (!user.tokens[tokenAddress]) {
    user.tokens[tokenAddress] = {
      amount: 0,
      totalCostUSD: 0,
    };
  }
  
  // Calculate new average buy price in USD
  const currentHolding = user.tokens[tokenAddress];
  const totalTokens = currentHolding.amount + tradeResult.tokensOut;
  const newCostUSD = solAmount * solPriceUSD;
  const totalCostUSD = (currentHolding.totalCostUSD || 0) + newCostUSD;
  
  user.tokens[tokenAddress] = {
    amount: totalTokens,
    totalCostUSD: totalCostUSD,
    avgBuyPriceUSD: totalCostUSD / totalTokens,
  };
  
  // Save user
  updateUser(userId, user);
  
  // Record transaction with USD values
  const token = getTokenByAddress(tokenAddress);
  const transaction = addTransaction({
    userId,
    type: 'buy',
    tokenAddress,
    tokenSymbol: token?.symbol || 'UNKNOWN',
    tokenAmount: tradeResult.tokensOut,
    solAmount,
    amountUSD: solAmount * solPriceUSD,
    priceUSD: tradeResult.executionPrice * solPriceUSD,
    priceImpact: tradeResult.priceImpact,
    marketCapUSD: tradeResult.newSolReserve * solPriceUSD,
    fromCopyTrading,
    copiedFrom,
  });
  
  return {
    transaction,
    tradeResult,
    newBalance: user.solBalance,
    newTokenAmount: user.tokens[tokenAddress].amount,
  };
};

/**
 * Execute a sell trade for a user
 */
export const sellTokens = (userId, tokenAddress, tokenAmount, fromCopyTrading = false, copiedFrom = null) => {
  const users = getAllUsers();
  const user = users[userId];
  const solPriceUSD = getSolPriceUSD();
  
  if (!user) throw new Error('User not found');
  if (!user.tokens?.[tokenAddress] || user.tokens[tokenAddress].amount < tokenAmount) {
    throw new Error('Insufficient token balance');
  }
  
  // Store holding before sell for copy trading calculation
  const holdingBeforeSell = user.tokens[tokenAddress].amount;
  
  // Execute AMM sell (this updates the pool)
  const tradeResult = executeSell(tokenAddress, tokenAmount);
  
  // Update user's token balance and cost basis proportionally
  const holding = user.tokens[tokenAddress];
  const sellRatio = tokenAmount / holding.amount;
  holding.totalCostUSD = (holding.totalCostUSD || 0) * (1 - sellRatio);
  holding.amount -= tokenAmount;
  
  // If user sold all tokens, remove from portfolio
  if (holding.amount <= 0) {
    delete user.tokens[tokenAddress];
  } else {
    // Recalculate average price
    holding.avgBuyPriceUSD = holding.totalCostUSD / holding.amount;
  }
  
  // Update user's SOL balance
  user.solBalance += tradeResult.solOut;
  
  // Save user
  updateUser(userId, user);
  
  // Record transaction with USD values
  const token = getTokenByAddress(tokenAddress);
  const transaction = addTransaction({
    userId,
    type: 'sell',
    tokenAddress,
    tokenSymbol: token?.symbol || 'UNKNOWN',
    tokenAmount,
    solAmount: tradeResult.solOut,
    amountUSD: tradeResult.solOut * solPriceUSD,
    priceUSD: tradeResult.executionPrice * solPriceUSD,
    priceImpact: tradeResult.priceImpact,
    marketCapUSD: tradeResult.newSolReserve * solPriceUSD,
    fromCopyTrading,
    copiedFrom,
  });
  
  return {
    transaction,
    tradeResult,
    newBalance: user.solBalance,
    newTokenAmount: user.tokens[tokenAddress]?.amount || 0,
    holdingBeforeSell, // Return for copy trading
  };
};

/**
 * Execute trade with copy trading support
 * This is the main function that should be called from UI
 */
export const executeTrade = (userId, type, tokenAddress, amount) => {
  // Execute the original user's trade
  let result;
  if (type === 'buy') {
    result = buyTokens(userId, tokenAddress, amount, false, null);
    
    // Trigger copy buys for all followers
    try {
      executeCopyBuys(userId, tokenAddress);
    } catch (error) {
      console.error('Failed to execute copy buys:', error);
    }
  } else {
    result = sellTokens(userId, tokenAddress, amount, false, null);
    
    // Deduct from user's own copy positions and trigger copy sells
    try {
      deductFromCopyPositions(userId, tokenAddress, amount);
      
      if (result.holdingBeforeSell) {
        executeCopySells(userId, tokenAddress, amount, result.holdingBeforeSell);
      }
    } catch (error) {
      console.error('Failed to execute copy sells:', error);
    }
  }
  
  return result;
};

/**
 * Calculate user's portfolio value in SOL
 */
export const calculatePortfolioValue = (userId) => {
  const users = getAllUsers();
  const user = users[userId];
  
  if (!user) return 0;
  
  let totalValue = user.solBalance;
  
  // Add value of all tokens
  Object.entries(user.tokens || {}).forEach(([tokenAddress, holding]) => {
    const currentPrice = getCurrentPrice(tokenAddress);
    totalValue += holding.amount * currentPrice;
  });
  
  return totalValue;
};

/**
 * Calculate user's profit/loss
 */
export const calculateProfitLoss = (userId) => {
  const solPriceUSD = getSolPriceUSD();
  const currentValueSOL = calculatePortfolioValue(userId);
  const currentValueUSD = currentValueSOL * solPriceUSD;
  const initialValueUSD = 100 * solPriceUSD; // Everyone starts with 100 SOL
  
  return {
    absoluteUSD: currentValueUSD - initialValueUSD,
    percentage: ((currentValueUSD - initialValueUSD) / initialValueUSD) * 100,
  };
};

/**
 * Get user's portfolio summary
 */
export const getPortfolioSummary = (userId) => {
  const users = getAllUsers();
  const user = users[userId];
  const solPriceUSD = getSolPriceUSD();
  
  if (!user) return null;
  
  const totalValueSOL = calculatePortfolioValue(userId);
  const totalValueUSD = totalValueSOL * solPriceUSD;
  const profitLoss = calculateProfitLoss(userId);
  
  const tokens = Object.entries(user.tokens || {}).map(([tokenAddress, holding]) => {
    const token = getTokenByAddress(tokenAddress);
    const currentPriceSOL = getCurrentPrice(tokenAddress);
    const currentPriceUSD = currentPriceSOL * solPriceUSD;
    const currentValueUSD = holding.amount * currentPriceUSD;
    const costBasisUSD = holding.totalCostUSD || (holding.amount * (holding.avgBuyPriceUSD || 0));
    const pnlUSD = currentValueUSD - costBasisUSD;
    const pnlPercent = costBasisUSD > 0 ? (pnlUSD / costBasisUSD) * 100 : 0;
    
    return {
      ...token,
      address: tokenAddress,
      amount: holding.amount,
      avgBuyPriceUSD: holding.avgBuyPriceUSD || 0,
      currentPriceUSD,
      currentValueUSD,
      pnlUSD,
      pnlPercent,
    };
  });
  
  return {
    solBalance: user.solBalance,
    totalValueSOL,
    totalValueUSD,
    profitLoss,
    tokens,
  };
};
