import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import PageHeader from '../../components/PageHeader';
import Loading from '../../components/Loading';
import {
  getReports,
  updateReport,
  getModerationLog,
  getModerationExport,
  getModerationExportCsv,
  getBanAppeals,
  reviewBanAppeal,
  getErrorMessage,
} from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';

const EXPORT_LIMITS_KEY = 'neuron-moderation-export-limits-v1';

const EXPORT_PRESETS = {
  small: { reports: 500, audit: 1000 },
  medium: { reports: 1000, audit: 2000 },
  full: { reports: 5000, audit: 10000 },
};

function fmt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function buildTargetHref(targetType, targetId) {
  const type = String(targetType || '').toLowerCase();
  const id = String(targetId || '').trim();
  if (!id) return null;
  if (type === 'thread') return `/t/${encodeURIComponent(id)}`;
  if (type === 'reply') return `/t/${encodeURIComponent(id)}`;
  if (type === 'user') return `/u/${encodeURIComponent(id)}`;
  if (type === 'project') {
    const parts = id.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return `/p/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`;
    }
    return null;
  }
  return null;
}

function toCsvRow(values) {
  return values
    .map((v) => {
      const s = String(v ?? '');
      const escaped = s.replace(/"/g, '""');
      return `"${escaped}"`;
    })
    .join(',');
}

export default function OwnerReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(null);
  const [reports, setReports] = useState([]);
  const [audit, setAudit] = useState([]);
  const [reportsNextCursor, setReportsNextCursor] = useState(null);
  const [auditNextCursor, setAuditNextCursor] = useState(null);
  const [loadingMoreReports, setLoadingMoreReports] = useState(false);
  const [loadingMoreAudit, setLoadingMoreAudit] = useState(false);
  const [exportingAudit, setExportingAudit] = useState(false);
  const [exportingReports, setExportingReports] = useState(false);
  const [reportExportLimit, setReportExportLimit] = useState(1000);
  const [auditExportLimit, setAuditExportLimit] = useState(2000);
  const [exportWarning, setExportWarning] = useState('');
  const [exportPreset, setExportPreset] = useState('medium');
  const [statusFilter, setStatusFilter] = useState('open');
  const [targetFilter, setTargetFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [appeals, setAppeals] = useState([]);
  const [appealStatusFilter, setAppealStatusFilter] = useState('pending');

  async function fetchAllAuditForExport() {
    const all = [];
    let cursor = null;
    let pages = 0;
    const MAX_PAGES = 50;
    const baseParams = {
      ...(actionFilter !== 'all' ? { action: actionFilter } : {}),
      limit: 500,
    };

    while (pages < MAX_PAGES) {
      // eslint-disable-next-line no-await-in-loop
      const data = await getModerationLog({
        ...baseParams,
        ...(cursor ? { cursor } : {}),
      });
      const items = data?.items || [];
      all.push(...items);
      cursor = data?.nextCursor || null;
      pages += 1;
      if (!cursor) break;
    }
    return all;
  }

  async function fetchAllReportsForExport() {
    const all = [];
    let cursor = null;
    let pages = 0;
    const MAX_PAGES = 50;
    const baseParams = {
      status: statusFilter,
      ...(targetFilter !== 'all' ? { targetType: targetFilter } : {}),
      ...(query.trim().length >= 2 ? { q: query.trim() } : {}),
      limit: 200,
    };

    while (pages < MAX_PAGES) {
      // eslint-disable-next-line no-await-in-loop
      const data = await getReports({
        ...baseParams,
        ...(cursor ? { cursor } : {}),
      });
      const items = data?.items || [];
      all.push(...items);
      cursor = data?.nextCursor || null;
      pages += 1;
      if (!cursor) break;
    }
    return all;
  }

  const exportAuditJson = async () => {
    setExportingAudit(true);
    setError(null);
    try {
      const allAudit = await fetchAllAuditForExport();
      const blob = new Blob([JSON.stringify(allAudit, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moderation-audit-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExportingAudit(false);
    }
  };

  const exportAuditCsv = async () => {
    setExportingAudit(true);
    setError(null);
    try {
      const allAudit = await fetchAllAuditForExport();
    const header = toCsvRow([
      'createdAt',
      'moderatorUsername',
      'action',
      'targetType',
      'targetId',
      'targetPreview',
      'note',
    ]);
    const rows = allAudit.map((a) =>
      toCsvRow([
        a.createdAt || '',
        a.moderator?.username || '',
        a.action || '',
        a.targetType || '',
        a.targetId || '',
        a.targetPreview || '',
        a.note || '',
      ])
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `moderation-audit-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExportingAudit(false);
    }
  };

  const exportReportsJson = async () => {
    setExportingReports(true);
    setError(null);
    try {
      const allReports = await fetchAllReportsForExport();
      const blob = new Blob([JSON.stringify(allReports, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moderation-reports-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExportingReports(false);
    }
  };

  const exportReportsCsv = async () => {
    setExportingReports(true);
    setError(null);
    try {
      const allReports = await fetchAllReportsForExport();
      const header = toCsvRow([
        'createdAt',
        'status',
        'targetType',
        'targetId',
        'targetPreview',
        'reporterUsername',
        'reason',
      ]);
      const rows = allReports.map((r) =>
        toCsvRow([
          r.createdAt || '',
          r.status || '',
          r.targetType || '',
          r.targetId || '',
          r.targetPreview || '',
          r.reporter?.username || '',
          r.reason || '',
        ])
      );
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `moderation-reports-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExportingReports(false);
    }
  };

  const exportAllModerationJson = async () => {
    setExportingReports(true);
    setExportingAudit(true);
    setError(null);
    setExportWarning('');
    try {
      const payload = await getModerationExport({
        reportStatus: statusFilter,
        ...(targetFilter !== 'all' ? { reportTargetType: targetFilter } : {}),
        ...(query.trim().length >= 2 ? { reportQ: query.trim() } : {}),
        auditAction: actionFilter,
        reportLimit: reportExportLimit,
        auditLimit: auditExportLimit,
      });
      if (payload?.truncated?.reports || payload?.truncated?.audit) {
        setExportWarning(
          `Export truncated by limit (reports ${payload.counts?.reports}/${payload.totals?.reports}, audit ${payload.counts?.audit}/${payload.totals?.audit}).`
        );
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moderation-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExportingReports(false);
      setExportingAudit(false);
    }
  };

  const exportAllModerationCsv = async () => {
    setExportingReports(true);
    setExportingAudit(true);
    setError(null);
    setExportWarning('');
    try {
      const csvResponse = await getModerationExportCsv({
        reportStatus: statusFilter,
        ...(targetFilter !== 'all' ? { reportTargetType: targetFilter } : {}),
        ...(query.trim().length >= 2 ? { reportQ: query.trim() } : {}),
        auditAction: actionFilter,
        reportLimit: reportExportLimit,
        auditLimit: auditExportLimit,
      });
      const headers = csvResponse.headers || {};
      const reportsTruncated = String(headers['x-neuron-reports-truncated'] || '').toLowerCase() === 'true';
      const auditTruncated = String(headers['x-neuron-audit-truncated'] || '').toLowerCase() === 'true';
      if (reportsTruncated || auditTruncated) {
        setExportWarning(
          `CSV export truncated by limit (reports ${headers['x-neuron-reports-returned']}/${headers['x-neuron-reports-total']}, audit ${headers['x-neuron-audit-returned']}/${headers['x-neuron-audit-total']}).`
        );
      }

      const url = URL.createObjectURL(csvResponse.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moderation-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExportingReports(false);
      setExportingAudit(false);
    }
  };

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const reportParams = {
        status: statusFilter,
        ...(targetFilter !== 'all' ? { targetType: targetFilter } : {}),
        ...(query.trim().length >= 2 ? { q: query.trim() } : {}),
      };
      const logParams = {
        ...(actionFilter !== 'all' ? { action: actionFilter } : {}),
      };
      const [reportData, logData, appealData] = await Promise.all([
        getReports(reportParams),
        getModerationLog(logParams),
        getBanAppeals({
          status: appealStatusFilter,
        }).catch(() => ({ items: [] })),
      ]);
      setReports(reportData?.items || []);
      setAudit(logData?.items || []);
      setAppeals(appealData?.items || []);
      setReportsNextCursor(reportData?.nextCursor || null);
      setAuditNextCursor(logData?.nextCursor || null);
      setForbidden(false);
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        setForbidden(true);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login?next=/moderation');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, statusFilter, targetFilter, actionFilter, appealStatusFilter]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPORT_LIMITS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const reports = Number(parsed?.reports);
      const audit = Number(parsed?.audit);
      if (Number.isFinite(reports) && reports > 0) setReportExportLimit(reports);
      if (Number.isFinite(audit) && audit > 0) setAuditExportLimit(audit);
      const preset = String(parsed?.preset || '');
      if (preset && EXPORT_PRESETS[preset]) setExportPreset(preset);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        EXPORT_LIMITS_KEY,
        JSON.stringify({
          preset: exportPreset,
          reports: reportExportLimit,
          audit: auditExportLimit,
        })
      );
    } catch {
      /* ignore */
    }
  }, [exportPreset, reportExportLimit, auditExportLimit]);

  async function loadMoreReports() {
    if (!reportsNextCursor || loadingMoreReports) return;
    setLoadingMoreReports(true);
    try {
      const reportData = await getReports({
        status: statusFilter,
        ...(targetFilter !== 'all' ? { targetType: targetFilter } : {}),
        ...(query.trim().length >= 2 ? { q: query.trim() } : {}),
        cursor: reportsNextCursor,
      });
      setReports((prev) => [...prev, ...(reportData?.items || [])]);
      setReportsNextCursor(reportData?.nextCursor || null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingMoreReports(false);
    }
  }

  async function loadMoreAudit() {
    if (!auditNextCursor || loadingMoreAudit) return;
    setLoadingMoreAudit(true);
    try {
      const logData = await getModerationLog({
        ...(actionFilter !== 'all' ? { action: actionFilter } : {}),
        cursor: auditNextCursor,
      });
      setAudit((prev) => [...prev, ...(logData?.items || [])]);
      setAuditNextCursor(logData?.nextCursor || null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingMoreAudit(false);
    }
  }

  if (loading) {
    return (
      <Layout title="Moderation reports" wide chromeless>
        <Loading />
      </Layout>
    );
  }
  if (forbidden) {
    return (
      <Layout title="Not found" wide chromeless>
        <div className="panel" style={{ textAlign: 'center', marginTop: '4rem' }}>
          <h1 className="page-title">404</h1>
          <p className="page-desc">Page not found.</p>
          <Link href="/explore" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
            Home
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Moderation reports" wide chromeless>
      <PageHeader
        eyebrow="Moderation"
        title="Reports queue"
        description={`Reports shown: ${reports.length}`}
      />

      {error && <p className="error">{error}</p>}
      {exportWarning && <p className="muted">{exportWarning}</p>}

      <section className="panel">
        <div className="panel-head-row">
          <h2>Reports</h2>
          <div className="emergence-actions">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="open">Open</option>
              <option value="reviewed">Reviewed</option>
              <option value="dismissed">Dismissed</option>
              <option value="actioned">Actioned</option>
              <option value="all">All</option>
            </select>
            <select value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)}>
              <option value="all">All targets</option>
              <option value="thread">Thread</option>
              <option value="reply">Reply</option>
              <option value="user">User</option>
              <option value="message">Message</option>
              <option value="project">Project</option>
              <option value="file">File</option>
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reason / target id"
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
              Apply
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={exportReportsJson}
              disabled={exportingReports}
            >
              {exportingReports ? 'Exporting…' : 'Export reports JSON'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={exportReportsCsv}
              disabled={exportingReports}
            >
              {exportingReports ? 'Exporting…' : 'Export reports CSV'}
            </button>
          </div>
        </div>
        {reports.length === 0 ? (
          <p className="muted">No reports for current filters.</p>
        ) : (
          <ul className="invite-list">
            {reports.map((r) => (
              <li key={r._id} className="panel-inset">
                <p>
                  <strong>{r.targetType}</strong> · <code>{r.targetId}</code> · @{r.reporter?.username}
                </p>
                {(r.targetHref || buildTargetHref(r.targetType, r.targetId)) && (
                  <p className="muted">
                    <Link
                      href={r.targetHref || buildTargetHref(r.targetType, r.targetId)}
                      className="owner-report-target-link"
                    >
                      {r.targetLabel || 'Open target'}
                    </Link>
                  </p>
                )}
                {r.targetPreview && <p className="muted">{r.targetPreview}</p>}
                <p className="muted">{r.reason}</p>
                <p className="muted">{fmt(r.createdAt)}</p>
                <div className="emergence-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={async () => {
                      try {
                        await updateReport(r._id, {
                          status: 'reviewed',
                          action: 'none',
                          note: 'Reviewed by moderator',
                        });
                        await load();
                      } catch (err) {
                        setError(getErrorMessage(err));
                      }
                    }}
                  >
                    Mark reviewed
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      try {
                        await updateReport(r._id, {
                          status: 'actioned',
                          action: 'content_removed',
                          note: 'Content removed',
                        });
                        await load();
                      } catch (err) {
                        setError(getErrorMessage(err));
                      }
                    }}
                  >
                    Content removed
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      try {
                        await updateReport(r._id, {
                          status: 'actioned',
                          action: 'user_banned',
                          note: 'User ban requested',
                        });
                        await load();
                      } catch (err) {
                        setError(getErrorMessage(err));
                      }
                    }}
                  >
                    Ban user
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      try {
                        await updateReport(r._id, {
                          status: 'actioned',
                          action: 'user_unbanned',
                          note: 'User unbanned',
                        });
                        await load();
                      } catch (err) {
                        setError(getErrorMessage(err));
                      }
                    }}
                  >
                    Unban user
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      try {
                        await updateReport(r._id, {
                          status: 'actioned',
                          action: 'warning_sent',
                          note: 'Formal warning sent',
                        });
                        await load();
                      } catch (err) {
                        setError(getErrorMessage(err));
                      }
                    }}
                  >
                    Send warning
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      try {
                        await updateReport(r._id, {
                          status: 'dismissed',
                          action: 'none',
                          note: 'Dismissed',
                        });
                        await load();
                      } catch (err) {
                        setError(getErrorMessage(err));
                      }
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {reportsNextCursor && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={loadingMoreReports}
            onClick={loadMoreReports}
          >
            {loadingMoreReports ? 'Loading…' : 'Load more reports'}
          </button>
        )}
      </section>

      <section className="panel">
        <div className="panel-head-row">
          <h2>Ban appeals</h2>
          <select
            value={appealStatusFilter}
            onChange={(e) => setAppealStatusFilter(e.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>
        {appeals.length === 0 ? (
          <p className="muted">No ban appeals in this filter.</p>
        ) : (
          <ul className="invite-list">
            {appeals.map((a) => (
              <li key={a._id}>
                <p>
                  @{a.user?.username} · {fmt(a.createdAt)} · <strong>{a.status}</strong>
                </p>
                <p className="muted">{a.message}</p>
                {a.status === 'PENDING' && (
                  <div className="emergence-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={async () => {
                        try {
                          await reviewBanAppeal(a._id, {
                            status: 'ACCEPTED',
                            note: 'Appeal accepted — account unbanned',
                          });
                          await load();
                        } catch (err) {
                          setError(getErrorMessage(err));
                        }
                      }}
                    >
                      Accept & unban
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        try {
                          await reviewBanAppeal(a._id, {
                            status: 'REJECTED',
                            note: 'Appeal rejected',
                          });
                          await load();
                        } catch (err) {
                          setError(getErrorMessage(err));
                        }
                      }}
                    >
                      Reject
                    </button>
                  </div>
                )}
                {a.moderatorNote ? <p className="muted">Mod note: {a.moderatorNote}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-head-row">
          <h2>Audit log</h2>
          <div className="emergence-actions">
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="all">All actions</option>
              <option value="content_removed">content_removed</option>
              <option value="user_banned">user_banned</option>
              <option value="user_unbanned">user_unbanned</option>
              <option value="warning_sent">warning_sent</option>
              <option value="appeal_accepted">appeal_accepted</option>
              <option value="appeal_rejected">appeal_rejected</option>
              <option value="none">none</option>
            </select>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={exportAuditJson}
              disabled={exportingAudit}
            >
              {exportingAudit ? 'Exporting…' : 'Export JSON'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={exportAuditCsv}
              disabled={exportingAudit}
            >
              {exportingAudit ? 'Exporting…' : 'Export CSV'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={exportAllModerationJson}
              disabled={exportingAudit || exportingReports}
            >
              {exportingAudit || exportingReports ? 'Exporting…' : 'Export all moderation data'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={exportAllModerationCsv}
              disabled={exportingAudit || exportingReports}
            >
              {exportingAudit || exportingReports ? 'Exporting…' : 'Export all moderation CSV'}
            </button>
            <input
              type="number"
              min={1}
              max={5000}
              value={reportExportLimit}
              onChange={(e) => {
                setExportPreset('custom');
                setReportExportLimit(Math.max(1, Number(e.target.value) || 1));
              }}
              title="Reports export limit"
              aria-label="Reports export limit"
            />
            <input
              type="number"
              min={1}
              max={10000}
              value={auditExportLimit}
              onChange={(e) => {
                setExportPreset('custom');
                setAuditExportLimit(Math.max(1, Number(e.target.value) || 1));
              }}
              title="Audit export limit"
              aria-label="Audit export limit"
            />
            <select
              value={exportPreset}
              onChange={(e) => {
                const preset = e.target.value;
                setExportPreset(preset);
                if (EXPORT_PRESETS[preset]) {
                  setReportExportLimit(EXPORT_PRESETS[preset].reports);
                  setAuditExportLimit(EXPORT_PRESETS[preset].audit);
                }
              }}
              title="Export limit preset"
              aria-label="Export limit preset"
            >
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="full">full</option>
              <option value="custom">custom</option>
            </select>
          </div>
        </div>
        {audit.length === 0 ? (
          <p className="muted">No moderation actions yet.</p>
        ) : (
          <ul className="invite-list">
            {audit.map((a) => (
              <li key={a._id}>
                {fmt(a.createdAt)} · @{a.moderator?.username} · <strong>{a.action}</strong> ·{' '}
                {a.targetType}:{a.targetId}{' '}
                {(a.targetHref || buildTargetHref(a.targetType, a.targetId)) && (
                  <Link
                    href={a.targetHref || buildTargetHref(a.targetType, a.targetId)}
                    className="owner-report-target-link"
                  >
                    ({a.targetLabel || 'open'})
                  </Link>
                )}
                {a.targetPreview ? ` · ${a.targetPreview}` : ''}
                {a.note ? ` · ${a.note}` : ''}
              </li>
            ))}
          </ul>
        )}
        {auditNextCursor && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={loadingMoreAudit}
            onClick={loadMoreAudit}
          >
            {loadingMoreAudit ? 'Loading…' : 'Load more audit'}
          </button>
        )}
      </section>
    </Layout>
  );
}
