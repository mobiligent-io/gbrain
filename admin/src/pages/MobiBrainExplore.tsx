import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

type ExploreSummary = {
  page_count: number;
  markdown_page_count: number;
  code_page_count: number;
  image_page_count: number;
  chunk_count: number;
  embedded_chunk_count: number;
  embedding_completion_ratio: number | null;
  text_chunk_count: number;
  image_chunk_count: number;
  timeline_entry_count: number;
  mobibrain_timeline_signal_count: number;
  timeline_signal_count: number;
  link_count: number;
  tag_count: number;
  source_count: number;
  stale_extraction_page_count: number;
  latest_page_updated_at: string | null;
  latest_embedded_at: string | null;
};

type ExploreDocument = {
  id: string;
  source_id: string | null;
  source_name: string;
  slug: string;
  section: string;
  namespace: string;
  title: string;
  type: string;
  page_kind: string;
  sensitivity: string | null;
  updated_at: string | null;
  effective_date: string | null;
  last_retrieved_at: string | null;
  links_extracted_at: string | null;
  chunk_count: number;
  embedded_chunk_count: number;
  timeline_count: number;
  mobibrain_timeline_count: number;
  timeline_signal_count: number;
  outgoing_link_count: number;
  incoming_link_count: number;
  tags: string[];
  source_links: string[];
};

type ExploreCount = {
  namespace?: string;
  section?: string;
  page_count: number;
  chunk_count: number;
  embedded_chunk_count: number;
  latest_updated_at: string | null;
};

type ExploreSource = {
  id: string;
  name: string;
  local_path: string | null;
  last_commit: string | null;
  last_sync_at: string | null;
  newest_content_at: string | null;
  chunker_version: string | null;
  archived: boolean;
};

type ExploreCheckpoint = {
  op: string;
  count: number;
  latest_updated_at: string | null;
};

type ExploreResponse = {
  generated_at: string;
  document_limit: number;
  sync_policy: {
    indexed_surface: string;
    mobishare_bridge_interval_minutes: number;
    gbrain_sync_interval_minutes: number;
    max_expected_latency_minutes: number;
    flow: string[];
  };
  summary: ExploreSummary;
  namespaces: ExploreCount[];
  sections: ExploreCount[];
  sources: ExploreSource[];
  checkpoints: ExploreCheckpoint[];
  capabilities: Array<{ key: string; title: string; description: string }>;
  sample_questions: string[];
  documents: ExploreDocument[];
};

type IndexingStep = {
  key: string;
  title: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  output_tail: string;
  error: string | null;
};

type IndexingRun = {
  id: string;
  status: 'running' | 'succeeded' | 'failed';
  started_at: string;
  finished_at: string | null;
  steps: IndexingStep[];
  output_tail: string;
  error: string | null;
};

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString();
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortCommit(value: string | null) {
  if (!value) return '-';
  return value.length > 10 ? value.slice(0, 10) : value;
}

function evidenceCount(doc: ExploreDocument) {
  return doc.source_links.length + doc.outgoing_link_count + doc.incoming_link_count;
}

function runStatusLabel(status: IndexingRun['status']) {
  if (status === 'running') return '실행 중';
  if (status === 'succeeded') return '완료';
  return '실패';
}

function stepStatusLabel(status: IndexingStep['status']) {
  if (status === 'pending') return '대기';
  if (status === 'running') return '실행 중';
  if (status === 'succeeded') return '완료';
  return '실패';
}

function statusClass(status: IndexingRun['status'] | IndexingStep['status']) {
  if (status === 'succeeded') return 'badge-success';
  if (status === 'failed') return 'badge-danger';
  return 'badge-read';
}

