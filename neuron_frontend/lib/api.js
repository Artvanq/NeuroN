import axios from 'axios';
import { getToken, clearAuth, setAuth } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

function shouldSkipRefresh(url) {
  if (!url) return true;
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/oauth')
  );
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;

    if (status !== 401 || !original || original._retry || shouldSkipRefresh(original.url)) {
      if (status === 401 && typeof window !== 'undefined' && !shouldSkipRefresh(original?.url)) {
        clearAuth();
      }
      return Promise.reject(err);
    }

    original._retry = true;

    if (!refreshPromise) {
      refreshPromise = api
        .post('/auth/refresh', {}, { withCredentials: true })
        .then((res) => res.data)
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      const data = await refreshPromise;
      setAuth(data.token, data.user);
      original.headers.Authorization = `Bearer ${data.token}`;
      return api(original);
    } catch (refreshErr) {
      clearAuth();
      return Promise.reject(refreshErr);
    }
  }
);

export function getErrorMessage(err, fallback = 'Request failed') {
  return err.response?.data?.message || err.message || fallback;
}

export function getBanErrorDetails(err) {
  const data = err?.response?.data;
  if (data?.code === 'account_banned') return data;
  return null;
}

/** API list endpoints must return arrays; normalize odd/error payloads. */
export function asApiList(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.projects)) return data.projects;
    if (Array.isArray(data.inquiries)) return data.inquiries;
    if (Array.isArray(data.categories)) return data.categories;
    if (Array.isArray(data.threads)) return data.threads;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.minds)) return data.minds;
    if (Array.isArray(data.users)) return data.users;
    if (Array.isArray(data.organizations)) return data.organizations;
  }
  return [];
}

// Auth
export async function getAuthConfig() {
  const { data } = await api.get('/auth/config');
  return data;
}

export async function register(payload) {
  const { data } = await api.post('/auth/register', payload, { withCredentials: true });
  return data;
}

export async function getMediaConfig() {
  const { data } = await api.get('/media/config');
  return data;
}

export async function presignMedia(payload) {
  const { data } = await api.post('/media/presign', payload);
  return data;
}

export async function completeMedia(mediaId) {
  const { data } = await api.post(`/media/${mediaId}/complete`);
  return data;
}

export async function login(payload) {
  const { data } = await api.post('/auth/login', payload, { withCredentials: true });
  return data;
}

export async function refreshAuth() {
  const { data } = await api.post('/auth/refresh', {}, { withCredentials: true });
  return data;
}

export async function logoutAuth() {
  const { data } = await api.post('/auth/logout', {}, { withCredentials: true });
  return data;
}

export async function completeOAuthSignup(payload) {
  const { data } = await api.post('/auth/oauth/complete', payload, { withCredentials: true });
  return data;
}

export async function getMyInvites() {
  const { data } = await api.get('/auth/invites');
  return data;
}

export async function createInvite() {
  const { data } = await api.post('/auth/invites');
  return data;
}

export async function setPassword(payload) {
  const { data } = await api.post('/auth/password', payload);
  return data;
}

export async function requestPasswordReset(identity) {
  const { data } = await api.post('/auth/password/forgot', { identity });
  return data;
}

export async function resetPassword(payload) {
  const { data } = await api.post('/auth/password/reset', payload);
  return data;
}

export async function requestEmailVerification() {
  const { data } = await api.post('/auth/email/verify/request');
  return data;
}

export async function requestEmailVerificationPublic(identity) {
  const { data } = await api.post('/auth/email/verify/request-public', { identity });
  return data;
}

export async function confirmEmailVerification(token) {
  const { data } = await api.post('/auth/email/verify/confirm', { token });
  return data;
}

export async function unlinkOAuthProvider(provider) {
  const { data } = await api.delete(`/auth/oauth/unlink/${provider}`);
  return data;
}

export async function getAuthSessions() {
  const { data } = await api.get('/auth/sessions');
  return data;
}

export async function getTwoFactorStatus() {
  const { data } = await api.get('/auth/2fa/status');
  return data;
}

export async function setupTwoFactor() {
  const { data } = await api.post('/auth/2fa/setup');
  return data;
}

