'use client';
import CopyButton from './CopyButton';

// Code block with a copy button — no external syntax highlighter needed
export default function CodeBlock({ code, lang = 'json', label = null }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#020409', border: '1px solid #1e3a8a' }}>
      {(label || lang) && (
        <div className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: '#060b16', borderBottom: '1px solid #1e3a8a' }}>
          <span className="text-xs font-mono" style={{ color: '#64748b' }}>{label || lang}</span>
          <CopyButton text={code} label="Copy" />
        </div>
      )}
      {!label && !lang && (
        <div className="flex justify-end px-3 pt-2">
          <CopyButton text={code} label="Copy" />
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-xs leading-relaxed font-mono" style={{ color: '#cbd5e1', maxHeight: 480 }}>
        {code}
      </pre>
    </div>
  );
}
