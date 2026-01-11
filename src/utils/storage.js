// localStorage keys
export const STORAGE_KEYS = {
  USERS: 'gmgn_users',
  CURRENT_USER: 'gmgn_currentUser',
  LIQUIDITY_POOLS: 'gmgn_liquidityPools',
  TOKEN_REGISTRY: 'gmgn_tokenRegistry',
  TRANSACTIONS: 'gmgn_transactions',
  COPY_RELATIONSHIPS: 'gmgn_copyRelationships',
  CONSTANTS: 'gmgn_constants',
};

// Initialize app data from initial JSON
export const initializeAppData = (initialData) => {
  // Only initialize if not already set
  if (!localStorage.getItem(STORAGE_KEYS.TOKEN_REGISTRY)) {
    localStorage.setItem(STORAGE_KEYS.TOKEN_REGISTRY, JSON.stringify(initialData.tokenRegistry));
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.LIQUIDITY_POOLS)) {
    localStorage.setItem(STORAGE_KEYS.LIQUIDITY_POOLS, JSON.stringify(initialData.liquidityPools));
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.CONSTANTS)) {
    localStorage.setItem(STORAGE_KEYS.CONSTANTS, JSON.stringify(initialData.constants));
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify({}));
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.COPY_RELATIONSHIPS)) {
    localStorage.setItem(STORAGE_KEYS.COPY_RELATIONSHIPS, JSON.stringify({}));
  }
};

// Generic get/set functions
export const getFromStorage = (key) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

export const setToStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

// User functions
export const getAllUsers = () => getFromStorage(STORAGE_KEYS.USERS) || {};

export const createUser = (username, password) => {
  const users = getAllUsers();
  
  // Check if username exists
  if (Object.values(users).find(u => u.username === username)) {
    throw new Error('Username already exists');
  }
  
  const userId = `user_${Date.now()}`;
  const newUser = {
    id: userId,
    username,
    password, // In real app, hash this!
    createdAt: Date.now(),
    solBalance: 100, // Starting balance: 100 SOL
    tokens: {}, // No tokens initially
  };
  
  users[userId] = newUser;
  setToStorage(STORAGE_KEYS.USERS, users);
  
  return newUser;
};

export const loginUser = (username, password) => {
  const users = getAllUsers();
  const user = Object.values(users).find(u => u.username === username && u.password === password);
  
  if (!user) {
    throw new Error('Invalid username or password');
  }
  
  setToStorage(STORAGE_KEYS.CURRENT_USER, user.id);
  return user;
};

export const getCurrentUser = () => {
  const userId = getFromStorage(STORAGE_KEYS.CURRENT_USER);
  if (!userId) return null;
  
  const users = getAllUsers();
  return users[userId] || null;
};

export const logoutUser = () => {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
};

export const updateUser = (userId, updates) => {
  const users = getAllUsers();
  if (!users[userId]) {
    throw new Error('User not found');
  }
  
  users[userId] = { ...users[userId], ...updates };
  setToStorage(STORAGE_KEYS.USERS, users);
  
  return users[userId];
};

// Token Registry functions
export const getTokenRegistry = () => getFromStorage(STORAGE_KEYS.TOKEN_REGISTRY) || {};

export const getTokenByAddress = (address) => {
  const registry = getTokenRegistry();
  return registry[address] || null;
};

export const getAllTokens = () => {
  const registry = getTokenRegistry();
  return Object.values(registry);
};

// Liquidity Pool functions
export const getLiquidityPools = () => getFromStorage(STORAGE_KEYS.LIQUIDITY_POOLS) || {};

export const getPoolByToken = (tokenAddress) => {
  const pools = getLiquidityPools();
  return pools[tokenAddress] || null;
};

export const updatePool = (tokenAddress, updates) => {
  const pools = getLiquidityPools();
  if (!pools[tokenAddress]) {
    throw new Error('Pool not found');
  }
  
  pools[tokenAddress] = { ...pools[tokenAddress], ...updates };
  setToStorage(STORAGE_KEYS.LIQUIDITY_POOLS, pools);
  
  return pools[tokenAddress];
};

// Transaction functions
export const getAllTransactions = () => getFromStorage(STORAGE_KEYS.TRANSACTIONS) || [];

export const addTransaction = (transaction) => {
  const transactions = getAllTransactions();
  const newTx = {
    id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    ...transaction,
  };
  
  transactions.push(newTx); // Add to beginning
  setToStorage(STORAGE_KEYS.TRANSACTIONS, transactions);
  
  return newTx;
};

export const getUserTransactions = (userId) => {
  const transactions = getAllTransactions();
  return transactions.filter(tx => tx.userId === userId);
};

// Copy Relationship functions
export const getCopyRelationships = () => getFromStorage(STORAGE_KEYS.COPY_RELATIONSHIPS) || {};

export const addCopyRelationship = (copierId, traderId, copyPercentage) => {
  const relationships = getCopyRelationships();
  
  if (!relationships[copierId]) {
    relationships[copierId] = { copiedTraders: [] };
  }
  
  // Check if already copying this trader
  const existingIndex = relationships[copierId].copiedTraders.findIndex(
    t => t.traderId === traderId
  );
  
  if (existingIndex !== -1) {
    // Update existing relationship
    relationships[copierId].copiedTraders[existingIndex] = {
      traderId,
      copyPercentage,
      isActive: true,
      startedAt: Date.now(),
    };
  } else {
    // Add new relationship
    relationships[copierId].copiedTraders.push({
      traderId,
      copyPercentage,
      isActive: true,
      startedAt: Date.now(),
    });
  }
  
  setToStorage(STORAGE_KEYS.COPY_RELATIONSHIPS, relationships);
  return relationships[copierId];
};

export const removeCopyRelationship = (copierId, traderId) => {
  const relationships = getCopyRelationships();
  
  if (!relationships[copierId]) return;
  
  relationships[copierId].copiedTraders = relationships[copierId].copiedTraders.map(t => 
    t.traderId === traderId ? { ...t, isActive: false } : t
  );
  
  setToStorage(STORAGE_KEYS.COPY_RELATIONSHIPS, relationships);
};

export const getUserCopiedTraders = (userId) => {
  const relationships = getCopyRelationships();
  return relationships[userId]?.copiedTraders.filter(t => t.isActive) || [];
};

export const getUserCopiers = (traderId) => {
  const relationships = getCopyRelationships();
  const copiers = [];
  
  Object.entries(relationships).forEach(([copierId, data]) => {
    const isCopying = data.copiedTraders.find(
      t => t.traderId === traderId && t.isActive
    );
    if (isCopying) {
      copiers.push({
        userId: copierId,
        ...isCopying,
      });
    }
  });
  
  return copiers;
};

// Constants
export const getConstants = () => getFromStorage(STORAGE_KEYS.CONSTANTS) || { solPriceUSD: 100 };

export const getSolPriceUSD = () => {
  const constants = getConstants();
  return constants.solPriceUSD || 100;
};