export async function enableTwoFactor(code) {
  const { data } = await api.post('/auth/2fa/enable', { code });
  return data;
}

export async function disableTwoFactor(payload) {
  const { data } = await api.post('/auth/2fa/disable', payload);
  return data;
}

export async function getAccessTokens() {
  const { data } = await api.get('/auth/tokens');
  return data;
}

export async function createAccessToken(payload) {
  const { data } = await api.post('/auth/tokens', payload);
  return data;
}

export async function revokeAccessToken(id) {
  const { data } = await api.delete(`/auth/tokens/${id}`);
  return data;
}

export async function getSshKeys() {
  const { data } = await api.get('/auth/ssh-keys');
  return data;
}

export async function addSshKey(payload) {
  const { data } = await api.post('/auth/ssh-keys', payload);
  return data;
}

export async function deleteSshKey(id) {
  const { data } = await api.delete(`/auth/ssh-keys/${id}`);
  return data;
}

export async function getGitTransportInfo(owner, slug, params) {
  const { data } = await api.get(`/git/${owner}/${slug}`, { params });
  return data;
}

export async function revokeAuthSession(jti) {
  const { data } = await api.delete(`/auth/sessions/${jti}`);
  return data;
}

export async function revokeAllAuthSessions(payload) {
  const { data } = await api.post('/auth/sessions/revoke-all', payload || {});
  return data;
}

export async function exportAccountData() {
  const { data } = await api.get('/auth/export');
  return data;
}

export async function deleteAccount(payload) {
  const { data } = await api.delete('/auth/account', { data: payload || {} });
  return data;
}

export async function getBlockedUsers() {
  const { data } = await api.get('/blocks');
  return data;
}

export async function blockUser(payload) {
  const { data } = await api.post('/blocks', payload);
  return data;
}

export async function unblockUser(userId) {
  const { data } = await api.delete(`/blocks/${userId}`);
  return data;
}

export async function getIncomingMessageRequests() {
  const { data } = await api.get('/message-requests/incoming');
  return data;
}

export async function sendMessageRequest(payload) {
  const { data } = await api.post('/message-requests', payload);
  return data;
}

