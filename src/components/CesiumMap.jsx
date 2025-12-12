// src/components/CesiumMap.jsx
import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
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
 * Extraire toutes les positions de l'itinéraire avec métadonnées des segments
 */
function extractRoutePositions(selectedHuts) {
  const positions = [];
  const segmentMarkers = [];

  for (let i = 1; i < selectedHuts.length; i++) {
    const currHut = selectedHuts[i];
    const prevHut = selectedHuts[i - 1];
    if (!currHut) continue;

    segmentMarkers.push({
      positionIndex: positions.length,
      dayIndex: i,
      fromHut: prevHut?.name || 'Départ',
      toHut: currHut.name,
      isRestDay: currHut.isRestDay
    });

    const steps = currHut.steps || [];
    
    if (steps.length === 0) {
      if (prevHut?.latitude && prevHut?.longitude && currHut?.latitude && currHut?.longitude) {
        positions.push({ lat: prevHut.latitude, lng: prevHut.longitude });
        positions.push({ lat: currHut.latitude, lng: currHut.longitude });
      }
    } else {
      steps.forEach((step) => {
        const poly = step.geometry_polyline || step.geometry?.polyline;
        if (poly) {
          const decoded = decodePolyline(poly);
          positions.push(...decoded);
        }
      });
    }
  }

  return { positions, segmentMarkers };
}

/**
 * Calculer la vue caméra à partir des bounds
 */
function getCameraViewFromBounds(mapBounds) {
  if (!mapBounds) {
    return { longitude: 18.5, latitude: 64.0, height: 50000 };
  }

  const centerLat = (mapBounds.minLat + mapBounds.maxLat) / 2;
  const centerLng = (mapBounds.minLng + mapBounds.maxLng) / 2;
  const latSpan = mapBounds.maxLat - mapBounds.minLat;
  const lngSpan = mapBounds.maxLng - mapBounds.minLng;
  const maxSpan = Math.max(latSpan, lngSpan, 0.1);
  const heightKm = maxSpan * 111 * 0.8;
  const heightMeters = Math.max(heightKm * 1000, 15000);
  const cameraLatOffset = latSpan * 0.7;

  return {
    longitude: centerLng,
    latitude: centerLat - cameraLatOffset,
    height: heightMeters
  };
}

/**
 * Calculer le bearing (direction) entre deux points
 */
function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = Cesium.Math.toRadians(lng2 - lng1);
  const lat1Rad = Cesium.Math.toRadians(lat1);
  const lat2Rad = Cesium.Math.toRadians(lat2);
  
  const x = Math.sin(dLng) * Math.cos(lat2Rad);
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  return Cesium.Math.toDegrees(Math.atan2(x, y));
}

/**
 * Distance perpendiculaire d'un point à une ligne (pour Douglas-Peucker)
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.lng - lineStart.lng;
  const dy = lineEnd.lat - lineStart.lat;
  
  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point.lng - lineStart.lng, 2) + 
      Math.pow(point.lat - lineStart.lat, 2)
    );
  }
  
  const t = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / (dx * dx + dy * dy);
  const nearestLng = lineStart.lng + t * dx;
  const nearestLat = lineStart.lat + t * dy;
  
  // Convertir en mètres approximatifs pour la tolérance
  const dLat = (point.lat - nearestLat) * 111000;
  const dLng = (point.lng - nearestLng) * 111000 * Math.cos(point.lat * Math.PI / 180);
  
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Simplification Douglas-Peucker
 * Réduit le nombre de points tout en préservant la forme générale
 */
function simplifyPath(points, tolerance = 50) {
  if (points.length <= 2) return points;
  
  // Trouver le point le plus éloigné de la ligne start-end
  let maxDistance = 0;
  let maxIndex = 0;
  
  const start = points[0];
  const end = points[points.length - 1];
  
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }
  
  // Si la distance max est supérieure à la tolérance, on subdivise
  if (maxDistance > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  
  // Sinon on garde juste les extrémités
  return [start, end];
}

