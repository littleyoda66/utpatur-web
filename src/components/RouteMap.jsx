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
// FitBounds sur l'ensemble des positions (itinéraire + candidates)
// -----------------------------------------------------------------------------
function FitBoundsOnRoute({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (!positions || positions.length === 0) return;

    if (positions.length === 1) {
      map.setView(positions[0], 9);
      return;
    }

    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, positions]);

  return null;
}

// -----------------------------------------------------------------------------
// Construction du texte de badge (jours) pour une cabane
// -----------------------------------------------------------------------------
/*
Règles figées :

Jours normaux :
  [ 2 ]        => "2"
  [ 0, 3 ]     => "0, 3"

Départ :
  [ 0 → ]      => "0 →"
  [ 0 →, 3 ]   => "0 →, 3"

Arrivée :
  [ → 4 ]      => "→ 4"
  [ 2, → 5 ]   => "2, → 5"

Cabane qui est à la fois départ ET arrivée (boucle) :
  [ → 0 → ]          => "→ 0 →"
  [ 0 →, 2, → 5 ]    => "0 →, 2, → 5"
*/
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
      // [ 0 → ]
      return `${firstDayIndex} →`;
    }
    // [ 0 →, 3 ]
    return `${firstDayIndex} →, ${others.join(', ')}`;
  }

  // Arrivée uniquement
  if (!hasStart && hasEnd) {
    if (others.length === 0) {
      // [ → 4 ]
      return `→ ${lastDayIndex}`;
    }
    // [ 2, → 5 ]
    return `${others.join(', ')}, → ${lastDayIndex}`;
  }

  // Cabane qui est à la fois départ ET arrivée
  if (hasStart && hasEnd) {
    if (others.length === 0) {
      // [ → 0 → ]
      return `→ ${firstDayIndex} →`;
    }
    // [ 0 →, 2, → 5 ]
    return `${firstDayIndex} →, ${others.join(', ')}, → ${lastDayIndex}`;
  }

  return sorted.join(', ');
}

