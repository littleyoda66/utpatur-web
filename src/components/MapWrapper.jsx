// src/components/MapWrapper.jsx
/**
 * Wrapper qui permet de basculer entre la carte Leaflet 2D et Cesium 3D
 */
import React, { Suspense, lazy, useState, useRef, useCallback } from 'react';
import { RouteMap } from './RouteMap';

// Lazy load Cesium pour éviter de charger 3MB au démarrage
const CesiumMap = lazy(() => 
  import('./CesiumMap').then(module => ({ default: module.CesiumMap }))
);

// Loader pendant le chargement de Cesium
function CesiumLoader() {
  return (
    <div className="cesium-loader">
      <div className="cesium-loader-content">
        <div className="cesium-loader-spinner" />
        <p>Chargement de la vue 3D...</p>
        <p className="cesium-loader-hint">Première fois ? Le chargement peut prendre quelques secondes.</p>
      </div>
      <style>{`
        .cesium-loader {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: white;
        }
        .cesium-loader-content {
          text-align: center;
        }
        .cesium-loader-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(255,255,255,0.2);
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }
        .cesium-loader-hint {
          font-size: 12px;
          opacity: 0.6;
          margin-top: 8px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export function MapWrapper({ 
  selectedHuts = [], 
  reachableHuts = [],
  hoveredHutId = null,
  onHutHover = () => {},
  onHutClick = () => {},
  profileHoverPosition = null,
  isRouteClosed = false,
  is3DMode = false,
  onToggle3D = () => {}
}) {
  // Stocker les bounds de la carte 2D avant de passer en 3D
  const savedBoundsRef = useRef(null);
  const savedZoomRef = useRef(null);
  
  // État pour forcer la restauration des bounds
  const [restoreBounds, setRestoreBounds] = useState(null);

  // Callback appelé par RouteMap pour sauvegarder les bounds
  const handleMapReady = useCallback((map) => {
    // Sauvegarder les bounds actuels quand on passe en 3D
    if (map) {
      savedBoundsRef.current = map.getBounds();
      savedZoomRef.current = map.getZoom();
    }
  }, []);

  const handleOpen3D = () => {
    // Les bounds seront sauvegardés via onMapReady
    onToggle3D(true);
  };

  const handleClose3D = () => {
    onToggle3D(false);
    // Restaurer les bounds sauvegardés
    if (savedBoundsRef.current) {
      setRestoreBounds({
        bounds: savedBoundsRef.current,
        zoom: savedZoomRef.current,
        timestamp: Date.now()
      });
    }
  };

  // Mode 3D
  if (is3DMode) {
    return (
      <Suspense fallback={<CesiumLoader />}>
        <CesiumMap 
          selectedHuts={selectedHuts}
          onClose={handleClose3D}
        />
      </Suspense>
    );
  }

  // Mode 2D (Leaflet par défaut)
  return (
    <RouteMap 
      selectedHuts={selectedHuts}
      reachableHuts={reachableHuts}
      hoveredHutId={hoveredHutId}
      onHutHover={onHutHover}
      onHutClick={onHutClick}
      profileHoverPosition={profileHoverPosition}
      isRouteClosed={isRouteClosed}
      onMapReady={handleMapReady}
      restoreBounds={restoreBounds}
    />
  );
}