export async function respondMessageRequest(id, status) {
  const { data } = await api.patch(`/message-requests/${id}`, { status });
  return data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function updateMe(payload) {
  const { data } = await api.patch('/auth/me', payload);
  return data;
}

// Categories
export async function getCategories() {
  const { data } = await api.get('/categories');
  return asApiList(data);
}

export async function getMyCommunities() {
  const { data } = await api.get('/categories/mine/list');
  return data;
}

export async function createCommunity(payload) {
  const { data } = await api.post('/categories', payload);
  return data;
}

export async function updateCommunity(slug, payload) {
  const { data } = await api.patch(`/categories/${slug}`, payload);
  return data;
}

export async function getCategory(slug) {
  const { data } = await api.get(`/categories/${slug}`);
  return data;
}

export async function getCategoryThreads(slug, params) {
  const { data } = await api.get(`/categories/${slug}/threads`, { params });
  return data;
}

// Inquiries (cross-field questions)
export async function getInquiries(params) {
  const { data } = await api.get('/inquiries', { params });
  return asApiList(data);
}

export async function getInquiry(slug) {
  const { data } = await api.get(`/inquiries/${slug}`);
  return data;
}

export async function getInquiryThreads(slug, params) {
  const { data } = await api.get(`/inquiries/${slug}/threads`, { params });
  return data;
}

// Threads
export async function getThreads(params) {
  const { data } = await api.get('/threads', { params });
  return data;
}

export async function getCompatibleMinds() {
  const { data } = await api.get('/users/recommendations/minds');
  return data.minds || [];
}

export async function getRecommendedThreads(params) {
  const { data } = await api.get('/users/recommendations/threads', { params });
  return data;
}

export async function getRelatedThreads(threadId) {
  const { data } = await api.get(`/threads/${threadId}/related`);
  return data;
}

export async function getThreadResonanceCandidates(threadId, params) {
  const { data } = await api.get(`/threads/${threadId}/resonance-candidates`, { params });
  return data.minds || [];
}

export async function getThread(id) {
  const { data } = await api.get(`/threads/${id}`);
  return data;
}

export async function createThread(payload) {
  const { data } = await api.post('/threads', payload);
  return data;
}

export async function crosspostThread(threadId, payload) {
  const { data } = await api.post(`/threads/${threadId}/crosspost`, payload);
  return data;
}

export async function voteThreadPoll(threadId, optionId) {
  const { data } = await api.post(`/threads/${threadId}/poll/vote`, { optionId });
  return data;
}

export async function updateThread(id, payload) {
  const { data } = await api.patch(`/threads/${id}`, payload);
  return data;
}

export async function deleteThread(id) {
  const { data } = await api.delete(`/threads/${id}`);
  return data;
}

export async function getThreadReplies(id, params) {
  const { data } = await api.get(`/threads/${id}/replies`, { params });
  return data;
}

export async function createReply(threadId, payload) {
  const { data } = await api.post(`/threads/${threadId}/replies`, payload);
  return data;
}

export async function castVote({ targetType, targetId, value }) {
  const { data } = await api.post('/votes', { targetType, targetId, value });
  return data;
}

export async function getReplies(threadId, params) {
  const { data } = await api.get(`/threads/${threadId}/replies`, { params });
  return data;
}

export async function getUserThreads(username, params) {
  const { data } = await api.get(`/users/${username}/threads`, { params });
  return data;
}

export async function searchAll(q, params) {
  const { data } = await api.get('/search', { params: { q, ...params } });
  return data;
}

export async function getSynthesis(threadId) {
  const { data } = await api.get(`/threads/${threadId}/synthesis`);
  return data;
}

export async function updateSynthesis(threadId, payload) {
  const { data } = await api.put(`/threads/${threadId}/synthesis`, payload);
  return data;
}

export async function getProjects(params) {
  const { data } = await api.get('/projects', { params });
  return asApiList(data);
}

export async function createProject(payload) {
  const { data } = await api.post('/projects', payload);
  return data;
}

export async function forkProject(owner, slug, payload = {}) {
  const { data } = await api.post(`/projects/${owner}/${slug}/fork`, payload);
  return data;
}

export async function listOrganizations(params = {}) {
  const { data } = await api.get('/orgs', { params });
  return data.organizations || [];
}

export async function listMyOrganizations() {
  const { data } = await api.get('/orgs/mine');
  return data.organizations || [];
}

export async function createOrganization(payload) {
  const { data } = await api.post('/orgs', payload);
  return data;
}

export async function getOrganization(slug) {
  const { data } = await api.get(`/orgs/${slug}`);
  return data;
}

export async function getOrganizationProjects(slug, params = {}) {
  const { data } = await api.get(`/orgs/${slug}/projects`, { params });
  return asApiList(data);
}

export async function getOrganizationMembers(slug) {
  const { data } = await api.get(`/orgs/${slug}/members`);
  return data.members || [];
}

export async function addOrganizationMember(slug, payload) {
  const { data } = await api.post(`/orgs/${slug}/members`, payload);
  return data;
}

export async function removeOrganizationMember(slug, userId) {
  const { data } = await api.delete(`/orgs/${slug}/members/${userId}`);
  return data;
}

export async function getProject(owner, slug) {
  const { data } = await api.get(`/projects/${owner}/${slug}`);
  return data;
}

export async function getHealth() {
  const { data } = await api.get('/health');
  return data;
}

export async function getCloneInfo(owner, slug, params) {
  const { data } = await api.get(`/projects/${owner}/${slug}/clone`, { params });
  return data;
}

export async function getRepoTree(owner, slug, params) {
  const { data } = await api.get(`/projects/${owner}/${slug}/tree`, { params });
  return data;
}

export async function getRepoFile(owner, slug, params) {
  const query =
    typeof params === 'string'
      ? { path: params }
      : params && typeof params === 'object'
        ? params
        : {};
  const { data } = await api.get(`/projects/${owner}/${slug}/blob`, { params: query });
  return data;
}

export async function getRepoBlame(owner, slug, params) {
  const { data } = await api.get(`/projects/${owner}/${slug}/blame`, { params });
  return data;
}

export async function getRepoHistory(owner, slug, params) {
  const { data } = await api.get(`/projects/${owner}/${slug}/history`, { params });
  return data;
}

export async function getRepoRevision(owner, slug, revisionId) {
  const { data } = await api.get(`/projects/${owner}/${slug}/history/${revisionId}`);
  return data;
}

export async function saveRepoFile(owner, slug, payload) {
  const { data } = await api.put(`/projects/${owner}/${slug}/files`, payload);
  return data;
}

export async function createRepoBranch(owner, slug, payload) {
  const { data } = await api.post(`/projects/${owner}/${slug}/branches`, payload);
  return data;
}

export async function getProjectIssues(owner, slug, params) {
  const { data } = await api.get(`/projects/${owner}/${slug}/issues`, { params });
  return data;
}

export async function createIssue(owner, slug, payload) {
  const { data } = await api.post(`/projects/${owner}/${slug}/issues`, payload);
  return data;
}

export async function getIssue(owner, slug, number) {
  const { data } = await api.get(`/projects/${owner}/${slug}/issues/${number}`);
  return data;
}

export async function updateIssue(owner, slug, number, payload) {
  const { data } = await api.patch(`/projects/${owner}/${slug}/issues/${number}`, payload);
  return data;
}

export async function getIssueComments(owner, slug, number) {
  const { data } = await api.get(`/projects/${owner}/${slug}/issues/${number}/comments`);
  return data.comments || [];
}

export async function createIssueComment(owner, slug, number, body) {
  const { data } = await api.post(`/projects/${owner}/${slug}/issues/${number}/comments`, { body });
  return data;
}

export async function updateIssueComment(owner, slug, number, commentId, body) {
  const { data } = await api.patch(
    `/projects/${owner}/${slug}/issues/${number}/comments/${commentId}`,
    { body }
  );
  return data;
}

export async function deleteIssueComment(owner, slug, number, commentId) {
  const { data } = await api.delete(
    `/projects/${owner}/${slug}/issues/${number}/comments/${commentId}`
  );
  return data;
}

export async function getProjectLabels(owner, slug) {
  const { data } = await api.get(`/projects/${owner}/${slug}/labels`);
  return data.labels || [];
}

export async function createProjectLabel(owner, slug, payload) {
  const { data } = await api.post(`/projects/${owner}/${slug}/labels`, payload);
  return data;
}

export async function deleteProjectLabel(owner, slug, labelId) {
  const { data } = await api.delete(`/projects/${owner}/${slug}/labels/${labelId}`);
  return data;
}

export async function getProjectMilestones(owner, slug) {
  const { data } = await api.get(`/projects/${owner}/${slug}/milestones`);
  return data.milestones || [];
}

export async function createProjectMilestone(owner, slug, payload) {
  const { data } = await api.post(`/projects/${owner}/${slug}/milestones`, payload);
  return data;
}

export async function updateProjectMilestone(owner, slug, milestoneId, payload) {
  const { data } = await api.patch(`/projects/${owner}/${slug}/milestones/${milestoneId}`, payload);
  return data;
}

export async function deleteProjectMilestone(owner, slug, milestoneId) {
  const { data } = await api.delete(`/projects/${owner}/${slug}/milestones/${milestoneId}`);
  return data;
}

export async function updateProject(owner, slug, payload) {
  const { data } = await api.patch(`/projects/${owner}/${slug}`, payload);
  return data;
}

export async function getProjectIssueTemplates(owner, slug) {
  const { data } = await api.get(`/projects/${owner}/${slug}/issue-templates`);
  return data.templates || [];
}

export async function createProjectIssueTemplate(owner, slug, payload) {
  const { data } = await api.post(`/projects/${owner}/${slug}/issue-templates`, payload);
  return data;
}

export async function deleteProjectIssueTemplate(owner, slug, templateId) {
  const { data } = await api.delete(`/projects/${owner}/${slug}/issue-templates/${templateId}`);
  return data;
}

export async function starProject(owner, slug) {
  const { data } = await api.post(`/projects/${owner}/${slug}/star`);
  return data;
}

export async function unstarProject(owner, slug) {
  const { data } = await api.delete(`/projects/${owner}/${slug}/star`);
  return data;
}

export async function watchProject(owner, slug) {
  const { data } = await api.post(`/projects/${owner}/${slug}/watch`);
  return data;
}

export async function unwatchProject(owner, slug) {
  const { data } = await api.delete(`/projects/${owner}/${slug}/watch`);
  return data;
}

export async function getPullRequests(owner, slug, params) {
  const { data } = await api.get(`/projects/${owner}/${slug}/pulls`, { params });
  return data;
}

export async function createPullRequest(owner, slug, payload) {
  const { data } = await api.post(`/projects/${owner}/${slug}/pulls`, payload);
  return data;
}

export async function getPullRequest(owner, slug, number) {
  const { data } = await api.get(`/projects/${owner}/${slug}/pulls/${number}`);
  return data;
}

export async function updatePullRequest(owner, slug, number, payload) {
  const { data } = await api.patch(`/projects/${owner}/${slug}/pulls/${number}`, payload);
  return data;
}

export async function mergePullRequest(owner, slug, number, payload = {}) {
  const { data } = await api.post(`/projects/${owner}/${slug}/pulls/${number}/merge`, payload);
  return data;
}

export async function createPullRequestReviewComment(owner, slug, number, payload) {
  const { data } = await api.post(
    `/projects/${owner}/${slug}/pulls/${number}/comments`,
    payload
  );
  return data;
}

export async function updatePullRequestReviewComment(owner, slug, number, commentId, body) {
  const { data } = await api.patch(
    `/projects/${owner}/${slug}/pulls/${number}/comments/${commentId}`,
    { body }
  );
  return data;
}

export async function deletePullRequestReviewComment(owner, slug, number, commentId) {
  const { data } = await api.delete(
    `/projects/${owner}/${slug}/pulls/${number}/comments/${commentId}`
  );
  return data;
}

export async function submitPullRequestReview(owner, slug, number, payload) {
  const { data } = await api.post(`/projects/${owner}/${slug}/pulls/${number}/reviews`, payload);
  return data;
}

export async function getProjectCollaborators(owner, slug) {
  const { data } = await api.get(`/projects/${owner}/${slug}/collaborators`);
  return data;
}

export async function addProjectCollaborator(owner, slug, payload) {
  const { data } = await api.post(`/projects/${owner}/${slug}/collaborators`, payload);
  return data;
}

export async function updateProjectCollaborator(owner, slug, userId, payload) {
  const { data } = await api.patch(`/projects/${owner}/${slug}/collaborators/${userId}`, payload);
  return data;
}

export async function removeProjectCollaborator(owner, slug, userId) {
  const { data } = await api.delete(`/projects/${owner}/${slug}/collaborators/${userId}`);
  return data;
}

export async function getBranchProtection(owner, slug, params) {
  const { data } = await api.get(`/projects/${owner}/${slug}/protection`, { params });
  return data;
}

export async function updateBranchProtection(owner, slug, payload) {
  const { data } = await api.patch(`/projects/${owner}/${slug}/protection`, payload);
  return data;
}

export async function getWorkflowRuns(owner, slug) {
  const { data } = await api.get(`/projects/${owner}/${slug}/actions/runs`);
  return data;
}

export async function runWorkflow(owner, slug, payload) {
  const { data } = await api.post(`/projects/${owner}/${slug}/actions/run`, payload);
  return data;
}

export async function getUser(username) {
  const { data } = await api.get(`/users/${username}`);
  return data;
}

export async function getUserProjects(username) {
  const { data } = await api.get(`/users/${username}/projects`);
  return asApiList(data);
}

export async function deleteProject(owner, slug) {
  const { data } = await api.delete(`/projects/${owner}/${slug}`);
  return data;
}

export async function searchUsers(q) {
  const { data } = await api.get('/users/search', { params: { q } });
  return data;
}

export async function search(query, params) {
  const { data } = await api.get('/search', { params: { q: query, ...params } });
  return data;
}

export async function getConversations() {
  const { data } = await api.get('/conversations');
  return data;
}

export async function getConversation(id) {
  const { data } = await api.get(`/conversations/${id}`);
  return data;
}

export async function createConversation(payload) {
  const { data } = await api.post('/conversations', payload);
  return data;
}

export async function createGroup(payload) {
  const { data } = await api.post('/conversations/groups', payload);
  return data;
}

export async function getConversationCryptoKey(conversationId) {
  const { data } = await api.get(`/conversations/${conversationId}/crypto-key`);
  return data;
}

export async function addGroupMembers(conversationId, usernames) {
  const { data } = await api.post(`/conversations/${conversationId}/members`, { usernames });
  return data;
}

export async function getMessages(conversationId) {
  const { data } = await api.get(`/conversations/${conversationId}/messages`);
  return data;
}

export async function sendMessage(conversationId, bodyOrPayload) {
  const payload =
    typeof bodyOrPayload === 'string' ? { body: bodyOrPayload } : bodyOrPayload || {};
  const { data } = await api.post(`/conversations/${conversationId}/messages`, payload);
  return data;
}

export async function markConversationRead(conversationId, payload = {}) {
  const { data } = await api.post(`/conversations/${conversationId}/read`, payload);
  return data;
}

export async function editMessage(conversationId, messageId, payload) {
  const { data } = await api.patch(`/conversations/${conversationId}/messages/${messageId}`, payload);
  return data;
}

export async function deleteMessage(conversationId, messageId) {
  const { data } = await api.delete(`/conversations/${conversationId}/messages/${messageId}`);
  return data;
}

export async function reactToMessage(conversationId, messageId, emoji) {
  const { data } = await api.post(`/conversations/${conversationId}/messages/${messageId}/reactions`, {
    emoji,
  });
  return data;
}

export async function updateCategoryRules(slug, rules) {
  const { data } = await api.patch(`/categories/${slug}/rules`, { rules });
  return data;
}

export async function getCategoryModerators(slug) {
  const { data } = await api.get(`/categories/${slug}/moderators`);
  return data;
}

export async function addCategoryModerator(slug, username) {
  const { data } = await api.post(`/categories/${slug}/moderators`, { username });
  return data;
}

export async function removeCategoryModerator(slug, userId) {
  const { data } = await api.delete(`/categories/${slug}/moderators/${userId}`);
  return data;
}

export async function getNotifications() {
  const { data } = await api.get('/notifications');
  return data;
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.patch('/notifications/read-all');
  return data;
}

export async function createReport(payload) {
  const { data } = await api.post('/reports', payload);
  return data;
}

export async function getReports(params = {}) {
  const { data } = await api.get('/reports', { params });
  return data;
}

export async function updateReport(id, payload) {
  const { data } = await api.patch(`/reports/${id}`, payload);
  return data;
}

export async function getModerationLog(params = {}) {
  const { data } = await api.get('/reports/log', { params });
  return data;
}

export async function getMyBanSanction() {
  const { data } = await api.get('/appeals/me');
  return data;
}

export async function submitBanAppeal(payload) {
  const { data } = await api.post('/appeals', payload);
  return data;
}

export async function getBanAppeals(params = {}) {
  const { data } = await api.get('/appeals', { params });
  return data;
}

export async function reviewBanAppeal(id, payload) {
  const { data } = await api.patch(`/appeals/${id}`, payload);
  return data;
}

export async function getModerationExport(params = {}) {
  const { data } = await api.get('/reports/export', { params });
  return data;
}

export async function getModerationExportCsv(params = {}) {
  const response = await api.get('/reports/export.csv', {
    params,
    responseType: 'blob',
  });
  return {
    blob: response.data,
    headers: response.headers || {},
  };
}

export async function translateText(payload) {
  const { data } = await api.post('/translate', payload);
  return data;
}

/** Private owner stats — requires SITE_OWNER_USERNAME on server */
export async function getStatsOverview() {
  const { data } = await api.get('/stats/overview');
  return data;
}

export async function getStatsUsers(params = {}) {
  const { data } = await api.get('/stats/users', { params });
  return data;
}

export default api;
