import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  getGoogleAuthUrl: () => api.get('/auth/google'),
  getMe: () => api.get('/auth/me'),
  updateSettings: (settings) => api.put('/auth/settings', { settings }),
};

// Session API
export const sessionAPI = {
  generate: (data) => api.post('/sessions/generate', data),
  getActive: () => api.get('/sessions/active'),
  getHistory: () => api.get('/sessions/history'),
  getById: (id) => api.get(`/sessions/${id}`),
  deactivate: (id) => api.post(`/sessions/${id}/deactivate`),
  extend: (id, minutes) => api.post(`/sessions/${id}/extend`, { additionalMinutes: minutes }),
  validate: (id) => api.get(`/sessions/${id}/validate`),
};

// Attendance API
export const attendanceAPI = {
  submit: (data) => api.post('/attendance/submit', data),
  getBySession: (sessionId) => api.get(`/attendance/session/${sessionId}`),
  getByStudent: (email) => api.get(`/attendance/student/${email}`),
  getStats: () => api.get('/attendance/stats'),
};

// Schedule API
export const scheduleAPI = {
  create: (data) => api.post('/schedules', data),
  getAll: () => api.get('/schedules'),
  getToday: () => api.get('/schedules/today'),
  getUpcoming: () => api.get('/schedules/upcoming'),
  getById: (id) => api.get(`/schedules/${id}`),
  update: (id, data) => api.put(`/schedules/${id}`, data),
  delete: (id) => api.delete(`/schedules/${id}`),
};

// Analytics API
export const analyticsAPI = {
  getOverview: () => api.get('/analytics/overview'),
  getTrends: (days = 30) => api.get(`/analytics/trends?days=${days}`),
  getCourses: () => api.get('/analytics/courses'),
  getLowAttendance: (threshold = 70) => api.get(`/analytics/low-attendance?threshold=${threshold}`),
};

// Cheating API
export const cheatingAPI = {
  getViolations: (filters = {}) => api.get('/cheating/violations', { params: filters }),
  getSuspicious: (min = 3) => api.get(`/cheating/suspicious?minViolations=${min}`),
  getStats: () => api.get('/cheating/stats'),
};

// Drive API
export const driveAPI = {
  getFolders: () => api.get('/drive/folders'),
  getFiles: (folderId) => api.get(`/drive/folder/${folderId}/files`),
  getSheet: (spreadsheetId) => api.get(`/drive/sheet/${spreadsheetId}`),
};

export default api;
