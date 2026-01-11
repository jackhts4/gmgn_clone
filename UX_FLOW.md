# GMGN Clone - UX Flow Documentation

## User Journeys

### Journey 1: New User → First Trade
1. User lands on Market page (homepage)
2. Clicks "Login" → Register with username/password
3. Gets 100 SOL starting balance
4. Clicks any token → Goes to Trade page
5. Enters amount → Clicks "Buy"
6. Sees toast confirmation → Balance updated

### Journey 2: Copy Trading
1. User clicks "Copy Trading" in navigation
2. Views Leaderboard with trader rankings
3. Clicks "Copy" on a trader
4. Sets SOL amount per trade in modal
5. Confirms → Now following trader
6. When trader buys/sells → User auto buys/sells

### Journey 3: Check Portfolio
1. User clicks "Wallet" in navigation
2. Sees total balance (SOL + USD)
3. Sees profit/loss percentage
4. Views all token holdings
5. Reviews transaction history

---

## Core Pages

### 1. Market Page (`/`)
- Shows list of all available tokens
- Each token displays: name, price, 24h change, market cap
- Click token → Navigate to Trade page

### 2. Trade Page (`/trade/:tokenAddress`)
- Price chart (candlestick with volume)
- Token info (symbol, price, market cap)
- Buy/Sell toggle tabs
- Amount input with quick buttons (25%, 50%, 75%, 100%)
- Execute trade button
- Recent transactions table

### 3. Wallet Page (`/wallet`)
- Total portfolio value (SOL and USD)
- Overall PNL (profit/loss)
- List of token holdings with individual PNL
- Transaction history table

### 4. Copy Trading Page (`/copy-trading`)
- **Leaderboard tab**: All traders ranked by PNL, with Copy/Unfollow buttons
- **Following tab**: List of traders you're copying
- **Positions tab**: Your active copy trade positions

---

## Key Interaction Flows

### Buy/Sell Token
1. Select Buy or Sell tab
2. Enter amount (or use quick % buttons)
3. Click "Buy [TOKEN]" or "Sell [TOKEN]"
4. Trade executes via AMM
5. Toast shows success message
6. Balance updates immediately

### Start Copy Trading
1. View trader's stats (PNL, volume, followers)
2. Click "Copy" button
3. Modal opens → Enter SOL amount per trade
4. Click "Start Copying"
5. Toast confirms following

### Auto Copy Trade Execution
- When trader buys → You auto-buy with your set SOL amount
- When trader sells 50% → You auto-sell 50% of your copy position
- Insufficient balance → Trade skipped (no partial buys)

### Unfollow Trader
1. Go to "Following" tab
2. Click "Unfollow"
3. Stops future auto-trades
4. Existing positions remain (manage manually)

---

## Mobile Design

- Bottom navigation bar on mobile (< 768px)
- Top navigation bar on desktop
- Touch-friendly buttons
- Responsive token cards and tables
