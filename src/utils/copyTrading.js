import { 
  getAllUsers, 
  updateUser, 
  getTokenByAddress,
  getSolPriceUSD,
  addTransaction
} from './storage';
import { executeBuy, executeSell } from './amm';

const COPY_POSITIONS_KEY = 'gmgn_copy_positions';

// ============ COPY POSITIONS CRUD ============

/**
 * Get all copy positions
 */
export const getAllCopyPositions = () => {
  return JSON.parse(localStorage.getItem(COPY_POSITIONS_KEY) || '[]');
};

/**
 * Save all copy positions
 */
const saveCopyPositions = (positions) => {
  localStorage.setItem(COPY_POSITIONS_KEY, JSON.stringify(positions));
};

/**
 * Create a new copy position
 */
export const createCopyPosition = (data) => {
  const positions = getAllCopyPositions();
  const position = {
    id: `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...data,
    timestamp: Date.now(),
    status: 'active'
  };
  positions.push(position);
  saveCopyPositions(positions);
  return position;
};

/**
 * Update a copy position
 */
export const updateCopyPosition = (positionId, updates) => {
  const positions = getAllCopyPositions();
  const index = positions.findIndex(p => p.id === positionId);
  if (index !== -1) {
    positions[index] = { ...positions[index], ...updates };
    saveCopyPositions(positions);
  }
};

/**
 * Get copy positions with filters
 */
export const getCopyPositions = ({ traderId, followerId, tokenAddress, status } = {}) => {
  let positions = getAllCopyPositions();
  
  if (traderId) positions = positions.filter(p => p.traderId === traderId);
  if (followerId) positions = positions.filter(p => p.followerId === followerId);
  if (tokenAddress) positions = positions.filter(p => p.tokenAddress === tokenAddress);
  if (status) positions = positions.filter(p => p.status === status);
  
  return positions;
};

// ============ FOLLOW/UNFOLLOW (BI-DIRECTIONAL) ============

/**
 * Follow a trader
 * Stores data in BOTH:
 * 1. User's "following" object: { traderId: { solAmount, followedAt } }
 * 2. Trader's "followers" object: { oderId: { solAmount, followedAt } }
 */
export const followTrader = (userId, traderId, solAmount) => {
  if (userId === traderId) {
    throw new Error("You cannot follow yourself");
  }
  if (solAmount <= 0) {
    throw new Error("SOL amount must be greater than 0");
  }
  
  const users = getAllUsers();
  const user = users[userId];
  const trader = users[traderId];
  
  if (!user) throw new Error("User not found");
  if (!trader) throw new Error("Trader not found");
  
  const followData = {
    solAmount,
    followedAt: Date.now()
  };
  
  // 1. Add to user's following list
  if (!user.following) {
    user.following = {};
  }
  user.following[traderId] = followData;
  updateUser(userId, user);
  
  // 2. Add to trader's followers list
  if (!trader.followers) {
    trader.followers = {};
  }
  trader.followers[userId] = followData;
  updateUser(traderId, trader);
  
  console.log(`[CopyTrade] ${userId} now following ${traderId} with ${solAmount} SOL`);
  
  return followData;
};

/**
 * Unfollow a trader
 * Removes data from BOTH user's following and trader's followers
 */
export const unfollowTrader = (userId, traderId) => {
  const users = getAllUsers();
  const user = users[userId];
  const trader = users[traderId];
  
  if (!user) throw new Error("User not found");
  if (!user.following || !user.following[traderId]) {
    throw new Error("Not following this trader");
  }
  
  // 1. Remove from user's following list
  delete user.following[traderId];
  updateUser(userId, user);
  
  // 2. Remove from trader's followers list (if trader exists)
  if (trader && trader.followers && trader.followers[userId]) {
    delete trader.followers[userId];
    updateUser(traderId, trader);
  }
  
  console.log(`[CopyTrade] ${userId} unfollowed ${traderId}`);
};

/**
 * Get all followers of a trader (from trader's followers object)
 */
export const getFollowersOfTrader = (traderId) => {
  const users = getAllUsers();
  const trader = users[traderId];
  
  if (!trader || !trader.followers) {
    return [];
  }
  
  const followers = Object.entries(trader.followers).map(([oderId, data]) => ({
    followerId: oderId,
    solAmount: data.solAmount,
    followedAt: data.followedAt
  }));
  
  // Sort by followedAt (earliest first)
  followers.sort((a, b) => a.followedAt - b.followedAt);
  
  return followers;
};

/**
 * Get count of followers for a trader
 */
export const getFollowerCount = (traderId) => {
  const users = getAllUsers();
  const trader = users[traderId];
  return trader?.followers ? Object.keys(trader.followers).length : 0;
};

/**
 * Check if user is following a trader
 */
export const isFollowing = (userId, traderId) => {
  const users = getAllUsers();
  const user = users[userId];
  return user?.following?.[traderId] ? true : false;
};

/**
 * Get following settings for a trader
 */
export const getFollowingSettings = (userId, traderId) => {
  const users = getAllUsers();
  const user = users[userId];
  return user?.following?.[traderId] || null;
};

// ============ COPY TRADE EXECUTION ============

// Flag to prevent circular copy trading (User1 -> User2 -> User1 -> ...)
let isExecutingCopyTrade = false;

/**
 * Execute copy trades when a trader buys
 * Called after the trader's buy is executed
 * 
 * IMPORTANT: Copy trades do NOT trigger further copy trades (no circular copying)
 */
export const executeCopyBuys = (traderId, tokenAddress) => {
  // Prevent circular copy trading
  if (isExecutingCopyTrade) {
    console.log(`[CopyTrade] Skipping - already executing copy trade (preventing circular copy)`);
    return [];
  }
  
  const followers = getFollowersOfTrader(traderId);
  
  console.log(`[CopyTrade] Trader ${traderId} bought. Followers:`, followers);
  
  if (followers.length === 0) {
    console.log(`[CopyTrade] No followers to copy trade`);
    return [];
  }
  
  // Set flag to prevent circular copy trading
  isExecutingCopyTrade = true;
  
  const solPriceUSD = getSolPriceUSD();
  const token = getTokenByAddress(tokenAddress);
  const results = [];
  
  try {
    for (const follower of followers) {
      try {
        // Re-fetch user to get latest balance
        const users = getAllUsers();
        const followerUser = users[follower.followerId];
        
        console.log(`[CopyTrade] Processing follower ${follower.followerId}, solAmount: ${follower.solAmount}`);
        
        // Check if follower has enough SOL
        if (!followerUser) {
          console.log(`[CopyTrade] Follower ${follower.followerId} not found`);
          results.push({
            followerId: follower.followerId,
            success: false,
            reason: 'Follower not found'
          });
          continue;
        }
        
        if (followerUser.solBalance < follower.solAmount) {
          console.log(`[CopyTrade] Follower ${follower.followerId} insufficient balance: ${followerUser.solBalance} < ${follower.solAmount}`);
          results.push({
            followerId: follower.followerId,
            success: false,
            reason: 'Insufficient SOL balance'
          });
          continue;
        }
        
        // Execute buy for follower
        const tradeResult = executeBuy(tokenAddress, follower.solAmount);
        
        // Update follower's SOL balance
        followerUser.solBalance -= follower.solAmount;
        
        // Update follower's token balance
        if (!followerUser.tokens) {
          followerUser.tokens = {};
        }
        if (!followerUser.tokens[tokenAddress]) {
          followerUser.tokens[tokenAddress] = {
            amount: 0,
            totalCostUSD: 0,
          };
        }
        
        const holding = followerUser.tokens[tokenAddress];
        const newCostUSD = follower.solAmount * solPriceUSD;
        holding.amount += tradeResult.tokensOut;
        holding.totalCostUSD = (holding.totalCostUSD || 0) + newCostUSD;
        holding.avgBuyPriceUSD = holding.totalCostUSD / holding.amount;
        
        updateUser(follower.followerId, followerUser);
        
        // Record transaction
        addTransaction({
          userId: follower.followerId,
          type: 'buy',
          tokenAddress,
          tokenSymbol: token?.symbol || 'UNKNOWN',
          tokenAmount: tradeResult.tokensOut,
          solAmount: follower.solAmount,
          amountUSD: follower.solAmount * solPriceUSD,
          priceUSD: tradeResult.executionPrice * solPriceUSD,
          priceImpact: tradeResult.priceImpact,
          marketCapUSD: tradeResult.newSolReserve * solPriceUSD,
          fromCopyTrading: true,
          copiedFrom: traderId,
        });
        
        // Create copy position
        createCopyPosition({
          followerId: follower.followerId,
          traderId,
          tokenAddress,
          originalTokenAmount: tradeResult.tokensOut,
          remainingTokenAmount: tradeResult.tokensOut,
          solSpent: follower.solAmount,
          entryPriceUSD: tradeResult.executionPrice * solPriceUSD,
        });
        
        console.log(`[CopyTrade] Follower ${follower.followerId} bought ${tradeResult.tokensOut} tokens`);
        
        results.push({
          followerId: follower.followerId,
          success: true,
          tokensReceived: tradeResult.tokensOut
        });
        
      } catch (error) {
        console.error(`[CopyTrade] Error for follower ${follower.followerId}:`, error);
        results.push({
          followerId: follower.followerId,
          success: false,
          reason: error.message
        });
      }
    }
  } finally {
    // Always reset the flag
    isExecutingCopyTrade = false;
  }
  
  return results;
};

/**
 * Execute copy trades when a trader sells
 * Called after the trader's sell is executed
 * 
 * IMPORTANT: 
 * - Copy trades do NOT trigger further copy trades (no circular copying)
 * - Multiple positions for same follower+trader+token are treated as ONE combined position
 * - Only ONE sell transaction per follower (not multiple sells for multiple buys)
 */
export const executeCopySells = (traderId, tokenAddress, traderSellAmount, traderHoldingBeforeSell) => {
  // Prevent circular copy trading
  if (isExecutingCopyTrade) {
    console.log(`[CopyTrade] Skipping sell - already executing copy trade (preventing circular copy)`);
    return [];
  }
  
  // Calculate sell percentage
  const sellPercentage = traderSellAmount / traderHoldingBeforeSell;
  
  console.log(`[CopyTrade] Trader ${traderId} sold ${(sellPercentage * 100).toFixed(2)}% of ${tokenAddress}`);
  
  // Get all active copy positions for this trader + token
  const positions = getCopyPositions({
    traderId,
    tokenAddress,
    status: 'active'
  });
  
  console.log(`[CopyTrade] Found ${positions.length} active copy positions`);
  
  if (positions.length === 0) {
    return [];
  }
  
  // Set flag to prevent circular copy trading
  isExecutingCopyTrade = true;
  
  // Group positions by follower - treat all positions as ONE combined position per follower
  const followerPositions = {};
  for (const position of positions) {
    if (!followerPositions[position.followerId]) {
      followerPositions[position.followerId] = [];
    }
    followerPositions[position.followerId].push(position);
  }
  
  const solPriceUSD = getSolPriceUSD();
  const token = getTokenByAddress(tokenAddress);
  const results = [];
  
  try {
    // Process each follower ONCE (not each position)
    for (const [followerId, followerPositionList] of Object.entries(followerPositions)) {
      try {
        const users = getAllUsers();
        const followerUser = users[followerId];
        
        if (!followerUser) {
          continue;
        }
        
        // Calculate TOTAL remaining tokens across all positions for this follower
        const totalRemainingTokens = followerPositionList.reduce(
          (sum, pos) => sum + pos.remainingTokenAmount, 0
        );
        
        // Calculate how much follower should sell (percentage of total)
        const shouldSellAmount = totalRemainingTokens * sellPercentage;
        
        // Get follower's actual token balance
        const actualBalance = followerUser.tokens?.[tokenAddress]?.amount || 0;
        
        // Determine actual sell amount
        const actualSellAmount = Math.min(shouldSellAmount, actualBalance);
        
        if (actualSellAmount <= 0) {
          results.push({
            followerId,
            success: false,
            reason: 'Nothing to sell'
          });
          continue;
        }
        
        // Execute ONE sell for this follower
        const tradeResult = executeSell(tokenAddress, actualSellAmount);
        
        // Update follower's token balance
        const holding = followerUser.tokens[tokenAddress];
        const sellRatio = actualSellAmount / holding.amount;
        holding.totalCostUSD = (holding.totalCostUSD || 0) * (1 - sellRatio);
        holding.amount -= actualSellAmount;
        
        if (holding.amount <= 0) {
          delete followerUser.tokens[tokenAddress];
        } else {
          holding.avgBuyPriceUSD = holding.totalCostUSD / holding.amount;
        }
        
        // Update follower's SOL balance
        followerUser.solBalance += tradeResult.solOut;
        
        updateUser(followerId, followerUser);
        
        // Record ONE transaction
        addTransaction({
          userId: followerId,
          type: 'sell',
          tokenAddress,
          tokenSymbol: token?.symbol || 'UNKNOWN',
          tokenAmount: actualSellAmount,
          solAmount: tradeResult.solOut,
          amountUSD: tradeResult.solOut * solPriceUSD,
          priceUSD: tradeResult.executionPrice * solPriceUSD,
          priceImpact: tradeResult.priceImpact,
          marketCapUSD: tradeResult.newSolReserve * solPriceUSD,
          fromCopyTrading: true,
          copiedFrom: traderId,
        });
        
        // Update all positions proportionally (FIFO - oldest first)
        let remainingToDeduct = actualSellAmount;
        followerPositionList.sort((a, b) => a.timestamp - b.timestamp);
        
        for (const position of followerPositionList) {
          if (remainingToDeduct <= 0) break;
          
          const deductFromThis = Math.min(remainingToDeduct, position.remainingTokenAmount);
          const newRemainingAmount = position.remainingTokenAmount - deductFromThis;
          
          updateCopyPosition(position.id, {
            remainingTokenAmount: newRemainingAmount,
            status: newRemainingAmount <= 0 ? 'closed' : 'active'
          });
          
          remainingToDeduct -= deductFromThis;
        }
        
        console.log(`[CopyTrade] Follower ${followerId} sold ${actualSellAmount} tokens (combined from ${followerPositionList.length} positions)`);
        
        results.push({
          followerId,
          success: true,
          tokensSold: actualSellAmount,
          solReceived: tradeResult.solOut
        });
        
      } catch (error) {
        console.error(`[CopyTrade] Error selling for ${followerId}:`, error);
        results.push({
          followerId,
          success: false,
          reason: error.message
        });
      }
    }
  } finally {
    // Always reset the flag
    isExecutingCopyTrade = false;
  }
  
  return results;
};

/**
 * Deduct from copy positions when user manually sells
 * Uses FIFO (oldest positions first)
 */
export const deductFromCopyPositions = (userId, tokenAddress, sellAmount) => {
  // Get all active copy positions for this user + token
  const positions = getCopyPositions({
    followerId: userId,
    tokenAddress,
    status: 'active'
  });
  
  // Sort by timestamp (oldest first) for FIFO
  positions.sort((a, b) => a.timestamp - b.timestamp);
  
  let remainingToDeduct = sellAmount;
  
  for (const position of positions) {
    if (remainingToDeduct <= 0) break;
    
    const deductAmount = Math.min(remainingToDeduct, position.remainingTokenAmount);
    const newRemainingAmount = position.remainingTokenAmount - deductAmount;
    
    updateCopyPosition(position.id, {
      remainingTokenAmount: newRemainingAmount,
      status: newRemainingAmount <= 0 ? 'closed' : 'active'
    });
    
    remainingToDeduct -= deductAmount;
  }
};

// ============ LEADERBOARD / STATS ============

/**
 * Get trader stats for leaderboard
 */
export const getTraderStats = (userId) => {
  const users = getAllUsers();
  const user = users[userId];
  
  if (!user) return null;
  
  const solPriceUSD = getSolPriceUSD();
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  
  // Get user's transactions (excluding copy trades for PNL calculation)
  const allTransactions = JSON.parse(localStorage.getItem('gmgn_transactions') || '[]');
  const userTx = allTransactions.filter(tx => tx.userId === userId);
  const userTx1D = userTx.filter(tx => tx.timestamp > oneDayAgo);
  
  // Calculate 1D volume (all trades)
  const volume1D = userTx1D.reduce((sum, tx) => sum + (tx.amountUSD || (tx.solAmount * solPriceUSD) || 0), 0);
  
  // Calculate PNL - current portfolio value vs initial 100 SOL
  const initialValueUSD = 100 * solPriceUSD;
  
  // Current portfolio value
  let currentValueUSD = user.solBalance * solPriceUSD;
  
  // Add token values using correct storage key
  const pools = JSON.parse(localStorage.getItem('gmgn_liquidityPools') || '{}');
  Object.entries(user.tokens || {}).forEach(([tokenAddress, holding]) => {
    const pool = pools[tokenAddress];
    if (pool && holding.amount > 0) {
      const currentPriceSOL = pool.solReserve / pool.tokenReserve;
      currentValueUSD += holding.amount * currentPriceSOL * solPriceUSD;
    }
  });
  
  const pnlUSD = currentValueUSD - initialValueUSD;
  const pnlPercent = (pnlUSD / initialValueUSD) * 100;
  
  // Get follower count (from trader's followers object)
  const followerCount = getFollowerCount(userId);
  
  return {
    userId,
    username: user.username,
    pnlUSD,
    pnlPercent,
    txCount1D: userTx1D.length,
    volume1DUSD: volume1D,
    followerCount,
    totalTrades: userTx.length,
  };
};

/**
 * Get leaderboard of all traders
 */
export const getLeaderboard = () => {
  const users = getAllUsers();
  
  // Get all registered users
  const traderIds = Object.keys(users);
  
  // Get stats for each trader
  const leaderboard = traderIds
    .map(userId => getTraderStats(userId))
    .filter(stats => stats !== null)
    .sort((a, b) => b.pnlUSD - a.pnlUSD); // Sort by PNL descending
  
  return leaderboard;
};

/**
 * Get user's active copy positions
 */
export const getUserCopyPositions = (userId) => {
  const positions = getCopyPositions({ followerId: userId, status: 'active' });
  const users = getAllUsers();
  
  return positions.map(pos => ({
    ...pos,
    traderUsername: users[pos.traderId]?.username || 'Unknown',
    token: getTokenByAddress(pos.tokenAddress),
  }));
};

/**
 * Get list of traders a user is following
 */
export const getFollowingList = (userId) => {
  const users = getAllUsers();
  const user = users[userId];
  
  if (!user?.following) return [];
  
  return Object.entries(user.following).map(([traderId, settings]) => ({
    oderId: traderId,
    username: users[traderId]?.username || 'Unknown',
    solAmount: settings.solAmount,
    followedAt: settings.followedAt,
    stats: getTraderStats(traderId),
  }));
};
