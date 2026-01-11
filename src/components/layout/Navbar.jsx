import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getCurrentUser, logoutUser } from '../../utils/storage';
import AuthModal from '../common/AuthModal';
import { showToast } from '../common/Toast';

function Navbar() {
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const loadUser = () => {
    setUser(getCurrentUser());
  };

  useEffect(() => {
    loadUser();
    
    // Listen for auth changes
    const handleAuthChange = () => loadUser();
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    window.dispatchEvent(new Event('auth-change'));
    showToast('Logged out successfully', 'success');
  };

  return (
    <>
      <nav className="hidden md:block bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="text-xl font-bold text-white">
              GMGN
            </Link>

            {/* Nav Links */}
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-gray-300 hover:text-white transition">
                Market
              </Link>
              <Link to="/copy-trading" className="text-gray-300 hover:text-white transition">
                Copy Trading
              </Link>
              <Link to="/wallet" className="text-gray-300 hover:text-white transition">
                Wallet
              </Link>
            </div>

            {/* User section */}
            <div>
              {user ? (
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-white font-semibold">{user.username}</div>
                    <div className="text-xs text-gray-400">{user.solBalance.toFixed(2)} SOL</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          loadUser();
        }}
      />
    </>
  );
}

export default Navbar;
