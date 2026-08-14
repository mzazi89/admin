'use client';
import { createContext, useContext, useState, useCallback } from 'react';

// Lightweight toast notification system
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2" style={{ maxWidth: 340 }}>
        {toasts.map(t => (
          <div
            key={t.id}
            className="px-4 py-3 rounded-xl text-sm font-medium shadow-2xl animate-fade-in"
            style={{
              backgroundColor: '#060b16',
              border: `1px solid ${t.type === 'error' ? 'rgba(248,113,113,0.4)' : 'rgba(74,222,128,0.4)'}`,
              color: t.type === 'error' ? '#fca5a5' : '#bbf7d0',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