/**
 * Interpolation linéaire
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Interpolation d'angle (gère le wrap-around 360°)
 */
function lerpAngle(a, b, t) {
  let diff = b - a;
  // Normaliser la différence entre -180 et 180
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return a + diff * t;
}

/**
 * Composant CesiumMap - Vue 3D avec Flight Simulator FLUIDE
 */
export function CesiumMap({ 
  selectedHuts = [],
  onClose = () => {},
  mapBounds = null,
  onFlightProgressChange = null, // Callback pour envoyer la progression (en km)
  seekToDistance = null          // Distance cible pour sauter (en km)
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const initializedRef = useRef(false);
  const animationFrameRef = useRef(null);
  const hikerMarkerRef = useRef(null); // Marqueur randonneur animé
  
  // État d'animation fluide
  const flightStateRef = useRef({
    currentIndex: 0,
    interpolation: 0, // 0 à 1 entre deux points
    currentBearing: 0,
    lastTimestamp: 0
  });

  // État du Flight Simulator
  const [isFlying, setIsFlying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [flySpeed, setFlySpeed] = useState(1);
  const [currentSegment, setCurrentSegment] = useState(null);
  const [progress, setProgress] = useState(0);
  const [hutPauseMessage, setHutPauseMessage] = useState(null); // Message pendant pause cabane
  const [isInitializing, setIsInitializing] = useState(false); // Masquer pendant init

  // Extraire les positions et segments
  const { positions: rawPositions, segmentMarkers } = useMemo(
    () => extractRoutePositions(selectedHuts),
    [selectedHuts]
  );

  // Calculer les distances cumulées pour une vitesse constante
  const { routePositions, cumulativeDistances, totalDistance, hutDistances } = useMemo(() => {
    if (rawPositions.length < 2) {
      return { routePositions: rawPositions, cumulativeDistances: [0], totalDistance: 0, hutDistances: [] };
    }

    const distances = [0];
    let total = 0;

    for (let i = 1; i < rawPositions.length; i++) {
      const p1 = rawPositions[i - 1];
      const p2 = rawPositions[i];
      
      // Distance en mètres (approximation)
      const dLat = (p2.lat - p1.lat) * 111000;
      const dLng = (p2.lng - p1.lng) * 111000 * Math.cos(p1.lat * Math.PI / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      
      total += dist;
      distances.push(total);
    }

    // Calculer les distances des cabanes (basé sur segmentMarkers)
    // On utilise fromHut car c'est la cabane de départ du segment qu'on vient d'atteindre
    const hutDists = [];
    
    // Première cabane (départ)
    if (selectedHuts.length > 0 && selectedHuts[0]) {
      hutDists.push({
        distance: 0,
        name: selectedHuts[0].name,
        dayIndex: 0
      });
    }
    
    // Cabanes suivantes (à la fin de chaque segment)
    segmentMarkers.forEach((marker, idx) => {
      // La distance de la cabane d'arrivée est à la fin du segment
      const nextMarkerIdx = idx + 1;
      const endDistance = nextMarkerIdx < segmentMarkers.length 
        ? distances[segmentMarkers[nextMarkerIdx].positionIndex] 
        : total;
      
      hutDists.push({
        distance: endDistance,
        name: marker.toHut,
        dayIndex: marker.dayIndex
      });
    });

    return { 
      routePositions: rawPositions, 
      cumulativeDistances: distances, 
      totalDistance: total,
      hutDistances: hutDists
    };
  }, [rawPositions, segmentMarkers]);

  const cameraView = useMemo(() => getCameraViewFromBounds(mapBounds), [mapBounds]);

  // État de préchargement
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const terrainCacheRef = useRef(new Map());

  // Précharger le terrain le long du parcours (avec warm-up haute résolution)
  const preloadTerrain = useCallback(async () => {
    if (!viewerRef.current || routePositions.length < 2) return true;
    
    const viewer = viewerRef.current;
    const terrainProvider = viewer.scene.terrainProvider;
    
    if (!terrainProvider || terrainProvider.ready === false) return true;

    setIsPreloading(true);
    setPreloadProgress(0);

    try {
      // PHASE 1: Échantillonner les altitudes pour le cache (20%)
      const sampleInterval = Math.max(1, Math.floor(routePositions.length / 50));
      const samplesToLoad = [];
      
      for (let i = 0; i < routePositions.length; i += sampleInterval) {
        const pos = routePositions[i];
        samplesToLoad.push(Cesium.Cartographic.fromDegrees(pos.lng, pos.lat));
      }
      
      const lastPos = routePositions[routePositions.length - 1];
      samplesToLoad.push(Cesium.Cartographic.fromDegrees(lastPos.lng, lastPos.lat));

      const batchSize = 10;
      for (let i = 0; i < samplesToLoad.length; i += batchSize) {
        const batch = samplesToLoad.slice(i, i + batchSize);
        const sampledBatch = await Cesium.sampleTerrainMostDetailed(terrainProvider, batch);
        
        sampledBatch.forEach((sampled, idx) => {
          const originalIdx = i + idx;
          if (sampled && sampled.height !== undefined) {
            const key = `${samplesToLoad[originalIdx].longitude.toFixed(6)},${samplesToLoad[originalIdx].latitude.toFixed(6)}`;
            terrainCacheRef.current.set(key, sampled.height);
          }
        });
        
        setPreloadProgress(Math.round((i + batch.length) / samplesToLoad.length * 20));
      }

      // PHASE 2: Warm-up des tuiles terrain haute résolution (80%)
      // Survoler rapidement le parcours pour forcer le chargement des tuiles
      const warmupPoints = 10; // Nombre de points de survol
      const warmupInterval = Math.floor(routePositions.length / warmupPoints);
      
      for (let i = 0; i < warmupPoints; i++) {
        const pointIdx = Math.min(i * warmupInterval, routePositions.length - 1);
        const pos = routePositions[pointIdx];
        
        // Positionner la caméra à basse altitude pour forcer le chargement des tuiles détaillées
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, 800),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-45),
            roll: 0
          }
        });
        
        // Attendre que les tuiles se chargent
        await new Promise(resolve => setTimeout(resolve, 400));
        
        // Forcer le rendu
        viewer.scene.requestRender();
        
        setPreloadProgress(20 + Math.round((i + 1) / warmupPoints * 80));
      }

      // Revenir à la vue initiale
      if (cameraView) {
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            cameraView.longitude,
            cameraView.latitude,
            cameraView.height
          ),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-60),
            roll: 0
          }
        });
      }

      console.log(`Terrain préchargé: ${terrainCacheRef.current.size} points, ${warmupPoints} zones`);
      return true;
    } catch (e) {
      console.warn('Préchargement terrain échoué:', e);
      return true;
    } finally {
      setIsPreloading(false);
    }
  }, [routePositions, cameraView]);

  // Obtenir la hauteur du terrain (avec cache)
  const getTerrainHeight = useCallback((lng, lat) => {
    const key = `${Cesium.Math.toRadians(lng).toFixed(6)},${Cesium.Math.toRadians(lat).toFixed(6)}`;
    
    // Chercher dans le cache (approximation par point le plus proche)
    let closestHeight = null;
    let closestDist = Infinity;
    
    terrainCacheRef.current.forEach((height, cachedKey) => {
      const [cachedLng, cachedLat] = cachedKey.split(',').map(Number);
      const dist = Math.abs(cachedLng - Cesium.Math.toRadians(lng)) + 
                   Math.abs(cachedLat - Cesium.Math.toRadians(lat));
      if (dist < closestDist) {
        closestDist = dist;
        closestHeight = height;
      }
    });
    
    return closestHeight || 0;
  }, []);

  // Trouver le segment actuel
  const findCurrentSegment = useCallback((posIndex) => {
    for (let i = segmentMarkers.length - 1; i >= 0; i--) {
      if (posIndex >= segmentMarkers[i].positionIndex) {
        return segmentMarkers[i];
      }
    }
    return segmentMarkers[0] || null;
  }, [segmentMarkers]);

  // Démarrer le survol (avec préchargement)
  const startFlight = useCallback(async () => {
    if (!viewerRef.current || routePositions.length < 2) return;

    const viewer = viewerRef.current;
    
    // Afficher l'overlay d'initialisation IMMÉDIATEMENT (masque le flickering)
    setIsInitializing(true);
    
    // Attendre que l'overlay soit rendu
    await new Promise(resolve => setTimeout(resolve, 50));

    // Précharger le terrain
    await preloadTerrain();

    // Initialiser le bearing vers la première direction
    const initialBearing = calculateBearing(
      routePositions[0].lat, routePositions[0].lng,
      routePositions[1].lat, routePositions[1].lng
    );

    // Positionner la caméra au départ
    const startPos = routePositions[0];
    const bearingRad = Cesium.Math.toRadians(initialBearing);
    const metersPerDegreeLat = 111000;
    const metersPerDegreeLng = 111000 * Math.cos(startPos.lat * Math.PI / 180);
    const cameraDistance = 400;
    const cameraLat = startPos.lat - Math.cos(bearingRad) * (cameraDistance / metersPerDegreeLat);
    const cameraLng = startPos.lng - Math.sin(bearingRad) * (cameraDistance / metersPerDegreeLng);
    const terrainHeight = getTerrainHeight(cameraLng, cameraLat);
    const cameraHeight = Math.max(terrainHeight + 150, 350);

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(cameraLng, cameraLat, cameraHeight),
      orientation: {
        heading: Cesium.Math.toRadians(initialBearing),
        pitch: Cesium.Math.toRadians(-12),
        roll: 0
      }
    });

    // Créer le marqueur randonneur
    hikerMarkerRef.current = viewer.entities.add({
      name: 'Randonneur',
      position: Cesium.Cartesian3.fromDegrees(startPos.lng, startPos.lat),
      point: {
        pixelSize: 16,
        color: Cesium.Color.fromCssColorString('#ff6b00'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    flightStateRef.current = {
      currentIndex: 0,
      currentDistance: 0,
      interpolation: 0,
      currentBearing: initialBearing,
      lastTimestamp: 0,
      smoothedHeight: cameraHeight
    };

    // Forcer plusieurs rendus pour que tout soit stable
    for (let i = 0; i < 3; i++) {
      viewer.scene.requestRender();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Activer l'état de vol AVANT de retirer l'overlay
    setIsFlying(true);
    setIsPaused(true);
    setProgress(0);
    setCurrentSegment(findCurrentSegment(0));

    // Attendre un frame
    await new Promise(resolve => setTimeout(resolve, 50));

    // Retirer l'overlay
    setIsInitializing(false);
    
    // Afficher la première cabane APRÈS que l'overlay soit retiré
    await new Promise(resolve => setTimeout(resolve, 100));
    setHutPauseMessage(`📍 ${selectedHuts[0]?.name || 'Départ'}`);
    setTimeout(() => setHutPauseMessage(null), 2000);
    
  }, [routePositions, selectedHuts, findCurrentSegment, preloadTerrain, getTerrainHeight]);

  // Pause/Resume
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
    flightStateRef.current.lastTimestamp = 0; // Reset pour éviter un saut
  }, []);

  // Arrêter le survol
  const stopFlight = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Supprimer le marqueur randonneur
    if (hikerMarkerRef.current && viewerRef.current) {
      viewerRef.current.entities.remove(hikerMarkerRef.current);
      hikerMarkerRef.current = null;
    }
    
    setIsFlying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentSegment(null);

    // Revenir à la vue initiale avec animation douce
    if (viewerRef.current && cameraView) {
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          cameraView.longitude,
          cameraView.latitude,
          cameraView.height
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-60),
          roll: 0
        },
        duration: 2
      });
    }
    
    // Signaler au parent que le vol est arrêté
    if (onFlightProgressChange) {
      onFlightProgressChange(null);
    }
  }, [cameraView, onFlightProgressChange]);

  // Gérer le seek depuis le profil d'élévation
  useEffect(() => {
    if (seekToDistance === null || !isFlying || !totalDistance) return;
    
    // Convertir km en mètres
    const targetDistanceMeters = seekToDistance * 1000;
    
    // Mettre à jour la position dans le state
    flightStateRef.current.currentDistance = Math.max(0, Math.min(targetDistanceMeters, totalDistance));
    flightStateRef.current.lastTimestamp = 0; // Reset pour éviter un saut
    
    // Réinitialiser les cabanes visitées jusqu'à ce point
    if (flightStateRef.current.visitedHuts) {
      const newVisited = new Set();
      for (const hut of hutDistances) {
        if (hut.distance <= targetDistanceMeters) {
          newVisited.add(hut.name);
        }
      }
      flightStateRef.current.visitedHuts = newVisited;
    }
    
    // Si on était en pause, reprendre
    if (isPaused) {
      setIsPaused(false);
    }
  }, [seekToDistance, isFlying, totalDistance, isPaused, hutDistances]);

  // Changer la vitesse
  const cycleSpeed = useCallback(() => {
    setFlySpeed(prev => {
      const speeds = [1, 2, 5, 10];
      const currentIdx = speeds.indexOf(prev);
      return speeds[(currentIdx + 1) % speeds.length];
    });
  }, []);

  // Animation loop FLUIDE avec interpolation par DISTANCE (vitesse constante)
  useEffect(() => {
    if (!isFlying || isPaused || !viewerRef.current || routePositions.length < 2) {
      return;
    }

    const viewer = viewerRef.current;
    
    // Paramètres de vol
    const CAMERA_HEIGHT_ABOVE_GROUND = 150;
    const CAMERA_MIN_HEIGHT = 350;
    const CAMERA_PITCH = -12;
    const METERS_PER_SECOND = 160 * flySpeed; // Vitesse en mètres/seconde
    const BEARING_SMOOTHING = 0.025;
    const HEIGHT_SMOOTHING = 0.15;
    const HUT_PAUSE_DURATION = 2000; // Pause de 2 secondes aux cabanes
    const HUT_PROXIMITY_THRESHOLD = 50; // Distance en mètres pour déclencher la pause

    const animate = (timestamp) => {
      const state = flightStateRef.current;
      
      // Initialiser les trackers de cabanes visitées
      if (!state.visitedHuts) state.visitedHuts = new Set();
      if (!state.hutPauseUntil) state.hutPauseUntil = 0;
      
      // Vérifier si on est en pause cabane
      if (state.hutPauseUntil > timestamp) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      } else if (state.hutPauseUntil > 0) {
        // Fin de la pause cabane
        state.hutPauseUntil = 0;
        setHutPauseMessage(null);
      }
      
      // Calculer le delta time
      if (state.lastTimestamp === 0) {
        state.lastTimestamp = timestamp;
      }
      const deltaTime = (timestamp - state.lastTimestamp) / 1000;
      state.lastTimestamp = timestamp;

      // Avancer la distance parcourue
      if (state.currentDistance === undefined) state.currentDistance = 0;
      state.currentDistance += deltaTime * METERS_PER_SECOND;
      
      // Vérifier si on approche d'une cabane (pause automatique)
      for (const hut of hutDistances) {
        if (!state.visitedHuts.has(hut.name)) {
          const distanceToHut = Math.abs(state.currentDistance - hut.distance);
          if (distanceToHut < HUT_PROXIMITY_THRESHOLD) {
            // Marquer comme visitée et déclencher la pause
            state.visitedHuts.add(hut.name);
            state.hutPauseUntil = timestamp + HUT_PAUSE_DURATION;
            state.lastTimestamp = 0; // Reset pour éviter un saut après la pause
            setHutPauseMessage(`📍 ${hut.name}`);
            animationFrameRef.current = requestAnimationFrame(animate);
            return;
          }
        }
      }

      // Vérifier la fin du parcours
      if (state.currentDistance >= totalDistance) {
        stopFlight();
        return;
      }

      // Trouver la position interpolée basée sur la distance
      let segmentIndex = 0;
      for (let i = 1; i < cumulativeDistances.length; i++) {
        if (cumulativeDistances[i] >= state.currentDistance) {
          segmentIndex = i - 1;
          break;
        }
        segmentIndex = i - 1;
      }

      const p1 = routePositions[segmentIndex];
      const p2 = routePositions[Math.min(segmentIndex + 1, routePositions.length - 1)];
      
      // Interpolation dans le segment actuel
      const segmentStart = cumulativeDistances[segmentIndex];
      const segmentEnd = cumulativeDistances[Math.min(segmentIndex + 1, cumulativeDistances.length - 1)];
      const segmentLength = segmentEnd - segmentStart;
      const t = segmentLength > 0 ? (state.currentDistance - segmentStart) / segmentLength : 0;

      // Position interpolée exacte
      const currentLat = lerp(p1.lat, p2.lat, Math.min(t, 1));
      const currentLng = lerp(p1.lng, p2.lng, Math.min(t, 1));

      // Calculer la pente actuelle pour adapter la caméra
      // Regarder quelques points en avant pour estimer la pente
      const slopeAheadDistance = state.currentDistance + 150; // 150m devant
      let slopeAheadIdx = segmentIndex;
      for (let i = segmentIndex; i < cumulativeDistances.length; i++) {
        if (cumulativeDistances[i] >= slopeAheadDistance) {
          slopeAheadIdx = i;
          break;
        }
        slopeAheadIdx = i;
      }
      
      // Estimer la pente (en utilisant le terrain cache)
      const currentTerrainHeight = getTerrainHeight(currentLng, currentLat);
      const aheadPos = routePositions[Math.min(slopeAheadIdx, routePositions.length - 1)];
      const aheadTerrainHeight = getTerrainHeight(aheadPos.lng, aheadPos.lat);
      const horizontalDist = 150; // mètres
      const verticalDiff = aheadTerrainHeight - currentTerrainHeight;
      const slopeAngle = Math.atan2(verticalDiff, horizontalDist) * (180 / Math.PI); // en degrés
      
      // Adapter la caméra selon la pente - APPROCHE SIMPLE
      // On garde des ajustements modérés pour éviter les mouvements erratiques
      let adaptiveHeightBonus = 0;
      let adaptivePitch = CAMERA_PITCH; // -12 par défaut
      let adaptiveDistanceBonus = 0;
      
      if (slopeAngle > 5) {
        // MONTÉE - ne pas toucher, c'est parfait
        const intensity = Math.min(slopeAngle - 5, 15); // 0 à 15
        adaptiveHeightBonus = intensity * 15; // jusqu'à +225m
        adaptiveDistanceBonus = intensity * 10; // jusqu'à +150m
        adaptivePitch = CAMERA_PITCH - intensity * 0.4; // -12° -> -18° max
      } else if (slopeAngle < -5) {
        // DESCENTE - encore plus de recul
        const intensity = Math.min(Math.abs(slopeAngle) - 5, 15); // 0 à 15
        adaptiveHeightBonus = intensity * 15; // jusqu'à +225m
        adaptiveDistanceBonus = intensity * 35; // jusqu'à +525m (encore plus de recul)
        adaptivePitch = CAMERA_PITCH - intensity * 0.85; // -12° -> -25° max
      }
      
      // Lisser l'adaptation (lissage TRÈS lent pour stabilité)
      if (state.adaptiveDistanceBonus === undefined) state.adaptiveDistanceBonus = 0;
      if (state.adaptiveHeightBonus === undefined) state.adaptiveHeightBonus = 0;
      if (state.adaptivePitch === undefined) state.adaptivePitch = CAMERA_PITCH;
      state.adaptiveDistanceBonus = lerp(state.adaptiveDistanceBonus, adaptiveDistanceBonus, 0.015);
      state.adaptiveHeightBonus = lerp(state.adaptiveHeightBonus, adaptiveHeightBonus, 0.015);
      state.adaptivePitch = lerp(state.adaptivePitch, adaptivePitch, 0.015);

      // Bearing cible - regarder plus loin pour anticiper
      const lookAheadDistance = state.currentDistance + 500; // 500m devant
      let lookAheadIdx = segmentIndex;
      for (let i = segmentIndex; i < cumulativeDistances.length; i++) {
        if (cumulativeDistances[i] >= lookAheadDistance) {
          lookAheadIdx = i;
          break;
        }
        lookAheadIdx = i;
      }
      const lookAheadPos = routePositions[Math.min(lookAheadIdx, routePositions.length - 1)];
      const targetBearing = calculateBearing(currentLat, currentLng, lookAheadPos.lat, lookAheadPos.lng);

      // Lisser le bearing
      state.currentBearing = lerpAngle(state.currentBearing, targetBearing, BEARING_SMOOTHING);

      // Position de la caméra (en arrière, avec distance adaptative)
      const bearingRad = Cesium.Math.toRadians(state.currentBearing);
      const metersPerDegreeLat = 111000;
      const metersPerDegreeLng = 111000 * Math.cos(Cesium.Math.toRadians(currentLat));
      
      const actualCameraDistance = 400 + state.adaptiveDistanceBonus; // Distance de base + bonus en pente
      const cameraLat = currentLat - Math.cos(bearingRad) * (actualCameraDistance / metersPerDegreeLat);
      const cameraLng = currentLng - Math.sin(bearingRad) * (actualCameraDistance / metersPerDegreeLng);

      // Obtenir l'altitude du terrain depuis le cache + bonus adaptatif
      const terrainHeight = getTerrainHeight(cameraLng, cameraLat);
      const targetHeight = Math.max(
        terrainHeight + CAMERA_HEIGHT_ABOVE_GROUND + state.adaptiveHeightBonus, 
        CAMERA_MIN_HEIGHT + state.adaptiveHeightBonus
      );

      // Lisser la hauteur
      if (state.smoothedHeight === undefined) state.smoothedHeight = targetHeight;
      state.smoothedHeight = lerp(state.smoothedHeight, targetHeight, HEIGHT_SMOOTHING);

      // Appliquer la position de la caméra avec pitch adaptatif
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          cameraLng,
          cameraLat,
          state.smoothedHeight
        ),
        orientation: {
          heading: Cesium.Math.toRadians(state.currentBearing),
          pitch: Cesium.Math.toRadians(state.adaptivePitch),
          roll: 0
        }
      });

      // Mettre à jour la position du marqueur randonneur (SUR LA LIGNE exactement)
      if (hikerMarkerRef.current) {
        hikerMarkerRef.current.position = Cesium.Cartesian3.fromDegrees(currentLng, currentLat);
      }

      // Mettre à jour l'UI
      const totalProgress = state.currentDistance / totalDistance;
      setProgress(Math.round(totalProgress * 100));
      setCurrentSegment(findCurrentSegment(segmentIndex));
      
      // Envoyer la progression au parent (en km)
      if (onFlightProgressChange) {
        onFlightProgressChange(state.currentDistance / 1000);
      }

      // Prochain frame
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isFlying, isPaused, flySpeed, routePositions, cumulativeDistances, totalDistance, hutDistances, findCurrentSegment, stopFlight, getTerrainHeight, onFlightProgressChange]);

  // Initialiser Cesium
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;

    const initViewer = async () => {
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

      // Désactiver l'éclairage dynamique
      viewer.scene.globe.enableLighting = false;
      viewer.scene.fog.enabled = true;
      viewer.scene.fog.density = 0.0001;

      // Position initiale
      if (cameraView) {
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            cameraView.longitude,
            cameraView.latitude,
            cameraView.height
          ),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-60),
            roll: 0
          }
        });
      }

      // Tracé de l'itinéraire (utiliser rawPositions pour le tracé complet)
      if (rawPositions.length > 1) {
        const cartesianPositions = rawPositions.map(pos => 
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

      // Marqueurs des cabanes
      selectedHuts.forEach((hut, index) => {
        if (!hut?.latitude || !hut?.longitude) return;

        const isStart = index === 0;
        const isEnd = index === selectedHuts.length - 1;
        const isRestDay = hut.isRestDay;

        let color = Cesium.Color.fromCssColorString('#1e3a8a');
        if (isStart) color = Cesium.Color.fromCssColorString('#22c55e');
        if (isEnd) color = Cesium.Color.fromCssColorString('#ef4444');
        if (isRestDay) color = Cesium.Color.fromCssColorString('#8b5cf6');

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
            text: `${index}. ${hut.name}`,
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

      // Terrain
      try {
        viewer.scene.terrainProvider = await Cesium.createWorldTerrainAsync({
          requestWaterMask: true,
          requestVertexNormals: true
        });
      } catch (err) {
        console.warn('Terrain loading failed:', err);
      }

      initializedRef.current = true;
    };

    initViewer();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      initializedRef.current = false;
    };
  }, [selectedHuts, rawPositions, cameraView]);

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

      {/* Contrôles Flight Simulator */}
      <div className="flight-controls">
        {isPreloading ? (
          <div className="flight-preload">
            <span>Préparation du terrain... {preloadProgress}%</span>
            <div className="flight-preload-bar">
              <div 
                className="flight-preload-progress" 
                style={{ width: `${preloadProgress}%` }}
              />
            </div>
          </div>
        ) : !isFlying ? (
          <button 
            className="flight-btn flight-start"
            onClick={startFlight}
            disabled={routePositions.length < 2}
            title="Démarrer le survol"
          >
            ▶ Survol
          </button>
        ) : (
          <>
            <button 
              className="flight-btn"
              onClick={togglePause}
              title={isPaused ? "Reprendre" : "Pause"}
            >
              {isPaused ? '▶' : '⏸'}
            </button>
            <button 
              className="flight-btn"
              onClick={cycleSpeed}
              title="Changer la vitesse"
            >
              x{flySpeed}
            </button>
            <button 
              className="flight-btn flight-stop"
              onClick={stopFlight}
              title="Arrêter"
            >
              ⏹
            </button>
          </>
        )}
      </div>

      {/* Info segment en cours */}
      {isFlying && currentSegment && (
        <div className="flight-info">
          <div className="flight-info-day">Jour {currentSegment.dayIndex}</div>
          <div className="flight-info-route">
            {currentSegment.fromHut} → {currentSegment.toHut}
          </div>
          <div className="flight-info-progress">
            <div 
              className="flight-info-progress-bar" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flight-info-percent">{progress}%</div>
        </div>
      )}

      {/* Message pause cabane */}
      {hutPauseMessage && (
        <div className="flight-hut-pause">
          <div className="flight-hut-pause-text">{hutPauseMessage}</div>
        </div>
      )}

      {/* Overlay d'initialisation (masque le flickering) */}
      {isInitializing && (
        <div className="flight-init-overlay">
          <div className="flight-init-content">
            <div className="flight-init-spinner" />
            <span>Positionnement...</span>
          </div>
        </div>
      )}

      {/* Conteneur Cesium */}
      <div 
        ref={containerRef} 
        className="cesium-container"
      />

      {/* Instructions (masquées pendant le vol) */}
      {!isFlying && !isInitializing && (
        <div className="cesium-instructions">
          <span>🖱️ Clic gauche = Rotation</span>
          <span>🖱️ Clic droit = Zoom</span>
          <span>🖱️ Molette = Zoom</span>
          <span>🖱️ Clic milieu = Inclinaison</span>
        </div>
      )}
    </div>
  );
}
