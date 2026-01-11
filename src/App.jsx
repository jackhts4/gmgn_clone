import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navbar from './components/layout/Navbar';
import MobileNav from './components/layout/MobileNav';
import Toast from './components/common/Toast';
import MarketPage from './pages/MarketPage';
import TradePage from './pages/TradePage';
import WalletPage from './pages/WalletPage';
import CopyTradingPage from './pages/CopyTradingPage';
import { initializeAppData } from './utils/storage';
import initialData from './data/initialData.json';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeAppData(initialData);
    setReady(true);
  }, []);

  if (!ready) {
    // show something instead of blank
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        {/* Toast Notifications */}
        <Toast />
        
        {/* Top Navbar (Desktop) */}
        <Navbar />

        {/* Main Content */}
        <main className="min-h-screen">
          <Routes>
            <Route path="/" element={<MarketPage />} />
            <Route path="/trade/:tokenAddress" element={<TradePage />} />
            <Route path="/copy-trading" element={<CopyTradingPage />} />
            <Route path="/wallet" element={<WalletPage />} />
          </Routes>
        </main>

        {/* Bottom Navbar (Mobile) */}
        <MobileNav />
      </div>
    </Router>
  );
}

export default App;
