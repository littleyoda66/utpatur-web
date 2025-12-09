// src/config/index.js
/**
 * Configuration centralisée de l'application
 */

export const config = {
  // API
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  apiVersion: 'v1',
  
  // Auth
  adminToken: import.meta.env.VITE_ADMIN_TOKEN || '',
  
  // Environment
  env: import.meta.env.VITE_ENV || 'development',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  debug: import.meta.env.VITE_DEBUG === 'true',
  
  // Map
  map: {
    defaultCenter: [
      parseFloat(import.meta.env.VITE_MAP_DEFAULT_LAT || '67.5'),
      parseFloat(import.meta.env.VITE_MAP_DEFAULT_LON || '18.0')
    ],
    defaultZoom: parseInt(import.meta.env.VITE_MAP_DEFAULT_ZOOM || '7'),
    minZoom: 5,
    maxZoom: 15,
    tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  
  // Route planning defaults
  routing: {
    defaultMaxDistance: 35, // km
    defaultMaxSegments: 2,
    maxDistanceLimit: 100,
    maxSegmentsLimit: 5,
  },
  
  // UI
  ui: {
    searchDebounceMs: 300,
    toastDuration: 3000,
  }
};

// Helper pour construire les URLs API
export const getApiUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${config.apiUrl}/api/${config.apiVersion}${cleanPath}`;
};

// Helper pour les headers avec auth
export const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  ...(config.adminToken && { Authorization: `Bearer ${config.adminToken}` })
});
