import { getAllTokens, addTransaction, getPoolByToken, updatePool, getSolPriceUSD } from './storage';
import { executeBuy, executeSell } from './amm';

/**
 * Generate initial transaction history for all tokens
 * Each transaction ACTUALLY executes through AMM and updates LP
 * First 10 transactions are buys to create uptrend
 */
export const generateInitialTransactions = () => {
  const tokens = getAllTokens();
  const currentTimestamp = Math.floor(Date.now() / 1000); // Current time in seconds
  const oneHourAgo = currentTimestamp - 3600; // 1 hour = 3600 seconds
  const solPriceUSD = getSolPriceUSD();

  tokens.forEach(token => {
    const pool = getPoolByToken(token.address);
    if (!pool) return;

    console.log(`Generating transactions for ${token.symbol}...`);
    
    // Generate 40 transactions in the last hour
    const txCount = 40;
    const timeInterval = 3600 / txCount; // Evenly spread across 1 hour
    
    for (let i = 0; i < txCount; i++) {
      // Calculate timestamp (oldest to newest)
      const timestamp = (oneHourAgo + (i * timeInterval)) * 1000; // Convert to milliseconds
      
      // First 10 transactions are BUYS to create uptrend
      // Then mix of buy/sell with slight buy bias (60% buy, 40% sell)
      let type;
      if (i < 10) {
        type = 'buy'; // Force uptrend at start
      } else {
        type = Math.random() < 0.6 ? 'buy' : 'sell';
      }
      
      // Random SOL amount for buy (0.1 to 3 SOL)
      // Random token amount for sell (based on current price)
      let solAmount, tokenAmount, result, price;
      
      try {
        if (type === 'buy') {
          solAmount = 0.1 + Math.random() * 2.9; // 0.1 to 3 SOL
          
          // Execute actual buy through AMM
          result = executeBuy(token.address, solAmount);
          tokenAmount = result.tokensOut;
          price = result.executionPrice;
        } else {
          // For sell, calculate token amount based on current price
          const currentPool = getPoolByToken(token.address);
          const currentPrice = currentPool.solReserve / currentPool.tokenReserve;
          
          // Sell equivalent of 0.1 to 3 SOL worth
          const solWorth = 0.1 + Math.random() * 2.9;
          tokenAmount = solWorth / currentPrice;
          
          // Execute actual sell through AMM
          result = executeSell(token.address, tokenAmount);
          solAmount = result.solOut;
          price = result.executionPrice;
        }
        
        // Record transaction with USD values
        const tx = {
          id: `init_tx_${token.address}_${i}_${Date.now()}_${Math.random()}`,
          userId: `bot_${Math.floor(Math.random() * 10)}`, // Random bot user
          type,
          tokenAddress: token.address,
          tokenSymbol: token.symbol,
          tokenAmount,
          solAmount,
          amountUSD: solAmount * solPriceUSD,
          priceUSD: price * solPriceUSD,
          priceImpact: result.priceImpact,
          marketCapUSD: result.newSolReserve * solPriceUSD,
          timestamp,
          fromCopyTrading: false,
        };
        
        // Add to transactions
        const transactions = JSON.parse(localStorage.getItem('gmgn_transactions') || '[]');
        transactions.push(tx);
        localStorage.setItem('gmgn_transactions', JSON.stringify(transactions));
        
        console.log(`  ${i + 1}/${txCount}: ${type.toUpperCase()} ${solAmount.toFixed(2)} SOL at price ${price.toFixed(10)}`);
      } catch (error) {
        console.error(`Failed to generate tx ${i}:`, error);
      }
    }
    
    // Log final state
    const finalPool = getPoolByToken(token.address);
    const finalPrice = finalPool.solReserve / finalPool.tokenReserve;
    console.log(`${token.symbol} final: ${finalPool.solReserve.toFixed(2)} SOL, ${finalPool.tokenReserve.toFixed(0)} tokens, price: ${finalPrice.toFixed(10)}`);
  });
  
  console.log('Transaction generation complete!');
};

/**
 * Get transactions for a specific token
 */
export const getTokenTransactions = (tokenAddress) => {
  const allTransactions = JSON.parse(localStorage.getItem('gmgn_transactions') || '[]');
  return allTransactions
    .filter(tx => tx.tokenAddress === tokenAddress)
    .sort((a, b) => a.timestamp - b.timestamp); // Sort by time (oldest first)
};

