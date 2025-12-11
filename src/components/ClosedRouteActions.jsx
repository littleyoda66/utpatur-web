// src/components/ClosedRouteActions.jsx
import React, { useState } from 'react';
import { Globe, Download, Loader2, X } from 'lucide-react';
import { exportApi } from '../services/api';
import { config } from '../config';
import './ClosedRouteActions.css';

/**
 * Zone d'actions disponibles quand l'itinéraire est clos
 * - Vue 3D (Cesium)
 * - Export KML
 * - Export GPX (futur)
 */
export function ClosedRouteActions({ 
  selectedHuts, 
  startDate, 
  onToggle3D = () => {},
  is3DMode = false,
  onReopenRoute = null  // Callback pour rouvrir l'itinéraire
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  // Générer le nom de l'expédition à partir des cabanes
  const getExpeditionName = () => {
    if (selectedHuts.length < 2) return 'Expédition Laponie';
    const first = selectedHuts[0].name.split(' ')[0];
    const last = selectedHuts[selectedHuts.length - 1].name.split(' ')[0];
    if (first === last) return `Boucle ${first}`;
    return `${first} → ${last}`;
  };

  // Ouvrir la vue 3D (Cesium)
  const handleOpenIn3D = () => {
    onToggle3D(true);
  };
  
  // Fermer la vue 3D
  const handleClose3D = () => {
    onToggle3D(false);
  };

  // Télécharger le GPX
  const handleDownloadGpx = async () => {
    setIsExporting(true);
    setExportMessage(null);
    
    try {
      const result = await exportApi.generateGpx({
        selectedHuts,
        startDate,
        expeditionName: getExpeditionName()
      });
      
      // Télécharger via l'URL directe
      const gpxUrl = `${config.apiUrl}${result.gpx_url}`;
      window.open(gpxUrl, '_blank');
      
      setExportMessage({
        type: 'success',
        message: 'Fichier GPX téléchargé !'
      });
      setTimeout(() => setExportMessage(null), 5000);
      
    } catch (err) {
      console.error('Erreur téléchargement GPX:', err);
      // Extraire le message d'erreur proprement
      let errorMsg = 'Erreur lors du téléchargement';
      if (typeof err === 'string') {
        errorMsg = err;
      } else if (err?.message) {
        errorMsg = typeof err.message === 'string' ? err.message : JSON.stringify(err.message);
      } else if (err?.detail) {
        // Erreur Pydantic/FastAPI
        if (Array.isArray(err.detail)) {
          errorMsg = err.detail.map(e => e.msg || e.message || String(e)).join(', ');
        } else if (typeof err.detail === 'string') {
          errorMsg = err.detail;
        } else {
          errorMsg = JSON.stringify(err.detail);
        }
      }
      setExportMessage({
        type: 'error',
        message: errorMsg
      });
    } finally {
      setIsExporting(false);
    }
  };

  // En mode 3D, afficher uniquement le bouton pour fermer la 3D
  if (is3DMode) {
    return (
      <div className="closed-route-actions">
        <div className="closed-route-actions-grid" style={{ gridTemplateColumns: '1fr' }}>
          <button
            className="action-btn action-btn-3d-active"
            onClick={handleClose3D}
            title="Revenir à la carte 2D"
          >
            <X size={16} className="action-btn-icon" />
            <span className="action-btn-text">Fermer 3D</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="closed-route-actions">
      <div className="closed-route-actions-grid">
        {/* Bouton : Voir en 3D */}
        <button
          className="action-btn"
          onClick={handleOpenIn3D}
          title="Voir l'itinéraire en 3D avec le relief"
        >
          <Globe size={16} className="action-btn-icon" />
          <span className="action-btn-text">3D</span>
        </button>
        
        {/* Bouton : Télécharger GPX */}
        <button
          className="action-btn"
          onClick={handleDownloadGpx}
          disabled={isExporting}
          title="Télécharger le fichier GPX"
        >
          {isExporting ? (
            <Loader2 size={16} className="action-btn-icon spinning" />
          ) : (
            <Download size={16} className="action-btn-icon" />
          )}
          <span className="action-btn-text">GPX</span>
        </button>
      </div>
      
      {/* Message de succès ou d'erreur */}
      {exportMessage && (
        <div className={`action-message action-message-${exportMessage.type}`}>
          <span>{exportMessage.message}</span>
        </div>
      )}
    </div>
  );
}
