# GMGN Clone

A mobile-first meme token DEX clone with copy trading functionality.

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Charts**: Lightweight Charts (TradingView)
- **Routing**: React Router v6
- **Storage**: localStorage (Mock data)

## AI Tools Used

- **Claude (Anthropic)** - Code generation and architecture design

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:5173
```

## Build & Deploy

```bash
# Build for production
npm run build

# Preview build
npm run preview
```

### Deploy to Vercel

1. Push to GitHub
2. Import project at vercel.com
3. Deploy (auto-detects Vite)

## Core Features

### 1. Market Page
- Browse all available meme tokens
- View price, 24h change, market cap

### 2. Trade Page
- Buy/Sell tokens with AMM pricing
- Candlestick chart with volume
- Quick amount buttons (25%, 50%, 75%, 100%)

### 3. Wallet Page
- Portfolio overview with total value
- PNL (profit/loss) tracking
- Transaction history

### 4. Copy Trading
- Leaderboard of traders by PNL
- Follow traders with custom SOL amount
- Auto-execute trades when trader trades

## Demo Accounts

Register any username/password. Each new user starts with 100 SOL.

To test copy trading:
1. Create 2 accounts (e.g., "trader" and "follower")
2. Login as "follower", copy "trader"
3. Login as "trader", make trades
4. Login as "follower", see copied trades
