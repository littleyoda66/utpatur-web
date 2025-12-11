// src/components/RouteMap.jsx
import React, { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  LayersControl,
  useMap,
  CircleMarker,
  Tooltip,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './RouteMap.css';

const { BaseLayer, Overlay } = LayersControl;

// -----------------------------------------------------------------------------
// Invalider la taille de la carte quand le conteneur change
// -----------------------------------------------------------------------------
function InvalidateSizeOnChange({ selectedCount }) {
  const map = useMap();
  
  useEffect(() => {
    // Observer les changements de taille du conteneur
    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    resizeObserver.observe(container);
    
    // Observer aussi le parent (pour quand le profil apparaît/disparaît)
    const parent = container.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
    }
    
    return () => resizeObserver.disconnect();
  }, [map]);
  
  return null;
}

// -----------------------------------------------------------------------------
// FitBounds basé sur les bounds calculés par le parent
// -----------------------------------------------------------------------------
function FitBoundsOnRoute({ mapBounds, mapRef, prevBoundsRef }) {
  const map = useMap();
  
  // Stocker la référence de la map
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  useEffect(() => {
    if (!mapBounds || !map) return;

    // Vérifier si les bounds ont changé
    const boundsKey = `${mapBounds.minLat}-${mapBounds.maxLat}-${mapBounds.minLng}-${mapBounds.maxLng}`;
    
    if (prevBoundsRef.current === boundsKey) return;
    prevBoundsRef.current = boundsKey;

    map.invalidateSize();
    
    const bounds = L.latLngBounds(
      [mapBounds.minLat, mapBounds.minLng],
      [mapBounds.maxLat, mapBounds.maxLng]
    );
    
    if (bounds.isValid()) {
      map.fitBounds(bounds, { 
        padding: [20, 20],
        animate: false
      });
    }

  }, [map, mapBounds, prevBoundsRef]);

  return null;
}

// -----------------------------------------------------------------------------
// Construction du texte de badge (jours) pour une cabane
// -----------------------------------------------------------------------------
function buildBadgeLabel(dayIndices, firstDayIndex, lastDayIndex) {
  if (!dayIndices || dayIndices.length === 0) return null;

  const sorted = Array.from(new Set(dayIndices)).sort((a, b) => a - b);
  const hasStart = sorted.includes(firstDayIndex);
  const hasEnd = sorted.includes(lastDayIndex);

  const others = sorted.filter(
    (d) => d !== firstDayIndex && d !== lastDayIndex,
  );

  // Aucun rôle spécial
  if (!hasStart && !hasEnd) {
    return sorted.join(', ');
  }

  // Départ uniquement
  if (hasStart && !hasEnd) {
    if (others.length === 0) {
      return `${firstDayIndex} →`;
    }
    return `${firstDayIndex} →, ${others.join(', ')}`;
  }

  // Arrivée uniquement
  if (!hasStart && hasEnd) {
    if (others.length === 0) {
      return `→ ${lastDayIndex}`;
    }
    return `${others.join(', ')}, → ${lastDayIndex}`;
  }

  // Cabane qui est à la fois départ ET arrivée
  if (hasStart && hasEnd) {
    if (others.length === 0) {
      return `→ ${firstDayIndex} →`;
    }
    return `${firstDayIndex} →, ${others.join(', ')}, → ${lastDayIndex}`;
  }

  return sorted.join(', ');
}

