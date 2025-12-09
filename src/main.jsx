// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Logging de la version et de l'environnement
console.log(`UtPaTur v${import.meta.env.VITE_API_VERSION || '2.0.0'}`);
console.log(`Environment: ${import.meta.env.VITE_ENV || 'development'}`);
console.log(`API URL: ${import.meta.env.VITE_API_URL || 'http://localhost:8000'}`);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);