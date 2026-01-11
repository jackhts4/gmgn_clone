import { useState } from 'react';
import { createUser, loginUser } from '../../utils/storage';
import { showToast } from './Toast';

function AuthModal({ isOpen, onClose, onSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    try {
      if (mode === 'register') {
        createUser(username, password);
        showToast('Account created! Please login.', 'success');
        setMode('login');
        setPassword('');
      } else {
        loginUser(username, password);
        // Dispatch auth change event
        window.dispatchEvent(new Event('auth-change'));
        showToast(`Welcome back, ${username}!`, 'success');
        onSuccess();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold text-white mb-6">
          {mode === 'login' ? 'Login' : 'Create Account'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="Enter username"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-500 text-sm">
              {error}
            </div>
          )}

          {mode === 'register' && (
            <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500 rounded text-blue-400 text-sm">
              💰 New users start with 100 SOL
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
          >
            {mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setPassword('');
            }}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            {mode === 'login' 
              ? "Don't have an account? Register" 
              : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
