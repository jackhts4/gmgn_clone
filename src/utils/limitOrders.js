import {
  getFromStorage,
  setToStorage,
  STORAGE_KEYS,
  getCurrentUser,
  updateUser,
} from './storage';
import { getCurrentPrice } from './amm';
import { buyTokens, sellTokens } from './trade';

// Storage key for open orders
const OPEN_ORDERS_KEY = 'gmgn_openOrders';

/**
 * Get all open orders
 */
export const getAllOpenOrders = () => {
  return getFromStorage(OPEN_ORDERS_KEY) || [];
};

/**
 * Get user's open orders
 */
export const getUserOpenOrders = (userId) => {
  const orders = getAllOpenOrders();
  return orders.filter(order => order.userId === userId && order.status === 'open');
};

/**
 * Get open orders for a specific token
 */
export const getTokenOpenOrders = (tokenAddress) => {
  const orders = getAllOpenOrders();
  return orders.filter(
    order => order.tokenAddress === tokenAddress && order.status === 'open'
  );
};

/**
 * Create a limit order
 * @param {string} userId - User ID
 * @param {string} type - 'buy' or 'sell'
 * @param {string} tokenAddress - Token address
 * @param {number} limitPrice - Price in SOL per token
 * @param {number} amount - For buy: SOL amount to spend, For sell: token amount to sell
 */
export const createLimitOrder = (userId, type, tokenAddress, limitPrice, amount) => {
  const user = getCurrentUser();
  if (!user || user.id !== userId) {
    throw new Error('User not found');
  }

  // Validate user has sufficient balance
  if (type === 'buy') {
    if (user.solBalance < amount) {
      throw new Error('Insufficient SOL balance');
    }
    // Lock the SOL (deduct from balance)
    user.solBalance -= amount;
  } else {
    // type === 'sell'
    if (!user.tokens[tokenAddress] || user.tokens[tokenAddress].amount < amount) {
      throw new Error('Insufficient token balance');
    }
    // Lock the tokens (deduct from balance)
    user.tokens[tokenAddress].amount -= amount;
  }

  // Update user with locked funds
  updateUser(userId, user);

  // Create the order
  const order = {
    id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type,
    tokenAddress,
    orderType: 'limit',
    limitPrice,
    amount,
    lockedAmount: amount, // Track what was locked
    filledAmount: 0,
    createdAt: Date.now(),
    status: 'open',
  };

  // Save order
  const orders = getAllOpenOrders();
  orders.push(order);
  setToStorage(OPEN_ORDERS_KEY, orders);

  return order;
};

/**
 * Cancel a limit order
 * Returns locked funds to user
 */
export const cancelLimitOrder = (orderId, userId) => {
  const orders = getAllOpenOrders();
  const orderIndex = orders.findIndex(o => o.id === orderId);

  if (orderIndex === -1) {
    throw new Error('Order not found');
  }

  const order = orders[orderIndex];

  if (order.userId !== userId) {
    throw new Error('Not your order');
  }

  if (order.status !== 'open') {
    throw new Error('Order is not open');
  }

  // Return locked funds to user
  const user = getCurrentUser();
  const remainingAmount = order.amount - order.filledAmount;

  if (order.type === 'buy') {
    user.solBalance += remainingAmount;
  } else {
    if (!user.tokens[order.tokenAddress]) {
      user.tokens[order.tokenAddress] = { amount: 0, avgBuyPrice: 0 };
    }
    user.tokens[order.tokenAddress].amount += remainingAmount;
  }

  updateUser(userId, user);

  // Update order status
  order.status = 'cancelled';
  orders[orderIndex] = order;
  setToStorage(OPEN_ORDERS_KEY, orders);

  return order;
};

/**
 * Check and execute limit orders that have been triggered
 * This should be called after every market trade or periodically
 */
export const checkAndExecuteLimitOrders = () => {
  const orders = getAllOpenOrders();
  const executedOrders = [];

  orders.forEach((order, index) => {
    if (order.status !== 'open') return;

    const currentPrice = getCurrentPrice(order.tokenAddress);

    // Check if limit price is reached
    let shouldExecute = false;

    if (order.type === 'buy' && currentPrice <= order.limitPrice) {
      // Buy order: execute when current price drops to or below limit price
      shouldExecute = true;
    } else if (order.type === 'sell' && currentPrice >= order.limitPrice) {
      // Sell order: execute when current price rises to or above limit price
      shouldExecute = true;
    }

    if (shouldExecute) {
      try {
        // Calculate how much to execute
        const remainingAmount = order.amount - order.filledAmount;

        if (order.type === 'buy') {
          // For buy orders, amount is in SOL
          // User already has SOL locked, so we pass fromLimitOrder flag
          const result = buyTokensFromLimitOrder(
            order.userId,
            order.tokenAddress,
            remainingAmount,
            order.id
          );

          // Update order
          order.filledAmount = order.amount;
          order.status = 'filled';
          order.filledAt = Date.now();
          order.executionPrice = result.tradeResult.executionPrice;

          executedOrders.push(order);
        } else {
          // For sell orders, amount is in tokens
          const result = sellTokensFromLimitOrder(
            order.userId,
            order.tokenAddress,
            remainingAmount,
            order.id
          );

          // Update order
          order.filledAmount = order.amount;
          order.status = 'filled';
          order.filledAt = Date.now();
          order.executionPrice = result.tradeResult.executionPrice;

          executedOrders.push(order);
        }

        // Update order in array
        orders[index] = order;
      } catch (error) {
        console.error(`Failed to execute limit order ${order.id}:`, error);
        // Mark order as failed
        order.status = 'failed';
        order.failReason = error.message;
        orders[index] = order;
      }
    }
  });

  // Save updated orders
  setToStorage(OPEN_ORDERS_KEY, orders);

  return executedOrders;
};

