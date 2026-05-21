import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../../../components/Layout';
import ProjectNav from '../../../../components/ProjectNav';
import FileTree from '../../../../components/FileTree';
import BranchSelector from '../../../../components/BranchSelector';
import ClonePanel from '../../../../components/ClonePanel';
import MarkdownBody from '../../../../components/MarkdownBody';
import BlameView from '../../../../components/BlameView';
import Loading from '../../../../components/Loading';
import ReportButton from '../../../../components/ReportButton';
import {
  getRepoTree,
  getRepoFile,
  getRepoBlame,
  getRepoHistory,
  getRepoRevision,
  saveRepoFile,
  getErrorMessage,
} from '../../../../lib/api';
import { useI18n } from '../../../../lib/I18nContext';
import { getStoredUser, isLoggedIn } from '../../../../lib/auth';

function isMarkdown(path) {
  return /\.(md|markdown)$/i.test(path || '');
}

export default function ProjectCodePage() {
  const router = useRouter();
  const { owner, slug } = router.query;
  const pathQuery = typeof router.query.path === 'string' ? router.query.path : '';
  const branchQuery = typeof router.query.branch === 'string' ? router.query.branch : '';
  const { t } = useI18n();

  const [project, setProject] = useState(null);
  const [tree, setTree] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState('main');
  const [file, setFile] = useState(null);
  const [content, setContent] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('code');
  const [blameLines, setBlameLines] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyPreview, setHistoryPreview] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const base = owner && slug ? `/p/${owner}/${slug}` : '';
  const user = getStoredUser();
  const isOwner = user && project && user.username === project.ownerUsername;
  const defaultBranch = project?.defaultBranch || 'main';
  const activeBranch = branchQuery || branch || defaultBranch;

  const codeQuery = useMemo(() => {
    const q = {};
    if (activeBranch && activeBranch !== defaultBranch) q.branch = activeBranch;
    if (pathQuery) q.path = pathQuery;
    return q;
  }, [activeBranch, defaultBranch, pathQuery]);

  const loadTree = useCallback(async () => {
    const data = await getRepoTree(owner, slug, activeBranch);
    setProject(data.project);
    setTree(data.tree);
    setBranches(data.branches || []);
    if (data.branch) setBranch(data.branch);
    return data;
  }, [owner, slug, activeBranch]);

  const loadFile = useCallback(
    async (path) => {
      if (!path) {
        setFile(null);
        setContent('');
        return;
      }
      const data = await getRepoFile(owner, slug, { path, branch: activeBranch });
      setFile(data.file);
      setContent(data.file.content || '');
    },
    [owner, slug, activeBranch]
  );

  const loadBlameAndHistory = useCallback(async (path) => {
    if (!path) {
      setBlameLines([]);
      setHistory([]);
      setHistoryPreview(null);
      return;
    }
    setMetaLoading(true);
    try {
      const params = { path, branch: activeBranch };
      const [blameData, historyData] = await Promise.all([
        getRepoBlame(owner, slug, params),
        getRepoHistory(owner, slug, params),
      ]);
      setBlameLines(blameData.lines || []);
      setHistory(historyData.revisions || []);
      setHistoryPreview(null);
    } catch {
      setBlameLines([]);
      setHistory([]);
    } finally {
      setMetaLoading(false);
    }
  }, [owner, slug, activeBranch]);

  useEffect(() => {
    if (!owner || !slug) return;
    setLoading(true);
    setError(null);
    setViewMode('code');
    loadTree()
      .then(() => loadFile(pathQuery))
      .then(() => loadBlameAndHistory(pathQuery))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [owner, slug, pathQuery, activeBranch, loadTree, loadFile, loadBlameAndHistory]);

  useEffect(() => {
    if (!pathQuery || viewMode === 'code') return;
    if (viewMode === 'blame' && blameLines.length === 0 && !metaLoading) {
      loadBlameAndHistory(pathQuery);
    }
    if (viewMode === 'history' && history.length === 0 && !metaLoading) {
      loadBlameAndHistory(pathQuery);
    }
  }, [viewMode, pathQuery, blameLines.length, history.length, metaLoading, loadBlameAndHistory]);

  const openPath = (path) => {
    router.push({ pathname: `${base}/code`, query: { ...codeQuery, path } }, undefined, {
      shallow: true,
    });
  };

  const switchBranch = (name) => {
    const q = { branch: name };
    if (pathQuery) q.path = pathQuery;
    router.push({ pathname: `${base}/code`, query: q }, undefined, { shallow: true });
  };

  const handleSave = async () => {
    if (!pathQuery || !isOwner) return;
    setSaving(true);
    setError(null);
    try {
      await saveRepoFile(owner, slug, { path: pathQuery, content, branch: activeBranch });
      setEditMode(false);
      await loadTree();
      await loadFile(pathQuery);
      await loadBlameAndHistory(pathQuery);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleNewFile = () => {
    const name = window.prompt(t('code_new_file_prompt'));
    if (!name?.trim()) return;
    openPath(name.trim().replace(/\\/g, '/'));
    setEditMode(true);
    setContent('');
  };

  const saveLabel =
    activeBranch === defaultBranch ? t('code_save') : `${t('code_save_to')} ${activeBranch}`;

  if (loading && !project) {
    return (
      <Layout wide>
        <Loading label={t('loading')} />
      </Layout>
    );
  }

  return (
    <Layout title={`${owner}/${slug}`} wide>
      <ProjectNav owner={owner} slug={slug} project={project} />

      {error && <p className="error">{error}</p>}

      <ClonePanel owner={owner} slug={slug} branch={activeBranch} />
      {project?._id && (
        <div className="actions-row">
          <ReportButton targetType="project" targetId={`${owner}/${slug}`} />
          {pathQuery && <ReportButton targetType="file" targetId={`${owner}/${slug}:${pathQuery}`} />}
        </div>
      )}

      <div className="repo-layout">
        <div className="repo-sidebar">
          <div className="repo-sidebar-head">
            <BranchSelector
              branches={branches}
              branch={activeBranch}
              defaultBranch={defaultBranch}
              isOwner={isOwner}
              owner={owner}
              slug={slug}
              onBranchChange={switchBranch}
              onBranchesUpdated={loadTree}
            />
            {isOwner && (
              <button type="button" className="link-btn" onClick={handleNewFile}>
                {t('code_new_file')}
              </button>
            )}
            {isLoggedIn() && !isOwner && (
              <Link
                href={
                  pathQuery
                    ? `${base}/pulls/new?path=${encodeURIComponent(pathQuery)}`
                    : `${base}/pulls/new`
                }
                className="link-btn"
              >
                {t('pr_new')}
              </Link>
            )}
          </div>
          <FileTree tree={tree} base={base} currentPath={pathQuery} branch={activeBranch} />
        </div>

        <div className="repo-main panel">
          {!pathQuery ? (
            <p className="muted">{t('code_pick_file')}</p>
          ) : (
            <>
              <div className="repo-file-head">
                <h2 className="repo-file-path">{pathQuery}</h2>
                <div className="actions-row">
                  {!editMode && (
                    <>
                      <button
                        type="button"
                        className={`btn btn-ghost btn-sm${viewMode === 'code' ? ' active' : ''}`}
                        onClick={() => setViewMode('code')}
                      >
                        Code
                      </button>
                      <button
                        type="button"
                        className={`btn btn-ghost btn-sm${viewMode === 'blame' ? ' active' : ''}`}
                        onClick={() => setViewMode('blame')}
                      >
                        Blame
                      </button>
                      <button
                        type="button"
                        className={`btn btn-ghost btn-sm${viewMode === 'history' ? ' active' : ''}`}
                        onClick={() => setViewMode('history')}
                      >
                        History
                      </button>
                    </>
                  )}
                  {isOwner && !editMode && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditMode(true)}>
                      {t('code_edit')}
                    </button>
                  )}
                  {isOwner && editMode && (
                    <>
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                        {saving ? t('loading') : saveLabel}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditMode(false);
                          setContent(file?.content || '');
                        }}
                      >
                        {t('code_cancel')}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editMode ? (
                <textarea
                  className="repo-editor"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  spellCheck={false}
                />
              ) : viewMode === 'blame' ? (
                metaLoading ? (
                  <Loading label={t('loading')} />
                ) : (
                  <BlameView lines={blameLines} />
                )
              ) : viewMode === 'history' ? (
                <div className="repo-history-layout">
                  {metaLoading ? (
                    <Loading label={t('loading')} />
                  ) : history.length === 0 ? (
                    <p className="muted">No revisions yet — save the file to start history.</p>
                  ) : (
                    <>
                      <ul className="repo-history-list">
                        {history.map((rev) => (
                          <li key={rev._id}>
                            <button
                              type="button"
                              className={`link-btn${historyPreview?._id === rev._id ? ' active' : ''}`}
                              onClick={async () => {
                                const data = await getRepoRevision(owner, slug, rev._id);
                                setHistoryPreview(data.revision);
                              }}
                            >
                              {rev.author?.username || 'unknown'} ·{' '}
                              {new Date(rev.createdAt).toLocaleString()} · {rev.lineCount} lines
                            </button>
                          </li>
                        ))}
                      </ul>
                      {historyPreview?.content !== undefined && (
                        <pre className="repo-raw-file repo-history-preview">
                          {historyPreview.content}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              ) : isMarkdown(pathQuery) ? (
                <MarkdownBody>{content}</MarkdownBody>
              ) : (
                <pre className="repo-raw-file">{content}</pre>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
