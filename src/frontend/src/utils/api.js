import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:8443/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    }
    return Promise.reject(error);
  }
);

export default api;