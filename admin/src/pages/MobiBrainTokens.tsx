import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

type AdminToken = {
  id: string;
  name: string;
  status: 'active' | 'revoked';
  managed_by: string;
  owner_email: string | null;
  owner_username: string | null;
  client: string;
  namespace: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  total_requests: number;
  requests_today: number;
  total_errors: number;
  errors_today: number;
  last_request_at: string | null;
};

type AdminTokensResponse = {
  tokens: AdminToken[];
  summary: {
    total: number;
    active: number;
    revoked: number;
    requests_today: number;
    errors_today: number;
  };
};

function formatDate(value: string | null) {
  if (!value) return 'never';
  return new Date(value).toLocaleString();
}

function shortId(id: string) {
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function MobiBrainTokensPage() {
  const [data, setData] = useState<AdminTokensResponse | null>(null);
  const [hideRevoked, setHideRevoked] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setError('');
    try {
      setData(await api.mobibrainAdminTokens());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleTokens = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.tokens ?? []).filter(token => {
      if (hideRevoked && token.status !== 'active') return false;
      if (!q) return true;
      return [
        token.name,
        token.owner_email ?? '',
        token.owner_username ?? '',
        token.client,
        token.managed_by,
        token.namespace ?? '',
        token.id,
      ].some(value => value.toLowerCase().includes(q));
    });
  }, [data?.tokens, hideRevoked, query]);

  const disableToken = async (token: AdminToken) => {
    if (!confirm(`Disable this token immediately?\n\n${token.name}`)) return;
    setBusyId(token.id);
    setError('');
    try {
      await api.disableMobibrainAdminToken(token.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const deleteToken = async (token: AdminToken) => {
    if (!confirm(`Permanently delete this token record?\n\n${token.name}\n\nRequest logs remain by token name.`)) return;
    setBusyId(token.id);
    setError('');
    try {
      await api.deleteMobibrainAdminToken(token.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-kicker">MobiBrain</div>
          <h1 className="page-title">Tokens</h1>
        </div>
        <div className="toolbar">
          <label className="checkbox-label">
            <input type="checkbox" checked={hideRevoked} onChange={e => setHideRevoked(e.target.checked)} />
            Hide revoked
          </label>
          <button className="btn btn-secondary" onClick={load} type="button">Refresh</button>
        </div>
      </div>

      {error && <div className="warning-bar">{error}</div>}

      <div className="metrics">
        <div className="metric">
          <div className="metric-value">{data?.summary.active ?? '-'}</div>
          <div className="metric-label">Active Tokens</div>
        </div>
        <div className="metric">
          <div className="metric-value">{data?.summary.requests_today ?? '-'}</div>
          <div className="metric-label">Requests Today</div>
        </div>
        <div className="metric">
          <div className="metric-value">{data?.summary.errors_today ?? '-'}</div>
          <div className="metric-label">Errors Today</div>
        </div>
        <div className="metric">
          <div className="metric-value">{data?.summary.total ?? '-'}</div>
          <div className="metric-label">Total Records</div>
        </div>
      </div>

      <div className="filter-bar">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search name, owner, client, namespace"
        />
      </div>

      {!data ? (
        <div className="feed-empty">Loading tokens...</div>
      ) : visibleTokens.length === 0 ? (
        <div className="feed-empty">No tokens match the current filter.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Owner</th>
              <th>Client</th>
              <th>Status</th>
              <th>Usage</th>
              <th>Last Used</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleTokens.map(token => (
              <tr key={token.id}>
                <td>
                  <div className="mono" style={{ fontWeight: 600 }}>{token.name}</div>
                  <div className="subtle">id {shortId(token.id)} · {token.managed_by}</div>
                </td>
                <td>
                  <div>{token.owner_email ?? 'legacy/admin'}</div>
                  {token.namespace && <div className="subtle">{token.namespace}</div>}
                </td>
                <td>{token.client}</td>
                <td>
                  <span className={`badge ${token.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                    {token.status}
                  </span>
                </td>
                <td>
                  <span className="mono">{token.requests_today}</span>
                  <span className="subtle"> / {token.total_requests}</span>
                  {token.total_errors > 0 && (
                    <div className="subtle danger-text">{token.errors_today} / {token.total_errors} errors</div>
                  )}
                </td>
                <td>{formatDate(token.last_request_at ?? token.last_used_at)}</td>
                <td>{formatDate(token.created_at)}</td>
                <td>
                  <div className="row-actions">
                    {token.status === 'active' && (
                      <button
                        className="btn btn-secondary"
                        disabled={busyId === token.id}
                        onClick={() => disableToken(token)}
                        type="button"
                      >
                        Disable
                      </button>
                    )}
                    <button
                      className="btn btn-danger"
                      disabled={busyId === token.id}
                      onClick={() => deleteToken(token)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
