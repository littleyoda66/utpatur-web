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

const { BaseLayer } = LayersControl;

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
  days.forEach((day, index) => {
    if (!day || !day.hut) return;
    const dayIndex =
      typeof day.dayIndex === 'number' ? day.dayIndex : index;
    allDayIndices.push(dayIndex);
  });

  const hasRoute = allDayIndices.length > 0;
  const firstDayIndex = hasRoute ? Math.min(...allDayIndices) : null;
  const lastDayIndex = hasRoute ? Math.max(...allDayIndices) : null;

  // 1) Cabanes de l’itinéraire
  days.forEach((day, index) => {
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
// Polyline de l’itinéraire (avec éventuels via)
// -----------------------------------------------------------------------------
function buildPolylinePositions(days) {
  const pts = [];
  if (!days || days.length === 0) return pts;

  for (let i = 0; i < days.length; i += 1) {
    const day = days[i];
    if (!day || !day.hut) continue;
    const hut = day.hut;

    if (
      typeof hut.latitude !== 'number' ||
      typeof hut.longitude !== 'number'
    ) {
      continue;
    }

    if (i === 0) {
      // premier jour
      pts.push([hut.latitude, hut.longitude]);
      continue;
    }

    const seg = day.segmentFromPrevious;

    // via intermédiaire
    if (seg && seg.segments === 2) {
      const viaHut = seg.viaHut || seg.via_hut || null;
      if (
        viaHut &&
        typeof viaHut.latitude === 'number' &&
        typeof viaHut.longitude === 'number'
      ) {
        pts.push([viaHut.latitude, viaHut.longitude]);
      }
    }

    // cabane d’arrivée du jour
    pts.push([hut.latitude, hut.longitude]);
  }

  return pts;
}

// -----------------------------------------------------------------------------
// Style du cercle (CircleMarker) selon le rôle
// -----------------------------------------------------------------------------
function getCircleStyle(marker) {
  const baseRadius = 6;
  const routeColor = '#1e3a8a';
  const orange = '#f59e0b';

  switch (marker.role) {
    case 'route':
      return {
        radius: baseRadius,
        pathOptions: {
          color: '#e5e7eb', // bord clair
          weight: 2,
          fillColor: routeColor,
          fillOpacity: 1,
        },
      };
    case 'candidate':
      return {
        radius: baseRadius + 1,
        pathOptions: {
          color: orange,
          weight: 3,          // anneau bien visible
          fillColor: '#ffffff',
          fillOpacity: 0.9,   // effet “anneau” sur fond clair
        },
      };
    case 'both':
    default:
      return {
        radius: baseRadius + 1,
        pathOptions: {
          color: orange,
          weight: 3,
          fillColor: routeColor,
          fillOpacity: 1,
        },
      };
  }
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
  setHoveredReachableHutId,
}) {
  const safeDays = days || [];
  const safeReachable = reachableHuts || [];

  const polylinePositions = useMemo(
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
    // fallback grossier
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
        scrollWheelZoom={false}
        style={{
          width: '100%',
          height: '720px',
          borderRadius: '0.75rem',
          overflow: 'hidden',
        }}
      >
        <LayersControl position="topright">
          <BaseLayer checked name="Topo (OpenTopoMap)">
            <TileLayer
              attribution="Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap"
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>

          <BaseLayer name="OSM standard">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>
        </LayersControl>

        {/* Ajustement automatique du zoom */}
        <FitBoundsOnRoute positions={allPositions} />

        {/* Tracé de l’itinéraire */}
        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{ color: '#1E3A8A', weight: 3 }}
          />
        )}

        {/* Markers pour les via */}
        {safeDays.map((day) => {
          const seg = day.segmentFromPrevious;
          if (!seg || seg.segments !== 2) return null;

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
          const { radius, pathOptions } = getCircleStyle(marker);
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
						onSelectReachableHut(marker.reachableRaw || marker.hut);
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
				  <Tooltip direction="top" offset={[0, -4]}>
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
