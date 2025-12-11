// src/components/ClosedRouteActions.jsx
import React, { useState } from 'react';
import { Globe, Download, FileText, Loader2 } from 'lucide-react';
import { exportApi } from '../services/api';
import { config } from '../config';
import './ClosedRouteActions.css';

/**
 * Zone d'actions disponibles quand l'itinéraire est clos
 * - Vue 3D (Cesium)
 * - Export KML
 * - Export GPX (futur)
 */
export function ClosedRouteActions({ selectedHuts, startDate, onToggle3D = () => {} }) {
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

  // Télécharger le KML
  const handleDownloadKml = async () => {
    setIsExporting(true);
    setExportMessage(null);
    
    try {
      const result = await exportApi.generateKml({
        selectedHuts,
        startDate,
        expeditionName: getExpeditionName()
      });
      
      // Télécharger via l'URL directe
      const kmlUrl = `${config.apiUrl}${result.kml_url}`;
      window.open(kmlUrl, '_blank');
      
      setExportMessage({
        type: 'success',
        message: 'Fichier KML téléchargé ! Ouvrez-le dans Google Earth Pro.'
      });
      setTimeout(() => setExportMessage(null), 5000);
      
    } catch (err) {
      console.error('Erreur téléchargement KML:', err);
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

  return (
    <div className="closed-route-actions">
      <h4 className="closed-route-actions-title">Actions</h4>
      
      <div className="closed-route-actions-grid">
        {/* Bouton principal : Voir en 3D */}
        <button
          className="action-btn action-btn-primary"
          onClick={handleOpenIn3D}
          title="Voir l'itinéraire en 3D avec le relief"
        >
          <Globe size={18} className="action-btn-icon" />
          <span>Voir en 3D</span>
        </button>
        
        {/* Bouton secondaire : Télécharger KML */}
        <button
          className="action-btn action-btn-secondary"
          onClick={handleDownloadKml}
          disabled={isExporting}
          title="Télécharger pour Google Earth Pro"
        >
          {isExporting ? (
            <Loader2 size={16} className="action-btn-icon spinning" />
          ) : (
            <Download size={16} className="action-btn-icon" />
          )}
          <span>KML</span>
        </button>
        
        {/* Futur : Export GPX */}
        <button
          className="action-btn action-btn-secondary action-btn-disabled"
          disabled
          title="Bientôt disponible"
        >
          <FileText size={16} className="action-btn-icon" />
          <span>GPX</span>
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
