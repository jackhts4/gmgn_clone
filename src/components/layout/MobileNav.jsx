import { Link, useLocation } from 'react-router-dom';

function MobileNav() {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
      <div className="flex items-center justify-around h-16">
        {/* Market */}
        <Link 
          to="/" 
          className={`flex flex-col items-center justify-center flex-1 ${
            isActive('/') ? 'text-blue-500' : 'text-gray-400'
          }`}
        >
          <span className="text-2xl mb-1">📊</span>
          <span className="text-xs">Market</span>
        </Link>

        {/* Copy Trading */}
        <Link 
          to="/copy-trading" 
          className={`flex flex-col items-center justify-center flex-1 ${
            isActive('/copy-trading') ? 'text-blue-500' : 'text-gray-400'
          }`}
        >
          <span className="text-2xl mb-1">👥</span>
          <span className="text-xs">Copy</span>
        </Link>

        {/* Wallet */}
        <Link 
          to="/wallet" 
          className={`flex flex-col items-center justify-center flex-1 ${
            isActive('/wallet') ? 'text-blue-500' : 'text-gray-400'
          }`}
        >
          <span className="text-2xl mb-1">👛</span>
          <span className="text-xs">Wallet</span>
        </Link>
      </div>
    </nav>
  );
}

export default MobileNav;
