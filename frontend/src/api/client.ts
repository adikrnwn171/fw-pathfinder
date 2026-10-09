// export const API_BASE_URL = 'http://localhost:8000';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

import axios from 'axios';

export const api = axios.create({
//   baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login'){
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);