'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fmtMtc } from '@/lib/currency';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/me').then(r => {
      if (!r.ok) { router.replace('/admin/login'); return; }
      fetch('/api/admin/users').then(async r2 => {
        if (r2.ok) { const d = await r2.json(); setUsers(d.users); }
        setLoading(false);
      });
    });
  }, []);

  const filtered = users.filter(u =>
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.fullname || '').toLowerCase().includes(search.toLowerCase()) ||
    ((u.firstname || '') + ' ' + (u.lastname || '')).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="eyebrow mb-4">Directory</div>
          <h1 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.4rem)' }}>
            Users <span className="mono" style={{ fontSize: '0.55em', fontWeight: 500, color: '#4C535B', letterSpacing: '0.1em' }}>({filtered.length})</span>
          </h1>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email"
          className="input mono" style={{ maxWidth: 300, fontSize: 13 }} />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner" />
          </div>
        ) : (
          <div className="scroll-x table-responsive">
            <table className="table-plain" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Wallet balance</th>
                  <th>Orders</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td data-label="ID" className="mono" style={{ color: '#4C535B', fontSize: 12 }}>#{u.id}</td>
                    <td data-label="Name">
                      <span className="flex items-center gap-2.5">
                        <span className="mono flex items-center justify-center flex-shrink-0"
                          style={{ width: 26, height: 26, border: '1px solid #262C33', borderRadius: 3, fontSize: 11, color: '#F2A93B', backgroundColor: '#0F1215' }}>
                          {(u.firstname || u.email || 'U')[0].toUpperCase()}
                        </span>
                        <span style={{ fontWeight: 600, color: '#E9E7E2' }}>{u.fullname || ((u.firstname || '') + ' ' + (u.lastname || '')).trim() || 'N/A'}</span>
                      </span>
                    </td>
                    <td data-label="Email" style={{ color: '#AEB5BD' }}>{u.email}</td>
                    <td data-label="Wallet balance" style={{ color: '#3ECF8E', fontWeight: 600 }}>{fmtMtc(u.wallet_balance || 0)}</td>
                    <td data-label="Orders" style={{ color: '#AEB5BD' }}>{u.total_orders}</td>
                    <td data-label="Joined" className="mono" style={{ color: '#4C535B', fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center" style={{ padding: '48px 0', color: '#4C535B' }}>No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
