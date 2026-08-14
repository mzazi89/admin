'use client';
import { useState } from 'react';

// Copy-to-clipboard button with feedback
export default function CopyButton({ text, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${className}`}
      style={{
        color: copied ? '#4ade80' : '#60a5fa',
        backgroundColor: copied ? 'rgba(74,222,128,0.1)' : 'rgba(37,99,235,0.1)',
        border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(37,99,235,0.25)'}`,
        cursor: 'pointer',
      }}
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}