// -----------------------------------------------------------------------------
// Construction des données de markers (rôle + jours + départ/arrivée)
// -----------------------------------------------------------------------------
function buildMarkersData(days, reachableHuts) {
  const markersMap = new Map();

  // Tous les dayIndex utilisés dans l’itinéraire
  const allDayIndices = [];
  (days || []).forEach((day, index) => {
    if (!day || !day.hut) return;
    const dayIndex =
      typeof day.dayIndex === 'number' ? day.dayIndex : index;
    allDayIndices.push(dayIndex);
  });

  const hasRoute = allDayIndices.length > 0;
  const firstDayIndex = hasRoute ? Math.min(...allDayIndices) : null;
  const lastDayIndex = hasRoute ? Math.max(...allDayIndices) : null;

  // 1) Cabanes de l’itinéraire
  (days || []).forEach((day, index) => {
    const hut = day?.hut;
    if (!hut) return;

    const hutId =
      hut.hut_id != null ? hut.hut_id : hut.id != null ? hut.id : null;
    if (hutId == null) return;

    const dayIndex =
      typeof day.dayIndex === 'number' ? day.dayIndex : index;

    if (!markersMap.has(hutId)) {
      markersMap.set(hutId, {
        hutId,
        hut,
        dayIndices: [dayIndex],
        isInRoute: true,
        isCandidate: false,
        reachableRaw: null,
      });
    } else {
      const entry = markersMap.get(hutId);
      entry.isInRoute = true;
      entry.dayIndices.push(dayIndex);
    }
  });

  // 2) Cabanes atteignables (candidates)
  (reachableHuts || []).forEach((rh) => {
    if (!rh) return;
    const hutId = rh.hut_id;
    if (hutId == null) return;

    if (!markersMap.has(hutId)) {
      markersMap.set(hutId, {
        hutId,
        hut: rh,
        dayIndices: [],
        isInRoute: false,
        isCandidate: true,
        reachableRaw: rh,
      });
    } else {
      const entry = markersMap.get(hutId);
      entry.isCandidate = true;
      entry.reachableRaw = rh;
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

  return { markers, hasRoute, firstDayIndex, lastDayIndex };
}

// -----------------------------------------------------------------------------
// Décodage d'une polyline encodée ORS avec elevation (lat, lon, z)
// On ignore la 3e dimension (altitude) et on renvoie [lat, lon] pour Leaflet.
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

    // --- latitude ---
    do {
      if (index >= len) break;
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    // --- longitude ---
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

    // --- altitude (3e dimension), présente car on a "elevation: true" côté ORS ---
    result = 0;
    shift = 0;
    if (index < len) {
      do {
        if (index >= len) break;
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      // const deltaZ = (result & 1) ? ~(result >> 1) : (result >> 1);
      // on pourrait cumuler z ici, mais on n'en a pas besoin pour le tracé
    }

    // ORS → lat / lon avec précision 1e5
    coordinates.push([lat / PRECISION, lng / PRECISION]);
  }

  return coordinates;
}



// -----------------------------------------------------------------------------
// Construction de la géométrie de l'itinéraire
// - retourne une liste de segments avec un flag isApprox
//   + une liste aplatie de tous les points pour le fitBounds
// -----------------------------------------------------------------------------
function buildPolylinePositions(days) {
  const segments = [];
  const allPositions = [];

  if (!days || days.length === 0) {
    return { segments, allPositions };
  }

  const safeDays = Array.isArray(days) ? days : [];

  const pushSegment = (positions, isApprox) => {
    if (!positions || positions.length < 2) return;

    const [firstLat, firstLng] = positions[0];
    const [lastLat, lastLng] = positions[positions.length - 1];

    // On ignore les segments de longueur nulle
    if (firstLat === lastLat && firstLng === lastLng) {
      return;
    }

    const seg = {
      positions,
      isApprox: !!isApprox,
    };
    segments.push(seg);
    positions.forEach((p) => {
      allPositions.push(p);
    });
  };

  for (let i = 0; i < safeDays.length; i += 1) {
    const day = safeDays[i];
    if (!day || !day.hut) continue;

    const hut = day.hut;
    if (
      typeof hut.latitude !== 'number' ||
      typeof hut.longitude !== 'number'
    ) {
      continue;
    }

    if (i === 0) {
      // Jour 0 : cabane de départ, aucun segment à tracer
      continue;
    }

    const prevDay = safeDays[i - 1];
    if (!prevDay || !prevDay.hut) {
      continue;
    }

    const prevHut = prevDay.hut;
    if (
      typeof prevHut.latitude !== 'number' ||
      typeof prevHut.longitude !== 'number'
    ) {
      continue;
    }

    const startLatLng = [prevHut.latitude, prevHut.longitude];
    const endLatLng = [hut.latitude, hut.longitude];

    const seg =
      day.segmentFromPrevious || day.segment_from_previous || null;
    const viaHut =
      seg && (seg.viaHut || seg.via_hut)
        ? seg.viaHut || seg.via_hut
        : null;
    const steps = seg && Array.isArray(seg.steps) ? seg.steps : [];

    // Aucun segmentFromPrevious : on trace un segment simple (approx)
    if (!seg) {
      pushSegment([startLatLng, endLatLng], true);
      continue;
    }

    // Pas de steps ORS : fallback "points droits" (via éventuel) => tout en pointillé
    if (!steps || steps.length === 0) {
      const positions = [startLatLng];

      if (
        viaHut &&
        typeof viaHut.latitude === 'number' &&
        typeof viaHut.longitude === 'number'
      ) {
        positions.push([viaHut.latitude, viaHut.longitude]);
      }

      positions.push(endLatLng);
      pushSegment(positions, true);
      continue;
    }

    // Steps présents : mélange géométrie ORS + segments droits approximatifs
    let currentPoint = startLatLng;

    const decodedSteps = steps.map((step) => {
      const encoded =
        step && typeof step.geometry_polyline === 'string'
          ? step.geometry_polyline
          : null;
      const coords = encoded ? decodePolyline(encoded) : [];
      return {
        hasGeometry: !!encoded && coords.length > 1,
        coords,
      };
    });

    for (
      let stepIndex = 0;
      stepIndex < decodedSteps.length;
      stepIndex += 1
    ) {
      const stepGeom = decodedSteps[stepIndex];

      if (stepGeom.hasGeometry) {
        const coords = stepGeom.coords;

        // Petit segment approx entre le point courant et le début de la géométrie
        if (currentPoint) {
          const first = coords[0];
          const approxPositions = [currentPoint, first];
          pushSegment(approxPositions, true);
        }

        // Segment ORS en trait plein
        pushSegment(coords, false);

        currentPoint = coords[coords.length - 1];
      } else {
        // Pas de géométrie : segment droit approximatif vers le prochain "anchor"
        let nextAnchor = null;

        for (
          let j = stepIndex + 1;
          j < decodedSteps.length;
          j += 1
        ) {
          const nextGeom = decodedSteps[j];
          if (nextGeom.hasGeometry && nextGeom.coords.length > 0) {
            nextAnchor = nextGeom.coords[0];
            break;
          }
        }

        if (!nextAnchor) {
          nextAnchor = endLatLng;
        }

        if (currentPoint && nextAnchor) {
          const approxPositions = [currentPoint, nextAnchor];
          pushSegment(approxPositions, true);
          currentPoint = nextAnchor;
        }
      }
    }

    // On s'assure de "rejoindre" la cabane d'arrivée
    if (currentPoint) {
      const approxToEnd = [currentPoint, endLatLng];
      pushSegment(approxToEnd, true);
    }
  }

  return { segments, allPositions };
}

// -----------------------------------------------------------------------------
// Style du cercle (CircleMarker) selon le rôle + hover
// -----------------------------------------------------------------------------
function getCircleStyle(marker, isHovered = false) {
  const baseRadius = 6;
  const routeColor = '#1e3a8a';
  const orange = '#f59e0b';

  let radius = baseRadius;
  let pathOptions;

  switch (marker.role) {
    case 'route':
      pathOptions = {
        color: '#e5e7eb', // bord clair
        weight: 2,
        fillColor: routeColor,
        fillOpacity: 1,
      };
      break;
    case 'candidate':
      radius = baseRadius + 1;
      pathOptions = {
        color: orange,
        weight: 3, // anneau bien visible
        fillColor: '#ffffff',
        fillOpacity: 0.9, // effet “anneau” sur fond clair
      };
      break;
    case 'both':
    default:
      radius = baseRadius + 1;
      pathOptions = {
        color: orange,
        weight: 3,
        fillColor: routeColor,
        fillOpacity: 1,
      };
      break;
  }

  if (isHovered) {
    radius += 2;
    pathOptions = {
      ...pathOptions,
      weight: (pathOptions.weight || 2) + 1,
    };
  }

  return { radius, pathOptions };
}

// -----------------------------------------------------------------------------
// Badge en DivIcon (pills) – ne touche pas à la géométrie
// -----------------------------------------------------------------------------
function createBadgeIcon(marker) {
  const { badgeLabel, isStart, isEnd } = marker;
  if (!badgeLabel) return null;

  const pillClasses = ['hut-badge-pill'];
  if (isStart) pillClasses.push('hut-badge-pill--start');
  if (isEnd) pillClasses.push('hut-badge-pill--end');

  const html = `<div class="${pillClasses.join(
    ' ',
  )}">${badgeLabel}</div>`;

  return L.divIcon({
    className: 'hut-badge-wrapper',
    html,
    iconSize: [0, 0], // taille auto laissée au CSS
    iconAnchor: [0, 0],
  });
}

// -----------------------------------------------------------------------------
// Composant principal
// -----------------------------------------------------------------------------
export function RouteMap({
  days,
  reachableHuts,
  onSelectReachableHut,
  hoveredReachableHutId,
  setHoveredReachableHutId,
}) {
  const safeDays = days || [];
  const safeReachable = reachableHuts || [];

  const {
  segments: routeSegments,
  allPositions: polylinePositions,
} = useMemo(
  () => buildPolylinePositions(safeDays),
  [safeDays],
);


  const { markers, hasRoute } = useMemo(
    () => buildMarkersData(safeDays, safeReachable),
    [safeDays, safeReachable],
  );

  // Pour le fitBounds : polyline + toutes les cabanes (route + candidates)
  const allPositions = useMemo(() => {
    const pts = [...polylinePositions];
    markers.forEach((m) => {
      const hut = m.hut;
      if (
        hut &&
        typeof hut.latitude === 'number' &&
        typeof hut.longitude === 'number'
      ) {
        pts.push([hut.latitude, hut.longitude]);
      }
    });
    return pts;
  }, [polylinePositions, markers]);

  const defaultCenter = useMemo(() => {
    if (polylinePositions.length > 0) {
      return polylinePositions[polylinePositions.length - 1];
    }
    if (allPositions.length > 0) {
      return allPositions[0];
    }
    // fallback grossier (Laponie)
    return [68.0, 19.0];
  }, [polylinePositions, allPositions]);

  // Etat vide : pas encore de cabane dans l’itinéraire
  if (!hasRoute || polylinePositions.length === 0) {
    return (
      <div
        style={{
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          padding: '0.75rem 1rem',
          background: '#ffffff',
        }}
      >
        <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Carte géographique
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>
          Choisis une cabane de départ pour voir l’itinéraire sur la carte.
        </p>
        <div
          style={{
            marginTop: '0.5rem',
            borderRadius: '0.75rem',
            border: '1px dashed #e5e7eb',
            padding: '1rem',
            fontSize: '0.8rem',
            color: '#9ca3af',
            textAlign: 'center',
            minHeight: '330px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Aucune cabane sélectionnée.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: '0.75rem',
        border: '1px solid #e5e7eb',
        padding: '0.75rem 1rem',
        background: '#ffffff',
      }}
    >
      <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
        Carte géographique
      </h3>

      <MapContainer
        center={defaultCenter}
        zoom={8}
        scrollWheelZoom={true}
        style={{
          width: '100%',
          height: '720px',
          borderRadius: '0.75rem',
          overflow: 'hidden',
        }}
      >
         {/* Fonds de carte */}
        <LayersControl position="topright">
          {/* 1. Topo par défaut */}
          <BaseLayer checked name="Topo (OpenTopoMap)">
            <TileLayer
              attribution="Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap"
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              maxZoom={17}
            />
          </BaseLayer>

          {/* 2. Fond clair très neutre */}
          <BaseLayer name="Clair (CARTO Positron)">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              maxZoom={19}
            />
          </BaseLayer>

          {/* 3. OSM standard */}
          <BaseLayer name="OSM standard">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          </BaseLayer>

          {/* 4. Satellite */}
          <BaseLayer name="Satellite (Esri World Imagery)">
            <TileLayer
              attribution="Tiles &copy; Esri — Source: Esri, Earthstar Geographics"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </BaseLayer>
		  
		     {/* Overlay pistes ski (optionnel) */}
          <Overlay checked name="Pistes de ski (OpenSnowMap)">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors, tiles &copy; www.opensnowmap.org"
              url="https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png"
              maxZoom={18}
              opacity={0.8}
            />
          </Overlay>
        

          
        </LayersControl>

        {/* Ajustement automatique du zoom */}
        <FitBoundsOnRoute positions={allPositions} />

        {/* Tracé de l’itinéraire */}
        {routeSegments.map((seg, idx) => (
		  <Polyline
			key={`route-seg-${idx}`}
			positions={seg.positions}
			pathOptions={
			  seg.isApprox
				? {
					color: '#1E3A8A',
					weight: 3,
					dashArray: '6 6', // segments approximatifs => pointillés
				  }
				: {
					color: '#1E3A8A',
					weight: 3, // segments ORS => trait plein
				  }
			}
		  />
		))}

        {/* Markers pour les via */}
        {safeDays.map((day) => {
          const seg = day.segmentFromPrevious;
          if (!seg) return null;

          const viaHut = seg.viaHut || seg.via_hut || null;
          if (
            !viaHut ||
            typeof viaHut.latitude !== 'number' ||
            typeof viaHut.longitude !== 'number'
          ) {
            return null;
          }

          const label = seg.via || viaHut.name || '';

          return (
            <CircleMarker
              key={`via-${day.id}`}
              center={[viaHut.latitude, viaHut.longitude]}
              radius={4}
              pathOptions={{
                color: '#6b7280',
                fillColor: '#ffffff',
                fillOpacity: 1,
                weight: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                {label ? `via ${label}` : 'via ?'}
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Cabanes (cercles + badge pill) */}
        {markers.map((marker) => {
          const hut = marker.hut;
          if (
            !hut ||
            typeof hut.latitude !== 'number' ||
            typeof hut.longitude !== 'number'
          ) {
            return null;
          }

          const position = [hut.latitude, hut.longitude];

          const isHoveredOnMap =
            hoveredReachableHutId != null &&
            String(marker.hutId) === String(hoveredReachableHutId);

          const { radius, pathOptions } = getCircleStyle(
            marker,
            isHoveredOnMap,
          );

          const badgeIcon = createBadgeIcon(marker);
          const isClickableCandidate = marker.isCandidate;

          return (
            <React.Fragment key={marker.hutId}>
              <CircleMarker
                center={position}
                radius={radius}
                pathOptions={pathOptions}
                eventHandlers={{
                  click: () => {
                    if (isClickableCandidate && onSelectReachableHut) {
                      onSelectReachableHut(
                        marker.reachableRaw || marker.hut,
                      );
                    }
                  },
                  mouseover: () => {
                    if (setHoveredReachableHutId && marker.isCandidate) {
                      setHoveredReachableHutId(marker.hutId);
                    }
                  },
                  mouseout: () => {
                    if (setHoveredReachableHutId && marker.isCandidate) {
                      setHoveredReachableHutId(null);
                    }
                  },
                }}
              >
                <Tooltip
                  key={isHoveredOnMap ? 'tooltip-perm' : 'tooltip-hover'}
                  direction="top"
                  offset={[0, -4]}
                  permanent={isHoveredOnMap}
                >
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
        })}
      </MapContainer>
    </div>
  );
}
