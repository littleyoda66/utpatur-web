// src/App.jsx
import React, { useState, useEffect } from 'react';
import { RouteBuilderPanel } from './components/RouteBuilderPanel';
import { AdminPanel } from './components/AdminPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { config } from './config';
import { checkHealth } from './services/api';
import './App.css';

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
        {/* Header avec badges d'environnement */}
        <header className="app-header">
          <div className="header-content">
            <div className="header-left">
              <h1 className="app-title">Ut På Tur</h1>
              
              {/* Badges environnement */}
              <div className="badges">
                {isStaging && (
                  <span className="badge badge-warning">
                    Staging
                  </span>
                )}
                {isDev && (
                  <span className="badge badge-info">
                    Dev
                  </span>
                )}
                {apiStatus && (
                  <span 
                    className={`badge ${
                      apiStatus.neo4j_connected 
                        ? 'badge-success' 
                        : 'badge-error'
                    }`}
                  >
                    API {apiStatus.status}
                  </span>
                )}
              </div>
            </div>

            {/* Tabs navigation */}
            <nav className="tabs">
             <button
			  type="button"
			  onClick={() => setActiveTab('route')}
			  className={`tab ${activeTab === 'route' ? 'tab-active' : ''}`}
			>
			  Planifier un itinéraire
			</button>

			<button
			  type="button"
			  onClick={() => setActiveTab('admin')}
			  className={`tab ${activeTab === 'admin' ? 'tab-active' : ''}`}
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

        {/* Footer */}
        <footer className="app-footer">
          <p>
            UtPaTur v{config.apiVersion} - Planification de raids en Laponie
            {config.debug && (
              <span className="debug-info">
                {' '}| API: {config.apiUrl}
              </span>
            )}
          </p>
        </footer>
      </div>
    </ErrorBoundary>
  );
}