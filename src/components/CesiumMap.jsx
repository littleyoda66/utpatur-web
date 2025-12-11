// src/components/CesiumMap.jsx
import React, { useEffect, useRef, useMemo } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './CesiumMap.css';

// Configurer le token Cesium Ion (depuis les variables d'environnement)
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN || '';

/**
 * Décodage d'une polyline encodée ORS (lat, lon, z)
 */
function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') {
    return [];
  }

  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const coordinates = [];
  const PRECISION = 1e5;

  while (index < len) {
    let result = 0;
    let shift = 0;
    let b;

    // latitude
    do {
      if (index >= len) break;
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    // longitude
    result = 0;
    shift = 0;
    do {
      if (index >= len) break;
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    // altitude (3e dimension) - on la saute
    result = 0;
    shift = 0;
    if (index < len) {
      do {
        if (index >= len) break;
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
    }

    coordinates.push({
      lat: lat / PRECISION,
      lng: lng / PRECISION
    });
  }

  return coordinates;
}

/**
 * Extraire toutes les positions de l'itinéraire
 */
function extractRoutePositions(selectedHuts) {
  const positions = [];

  for (let i = 1; i < selectedHuts.length; i++) {
    const currHut = selectedHuts[i];
    if (!currHut) continue;

    const steps = currHut.steps || [];
    
    if (steps.length === 0) {
      // Ligne droite
      const prevHut = selectedHuts[i - 1];
      if (prevHut?.latitude && prevHut?.longitude && currHut?.latitude && currHut?.longitude) {
        positions.push({ lat: prevHut.latitude, lng: prevHut.longitude });
        positions.push({ lat: currHut.latitude, lng: currHut.longitude });
      }
    } else {
      // Segments avec géométrie ORS
      steps.forEach((step) => {
        const poly = step.geometry_polyline || step.geometry?.polyline;
        if (poly) {
          const decoded = decodePolyline(poly);
          positions.push(...decoded);
        }
      });
    }
  }

  return positions;
}

/**
 * Calculer la vue caméra à partir des bounds
 */
function getCameraViewFromBounds(mapBounds) {
  if (!mapBounds) {
    // Fallback Laponie
    return {
      longitude: 18.5,
      latitude: 64.0,
      height: 50000
    };
  }

  // Centre des bounds
  const centerLat = (mapBounds.minLat + mapBounds.maxLat) / 2;
  const centerLng = (mapBounds.minLng + mapBounds.maxLng) / 2;

  // Calculer la hauteur en fonction de l'étendue
  const latSpan = mapBounds.maxLat - mapBounds.minLat;
  const lngSpan = mapBounds.maxLng - mapBounds.minLng;
  const maxSpan = Math.max(latSpan, lngSpan, 0.1);

  // 1 degré ≈ 111 km
  // Réduire le multiplicateur pour un zoom plus serré
  const heightKm = maxSpan * 111 * 0.8;
  const heightMeters = Math.max(heightKm * 1000, 15000); // minimum 15km

  // Décaler la caméra vers le sud pour compenser le pitch (-60°)
  // et laisser de la marge en bas pour la barre d'instructions
  const cameraLatOffset = latSpan * 0.7;

  return {
    longitude: centerLng,
    latitude: centerLat - cameraLatOffset,
    height: heightMeters
  };
}

/**
 * Composant CesiumMap - Vue 3D de l'itinéraire
 */
export function CesiumMap({ 
  selectedHuts = [],
  onClose = () => {},
  mapBounds = null
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const initializedRef = useRef(false);

  // Extraire les positions de l'itinéraire
  const routePositions = useMemo(
    () => extractRoutePositions(selectedHuts),
    [selectedHuts]
  );

  // Calculer la vue caméra à partir des bounds
  const cameraView = useMemo(() => getCameraViewFromBounds(mapBounds), [mapBounds]);

  // Initialiser Cesium
  useEffect(() => {
    if (!containerRef.current) return;
    if (initializedRef.current) return;

    const initViewer = async () => {
      // Créer le viewer
      const viewer = new Cesium.Viewer(containerRef.current, {
        baseLayerPicker: true,
        geocoder: false,
        homeButton: false,
        sceneModePicker: true,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        vrButton: false,
        infoBox: true,
        selectionIndicator: true,
        shadows: false,
        shouldAnimate: false
      });

      viewerRef.current = viewer;

      // Désactiver l'éclairage dynamique (toujours jour)
      viewer.scene.globe.enableLighting = false;
      viewer.scene.fog.enabled = true;
      viewer.scene.fog.density = 0.0001;

      // 1. POSITIONNER LA CAMÉRA IMMÉDIATEMENT
      if (cameraView) {
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            cameraView.longitude,
            cameraView.latitude,
            cameraView.height
          ),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-60), // Vue inclinée
            roll: 0
          }
        });
      }

      // 2. AJOUTER LE TRACÉ DE L'ITINÉRAIRE
      if (routePositions.length > 1) {
        const cartesianPositions = routePositions.map(pos => 
          Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat)
        );

        viewer.entities.add({
          name: 'Itinéraire',
          polyline: {
            positions: cartesianPositions,
            width: 5,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color: Cesium.Color.fromCssColorString('#3b82f6')
            }),
            clampToGround: true
          }
        });
      }

      // 3. AJOUTER LES MARQUEURS POUR CHAQUE CABANE
      selectedHuts.forEach((hut, index) => {
        if (!hut?.latitude || !hut?.longitude) return;

        const isStart = index === 0;
        const isEnd = index === selectedHuts.length - 1;
        const isRestDay = hut.isRestDay;

        // Couleur du point selon le rôle
        let color = Cesium.Color.fromCssColorString('#1e3a8a');
        if (isStart) {
          color = Cesium.Color.fromCssColorString('#22c55e');
        }
        if (isEnd) {
          color = Cesium.Color.fromCssColorString('#ef4444');
        }
        if (isRestDay) {
          color = Cesium.Color.fromCssColorString('#8b5cf6');
        }

        // Label court
        const labelText = `${index}. ${hut.name}`;

        viewer.entities.add({
          name: hut.name,
          position: Cesium.Cartesian3.fromDegrees(hut.longitude, hut.latitude),
          point: {
            pixelSize: isStart || isEnd ? 10 : 7,
            color: color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
          label: {
            text: labelText,
            font: 'bold 11px Arial',
            fillColor: Cesium.Color.WHITE,
            style: Cesium.LabelStyle.FILL,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
            pixelOffset: new Cesium.Cartesian2(10, 0),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
          description: `
            <h3>${hut.name}</h3>
            <p><b>Jour ${index}</b></p>
            ${hut.total_distance ? `<p>Distance: ${hut.total_distance.toFixed(1)} km</p>` : ''}
            ${hut.elevation_gain ? `<p>Dénivelé: +${Math.round(hut.elevation_gain)}m / -${Math.round(hut.elevation_loss || 0)}m</p>` : ''}
            ${isRestDay ? '<p><i>Jour de repos</i></p>' : ''}
          `
        });
      });

      // 4. AJOUTER LE TERRAIN (en arrière-plan, ne bloque pas l'affichage)
      try {
        viewer.scene.terrainProvider = await Cesium.createWorldTerrainAsync({
          requestWaterMask: true,
          requestVertexNormals: true
        });
      } catch (err) {
        console.warn('Terrain loading failed, using default:', err);
      }

      initializedRef.current = true;
    };

    initViewer();

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      initializedRef.current = false;
    };
  }, [selectedHuts, routePositions, cameraView]);

  return (
    <div className="cesium-map-wrapper">
      {/* Bouton fermer */}
      <button 
        className="cesium-close-btn"
        onClick={onClose}
        title="Revenir à la carte 2D"
      >
        ✕ Fermer la vue 3D
      </button>

      {/* Conteneur Cesium */}
      <div 
        ref={containerRef} 
        className="cesium-container"
      />

      {/* Instructions */}
      <div className="cesium-instructions">
        <span>🖱️ Clic gauche = Rotation</span>
        <span>🖱️ Clic droit = Zoom</span>
        <span>🖱️ Molette = Zoom</span>
        <span>🖱️ Clic milieu = Inclinaison</span>
      </div>
    </div>
  );
}
