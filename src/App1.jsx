// src/App.jsx
import React, { useState, useEffect } from 'react';
import { RouteBuilderPanel } from './components/RouteBuilderPanel';
import { AdminPanel } from './components/AdminPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { config } from './config';
import { checkHealth } from './services/api';
import { version } from '../package.json';
import './App.css';

// Composant SVG du drapeau Sami (officiel)
function SamiFlag() {
  return (
    <svg viewBox="0 0 808 600" xmlns="http://www.w3.org/2000/svg">
      <path fill="#0035ad" d="M0 0h808v600H0z"/>
      <path fill="#ffce00" d="M0 0h370v600H0z"/>
      <path fill="#007229" d="M0 0h314v600H0z"/>
      <path fill="#dc241f" d="M0 0h258v600H0z"/>
      <path fill="#0035ad" d="M314 108a192 192 0 0 0 0 384l16-16-16-16a160 160 0 0 1 0-320l16-16-16-16z"/>
      <path fill="none" stroke="#dc241f" strokeWidth="32" d="M314 124a176 176 0 0 1 0 352"/>
    </svg>
  );
}

// Silhouette de montagnes scandinaves - émergent du bleu, descente vers plaine
function MountainsSilhouette() {
  return (
    <svg viewBox="0 0 1400 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Dégradé pour le remplissage: bleu solide à gauche (sous le dégradé header), puis s'estompe */}
        <linearGradient id="mountainFill" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0035ad" stopOpacity="1"/>
          <stop offset="25%" stopColor="#0035ad" stopOpacity="0.8"/>
          <stop offset="40%" stopColor="#0035ad" stopOpacity="0.15"/>
          <stop offset="55%" stopColor="#0035ad" stopOpacity="0.06"/>
          <stop offset="75%" stopColor="#0035ad" stopOpacity="0"/>
        </linearGradient>
        {/* Dégradé pour le contour: invisible à gauche (fondu dans le bleu), visible à droite */}
        <linearGradient id="mountainStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0035ad" stopOpacity="0"/>
          <stop offset="30%" stopColor="#0035ad" stopOpacity="0"/>
          <stop offset="50%" stopColor="#0035ad" stopOpacity="0.1"/>
          <stop offset="70%" stopColor="#0035ad" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="#0035ad" stopOpacity="0.08"/>
        </linearGradient>
      </defs>
      {/* Silhouette remplie - pics hauts à gauche, descente progressive */}
      <path 
        fill="url(#mountainFill)"
        d="M0,80 L0,35 L50,28 L100,12 L150,22 L200,5 L260,18 L320,2 L380,15 L440,8 L500,20 L560,12 L620,25 L680,18 L740,28 L800,22 L860,35 L920,30 L980,42 L1040,38 L1100,50 L1160,46 L1220,55 L1280,52 L1340,62 L1400,65 L1400,80 Z"
      />
      {/* Contour seul - même profil */}
      <path 
        fill="none"
        stroke="url(#mountainStroke)"
        strokeWidth="1.5"
        strokeLinejoin="bevel"
        d="M0,35 L50,28 L100,12 L150,22 L200,5 L260,18 L320,2 L380,15 L440,8 L500,20 L560,12 L620,25 L680,18 L740,28 L800,22 L860,35 L920,30 L980,42 L1040,38 L1100,50 L1160,46 L1220,55 L1280,52 L1340,62 L1400,65"
      />
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('route');
  const [apiStatus, setApiStatus] = useState(null);
  const [isCheckingApi, setIsCheckingApi] = useState(true);

  // Vérifier l'état de l'API au démarrage
  useEffect(() => {
    const verifyApi = async (showLoading = false) => {
      if (showLoading) setIsCheckingApi(true);
      const health = await checkHealth();
      setApiStatus(health);
      if (showLoading) setIsCheckingApi(false);
    };
    
    // Premier appel avec loading
    verifyApi(true);
    
    // Vérifications périodiques silencieuses (toutes les 2 minutes)
    const interval = setInterval(() => verifyApi(false), 120000);
    return () => clearInterval(interval);
  }, []);

  const isStaging = config.env === 'staging';
  const isDev = config.isDevelopment;

  return (
    <ErrorBoundary>
      <div className="app">
        {/* Header avec drapeau Sami */}
        <header className="app-header">
          {/* Silhouette montagnes en arrière-plan */}
          <div className="header-mountains">
            <MountainsSilhouette />
          </div>
          
          <div className="header-content">
            {/* Drapeau Sami à gauche avec dégradé */}
            <div className="header-flag-container">
              <div className="sami-flag">
                <SamiFlag />
              </div>
            </div>
            
            {/* Logo et sous-titre */}
            <div className="header-brand">
              <h1 className="app-title">Ut På Tur</h1>
              <span className="app-subtitle">Jođi lea buoret go oru</span>
            </div>

            {/* Navigation links */}
            <nav className="nav-links">
              <button
                type="button"
                onClick={() => setActiveTab('route')}
                className={`nav-link ${activeTab === 'route' ? 'nav-link-active' : ''}`}
              >
                Planifier
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`nav-link ${activeTab === 'admin' ? 'nav-link-active' : ''}`}
              >
                Admin
              </button>
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="app-main">
          {isCheckingApi ? (
            <div className="loading-container">
              <div className="spinner" />
              <p>Connexion à l'API...</p>
            </div>
          ) : !apiStatus ? (
            <div className="error-container">
              <p className="error-message">
                ⚠️ Impossible de se connecter à l'API
              </p>
              <p className="error-details">
                Vérifiez que le backend est démarré sur {config.apiUrl}
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="btn btn-primary"
              >
                Réessayer
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'route' && <RouteBuilderPanel />}
              {activeTab === 'admin' && <AdminPanel />}
            </>
          )}
        </main>

        {/* Footer avec badges */}
        <footer className="app-footer">
          <span className="footer-version">
            Ut På Tur v{version}
          </span>
          
          <div className="footer-badges">
            {isStaging && (
              <span className="badge badge-warning">Staging</span>
            )}
            {isDev && (
              <span className="badge badge-info">Dev</span>
            )}
            {apiStatus && (
              <span className={`badge ${apiStatus.neo4j_connected ? 'badge-success' : 'badge-error'}`}>
                API {apiStatus.status}
              </span>
            )}
          </div>
          
          {config.debug && (
            <span className="debug-info">
              {config.apiUrl}
            </span>
          )}
        </footer>
      </div>
    </ErrorBoundary>
  );
}
