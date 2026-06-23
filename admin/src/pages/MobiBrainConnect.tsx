import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

type ConnectToken = {
  id: string;
  name: string;
  client: string;
  status: 'active' | 'revoked';
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type ConnectState = {
  principal: { email: string; username: string; groups: string[] };
  tokens: ConnectToken[];
  mcpUrl: string;
  disabledTools: string[];
};

type CreatedToken = {
  token: ConnectToken;
  plainToken: string;
  mcpUrl: string;
  disabledTools: string[];
};

const clientOptions = [
  { value: 'codex', label: 'Codex Desktop/CLI' },
  { value: 'claude-code', label: 'Claude Code/CLI' },
  { value: 'claude-desktop', label: 'Claude Desktop' },
  { value: 'generic', label: '기타 MCP 클라이언트' },
];

function formatDate(value: string | null) {
  if (!value) return 'never';
  return new Date(value).toLocaleString();
}

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-secondary connect-copy"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      type="button"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

function CodeBlock({ value }: { value: string }) {
  return (
    <div className="code-block connect-code">
      <CopyButton value={value} />
      <pre>{value}</pre>
    </div>
  );
}

export function MobiBrainConnectPage() {
  const [state, setState] = useState<ConnectState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [client, setClient] = useState('codex');
  const [label, setLabel] = useState('');
  const [created, setCreated] = useState<CreatedToken | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setState(await api.mobibrainConnectTokens());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const disabledToolsToml = useMemo(() => {
    const tools = state?.disabledTools ?? created?.disabledTools ?? [];
    return `disabled_tools = [\n${tools.map(t => `  "${t}",`).join('\n')}\n]\ndefault_tools_approval_mode = "prompt"`;
  }, [state?.disabledTools, created?.disabledTools]);

  const mcpUrl = state?.mcpUrl ?? created?.mcpUrl ?? 'https://brain.mobiligent.io/mcp';
  const envSnippet = `mkdir -p ~/.config/mobibrain\ncat > ~/.config/mobibrain/mcp.env <<'EOF'\nMOBIBRAIN_MCP_URL=${mcpUrl}\nMOBIBRAIN_REMOTE_TOKEN=<여기에 생성한 gbrain_... 토큰>\nEOF\nchmod 0600 ~/.config/mobibrain/mcp.env`;
  const codexSnippet = `set -a\n. ~/.config/mobibrain/mcp.env\nset +a\n\ncodex mcp add mobibrain \\\n  --url "$MOBIBRAIN_MCP_URL" \\\n  --bearer-token-env-var MOBIBRAIN_REMOTE_TOKEN`;
  const claudeCodeSnippet = `set -a\n. ~/.config/mobibrain/mcp.env\nset +a\n\nclaude mcp add mobibrain -t http \\\n  "$MOBIBRAIN_MCP_URL" \\\n  -H "Authorization: Bearer $MOBIBRAIN_REMOTE_TOKEN"`;

  const createToken = async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await api.createMobibrainConnectToken({ client, label: label.trim() || undefined });
      setCreated(result);
      setLabel('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (token: ConnectToken) => {
    if (!confirm(`토큰을 폐기할까요?\n\n${token.name}`)) return;
    setError(null);
    try {
      await api.revokeMobibrainConnectToken(token.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main className="connect-page">
      <div className="connect-shell">
        <header className="connect-header">
          <div>
            <div className="connect-kicker">MobiBrain Connect</div>
            <h1>Claude/Codex 연결 토큰</h1>
          </div>
          <div className="connect-endpoint mono">{mcpUrl}</div>
        </header>

        {error && <div className="warning-bar">{error}</div>}
        {loading && <div className="feed-empty">Loading...</div>}

        {state && (
          <>
            <section className="connect-section">
              <div>
                <h2>내 계정</h2>
                <p>{state.principal.email}</p>
              </div>
              <div className="connect-groups">
                {state.principal.groups.map(group => (
                  <span className="badge badge-read" key={group}>{group}</span>
                ))}
              </div>
            </section>

            <section className="connect-section">
              <div>
                <h2>새 토큰 만들기</h2>
                <p>토큰은 한 번만 표시된다. 클라이언트별로 따로 만들고, 노출되면 즉시 폐기한다.</p>
              </div>
              <div className="connect-create-grid">
                <div>
                  <label htmlFor="client">클라이언트</label>
                  <select id="client" value={client} onChange={e => setClient(e.target.value)}>
                    {clientOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="label">라벨</label>
                  <input
                    id="label"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="예: laptop, desktop"
                  />
                </div>
                <button className="btn btn-primary" disabled={creating} onClick={createToken} type="button">
                  {creating ? 'Creating...' : 'Create Token'}
                </button>
              </div>
            </section>

            {created && (
              <section className="connect-section connect-secret">
                <div>
                  <h2>생성된 토큰</h2>
                  <p>지금 이 화면에서만 볼 수 있다. 저장한 뒤 창을 닫는다.</p>
                </div>
                <div className="code-block connect-code connect-token">
                  <CopyButton value={created.plainToken} label="Copy Token" />
                  <pre>{created.plainToken}</pre>
                </div>
              </section>
            )}

            <section className="connect-section connect-stack">
              <div>
                <h2>내 토큰</h2>
                <p>이 화면에서는 본인 계정으로 만든 토큰만 보인다.</p>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Last Used</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {state.tokens.length === 0 && (
                    <tr>
                      <td colSpan={6} className="connect-empty">아직 생성한 토큰이 없다.</td>
                    </tr>
                  )}
                  {state.tokens.map(token => (
                    <tr key={token.id}>
                      <td className="mono">{token.name}</td>
                      <td>{token.client}</td>
                      <td>
                        <span className={`status-dot ${token.status === 'active' ? 'status-active' : 'status-inactive'}`} />
                        {token.status}
                      </td>
                      <td>{formatDate(token.created_at)}</td>
                      <td>{formatDate(token.last_used_at)}</td>
                      <td>
                        {token.status === 'active' && (
                          <button className="btn btn-danger" onClick={() => revokeToken(token)} type="button">
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="connect-section connect-stack">
              <div>
                <h2>1. 로컬 토큰 파일</h2>
                <p>생성한 토큰을 직원 PC의 로컬 env 파일에 저장한다. repo 안에는 두지 않는다.</p>
              </div>
              <CodeBlock value={envSnippet} />
            </section>

            <section className="connect-section connect-stack">
              <div>
                <h2>2A. Codex Desktop/CLI</h2>
                <p>Codex CLI와 Codex Desktop은 같은 MCP 설정을 사용한다. 터미널에서 한 번 등록한다.</p>
              </div>
              <CodeBlock value={codexSnippet} />
              <p className="connect-note">`~/.codex/config.toml`의 `[mcp_servers.mobibrain]` 아래에 다음 hardening 값을 추가한다.</p>
              <CodeBlock value={disabledToolsToml} />
            </section>

            <section className="connect-section connect-stack">
              <div>
                <h2>2B. Claude Code/CLI</h2>
                <p>Claude Code는 HTTP MCP 서버와 Authorization header를 직접 등록한다.</p>
              </div>
              <CodeBlock value={claudeCodeSnippet} />
            </section>

            <section className="connect-section connect-stack">
              <div>
                <h2>2C. Claude Desktop</h2>
                <p>Settings &gt; Integrations에서 remote MCP URL과 bearer token을 등록한다.</p>
              </div>
              <CodeBlock value={`URL: ${mcpUrl}\nAuthorization: Bearer <생성한 gbrain_... 토큰>`} />
            </section>

            <section className="connect-section connect-stack">
              <div>
                <h2>3. 확인 프롬프트</h2>
                <p>연결 뒤 새 대화에서 아래처럼 확인한다.</p>
              </div>
              <CodeBlock value={'Search MobiBrain for Mobiligent and show the source page names.'} />
            </section>

            <section className="connect-section connect-stack">
              <div>
                <h2>보안 규칙</h2>
                <p>MobiBrain 직원 MCP는 general projection 전용이다. 민감 내용은 이 경로에 쓰지 않는다.</p>
              </div>
              <ul className="connect-rules">
                <li>토큰은 직원별, 클라이언트별로 따로 만든다.</li>
                <li>평문 토큰은 생성 직후 한 번만 표시된다.</li>
                <li>토큰이 노출되었거나 PC를 교체했으면 이 화면에서 즉시 폐기한다.</li>
                <li>MobiBrain은 결정권자가 아니며, 승인과 최종 결정은 원본 시스템을 SoT로 본다.</li>
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