/**
 * Build OHLC data from transactions
 * @param {string} tokenAddress - Token address
 * @param {number} interval - Interval in seconds (e.g., 300 for 5min candles)
 * @returns {Array} OHLC data for charting with volume (prices in USD)
 */
export const buildOHLCFromTransactions = (tokenAddress, interval = 300) => {
  const transactions = getTokenTransactions(tokenAddress);
  
  if (transactions.length === 0) return [];
  
  // Get SOL price for converting old format
  const solPriceUSD = getSolPriceUSD();
  
  // Group transactions into time buckets
  const buckets = {};
  
  transactions.forEach(tx => {
    const bucketTime = Math.floor(tx.timestamp / 1000 / interval) * interval;
    
    if (!buckets[bucketTime]) {
      buckets[bucketTime] = {
        time: bucketTime,
        prices: [],
        volumes: [],
        open: null,
        high: null,
        low: null,
        close: null,
        volume: 0,
      };
    }
    
    // Use priceUSD if available, otherwise convert from SOL price
    const priceUSD = tx.priceUSD || (tx.price ? tx.price * solPriceUSD : 0);
    const volumeUSD = tx.amountUSD || (tx.solAmount ? tx.solAmount * solPriceUSD : 0);
    
    if (priceUSD > 0) {
      buckets[bucketTime].prices.push(priceUSD);
      buckets[bucketTime].volumes.push(volumeUSD);
    }
  });
  
  // Calculate OHLC for each bucket
  const ohlcData = Object.values(buckets)
    .filter(bucket => bucket.prices.length > 0)
    .map(bucket => {
      const prices = bucket.prices;
      const totalVolume = bucket.volumes.reduce((sum, vol) => sum + vol, 0);
      
      return {
        time: bucket.time,
        open: prices[0],
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: prices[prices.length - 1],
        volume: totalVolume, // Total USD volume in this candle
      };
    });
  
  // Sort by time
  ohlcData.sort((a, b) => a.time - b.time);
  
  return ohlcData;
};

/**
 * Get recent transactions for display in table
 * @param {string} tokenAddress - Token address
 * @param {number} limit - Number of transactions to return
 */
export const getRecentTransactions = (tokenAddress, limit = 20) => {
  const transactions = getTokenTransactions(tokenAddress);
  return transactions.slice(-limit).reverse(); // Get last N, newest first
};

/**
 * Calculate 24h volume from transactions
 * @param {string} tokenAddress - Token address
 * @returns {number} Total SOL volume in last 24h
 */
export const calculate24hVolume = (tokenAddress) => {
  const transactions = getTokenTransactions(tokenAddress);
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  // Filter transactions from last 24h and sum SOL amounts
  const volume = transactions
    .filter(tx => tx.timestamp >= oneDayAgo)
    .reduce((sum, tx) => sum + tx.solAmount, 0);
  
  return volume;
};

/**
 * Calculate 24h transaction count
 * @param {string} tokenAddress - Token address
 * @returns {number} Number of transactions in last 24h
 */
export const calculate24hTxCount = (tokenAddress) => {
  const transactions = getTokenTransactions(tokenAddress);
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  return transactions.filter(tx => tx.timestamp >= oneDayAgo).length;
};

/**
 * Calculate 24h price change
 * @param {string} tokenAddress - Token address
 * @returns {number} Percentage change in last 24h
 */
export const calculate24hChange = (tokenAddress) => {
  const transactions = getTokenTransactions(tokenAddress);
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  // Get transactions from last 24h
  const last24h = transactions.filter(tx => tx.timestamp >= oneDayAgo);
  
  if (last24h.length < 2) return 0;
  
  // Use priceUSD (new format) or fall back to price (old format)
  const oldestPrice = last24h[0].priceUSD || last24h[0].price || 0;
  const newestPrice = last24h[last24h.length - 1].priceUSD || last24h[last24h.length - 1].price || 0;
  
  if (oldestPrice === 0) return 0;
  
  return ((newestPrice - oldestPrice) / oldestPrice) * 100;
};

/**
 * Clear all transactions (for reset)
 */
export const clearTransactions = () => {
  localStorage.removeItem('gmgn_transactions');
};