/**
 * Buy tokens from limit order execution
 * User's SOL is already locked, so we don't deduct again
 */
const buyTokensFromLimitOrder = (userId, tokenAddress, solAmount, orderId) => {
  // Note: The SOL was already deducted when order was created
  // We just need to execute the trade and give user the tokens
  
  // Import needed to avoid circular dependency
  const { executeBuy } = require('./amm');
  const { getTokenByAddress, addTransaction, getAllUsers, updateUser } = require('./storage');
  
  const users = getAllUsers();
  const user = users[userId];
  
  if (!user) throw new Error('User not found');
  
  // Execute AMM buy (this updates the pool)
  const tradeResult = executeBuy(tokenAddress, solAmount);
  
  // Give user the tokens
  if (!user.tokens[tokenAddress]) {
    user.tokens[tokenAddress] = {
      amount: 0,
      avgBuyPrice: 0,
    };
  }
  
  const currentHolding = user.tokens[tokenAddress];
  const totalTokens = currentHolding.amount + tradeResult.tokensOut;
  const totalCost = (currentHolding.amount * currentHolding.avgBuyPrice) + solAmount;
  
  user.tokens[tokenAddress] = {
    amount: totalTokens,
    avgBuyPrice: totalCost / totalTokens,
  };
  
  updateUser(userId, user);
  
  // Record transaction
  const token = getTokenByAddress(tokenAddress);
  const transaction = addTransaction({
    userId,
    type: 'buy',
    tokenAddress,
    tokenSymbol: token?.symbol || 'UNKNOWN',
    tokenAmount: tradeResult.tokensOut,
    solAmount,
    price: tradeResult.executionPrice,
    priceImpact: tradeResult.priceImpact,
    fromLimitOrder: true,
    orderId,
  });
  
  return { transaction, tradeResult };
};

/**
 * Sell tokens from limit order execution
 */
const sellTokensFromLimitOrder = (userId, tokenAddress, tokenAmount, orderId) => {
  const { executeSell } = require('./amm');
  const { getTokenByAddress, addTransaction, getAllUsers, updateUser } = require('./storage');
  
  const users = getAllUsers();
  const user = users[userId];
  
  if (!user) throw new Error('User not found');
  
  // Execute AMM sell (this updates the pool)
  const tradeResult = executeSell(tokenAddress, tokenAmount);
  
  // Give user the SOL (tokens were already deducted when order was created)
  user.solBalance += tradeResult.solOut;
  
  updateUser(userId, user);
  
  // Record transaction
  const token = getTokenByAddress(tokenAddress);
  const transaction = addTransaction({
    userId,
    type: 'sell',
    tokenAddress,
    tokenSymbol: token?.symbol || 'UNKNOWN',
    tokenAmount,
    solAmount: tradeResult.solOut,
    price: tradeResult.executionPrice,
    priceImpact: tradeResult.priceImpact,
    fromLimitOrder: true,
    orderId,
  });
  
  return { transaction, tradeResult };
};

/**
 * Get order book for a token (for display)
 * Grouped by price levels
 */
export const getOrderBook = (tokenAddress) => {
  const orders = getTokenOpenOrders(tokenAddress);
  
  // Separate buy and sell orders
  const buyOrders = orders.filter(o => o.type === 'buy');
  const sellOrders = orders.filter(o => o.type === 'sell');
  
  // Group by price and sum amounts
  const groupByPrice = (orders) => {
    const grouped = {};
    orders.forEach(order => {
      const price = order.limitPrice;
      if (!grouped[price]) {
        grouped[price] = {
          price,
          totalAmount: 0,
          orderCount: 0,
        };
      }
      grouped[price].totalAmount += (order.amount - order.filledAmount);
      grouped[price].orderCount += 1;
    });
    return Object.values(grouped);
  };
  
  // Sort buy orders (highest first) and sell orders (lowest first)
  const bids = groupByPrice(buyOrders).sort((a, b) => b.price - a.price);
  const asks = groupByPrice(sellOrders).sort((a, b) => a.price - b.price);
  
  return { bids, asks };
};

/**
 * Get all orders for a user (including filled and cancelled)
 */
export const getUserAllOrders = (userId) => {
  const orders = getAllOpenOrders();
  return orders.filter(order => order.userId === userId);
};