// -----------------------------------------------------------------------------
// Construction des données de markers (rôle + jours + départ/arrivée)
// -----------------------------------------------------------------------------
function buildMarkersData(selectedHuts, reachableHuts, allHutsById = {}) {
  const markersMap = new Map();
  const viaHutIds = new Set(); // Pour tracker les cabanes qui sont des "via"

  // Tous les dayIndex utilisés dans l'itinéraire
  const allDayIndices = [];
  (selectedHuts || []).forEach((hut, index) => {
    if (!hut) return;
    allDayIndices.push(index);
  });

  const hasRoute = allDayIndices.length > 0;
  const firstDayIndex = hasRoute ? Math.min(...allDayIndices) : null;
  const lastDayIndex = hasRoute ? Math.max(...allDayIndices) : null;

  // 1) Cabanes de l'itinéraire
  (selectedHuts || []).forEach((hut, index) => {
    if (!hut) return;

    const hutId = hut.hut_id != null ? hut.hut_id : hut.id != null ? hut.id : null;
    if (hutId == null) return;

    if (!markersMap.has(hutId)) {
      markersMap.set(hutId, {
        hutId,
        hut,
        dayIndices: [index],
        isInRoute: true,
        isCandidate: false,
        isVia: false,
        reachableRaw: null,
      });
    } else {
      const entry = markersMap.get(hutId);
      entry.isInRoute = true;
      entry.dayIndices.push(index);
    }

    // Extraire les cabanes "via" des steps (segments > 1)
    if (hut.steps && hut.steps.length > 1) {
      // Pour chaque step intermédiaire, le to_hut_id est une cabane via
      // (sauf le dernier step qui mène à la destination finale)
      for (let i = 0; i < hut.steps.length - 1; i++) {
        const step = hut.steps[i];
        const viaHutId = step.to_hut_id;
        if (viaHutId && viaHutId !== hutId) {
          viaHutIds.add(viaHutId);
        }
      }
    }
  });

  // 2) Cabanes atteignables (candidates)
  (reachableHuts || []).forEach((rh) => {
    if (!rh) return;
    
    // Structure directe : { hut_id, name, latitude, longitude, ... }
    const hutId = rh.hut_id || rh.id;
    if (hutId == null) return;

    // Construire un objet hut compatible
    const hutData = {
      hut_id: hutId,
      id: hutId,
      name: rh.name,
      latitude: rh.latitude,
      longitude: rh.longitude,
      country_code: rh.country_code
    };

    if (!markersMap.has(hutId)) {
      markersMap.set(hutId, {
        hutId,
        hut: hutData,
        dayIndices: [],
        isInRoute: false,
        isCandidate: true,
        isVia: false,
        reachableRaw: rh,
      });
    } else {
      const entry = markersMap.get(hutId);
      entry.isCandidate = true;
      entry.reachableRaw = rh;
    }

    // Extraire aussi les cabanes via des candidates (pour preview)
    if (rh.steps && rh.steps.length > 1) {
      for (let i = 0; i < rh.steps.length - 1; i++) {
        const step = rh.steps[i];
        const viaHutId = step.to_hut_id;
        if (viaHutId && viaHutId !== hutId) {
          viaHutIds.add(viaHutId);
        }
      }
    }
  });

  const markers = Array.from(markersMap.values()).map((entry) => {
    const { dayIndices } = entry;
    const isInRoute = Boolean(entry.isInRoute && dayIndices.length > 0);
    const isCandidate = Boolean(entry.isCandidate);

    const role =
      isInRoute && isCandidate
        ? 'both'
        : isInRoute
        ? 'route'
        : 'candidate';

    const badgeLabel =
      isInRoute && hasRoute
        ? buildBadgeLabel(dayIndices, firstDayIndex, lastDayIndex)
        : null;

    const isStart =
      hasRoute &&
      isInRoute &&
      dayIndices.includes(firstDayIndex);
    const isEnd =
      hasRoute &&
      isInRoute &&
      dayIndices.includes(lastDayIndex);

    return {
      ...entry,
      role,
      badgeLabel,
      isStart,
      isEnd,
    };
  });

  return { markers, hasRoute, firstDayIndex, lastDayIndex, viaHutIds };
}

