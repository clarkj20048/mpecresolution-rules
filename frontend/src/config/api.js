const devFallbackBaseUrl = 'http://localhost:3001';
const prodFallbackBaseUrl = 'https://mpecresolution-ruleswebsite.onrender.com';

const fallbackBaseUrl = import.meta.env.DEV ? devFallbackBaseUrl : prodFallbackBaseUrl;

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || fallbackBaseUrl).replace(/\/+$/, '');

export const apiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
