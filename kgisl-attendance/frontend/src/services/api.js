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

function clearStoredSession() {
  localStorage.removeItem('kgisl_token');
  localStorage.removeItem('kgisl_refresh_token');
  localStorage.removeItem('kgisl_user');
}

function forceSignOut(err) {
  clearStoredSession();
  sessionStorage.setItem('kgisl_session_notice', 'Your session expired for security. Please sign in again.');
  window.location.assign('/');
  return Promise.reject({ ...err, message: 'Your session expired. Please sign in again.', code: 'SESSION_EXPIRED' });
}

function bearerOf(config) {
  const header = config?.headers?.Authorization;
  return typeof header === 'string' ? header.replace(/^Bearer\s+/i, '') : '';
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;
    const code = err.response?.data?.code;

    const isAuthEndpoint = original?.url?.includes('/auth/');
    if (status === 401 && !isAuthEndpoint && original && !original._retried) {
      original._retried = true;

      // Tokens live in localStorage, which every tab shares. If another tab (or an earlier request) already
      // refreshed them, just retry with the newer token instead of refreshing a second time.
      const storedToken = localStorage.getItem('kgisl_token');
      if (storedToken && storedToken !== bearerOf(original)) {
        original.headers.Authorization = `Bearer ${storedToken}`;
        return api(original);
      }

      const refreshToken = localStorage.getItem('kgisl_refresh_token');
      if (!refreshToken) return forceSignOut(err);
      try {
        refreshInFlight = refreshInFlight ?? refreshAccessToken(refreshToken).finally(() => { refreshInFlight = null; });
        const { accessToken, refreshToken: nextRefresh } = await refreshInFlight;
        localStorage.setItem('kgisl_token', accessToken);
        localStorage.setItem('kgisl_refresh_token', nextRefresh);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshError) {
        // Only a definite "this login is no longer valid" answer ends the session. A dropped connection, a timeout or a
        // server hiccup (all common on classroom Wi-Fi) used to sign the user out; they should just be able to retry.
        const refreshStatus = refreshError?.response?.status;
        if (refreshStatus === 400 || refreshStatus === 401 || refreshStatus === 403 || refreshStatus === 422) return forceSignOut(err);
        return Promise.reject({ ...err, message: 'Could not reach the server. Check your connection and try again.', code: 'NETWORK_ERROR' });
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
  api.post('/auth/admin/login', { email, password }).then((r) => r.data.data ?? r.data);
export const verifyAdminOtp = (email, code) =>
  api.post('/auth/admin/verify-otp', { email, code }).then((r) => r.data.data ?? r.data);

export const loginStudent = (email, password) =>
  api.post('/auth/student/login', { email, password }).then((r) => r.data);

export const getGoogleAuthConfig = () =>
  api.get('/auth/google/config').then((r) => r.data.data);
export const loginGoogle = (credential, role) =>
  api.post('/auth/google', { credential, role }).then((r) => r.data);

export const logoutRequest = (refreshToken) =>
  api.post('/auth/logout', { refreshToken }).then((r) => r.data);
export const changePassword = (currentPassword, newPassword) =>
  api.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data);
export const requestPasswordReset = (email, role) =>
  api.post('/auth/password-reset/request', { email, role }).then((r) => r.data);
export const confirmPasswordReset = (email, role, code, newPassword) =>
  api.post('/auth/password-reset/confirm', { email, role, code, newPassword }).then((r) => r.data);

// ---- Catalog (real DB-backed options for session config) ----
export const listSubjects = () => api.get('/catalog/subjects').then((r) => r.data.data);
export const listRooms = () => api.get('/catalog/rooms').then((r) => r.data.data);
export const listBatches = () => api.get('/catalog/batches').then((r) => r.data.data);
export const createBatch = (payload) => api.post('/catalog/batches', payload).then((r) => r.data.data);
export const updateBatch = (id, payload) => api.patch(`/catalog/batches/${id}`, payload).then((r) => r.data.data);
export const approveBatchArchive = (id) => api.post(`/catalog/batches/${id}/archive-approve`).then((r) => r.data);
export const retrieveBatch = (id, completionDate) => api.post(`/catalog/batches/${id}/retrieve`, { completionDate }).then((r) => r.data);
export const createSubject = (payload) => api.post('/catalog/subjects', payload).then((r) => r.data.data);
export const updateSubject = (id, payload) => api.patch(`/catalog/subjects/${id}`, payload).then((r) => r.data.data);
export const createRoom = (payload) => api.post('/catalog/rooms', payload).then((r) => r.data.data);
export const updateRoom = (id, payload) => api.patch(`/catalog/rooms/${id}`, payload).then((r) => r.data.data);

// ---- Sessions ----
export const startSession = (payload) => api.post('/sessions', payload).then((r) => r.data);
export const getActiveSession = () => api.get('/sessions/active/mine').then((r) => r.data.data);
export const endSession = (sessionId) => api.post(`/sessions/${sessionId}/end`).then((r) => r.data);
export const pauseSession = (sessionId) => api.post(`/sessions/${sessionId}/pause`).then((r) => r.data);
export const resumeSession = (sessionId) => api.post(`/sessions/${sessionId}/resume`).then((r) => r.data);
export const getAttendanceReport = (params) => api.get('/history/report', { params }).then((r) => r.data.data);
export const getSessionStats = (sessionId) => api.get(`/sessions/${sessionId}/stats`).then((r) => r.data);
export const getSessionPublicInfo = (sessionId) => api.get(`/sessions/${sessionId}/public`).then((r) => r.data);
/** "Wrong class" undo: removes a session nobody has marked yet so it never shows up in reports. */
export const cancelSession = (sessionId) => api.post(`/sessions/${sessionId}/cancel`).then((r) => r.data);
export const correctAttendance = (sessionId, payload) => api.patch(`/sessions/${sessionId}/attendance`, payload).then((r) => r.data);

// ---- Scan ----
export const submitScan = (payload) => api.post('/scan', payload).then((r) => r.data);
export const submitBeaconScan = (payload) => api.post('/scan/beacon', payload).then((r) => r.data);

// ---- Admin/Faculty Manage ----
/** `includeInactive` is for the admin directory so deactivated faculty can be re-enabled; dropdowns keep the default. */
export const listFaculty = (includeInactive = false) => api.get('/faculty', { params: includeInactive ? { includeInactive: true } : {} }).then((r) => r.data.data);
export const createFaculty = (payload) => api.post('/faculty', payload).then((r) => r.data);
export const deleteFaculty = (id) => api.delete(`/faculty/${id}`).then((r) => r.data);
export const setFacultyActive = (id, isActive) => api.patch(`/faculty/${id}/status`, { isActive }).then((r) => r.data.data);
export const listStudents = (batchId, view = 'current') => api.get('/students', { params: { ...(batchId ? { batchId } : {}), view } }).then((r) => r.data.data);
export const getMyAttendance = () => api.get('/students/me/attendance').then((r) => r.data.data);
export const createStudent = (payload) => api.post('/students', payload).then((r) => r.data.data);
export const bulkCreateStudents = (payload) => api.post('/students/bulk', payload).then((r) => r.data.data);
export const deleteStudent = (id) => api.delete(`/students/${id}`).then((r) => r.data);
export const setStudentActive = (id, isActive) => api.patch(`/students/${id}/status`, { isActive }).then((r) => r.data.data);
export const resetStudentDevice = (id) => api.post(`/students/${id}/device-reset`).then((r) => r.data);
export const listHistory = (params) => api.get('/history', { params }).then((r) => r.data.data);
export const getSessionAttendance = (sessionId) => api.get(`/history/${sessionId}`).then((r) => r.data.data);
export const getAnalyticsSummary = () => api.get('/history/summary').then((r) => r.data.data);
export const listAuditLogs = () => api.get('/history/audit').then((r) => r.data.data);
export const listLeaveRequests = () => api.get('/leave-requests').then((r) => r.data.data);
export const createLeaveRequest = (payload) => api.post('/leave-requests', payload).then((r) => r.data.data);
export const reviewLeaveRequest = (id, payload) => api.patch(`/leave-requests/${id}/review`, payload).then((r) => r.data.data);
export const listAttendanceCorrections = () => api.get('/attendance-corrections').then((r) => r.data.data);
export const createAttendanceCorrection = (payload) => api.post('/attendance-corrections', payload).then((r) => r.data.data);
export const reviewAttendanceCorrection = (id, payload) => api.patch(`/attendance-corrections/${id}/review`, payload).then((r) => r.data.data);
export const listAllocations = (scope) => api.get('/timetable', { params: scope ? { scope } : {} }).then((r) => r.data.data);
export const createAllocation = (payload) => api.post('/timetable', payload).then((r) => r.data.data);
export const deleteAllocation = (id) => api.delete(`/timetable/${id}`).then((r) => r.data);

// ---- Academic calendar and block tests (saved on the server, visible to everyone) ----
export const listCalendarEvents = (params) => api.get('/calendar/events', { params }).then((r) => r.data.data);
export const createCalendarEvent = (payload) => api.post('/calendar/events', payload).then((r) => r.data.data);
export const importCalendarEvents = (events) => api.post('/calendar/events/bulk', { events }).then((r) => r.data.data);
export const deleteCalendarEvent = (id) => api.delete(`/calendar/events/${id}`).then((r) => r.data);
export const listBlockTests = (params) => api.get('/calendar/block-tests', { params }).then((r) => r.data.data);
export const createBlockTest = (payload) => api.post('/calendar/block-tests', payload).then((r) => r.data.data);
export const importBlockTests = (tests) => api.post('/calendar/block-tests/bulk', { tests }).then((r) => r.data.data);
export const deleteBlockTest = (id) => api.delete(`/calendar/block-tests/${id}`).then((r) => r.data);
