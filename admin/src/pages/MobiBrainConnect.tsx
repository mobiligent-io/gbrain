import React, { useEffect, useMemo, useRef, useState } from 'react';
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

type ClientKey = 'codex' | 'claude-code' | 'claude-desktop' | 'generic';
type AutoOs = 'macos' | 'linux' | 'windows' | 'wsl';
type GuideId =
  | 'usage'
  | 'google-chat'
  | 'auto'
  | 'env'
  | 'codex'
  | 'claude-code'
  | 'claude-desktop'
  | 'verify'
  | 'security';

const clientOptions: { value: ClientKey; label: string }[] = [
  { value: 'codex', label: 'Codex Desktop/CLI' },
  { value: 'claude-code', label: 'Claude Code/CLI' },
  { value: 'claude-desktop', label: 'Claude Desktop' },
  { value: 'generic', label: '기타 MCP 클라이언트' },
];

const autoOsOptions: { value: AutoOs; label: string }[] = [
  { value: 'macos', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
  { value: 'windows', label: 'Windows' },
  { value: 'wsl', label: 'WSL' },
];

const companyInterfaces = [
  {
    title: 'Google Chat',
    meta: 'CEO / CXO 스페이스',
    body: '회사 공용 대화 채널에서는 @MobiBrain을 멘션해 문서 검색, 인덱싱 상태, 출처 확인을 요청하세요.',
    detail: 'CEO는 platform_admin, CXO는 general 권한으로 응답 범위가 나뉩니다.',
  },
  {
    title: 'Claude Desktop Extension',
    meta: '개인 PC의 Claude Desktop',
    body: 'Claude Desktop에서 MobiBrain MCP를 Extension으로 연결해 로컬 작업 중 회사 지식을 검색하세요.',
    detail: '이 페이지에서 만든 개인 토큰을 Extension 설정에 넣습니다.',
  },
  {
    title: 'Claude Code / Codex',
    meta: '개발자 CLI와 Desktop 앱',
    body: '터미널이나 Codex 앱에서 MobiBrain MCP를 등록해 코드 작업 중 회사 지식을 조회하세요.',
    detail: '자동 설정 스크립트가 토큰 파일과 MCP 등록을 처리합니다.',
  },
];

const claudeDesktopSteps = [
  '이 페이지에서 클라이언트를 Claude Desktop으로 선택하고 토큰을 만드세요.',
  'Claude Desktop을 열고 Settings > Extensions로 이동하세요.',
  '회사에서 배포한 MobiBrain Extension 파일이 있으면 설치하세요. 메뉴가 Integrations로 표시되면 Add Integration을 사용하세요.',
  'MCP URL에는 아래 endpoint를, 인증 방식에는 Bearer Token을 넣으세요.',
  '생성된 gbrain_... 토큰을 붙여 넣고 저장한 뒤 새 대화를 여세요.',
];

const guideByClient: Record<ClientKey, GuideId> = {
  codex: 'codex',
  'claude-code': 'claude-code',
  'claude-desktop': 'claude-desktop',
  generic: 'auto',
};

const clientGuideSummaries: Record<ClientKey, string> = {
  codex: 'Codex Desktop과 CLI는 같은 MCP 설정을 사용합니다. 토큰 파일을 만든 뒤 CLI에서 한 번 등록하세요.',
  'claude-code': 'Claude Code는 HTTP MCP 서버와 Authorization header를 직접 등록합니다.',
  'claude-desktop': 'Claude Desktop에서는 Extension 또는 Integrations 화면에 MCP URL과 Bearer Token을 입력하세요.',
  generic: '기타 MCP 클라이언트는 MCP URL과 Bearer Token 값을 직접 등록하세요.',
};

function formatDate(value: string | null) {
  if (!value) return 'never';
  return new Date(value).toLocaleString();
}

function detectAutoOs(): AutoOs {
  if (typeof navigator === 'undefined') return 'macos';
  const platform = `${navigator.platform || ''} ${navigator.userAgent || ''}`;
  if (/Win/i.test(platform)) return 'windows';
  if (/Linux/i.test(platform)) return 'linux';
  return 'macos';
}

function CopyButton({ value, label = '복사', inline = false }: { value: string; label?: string; inline?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      aria-label={`${label}: 클립보드에 복사`}
      className={`btn btn-secondary ${inline ? 'connect-copy-inline' : 'connect-copy'}`}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
      type="button"
    >
      <span aria-hidden="true" className="connect-copy-icon">{copied ? '✓' : '⧉'}</span>
      <span>{copied ? '복사됨' : label}</span>
    </button>
  );
}

function CodeBlock({ value }: { value: string }) {
  return (
    <div className="code-block connect-code">
      <CopyButton value={value} />
      <pre><code>{value}</code></pre>
    </div>
  );
}

function GuideAccordion({
  id,
  title,
  badge,
  open,
  highlighted,
  onToggle,
  children,
}: {
  id: GuideId;
  title: string;
  badge?: string;
  open: boolean;
  highlighted?: boolean;
  onToggle: (id: GuideId, open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <details
      className={`connect-guide-accordion ${highlighted ? 'is-highlighted' : ''}`}
      id={`guide-${id}`}
      onToggle={event => onToggle(id, event.currentTarget.open)}
      open={open}
    >
      <summary>
        <span>{title}</span>
        {badge && <span className="connect-guide-badge">{badge}</span>}
      </summary>
      <div className="connect-guide-body">{children}</div>
    </details>
  );
}

export function MobiBrainConnectPage() {
  const [state, setState] = useState<ConnectState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [client, setClient] = useState<ClientKey>('codex');
  const [label, setLabel] = useState('');
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [autoOs, setAutoOs] = useState<AutoOs>(detectAutoOs);
  const [showAllGuides, setShowAllGuides] = useState(false);
  const [openGuides, setOpenGuides] = useState<Partial<Record<GuideId, boolean>>>({});
  const tokenFormRef = useRef<HTMLElement | null>(null);
  const clientSelectRef = useRef<HTMLSelectElement | null>(null);

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

  const selectedGuideId = guideByClient[client];

  useEffect(() => {
    setOpenGuides(prev => ({ ...prev, [selectedGuideId]: true }));
  }, [selectedGuideId]);

  const mcpUrl = state?.mcpUrl ?? created?.mcpUrl ?? 'https://brain.mobiligent.io/mcp';
  const installOrigin = typeof window === 'undefined' ? 'https://brain.mobiligent.io' : window.location.origin;
  const installerUrls = {
    macos: `${installOrigin}/connect/install/macos.sh`,
    linux: `${installOrigin}/connect/install/linux.sh`,
    windows: `${installOrigin}/connect/install/windows.ps1`,
    wsl: `${installOrigin}/connect/install/linux.sh`,
  };
  const autoInstallSnippets: Record<AutoOs, string> = {
    macos: `curl -fsSL ${installerUrls.macos} | bash -s -- --client ${client} --force`,
    linux: `curl -fsSL ${installerUrls.linux} | bash -s -- --client ${client} --force`,
    windows: `$script = Join-Path $env:TEMP "install-mobibrain-windows.ps1"\nInvoke-RestMethod ${installerUrls.windows} -OutFile $script\nPowerShell -ExecutionPolicy Bypass -File $script -Client ${client} -Force`,
    wsl: `curl -fsSL ${installerUrls.wsl} | bash -s -- --client ${client} --force`,
  };
  const autoInstallNotes: Record<AutoOs, string> = {
    macos: '터미널에서 실행하세요. 토큰을 물으면 위에서 복사한 gbrain_... 값을 붙여넣으세요.',
    linux: '사용자 계정의 shell에서 실행하세요. 토큰 파일은 ~/.config/mobibrain/mcp.env에 저장됩니다.',
    windows: 'PowerShell에서 실행하세요. 토큰은 사용자 환경변수와 AppData 토큰 파일에 저장됩니다.',
    wsl: 'Windows PowerShell이 아니라 WSL 배포판 안의 Linux shell에서 실행하세요.',
  };
  const envSnippet = `mkdir -p ~/.config/mobibrain\ncat > ~/.config/mobibrain/mcp.env <<'EOF'\nMOBIBRAIN_MCP_URL=${mcpUrl}\nMOBIBRAIN_REMOTE_TOKEN=<여기에 생성한 gbrain_... 토큰>\nEOF\nchmod 0600 ~/.config/mobibrain/mcp.env`;
  const codexSnippet = `set -a\n. ~/.config/mobibrain/mcp.env\nset +a\n\ncodex mcp add mobibrain \\\n  --url "$MOBIBRAIN_MCP_URL" \\\n  --bearer-token-env-var MOBIBRAIN_REMOTE_TOKEN`;
  const claudeCodeSnippet = `set -a\n. ~/.config/mobibrain/mcp.env\nset +a\n\nclaude mcp add mobibrain -t http \\\n  "$MOBIBRAIN_MCP_URL" \\\n  -H "Authorization: Bearer $MOBIBRAIN_REMOTE_TOKEN"`;
  const claudeDesktopSnippet = `Extension name: MobiBrain\nMCP URL: ${mcpUrl}\nAuthentication: Bearer Token\nToken: <이 페이지에서 생성한 gbrain_... 토큰>`;
  const googleChatPrompt = `@MobiBrain MobiShare에 오늘 등록된 문서 중 CXO 채널에서 볼 수 있는 내용을 출처와 함께 요약해주세요.`;
  const claudeDesktopPrompt = `MobiBrain에서 Mobiligent를 검색하고, 답변에 사용한 출처 페이지 이름을 함께 알려주세요.`;

  const selectedClientLabel = clientOptions.find(option => option.value === client)?.label ?? client;

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

  const signOut = () => {
    if (!confirm('MobiBrain Connect에서 로그아웃할까요? 현재 브라우저의 Authentik 세션도 종료됩니다.')) return;
    window.location.assign('/admin/logout?return_to=/connect');
  };

  const focusTokenForm = () => {
    tokenFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => clientSelectRef.current?.focus(), 260);
  };

  const toggleGuide = (id: GuideId, open: boolean) => {
    setOpenGuides(prev => ({ ...prev, [id]: open }));
  };

  const isGuideOpen = (id: GuideId) => openGuides[id] ?? id === selectedGuideId;
  const isClientGuideVisible = (id: GuideId) => showAllGuides || id === selectedGuideId;

  return (
    <main className="connect-page">
      <div className="connect-shell">
        <header className="connect-header">
          <div className="connect-header-main">
            <div className="connect-kicker">MobiBrain Connect</div>
            <h1>Claude/Codex 연결 토큰</h1>
            <p className="connect-header-copy">개인 토큰을 발급하고 로컬 클라이언트에 MobiBrain MCP를 연결하세요.</p>
          </div>
          <div className="connect-header-actions">
            <div className="connect-reference-info" aria-label="MCP endpoint 참고 정보">
              <div>
                <span>참고 정보</span>
                <strong>MCP endpoint</strong>
                <code>{mcpUrl}</code>
              </div>
              <CopyButton inline label="복사" value={mcpUrl} />
            </div>
            {state && (
              <div className="connect-account-actions">
                <div>
                  <span>계정</span>
                  <strong>{state.principal.email}</strong>
                </div>
                <button className="btn btn-secondary" onClick={signOut} type="button">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {error && <div className="warning-bar">{error}</div>}
        {loading && <div className="feed-empty">Loading...</div>}

        {state && (
          <>
            <section className="connect-account-summary" aria-labelledby="connect-groups-heading">
              <div>
                <h2 id="connect-groups-heading">내 권한 그룹</h2>
                <p>Authentik 로그인 기준으로 이 페이지와 토큰 API 접근 범위가 결정됩니다.</p>
              </div>
              <div className="connect-groups">
                {state.principal.groups.map(group => (
                  <span aria-label={`권한 그룹: ${group}`} className="badge badge-read" key={group}>{group}</span>
                ))}
              </div>
            </section>

            <div className="connect-work-layout">
              <div className="connect-task-column">
                <section className="connect-panel connect-token-form-panel" ref={tokenFormRef}>
                  <div className="connect-panel-heading">
                    <div>
                      <div className="connect-section-label">작업 영역</div>
                      <h2>새 토큰 만들기</h2>
                    </div>
                    <span className="connect-client-chip">{selectedClientLabel}</span>
                  </div>
                  <div className="connect-inline-notice" role="note">
                    <strong>토큰은 발급 직후 1회만 표시됩니다.</strong>
                    <p>창을 닫으면 다시 볼 수 없습니다. 복사한 뒤 안전한 로컬 설정에 저장하세요.</p>
                  </div>
                  <div className="connect-create-grid">
                    <div>
                      <label htmlFor="client">클라이언트</label>
                      <select
                        id="client"
                        ref={clientSelectRef}
                        value={client}
                        onChange={e => setClient(e.target.value as ClientKey)}
                      >
                        {clientOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="label">라벨</label>
                      <input
                        aria-describedby="label-help"
                        id="label"
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        placeholder="예: 사내 맥북"
                      />
                      <p className="connect-field-help" id="label-help">이 토큰을 식별할 이름을 입력하세요. 예: 사내 맥북, 집 데스크톱</p>
                    </div>
                    <button className="btn btn-primary" disabled={creating} onClick={createToken} type="button">
                      {creating ? '생성 중...' : '토큰 만들기'}
                    </button>
                  </div>
                </section>

                {created && (
                  <section aria-live="polite" className="connect-panel connect-created-token">
                    <div>
                      <div className="connect-section-label">발급 완료</div>
                      <h2>생성된 토큰</h2>
                      <p>지금 이 화면에서만 볼 수 있습니다. 바로 복사해 클라이언트 설정에 넣으세요.</p>
                    </div>
                    <div className="code-block connect-code connect-token">
                      <CopyButton value={created.plainToken} label="토큰 복사" />
                      <pre><code>{created.plainToken}</code></pre>
                    </div>
                  </section>
                )}

                <section className="connect-panel connect-token-list-panel">
                  <div className="connect-panel-heading">
                    <div>
                      <div className="connect-section-label">작업 영역</div>
                      <h2>내 토큰</h2>
                    </div>
                    <span className="connect-token-count">{state.tokens.length}개</span>
                  </div>
                  <p className="connect-panel-copy">이 화면에서는 본인 계정으로 만든 토큰만 보입니다.</p>
                  {state.tokens.length === 0 ? (
                    <div className="connect-empty-state" role="status">
                      <div aria-hidden="true" className="connect-empty-icon">+</div>
                      <strong>아직 생성한 토큰이 없습니다.</strong>
                      <p>사용할 클라이언트를 선택하고 첫 토큰을 만들어 보세요.</p>
                      <button className="btn btn-primary" onClick={focusTokenForm} type="button">
                        토큰 만들기
                      </button>
                    </div>
                  ) : (
                    <div className="connect-table-wrap">
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
                                    폐기
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              <aside className="connect-side-guide" aria-labelledby="connect-side-guide-heading">
                <div className="connect-side-guide-sticky">
                  <div className="connect-section-label">선택 가이드</div>
                  <h2 id="connect-side-guide-heading">{selectedClientLabel}</h2>
                  <p>{clientGuideSummaries[client]}</p>
                  <div className="connect-side-guide-actions">
                    <a className="btn btn-secondary" href={`#guide-${selectedGuideId}`}>상세 가이드</a>
                    <button className="btn btn-secondary" onClick={() => setShowAllGuides(value => !value)} type="button">
                      {showAllGuides ? '선택 가이드만 보기' : '모든 클라이언트 가이드 보기'}
                    </button>
                  </div>
                  <div className="connect-side-note">
                    <strong>다음 순서</strong>
                    <ol>
                      <li>클라이언트를 선택합니다.</li>
                      <li>토큰을 만들고 복사합니다.</li>
                      <li>아래에서 열린 가이드대로 연결합니다.</li>
                    </ol>
                  </div>
                </div>
              </aside>
            </div>

            <section className="connect-guide-area" aria-labelledby="connect-guide-heading">
              <div className="connect-guide-title">
                <div>
                  <div className="connect-kicker">가이드 / 참고</div>
                  <h2 id="connect-guide-heading">사용 방법</h2>
                  <p>선택한 클라이언트의 설치 가이드만 기본으로 펼쳐집니다. 필요한 경우 전체 가이드를 열어보세요.</p>
                </div>
                <button className="btn btn-secondary" onClick={() => setShowAllGuides(value => !value)} type="button">
                  {showAllGuides ? '선택 가이드만 보기' : '모든 클라이언트 가이드 보기'}
                </button>
              </div>

              <div className="connect-guide-list">
                <GuideAccordion
                  id="usage"
                  onToggle={toggleGuide}
                  open={isGuideOpen('usage')}
                  title="어디에서 쓰나요?"
                >
                  <p>회사 공용 질의는 Google Chat, 개인 PC 작업은 Claude Desktop Extension을 우선 사용하세요.</p>
                  <div className="connect-interface-grid">
                    {companyInterfaces.map(item => (
                      <article className="connect-interface-card" key={item.title}>
                        <div className="connect-interface-meta">{item.meta}</div>
                        <h3>{item.title}</h3>
                        <p>{item.body}</p>
                        <span>{item.detail}</span>
                      </article>
                    ))}
                  </div>
                </GuideAccordion>

                <GuideAccordion
                  id="google-chat"
                  onToggle={toggleGuide}
                  open={isGuideOpen('google-chat')}
                  title="Google Chat에서 쓰기"
                >
                  <p>CEO/CXO 스페이스에서는 별도 토큰을 만들지 않습니다. 스페이스에서 MobiBrain을 멘션하세요.</p>
                  <div className="connect-chat-panel">
                    <div className="connect-chat-row">
                      <span className="badge badge-read">CEO</span>
                      <p>platform_admin 권한으로 restricted/sensitive 내용을 포함해 조회할 수 있습니다.</p>
                    </div>
                    <div className="connect-chat-row">
                      <span className="badge badge-read">CXO</span>
                      <p>general 권한으로 공개 문서와 general 허용 restricted 문서만 조회할 수 있습니다.</p>
                    </div>
                    <CodeBlock value={googleChatPrompt} />
                  </div>
                </GuideAccordion>

                <GuideAccordion
                  highlighted={selectedGuideId === 'auto'}
                  id="auto"
                  onToggle={toggleGuide}
                  open={isGuideOpen('auto')}
                  title="자동 설정"
                  badge={selectedGuideId === 'auto' ? '선택됨' : undefined}
                >
                  <p>Claude Code, Codex, 터미널 중심 사용자는 운영체제와 클라이언트를 선택한 뒤 명령을 실행하세요.</p>
                  <div className="connect-auto-panel">
                    <div className="connect-os-tabs" role="tablist" aria-label="운영체제 선택">
                      {autoOsOptions.map(option => (
                        <button
                          aria-selected={autoOs === option.value}
                          className={`connect-os-tab ${autoOs === option.value ? 'active' : ''}`}
                          key={option.value}
                          onClick={() => setAutoOs(option.value)}
                          role="tab"
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="connect-note">{autoInstallNotes[autoOs]}</p>
                    <CodeBlock value={autoInstallSnippets[autoOs]} />
                    <ul className="connect-rules connect-auto-rules">
                      <li>토큰은 명령줄에 직접 넣지 마세요.</li>
                      <li>Codex 설정에는 destructive tool 차단값이 자동으로 추가됩니다.</li>
                      <li>Desktop 앱에서 env 전달이 막히면 아래 수동 설정 값을 앱 설정 화면에 직접 넣으세요.</li>
                    </ul>
                  </div>
                </GuideAccordion>

                <GuideAccordion
                  id="env"
                  onToggle={toggleGuide}
                  open={isGuideOpen('env')}
                  title="1. 로컬 토큰 파일"
                >
                  <p>생성한 토큰을 직원 PC의 로컬 env 파일에 저장하세요. repo 안에는 두지 마세요.</p>
                  <CodeBlock value={envSnippet} />
                </GuideAccordion>

                {isClientGuideVisible('codex') && (
                  <GuideAccordion
                    highlighted={selectedGuideId === 'codex'}
                    id="codex"
                    onToggle={toggleGuide}
                    open={isGuideOpen('codex')}
                    title="2A. Codex Desktop/CLI"
                    badge={selectedGuideId === 'codex' ? '선택됨' : undefined}
                  >
                    <p>Codex CLI와 Codex Desktop은 같은 MCP 설정을 사용합니다. 터미널에서 한 번 등록하세요.</p>
                    <CodeBlock value={codexSnippet} />
                    <p className="connect-note">`~/.codex/config.toml`의 `[mcp_servers.mobibrain]` 아래에 다음 hardening 값을 추가하세요.</p>
                    <CodeBlock value={disabledToolsToml} />
                  </GuideAccordion>
                )}

                {isClientGuideVisible('claude-code') && (
                  <GuideAccordion
                    highlighted={selectedGuideId === 'claude-code'}
                    id="claude-code"
                    onToggle={toggleGuide}
                    open={isGuideOpen('claude-code')}
                    title="2B. Claude Code/CLI"
                    badge={selectedGuideId === 'claude-code' ? '선택됨' : undefined}
                  >
                    <p>Claude Code는 HTTP MCP 서버와 Authorization header를 직접 등록합니다.</p>
                    <CodeBlock value={claudeCodeSnippet} />
                  </GuideAccordion>
                )}

                {isClientGuideVisible('claude-desktop') && (
                  <GuideAccordion
                    highlighted={selectedGuideId === 'claude-desktop'}
                    id="claude-desktop"
                    onToggle={toggleGuide}
                    open={isGuideOpen('claude-desktop')}
                    title="2C. Claude Desktop Extension"
                    badge={selectedGuideId === 'claude-desktop' ? '선택됨' : undefined}
                  >
                    <p>Settings &gt; Extensions에서 MobiBrain Extension을 설치하고 MCP URL과 bearer token을 등록하세요.</p>
                    <ol className="connect-steps">
                      {claudeDesktopSteps.map(step => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <CodeBlock value={claudeDesktopSnippet} />
                  </GuideAccordion>
                )}

                <GuideAccordion
                  id="verify"
                  onToggle={toggleGuide}
                  open={isGuideOpen('verify')}
                  title="3. 확인 프롬프트"
                >
                  <p>연결 뒤 새 대화에서 아래처럼 확인하세요.</p>
                  <CodeBlock value={claudeDesktopPrompt} />
                </GuideAccordion>

                <GuideAccordion
                  id="security"
                  onToggle={toggleGuide}
                  open={isGuideOpen('security')}
                  title="보안 규칙"
                >
                  <div className="connect-security-callout" role="note">
                    <strong>MobiBrain 직원 MCP는 general projection 전용입니다.</strong>
                    <p>민감 내용은 이 경로에 쓰지 마세요. CEO/CXO의 sensitive 조회 정책은 Google Chat 권한 매핑으로 분리됩니다.</p>
                  </div>
                  <ul className="connect-rules">
                    <li>토큰은 직원별, 클라이언트별로 따로 만드세요.</li>
                    <li>평문 토큰은 생성 직후 한 번만 표시됩니다.</li>
                    <li>토큰이 노출되었거나 PC를 교체했으면 이 화면에서 즉시 폐기하세요.</li>
                    <li>MobiBrain은 결정권자가 아닙니다. 승인과 최종 결정은 원본 시스템을 SoT로 보세요.</li>
                  </ul>
                </GuideAccordion>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