// -----------------------------------------------------------------------------
// Style du CircleMarker selon le rôle
// -----------------------------------------------------------------------------
function getCircleMarkerStyle(role, isHovered = false) {
  // Agrandir le rayon si hover sur une candidate
  const hoverBonus = isHovered ? 3 : 0;

  if (role === 'route') {
    // Disque plein bleu + bordure claire (rayon 7px = diamètre 14px)
    return {
      radius: 7,
      pathOptions: {
        fillColor: '#1e3a8a',
        fillOpacity: 1,
        color: '#e5e7eb',
        weight: 2,
      }
    };
  }

  if (role === 'candidate') {
    // Cercle orange visible mais plus petit
    return {
      radius: isHovered ? 9 : 7,
      pathOptions: {
        fillColor: '#ff8c00',
        fillOpacity: isHovered ? 0.8 : 0.5,
        color: '#7c2d12',
        weight: 2,
        opacity: 1,
      }
    };
  }

  if (role === 'both') {
    // Disque bleu + anneau orange (rayon 7px)
    return {
      radius: 7 + hoverBonus,
      pathOptions: {
        fillColor: '#1e3a8a',
        fillOpacity: 1,
        color: '#f59e0b',
        weight: isHovered ? 4 : 3,
      }
    };
  }

  if (role === 'via') {
    // Petit disque blanc + fine bordure grise (rayon 5px = diamètre 10px)
    return {
      radius: 5,
      pathOptions: {
        fillColor: '#ffffff',
        fillOpacity: 1,
        color: '#d1d5db',
        weight: 1.5,
      }
    };
  }

  // Fallback
  return {
    radius: 7,
    pathOptions: {
      fillColor: '#6b7280',
      fillOpacity: 1,
      color: '#ffffff',
      weight: 2,
    }
  };
}

