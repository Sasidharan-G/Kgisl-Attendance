import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kgisl_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Silently exchanges the refresh token for a new access token exactly once per
// failed request. If that also fails, the refresh token itself is dead (expired,
// revoked, or reuse was detected server-side) — clear the session and force re-login.
let refreshInFlight = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;
    const code = err.response?.data?.code;

    const isAuthEndpoint = original?.url?.includes('/auth/');
    if (status === 401 && !isAuthEndpoint && !original?._retried) {
      const refreshToken = localStorage.getItem('kgisl_refresh_token');
      if (refreshToken) {
        original._retried = true;
        try {
          refreshInFlight = refreshInFlight ?? refreshAccessToken(refreshToken);
          const { accessToken, refreshToken: nextRefresh } = await refreshInFlight;
          refreshInFlight = null;
          localStorage.setItem('kgisl_token', accessToken);
          localStorage.setItem('kgisl_refresh_token', nextRefresh);
          original.headers.Authorization = `Bearer ${accessToken}`;
          return api(original);
        } catch {
          refreshInFlight = null;
          localStorage.removeItem('kgisl_token');
          localStorage.removeItem('kgisl_refresh_token');
          localStorage.removeItem('kgisl_user');
          window.location.assign('/');
        }
      }
    }

    const message = code === 'RATE_LIMITED'
      ? 'Too many attempts — please slow down and try again shortly.'
      : err.response?.data?.message || err.message || 'Something went wrong';
    return Promise.reject({ ...err, message, code });
  }
);

function refreshAccessToken(refreshToken) {
  // Plain axios (not the wrapped `api`) — must not recurse through this same interceptor.
  return axios.post('/api/v1/auth/refresh', { refreshToken }).then((r) => r.data.data);
}

// ---- Auth ----
export const registerFaculty = (payload) =>
  api.post('/auth/faculty/register', payload).then((r) => r.data);

export const loginFaculty = (email, password) =>
  api.post('/auth/faculty/login', { email, password }).then((r) => r.data);

export const loginAdmin = (email, password) =>
  api.post('/auth/admin/login', { email, password }).then((r) => r.data);

export const loginStudent = (email, password) =>
  api.post('/auth/student/login', { email, password }).then((r) => r.data);

export const logoutRequest = (refreshToken) =>
  api.post('/auth/logout', { refreshToken }).then((r) => r.data);

// ---- Catalog (real DB-backed options for session config) ----
export const listSubjects = () => api.get('/catalog/subjects').then((r) => r.data.data);
export const listRooms = () => api.get('/catalog/rooms').then((r) => r.data.data);
export const listBatches = () => api.get('/catalog/batches').then((r) => r.data.data);

// ---- Sessions ----
export const startSession = (payload) => api.post('/sessions', payload).then((r) => r.data);
export const endSession = (sessionId) => api.post(`/sessions/${sessionId}/end`).then((r) => r.data);
export const getSessionStats = (sessionId) => api.get(`/sessions/${sessionId}/stats`).then((r) => r.data);
export const getSessionPublicInfo = (sessionId) => api.get(`/sessions/${sessionId}/public`).then((r) => r.data);
export const markManualAttendance = (sessionId, rollNo) => api.post(`/sessions/${sessionId}/manual-attendance`, { rollNo }).then((r) => r.data);

// ---- Scan ----
export const submitScan = (payload) => api.post('/scan', payload).then((r) => r.data);

// ---- Admin/Faculty Manage ----
export const listFaculty = () => api.get('/faculty').then((r) => r.data.data);
export const createFaculty = (payload) => api.post('/faculty', payload).then((r) => r.data);
export const deleteFaculty = (id) => api.delete(`/faculty/${id}`).then((r) => r.data);
export const listStudents = (batchId) => api.get('/students', { params: batchId ? { batchId } : {} }).then((r) => r.data.data);
export const createStudent = (payload) => api.post('/students', payload).then((r) => r.data.data);
export const deleteStudent = (id) => api.delete(`/students/${id}`).then((r) => r.data);
export const listHistory = () => api.get('/history').then((r) => r.data.data);
export const listAllocations = (scope) => api.get('/timetable', { params: scope ? { scope } : {} }).then((r) => r.data.data);
export const createAllocation = (payload) => api.post('/timetable', payload).then((r) => r.data.data);
export const deleteAllocation = (id) => api.delete(`/timetable/${id}`).then((r) => r.data);

// ---- AI Agent ----
export const sendAgentMessage = (message) => api.post('/agent/chat', { message }).then((r) => r.data);
