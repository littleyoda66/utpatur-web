// src/components/ErrorBoundary.jsx
import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#ef4444' }}>
            Oups ! Une erreur s'est produite
          </h1>
          <p style={{ marginBottom: '2rem', color: '#64748b' }}>
            L'application a rencontré une erreur inattendue.
          </p>
          
          {this.state.error && (
            <div style={{
              maxWidth: '600px',
              padding: '1rem',
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              textAlign: 'left'
            }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                Détails de l'erreur :
              </h3>
              <pre style={{ 
                fontSize: '0.875rem', 
                overflow: 'auto',
                margin: 0
              }}>
                {this.state.error.toString()}
              </pre>
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer'
            }}
          >
            Recharger la page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
