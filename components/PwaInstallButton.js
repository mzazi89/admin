'use client';
import { useEffect, useState } from 'react';
import { usePwa } from './PwaProvider';

// "Download App" button — only visible when the PWA is installable
// (native install available, or iOS where it shows the Add-to-Home-Screen hint).
export default function PwaInstallButton({ className = '' }) {
  const { canInstall, isIOS, isStandalone, requestInstall } = usePwa();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || isStandalone) return null;
  if (!canInstall && !isIOS) return null;

  return (
    <button onClick={requestInstall}
      className={`px-7 py-3.5 rounded-xl font-bold text-sm transition-all inline-flex items-center gap-2 ${className}`}
      style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.35)', cursor: 'pointer' }}>
      ⬇️ {isIOS ? 'Get the App' : 'Download App'}
    </button>
  );
}
