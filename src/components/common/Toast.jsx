import { useState, useEffect } from 'react';

// Global toast state
let toastListeners = [];
let toastId = 0;

export const showToast = (message, type = 'success') => {
  const id = ++toastId;
  toastListeners.forEach(listener => listener({ id, message, type }));
  return id;
};

function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const listener = (toast) => {
      setToasts(prev => [...prev, toast]);
      
      // Auto remove after 3 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 3000);
    };

    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-white font-medium animate-slide-in ${
            toast.type === 'success' ? 'bg-green-600' :
            toast.type === 'error' ? 'bg-red-600' :
            'bg-blue-600'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' && <span>✓</span>}
            {toast.type === 'error' && <span>✗</span>}
            {toast.message}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Toast;
