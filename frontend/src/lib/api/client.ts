import axios from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    const authToken = localStorage.getItem('auth_token');
    
    // Proactive synchronization
    if (token && !authToken) {
      localStorage.setItem('auth_token', token);
    } else if (!token && authToken) {
      localStorage.setItem('token', authToken);
    }

    const activeToken = token || authToken;
    if (activeToken) {
      config.headers.Authorization = `Bearer ${activeToken}`;
    }
  }
  return config;
});

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Token expired or invalid
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('auth_token');
        window.location.href = '/landing';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
