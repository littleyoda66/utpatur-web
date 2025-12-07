// src/App.jsx
import React, { useState } from 'react';
import { RouteBuilderPanel } from './components/RouteBuilderPanel.jsx';
import { AdminAddLinkPanel } from './components/AdminAddLinkPanel.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('route');
  const env = import.meta.env.VITE_ENV;
  const isStaging = env === 'staging';


  const tabButtonStyle = (isActive) => ({
    borderRadius: '999px',
    border: '1px solid #d1d5db',
    padding: '0.35rem 0.9rem',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    background: isActive ? '#2563eb' : '#f9fafb',
    color: isActive ? '#ffffff' : '#374151',
  });
    
  return (
    <div
      className="app"
      style={{
        padding: '1.5rem',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
	      {isStaging && (
        <div
          style={{
            textAlign: 'center',
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            borderRadius: '999px',
            backgroundColor: '#f97316',
            color: '#111827',
            display: 'inline-block',
            marginBottom: '0.75rem',
          }}
        >
          Environnement de test (staging)
        </div>
      )}

	
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <h1
          style={{
            fontSize: '1.4rem',
            fontWeight: 600,
            marginRight: '0.5rem',
          }}
        >
          Ut På Tur
        </h1>

        <button
          type="button"
          onClick={() => setActiveTab('route')}
          style={tabButtonStyle(activeTab === 'route')}
        >
          Planifier un itinéraire
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('admin')}
          style={tabButtonStyle(activeTab === 'admin')}
        >
          Admin
        </button>
      </header>

      {activeTab === 'route' ? (
        <RouteBuilderPanel />
      ) : (
        <AdminAddLinkPanel />
      )}
    </div>
  );
}