export function MobiBrainExplorePage() {
  const [data, setData] = useState<ExploreResponse | null>(null);
  const [query, setQuery] = useState('');
  const [namespace, setNamespace] = useState('all');
  const [section, setSection] = useState('all');
  const [error, setError] = useState('');
  const [indexingRun, setIndexingRun] = useState<IndexingRun | null>(null);
  const [runningAction, setRunningAction] = useState(false);

  const load = async () => {
    setError('');
    try {
      setData(await api.mobibrainExplore());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadIndexingStatus = async () => {
    try {
      const response = await api.mobibrainIndexingRun();
      setIndexingRun(response.run ?? null);
      return response.run ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  const runIndexing = async () => {
    const ok = window.confirm(
      '지금 MobiBrain 동기화/인덱싱을 실행할까요?\n\n'
      + 'general projection 갱신, GBrain DB sync, extract, embedding을 순서대로 실행합니다. 실행 중에는 같은 작업을 중복 실행할 수 없습니다.',
    );
    if (!ok) return;

    setRunningAction(true);
    setError('');
    try {
      const response = await api.runMobibrainIndexing();
      setIndexingRun(response.run ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunningAction(false);
    }
  };

  useEffect(() => {
    void load();
    void loadIndexingStatus();
  }, []);

  useEffect(() => {
    if (indexingRun?.status !== 'running') return;
    const timer = window.setInterval(() => {
      void loadIndexingStatus().then(nextRun => {
        if (nextRun && nextRun.status !== 'running') void load();
      });
    }, 2500);
    return () => window.clearInterval(timer);
  }, [indexingRun?.status]);

  const namespaces = useMemo(() => data?.namespaces.map(item => item.namespace ?? 'general') ?? [], [data]);
  const sections = useMemo(() => data?.sections.map(item => item.section ?? 'uncategorized') ?? [], [data]);

  const visibleDocuments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.documents ?? []).filter(doc => {
      if (namespace !== 'all' && doc.namespace !== namespace) return false;
      if (section !== 'all' && doc.section !== section) return false;
      if (!q) return true;
      return [
        doc.title,
        doc.slug,
        doc.type,
        doc.page_kind,
        doc.source_name,
        doc.namespace,
        doc.section,
        doc.sensitivity ?? '',
        ...doc.tags,
        ...doc.source_links,
      ].some(value => value.toLowerCase().includes(q));
    });
  }, [data?.documents, namespace, query, section]);

  const isIndexingRunning = indexingRun?.status === 'running';

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-kicker">MobiBrain</div>
          <h1 className="page-title">인덱싱 현황</h1>
        </div>
        <div className="toolbar">
          <button
            className="btn btn-primary"
            disabled={runningAction || isIndexingRunning}
            onClick={runIndexing}
            type="button"
          >
            {isIndexingRunning ? '실행 중' : '동기화/인덱싱 실행'}
          </button>
          <button className="btn btn-secondary" onClick={load} type="button">Refresh</button>
        </div>
      </div>

      {error && <div className="warning-bar">{error}</div>}

      <div className="explore-summary-band">
        <div>
          <div className="section-title">운영 반영 주기</div>
          <div className="explore-flow">
            <span>MobiShare bridge {data?.sync_policy.mobishare_bridge_interval_minutes ?? 20}분</span>
            <span>GBrain sync/embed {data?.sync_policy.gbrain_sync_interval_minutes ?? 15}분</span>
            <span>최대 예상 지연 {data?.sync_policy.max_expected_latency_minutes ?? 35}분</span>
          </div>
        </div>
        <div className="subtle">
          실제 통계는 현재 GBrain DB 인덱스 기준입니다. Indexed surface: {data?.sync_policy.indexed_surface ?? 'general projection'}
        </div>
      </div>

      {indexingRun && (
        <section className="explore-panel explore-run-panel">
          <div className="explore-run-header">
            <div>
              <div className="section-title">수동 동기화/인덱싱 실행</div>
              <div className="subtle">
                general projection 갱신 후 GBrain sync, extract, embed를 순서대로 실행합니다.
              </div>
            </div>
            <span className={`badge ${statusClass(indexingRun.status)}`}>{runStatusLabel(indexingRun.status)}</span>
          </div>
          <div className="explore-run-meta">
            <span>시작 {formatDate(indexingRun.started_at)}</span>
            <span>종료 {formatDate(indexingRun.finished_at)}</span>
            <span className="mono">{indexingRun.id.slice(0, 8)}</span>
          </div>
          <div className="explore-run-steps">
            {indexingRun.steps.map(step => (
              <div className="explore-run-step" key={step.key}>
                <div className="explore-run-step-title">
                  <strong>{step.title}</strong>
                  <span className={`badge ${statusClass(step.status)}`}>{stepStatusLabel(step.status)}</span>
                </div>
                <div className="subtle">
                  {formatDate(step.started_at)} - {formatDate(step.finished_at)}
                  {step.exit_code !== null ? ` / exit ${step.exit_code}` : ''}
                </div>
                {step.error && <div className="warning-bar">{step.error}</div>}
              </div>
            ))}
          </div>
          {indexingRun.error && <div className="warning-bar">{indexingRun.error}</div>}
          {indexingRun.output_tail && <pre className="explore-run-log">{indexingRun.output_tail}</pre>}
        </section>
      )}

      <div className="metrics">
        <div className="metric">
          <div className="metric-value">{formatNumber(data?.summary.page_count)}</div>
          <div className="metric-label">Indexed Pages</div>
        </div>
        <div className="metric">
          <div className="metric-value">{formatNumber(data?.summary.chunk_count)}</div>
          <div className="metric-label">Chunks</div>
        </div>
        <div className="metric">
          <div className="metric-value">{formatPercent(data?.summary.embedding_completion_ratio)}</div>
          <div className="metric-label">Embedding Complete</div>
        </div>
        <div className="metric">
          <div className="metric-value">{formatNumber(data?.summary.timeline_signal_count)}</div>
          <div className="metric-label">Timeline Signals</div>
        </div>
        <div className="metric">
          <div className="metric-value">{formatNumber(data?.summary.link_count)}</div>
          <div className="metric-label">Links</div>
        </div>
        <div className="metric">
          <div className="metric-value">{formatNumber(data?.summary.stale_extraction_page_count)}</div>
          <div className="metric-label">Extraction Backlog</div>
        </div>
      </div>

      <div className="explore-grid">
        <section className="explore-panel">
          <div className="section-title">무엇을 물어볼 수 있나</div>
          <div className="explore-capabilities">
            {(data?.capabilities ?? []).map(item => (
              <div className="explore-capability" key={item.key}>
                <div className="explore-card-title">{item.title}</div>
                <div className="subtle">{item.description}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="explore-panel">
          <div className="section-title">최근 인덱스 상태</div>
          <div className="health-row">
            <span>최근 page update</span>
            <strong>{formatDate(data?.summary.latest_page_updated_at)}</strong>
          </div>
          <div className="health-row">
            <span>최근 embedding</span>
            <strong>{formatDate(data?.summary.latest_embedded_at)}</strong>
          </div>
          <div className="health-row">
            <span>Sources</span>
            <strong>{formatNumber(data?.summary.source_count)}</strong>
          </div>
          <div className="health-row">
            <span>Tags</span>
            <strong>{formatNumber(data?.summary.tag_count)}</strong>
          </div>
          <div className="explore-source-list">
            {(data?.sources ?? []).slice(0, 4).map(source => (
              <div className="explore-source-row" key={source.id}>
                <div>
                  <strong>{source.name}</strong>
                  <div className="subtle mono">{source.local_path ?? source.id}</div>
                </div>
                <div className="mono">{shortCommit(source.last_commit)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="explore-panel">
        <div className="section-title">샘플 질문</div>
        <div className="explore-question-list">
          {(data?.sample_questions ?? []).map(question => (
            <div className="code-block" key={question}>{question}</div>
          ))}
        </div>
      </section>

      <div className="explore-split">
        <section>
          <div className="section-title">섹션 분포</div>
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Pages</th>
                <th>Chunks</th>
                <th>Embedded</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {(data?.sections ?? []).map(item => (
                <tr key={item.section}>
                  <td>{item.section}</td>
                  <td>{formatNumber(item.page_count)}</td>
                  <td>{formatNumber(item.chunk_count)}</td>
                  <td>{formatNumber(item.embedded_chunk_count)}</td>
                  <td>{formatDate(item.latest_updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <div className="section-title">체크포인트</div>
          <table>
            <thead>
              <tr>
                <th>Op</th>
                <th>Rows</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {(data?.checkpoints ?? []).length === 0 ? (
                <tr><td colSpan={3}>No checkpoints</td></tr>
              ) : (data?.checkpoints ?? []).map(item => (
                <tr key={item.op}>
                  <td>{item.op}</td>
                  <td>{formatNumber(item.count)}</td>
                  <td>{formatDate(item.latest_updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="page-header explore-doc-header">
        <div>
          <div className="section-title">인덱싱된 문서</div>
          <div className="subtle">
            {formatNumber(visibleDocuments.length)} / {formatNumber(data?.documents.length ?? 0)} visible
            {data && data.documents.length >= data.document_limit ? `, capped at ${data.document_limit}` : ''}
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="문서명, slug, 태그, source link 검색"
        />
        <select value={namespace} onChange={e => setNamespace(e.target.value)}>
          <option value="all">All namespaces</option>
          {namespaces.map(item => <option value={item} key={item}>{item}</option>)}
        </select>
        <select value={section} onChange={e => setSection(e.target.value)}>
          <option value="all">All sections</option>
          {sections.map(item => <option value={item} key={item}>{item}</option>)}
        </select>
      </div>

      {!data ? (
        <div className="feed-empty">Loading indexed documents...</div>
      ) : visibleDocuments.length === 0 ? (
        <div className="feed-empty">No indexed documents match the current filter.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Namespace</th>
              <th>Index</th>
              <th>Timeline</th>
              <th>Evidence</th>
              <th>Updated</th>
              <th>Retrieved</th>
            </tr>
          </thead>
          <tbody>
            {visibleDocuments.map(doc => (
              <tr key={doc.id}>
                <td>
                  <div className="explore-doc-title">{doc.title}</div>
                  <div className="subtle mono">{doc.slug}</div>
                  {doc.tags.length > 0 && (
                    <div className="explore-tag-list">
                      {doc.tags.slice(0, 4).map(tag => <span className="badge" key={tag}>{tag}</span>)}
                    </div>
                  )}
                </td>
                <td>
                  <span className={`badge ${doc.namespace === 'sensitive' ? 'badge-danger' : 'badge-success'}`}>
                    {doc.namespace}
                  </span>
                  <div className="subtle">{doc.section} · {doc.page_kind}</div>
                </td>
                <td>
                  <span className="mono">{doc.embedded_chunk_count}</span>
                  <span className="subtle"> / {doc.chunk_count} chunks</span>
                </td>
                <td>
                  {formatNumber(doc.timeline_signal_count)}
                  {doc.mobibrain_timeline_count > 0 && <div className="subtle">{doc.mobibrain_timeline_count} MobiBrain</div>}
                </td>
                <td>{formatNumber(evidenceCount(doc))}</td>
                <td>{formatDate(doc.updated_at)}</td>
                <td>{formatDate(doc.last_retrieved_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