// -----------------------------------------------------------------------------
// Création d'une icône pill pour le badge (numéro de séquence)
// -----------------------------------------------------------------------------
function createBadgeIcon(marker) {
  if (!marker.badgeLabel) return null;

  let pillClass = 'hut-badge-pill';
  if (marker.isStart && !marker.isEnd) {
    pillClass += ' hut-badge-pill--start';
  } else if (marker.isEnd && !marker.isStart) {
    pillClass += ' hut-badge-pill--end';
  } else if (marker.isStart && marker.isEnd) {
    pillClass += ' hut-badge-pill--start'; // ou une classe spéciale pour boucle
  }

  return L.divIcon({
    className: 'hut-badge-wrapper',
    html: `<div class="${pillClass}">${marker.badgeLabel}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// -----------------------------------------------------------------------------
// Décodage d'une polyline encodée ORS avec elevation (lat, lon, z)
// -----------------------------------------------------------------------------
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

    // altitude (3e dimension)
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

    coordinates.push([lat / PRECISION, lng / PRECISION]);
  }

  return coordinates;
}

// -----------------------------------------------------------------------------
// Construction des segments de polyline
// -----------------------------------------------------------------------------
function buildRouteSegments(selectedHuts) {
  const segments = [];

  for (let i = 1; i < selectedHuts.length; i++) {
    const prevHut = selectedHuts[i - 1];
    const currHut = selectedHuts[i];

    if (!prevHut || !currHut) continue;

    const steps = currHut.steps || [];
    
    if (steps.length === 0) {
      // Ligne droite approximative
      if (
        typeof prevHut.latitude === 'number' &&
        typeof prevHut.longitude === 'number' &&
        typeof currHut.latitude === 'number' &&
        typeof currHut.longitude === 'number'
      ) {
        segments.push({
          positions: [
            [prevHut.latitude, prevHut.longitude],
            [currHut.latitude, currHut.longitude],
          ],
          isApprox: true,
        });
      }
    } else {
      // Segments avec géométrie ORS
      steps.forEach((step) => {
        const poly = step.geometry_polyline || step.geometry?.polyline;
        if (poly) {
          const decoded = decodePolyline(poly);
          if (decoded.length > 0) {
            segments.push({
              positions: decoded,
              isApprox: false,
            });
          }
        }
      });
    }
  }

  return segments;
}

// -----------------------------------------------------------------------------
// Extraction des positions des cabanes "via" (points de jonction entre segments)
// -----------------------------------------------------------------------------
function extractViaPositions(selectedHuts) {
  const viaPositions = [];

  for (let i = 1; i < selectedHuts.length; i++) {
    const currHut = selectedHuts[i];
    if (!currHut) continue;

    const steps = currHut.steps || [];
    const viaName = currHut.via || currHut.via_hut?.name || currHut.via_hut;
    
    // S'il y a plus d'un step, les points de jonction sont des cabanes via
    if (steps.length > 1) {
      for (let j = 0; j < steps.length - 1; j++) {
        const step = steps[j];
        const poly = step.geometry_polyline || step.geometry?.polyline;
        if (poly) {
          const decoded = decodePolyline(poly);
          if (decoded.length > 0) {
            // Le dernier point du segment est la position de la cabane via
            const lastPoint = decoded[decoded.length - 1];
            viaPositions.push({
              hutId: step.to_hut_id,
              position: lastPoint,
              name: viaName || null
            });
          }
        }
      }
    }
  }

  return viaPositions;
}

// -----------------------------------------------------------------------------
// Composant HutMarker avec gestion du tooltip au hover externe
// -----------------------------------------------------------------------------
function HutMarker({ 
  marker, 
  isHovered, 
  isClickable, 
  reachableHuts, 
  onHutHover, 
  onHutClick 
}) {
  const circleRef = React.useRef(null);
  const hut = marker.hut;
  
  // Ouvrir/fermer le tooltip quand isHovered change (hover depuis la liste)
  React.useEffect(() => {
    if (circleRef.current) {
      if (isHovered) {
        circleRef.current.openTooltip();
      } else {
        circleRef.current.closeTooltip();
      }
    }
  }, [isHovered]);

  if (
    !hut ||
    typeof hut.latitude !== 'number' ||
    typeof hut.longitude !== 'number'
  ) {
    return null;
  }

  const position = [hut.latitude, hut.longitude];
  const circleStyle = getCircleMarkerStyle(marker.role, isHovered);
  const badgeIcon = createBadgeIcon(marker);

  return (
    <React.Fragment>
      <CircleMarker
        ref={circleRef}
        center={position}
        pathOptions={circleStyle.pathOptions}
        radius={circleStyle.radius}
        eventHandlers={isClickable ? {
          mouseover: () => onHutHover(marker.hutId),
          mouseout: () => onHutHover(null),
          click: () => {
            const reachableHut = reachableHuts.find(
              rh => (rh.hut_id || rh.id) === marker.hutId
            );
            if (reachableHut) {
              onHutClick(reachableHut);
            }
          }
        } : {}}
      >
        <Tooltip direction="top" offset={[0, -12]}>
          {hut.name}
        </Tooltip>
      </CircleMarker>

      {badgeIcon && (
        <Marker
          position={position}
          icon={badgeIcon}
          interactive={false}
        />
      )}
    </React.Fragment>
  );
}

// -----------------------------------------------------------------------------
// Composant principal RouteMap
// -----------------------------------------------------------------------------
export function RouteMap({ 
  selectedHuts = [], 
  reachableHuts = [],
  hoveredHutId = null,
  onHutHover = () => {},
  onHutClick = () => {},
  profileHoverPosition = null,
  isRouteClosed = false,
  mapBounds = null
}) {
  // Refs stables pour le FitBounds (survivent aux re-renders)
  const mapRef = React.useRef(null);
  const prevBoundsRef = React.useRef(null);

  const { markers, hasRoute, viaHutIds } = useMemo(
    () => buildMarkersData(selectedHuts, reachableHuts),
    [selectedHuts, reachableHuts]
  );

  const routeSegments = useMemo(
    () => buildRouteSegments(selectedHuts),
    [selectedHuts]
  );

  const viaPositions = useMemo(
    () => extractViaPositions(selectedHuts),
    [selectedHuts]
  );

  const polylinePositions = useMemo(() => {
    const pts = [];
    routeSegments.forEach((seg) => {
      pts.push(...seg.positions);
    });
    return pts;
  }, [routeSegments]);

  // Positions de l'itinéraire uniquement (pour zoom quand clos)
  const routeOnlyPositions = useMemo(() => {
    const pts = [...polylinePositions];
    
    // Ajouter les positions des cabanes de l'itinéraire
    selectedHuts.forEach((hut) => {
      if (
        hut &&
        typeof hut.latitude === 'number' &&
        typeof hut.longitude === 'number'
      ) {
        pts.push([hut.latitude, hut.longitude]);
      }
    });
    
    return pts;
  }, [polylinePositions, selectedHuts]);

  // Positions incluant les candidates (pour zoom quand ouvert)
  const allPositionsWithCandidates = useMemo(() => {
    const pts = [...routeOnlyPositions];
    
    // Ajouter les positions de tous les markers candidates
    markers.forEach((m) => {
      const hut = m.hut;
      if (
        m.isCandidate &&
        hut &&
        typeof hut.latitude === 'number' &&
        typeof hut.longitude === 'number'
      ) {
        pts.push([hut.latitude, hut.longitude]);
      }
    });
    
    // Ajouter explicitement les candidates
    reachableHuts.forEach((rh) => {
      if (
        rh &&
        typeof rh.latitude === 'number' &&
        typeof rh.longitude === 'number'
      ) {
        pts.push([rh.latitude, rh.longitude]);
      }
    });
    
    return pts;
  }, [routeOnlyPositions, markers, reachableHuts]);

  // Choisir les positions selon l'état
  const allPositions = isRouteClosed ? routeOnlyPositions : allPositionsWithCandidates;

  const defaultCenter = useMemo(() => {
    if (polylinePositions.length > 0) {
      return polylinePositions[0];
    }
    if (allPositions.length > 0) {
      return allPositions[0];
    }
    return [68.0, 19.0];
  }, [polylinePositions, allPositions]);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MapContainer
        center={defaultCenter}
        zoom={8}
        scrollWheelZoom={true}
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <LayersControl position="topright">
          <BaseLayer checked name="Topo (OpenTopoMap)">
            <TileLayer
              attribution="Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap"
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              maxZoom={17}
            />
          </BaseLayer>

          <BaseLayer name="Clair (CARTO Positron)">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              maxZoom={19}
            />
          </BaseLayer>

          <BaseLayer name="OSM standard">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          </BaseLayer>

          <BaseLayer name="Satellite (Esri World Imagery)">
            <TileLayer
              attribution="Tiles &copy; Esri — Source: Esri, Earthstar Geographics"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </BaseLayer>

          {/* Overlay OpenSnowMap désactivé par défaut (certificat SSL invalide) */}
          <Overlay name="Pistes de ski (OpenSnowMap)">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors, tiles &copy; www.opensnowmap.org"
              url="https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png"
              maxZoom={18}
              opacity={0.8}
            />
          </Overlay>
        </LayersControl>

        <FitBoundsOnRoute 
          mapBounds={mapBounds} 
          mapRef={mapRef}
          prevBoundsRef={prevBoundsRef}
        />
        
        <InvalidateSizeOnChange selectedCount={selectedHuts.length} />

        {/* Tracé de l'itinéraire */}
        {routeSegments.map((seg, idx) => (
          <Polyline
            key={`route-seg-${idx}`}
            positions={seg.positions}
            pathOptions={
              seg.isApprox
                ? {
                    color: '#1E3A8A',
                    weight: 3,
                    dashArray: '6 6',
                  }
                : {
                    color: '#1E3A8A',
                    weight: 3,
                  }
            }
          />
        ))}

        {/* Markers pour les cabanes */}
        {markers.map((marker) => {
          const isHovered = hoveredHutId === marker.hutId;
          const isClickable = marker.role === 'candidate' || marker.role === 'both';

          return (
            <HutMarker
              key={marker.hutId}
              marker={marker}
              isHovered={isHovered}
              isClickable={isClickable}
              reachableHuts={reachableHuts}
              onHutHover={onHutHover}
              onHutClick={onHutClick}
            />
          );
        })}

        {/* Markers pour les cabanes "via" (points de passage intermédiaires) */}
        {viaPositions.map((via, idx) => {
          const circleStyle = getCircleMarkerStyle('via');
          return (
            <CircleMarker
              key={`via-${via.hutId}-${idx}`}
              center={via.position}
              pathOptions={circleStyle.pathOptions}
              radius={circleStyle.radius}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                {via.name ? `via ${via.name}` : 'Point de passage'}
              </Tooltip>
            </CircleMarker>
          );
        })}
        
        {/* Marqueur de position survolée sur le profil */}
        {profileHoverPosition && (
          <CircleMarker
            center={[profileHoverPosition.lat, profileHoverPosition.lng]}
            radius={8}
            pathOptions={{
              fillColor: '#3b82f6',
              fillOpacity: 1,
              color: '#ffffff',
              weight: 3,
              opacity: 1,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
