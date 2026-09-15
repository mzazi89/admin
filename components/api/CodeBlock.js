'use client';
import CopyButton from './CopyButton';

// Code block with a copy button — no external syntax highlighter needed
export default function CodeBlock({ code, lang = 'json', label = null }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--blue-deep)' }}>
      {(label || lang) && (
        <div className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--blue-deep)' }}>
          <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{label || lang}</span>
          <CopyButton text={code} label="Copy" />
        </div>
      )}
      {!label && !lang && (
        <div className="flex justify-end px-3 pt-2">
          <CopyButton text={code} label="Copy" />
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-xs leading-relaxed font-mono" style={{ color: 'var(--ink-2)', maxHeight: 480 }}>
        {code}
      </pre>
    </div>
  );
}
