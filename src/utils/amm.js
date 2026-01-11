import { getPoolByToken, updatePool } from './storage';

/**
 * Calculate current token price in SOL
 * Price = SOL Reserve / Token Reserve
 */
export const getCurrentPrice = (tokenAddress) => {
  const pool = getPoolByToken(tokenAddress);
  if (!pool) return 0;
  
  return pool.solReserve / pool.tokenReserve;
};

/**
 * Calculate how many tokens user will receive for given SOL amount
 * Uses constant product formula: x * y = k
 * 
 * @param {string} tokenAddress - Token address
 * @param {number} solAmountIn - Amount of SOL user wants to spend
 * @returns {object} { tokensOut, newPrice, priceImpact, executionPrice }
 */
export const calculateBuyAmount = (tokenAddress, solAmountIn) => {
  const pool = getPoolByToken(tokenAddress);
  if (!pool) throw new Error('Pool not found');
  
  const oldPrice = pool.solReserve / pool.tokenReserve;
  
  // Constant product: k = x * y
  const k = pool.solReserve * pool.tokenReserve;
  
  // New SOL reserve after user adds SOL
  const newSolReserve = pool.solReserve + solAmountIn;
  
  // Calculate new token reserve to maintain k
  const newTokenReserve = k / newSolReserve;
  
  // Tokens user receives
  const tokensOut = pool.tokenReserve - newTokenReserve;
  
  // New price after trade
  const newPrice = newSolReserve / newTokenReserve;
  
  // Price impact percentage
  const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100;
  
  // Execution price (average price user paid)
  const executionPrice = solAmountIn / tokensOut;
  
  return {
    tokensOut,
    newPrice,
    oldPrice,
    priceImpact,
    executionPrice,
    newSolReserve,
    newTokenReserve,
  };
};

/**
 * Calculate how much SOL user will receive for given token amount
 * 
 * @param {string} tokenAddress - Token address
 * @param {number} tokenAmountIn - Amount of tokens user wants to sell
 * @returns {object} { solOut, newPrice, priceImpact, executionPrice }
 */
export const calculateSellAmount = (tokenAddress, tokenAmountIn) => {
  const pool = getPoolByToken(tokenAddress);
  if (!pool) throw new Error('Pool not found');
  
  const oldPrice = pool.solReserve / pool.tokenReserve;
  
  const k = pool.solReserve * pool.tokenReserve;
  
  // New token reserve after user adds tokens
  const newTokenReserve = pool.tokenReserve + tokenAmountIn;
  
  // Calculate new SOL reserve to maintain k
  const newSolReserve = k / newTokenReserve;
  
  // SOL user receives
  const solOut = pool.solReserve - newSolReserve;
  
  // New price after trade
  const newPrice = newSolReserve / newTokenReserve;
  
  // Price impact percentage (negative because selling decreases price)
  const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100;
  
  // Execution price (average price user received)
  const executionPrice = solOut / tokenAmountIn;
  
  return {
    solOut,
    newPrice,
    oldPrice,
    priceImpact,
    executionPrice,
    newSolReserve,
    newTokenReserve,
  };
};

/**
 * Execute a buy trade
 * Updates pool reserves and returns trade details
 */
export const executeBuy = (tokenAddress, solAmountIn) => {
  const calculation = calculateBuyAmount(tokenAddress, solAmountIn);
  
  // Update pool reserves
  updatePool(tokenAddress, {
    solReserve: calculation.newSolReserve,
    tokenReserve: calculation.newTokenReserve,
  });
  
  return calculation;
};

/**
 * Execute a sell trade
 * Updates pool reserves and returns trade details
 */
export const executeSell = (tokenAddress, tokenAmountIn) => {
  const calculation = calculateSellAmount(tokenAddress, tokenAmountIn);
  
  // Update pool reserves
  updatePool(tokenAddress, {
    solReserve: calculation.newSolReserve,
    tokenReserve: calculation.newTokenReserve,
  });
  
  return calculation;
};

/**
 * Calculate market cap in SOL
 * Market Cap = Current Price * Total Supply
 */
export const calculateMarketCap = (tokenAddress, totalSupply) => {
  const price = getCurrentPrice(tokenAddress);
  return price * totalSupply;
};

/**
 * Calculate 24h price change percentage
 * For demo, we'll simulate this based on recent transactions
 * In real app, would track historical prices
 */
export const calculate24hChange = (tokenAddress) => {
  // For now, return a simulated value
  // In production, would compare current price to price 24h ago
  return (Math.random() - 0.5) * 50; // Random between -25% to +25%
};

/**
 * Format number for display with subscript zeros (no scientific notation)
 */
export const formatNumber = (num, decimals = 2) => {
  if (num === 0 || num === undefined || num === null || isNaN(num)) return '0';
  
  // For very small numbers, use subscript notation like 0.0₅123
  if (num < 0.0001 && num > 0) {
    const str = num.toExponential();
    const [coefficient, exponent] = str.split('e');
    const exp = Math.abs(parseInt(exponent));
    
    if (exp > 3) {
      // Get significant digits (remove leading 1. from coefficient)
      let sig = parseFloat(coefficient).toFixed(4).replace('.', '').replace(/^1/, '');
      // Remove trailing zeros
      sig = sig.replace(/0+$/, '');
      if (sig.length === 0) sig = '0';
      
      const zeroCount = exp - 1;
      
      // Use Unicode subscript numbers
      const subscriptMap = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
        '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
      };
      
      const subscript = zeroCount.toString().split('').map(d => subscriptMap[d]).join('');
      return `0.0${subscript}${sig}`;
    }
  }
  
  // For small but not tiny numbers (0.0001 to 1)
  if (num < 1) {
    let formatted = num.toFixed(8);
    // Remove trailing zeros
    formatted = formatted.replace(/\.?0+$/, '');
    return formatted;
  }
  
  // For numbers >= 1
  if (num < 1000) return num.toFixed(decimals);
  if (num < 1000000) return (num / 1000).toFixed(2) + 'K';
  if (num < 1000000000) return (num / 1000000).toFixed(2) + 'M';
  return (num / 1000000000).toFixed(2) + 'B';
};

/**
 * Format price specifically (always show enough precision)
 */
export const formatPrice = (price) => {
  return formatNumber(price, 8);
};

/**
 * Format large numbers with K/M/B suffix
 */
export const formatLargeNumber = (num) => {
  if (!num || num === 0) return '0';
  if (num < 1000) return num.toFixed(2);
  if (num < 1000000) return (num / 1000).toFixed(2) + 'K';
  if (num < 1000000000) return (num / 1000000).toFixed(2) + 'M';
  return (num / 1000000000).toFixed(2) + 'B';
};

/**
 * Format SOL amount
 */
export const formatSOL = (amount) => {
  return amount.toFixed(4) + ' SOL';
};

/**
 * Format USD amount
 */
export const formatUSD = (amount) => {
  return '$' + formatNumber(amount, 2);
};

/**
 * Format percentage
 */
export const formatPercent = (percent) => {
  const sign = percent >= 0 ? '+' : '';
  return sign + percent.toFixed(2) + '%';
};
