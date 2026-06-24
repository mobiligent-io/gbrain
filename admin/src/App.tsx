import React, { useState, useEffect } from 'react';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { AgentsPage } from './pages/Agents';
import { RequestLogPage } from './pages/RequestLog';
import { CalibrationPage } from './pages/Calibration';
import { JobsWatchPage } from './pages/JobsWatch';
import { MobiBrainConnectPage } from './pages/MobiBrainConnect';
import { MobiBrainExplorePage } from './pages/MobiBrainExplore';
import { MobiBrainTokensPage } from './pages/MobiBrainTokens';
import { api } from './api';

type Page = 'login' | 'dashboard' | 'agents' | 'mobibrain' | 'tokens' | 'log' | 'calibration' | 'jobs';

function getPage(): Page {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  if (['login', 'dashboard', 'agents', 'mobibrain', 'tokens', 'log', 'calibration', 'jobs'].includes(hash)) return hash as Page;
  return 'dashboard';
}

export function App() {
  const isConnectPage = window.location.pathname.startsWith('/connect') || window.location.pathname.startsWith('/admin/connect');
  const [page, setPage] = useState<Page>(getPage);

  useEffect(() => {
    const onHash = () => setPage(getPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (p: Page) => {
    window.location.hash = p;
    setPage(p);
  };

  if (isConnectPage) {
    return <MobiBrainConnectPage />;
  }

  if (page === 'login') {
    return <LoginPage onLogin={() => navigate('dashboard')} />;
  }

  const handleSignOutEverywhere = async () => {
    if (!confirm('Sign out every active admin session, including other browsers and tabs? Each one will need to re-authenticate via a fresh magic link.')) {
      return;
    }
    try {
      await api.signOutEverywhere();
    } catch {
      // Even if the call fails, push to login — cookie is likely already invalid.
    }
    navigate('login');
  };

  return (
    <div className="app" data-theme="camomile-ops" data-lang="ko">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <span className="brand-mark" aria-hidden="true" />
          <span>
            <span className="brand-title">MobiBrain</span>
            <span className="brand-subtitle">GBrain Admin</span>
          </span>
        </div>
        <div className="sidebar-nav">
          <div className="nav-label">운영</div>
          <a className={`nav-item ${page === 'dashboard' ? 'active' : ''}`}
             onClick={() => navigate('dashboard')}>Dashboard</a>
          <a className={`nav-item ${page === 'agents' ? 'active' : ''}`}
             onClick={() => navigate('agents')}>Agents</a>
          <a className={`nav-item ${page === 'mobibrain' ? 'active' : ''}`}
             onClick={() => navigate('mobibrain')}>MobiBrain</a>
          <a className={`nav-item ${page === 'tokens' ? 'active' : ''}`}
             onClick={() => navigate('tokens')}>Tokens</a>
          <div className="nav-label">진단</div>
          <a className={`nav-item ${page === 'log' ? 'active' : ''}`}
             onClick={() => navigate('log')}>Request Log</a>
          <a className={`nav-item ${page === 'calibration' ? 'active' : ''}`}
             onClick={() => navigate('calibration')}>Calibration</a>
          <a className={`nav-item ${page === 'jobs' ? 'active' : ''}`}
             onClick={() => navigate('jobs')}>Jobs Watch</a>
        </div>
        <div className="sidebar-footer">
          <button
            className="btn btn-secondary sidebar-signout"
            onClick={handleSignOutEverywhere}
            title="Revoke every active admin session — every browser, every tab"
          >
            Sign out everywhere
          </button>
        </div>
      </nav>
      <main className="main">
        {page === 'dashboard' && <DashboardPage />}
        {page === 'agents' && <AgentsPage />}
        {page === 'mobibrain' && <MobiBrainExplorePage />}
        {page === 'tokens' && <MobiBrainTokensPage />}
        {page === 'log' && <RequestLogPage />}
        {page === 'calibration' && <CalibrationPage />}
        {page === 'jobs' && <JobsWatchPage />}
      </main>
    </div>
  );
}
