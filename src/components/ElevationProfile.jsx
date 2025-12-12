// src/components/ElevationProfile.jsx
import React, { useMemo, useState, useRef, useEffect } from 'react';
import './ElevationProfile.css';

// Icône SVG de cabane - V4 trait fin avec cheminée
function CabinIcon({ size = 24, className = '' }) {
  const strokeWidth = size <= 16 ? 2.4 
                    : size <= 20 ? 2.0 
                    : size <= 24 ? 1.7 
                    : 1.2;

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
    >
      <path d="M4 13L11 7L20 13" />
      <path d="M7.5 11v7" />
      <path d="M7.5 18h6" />
      <path d="M16 10V6.5" />
    </svg>
  );
}

// Décoder une polyline Google encodée avec altitude
function decodePolyline(encoded) {
  if (!encoded) return [];
  
  const coordinates = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0, lng = 0, alt = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    if (index < len) {
      shift = 0; result = 0;
      do {
        if (index >= len) break;
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      alt += (result & 1) ? ~(result >> 1) : (result >> 1);
    }

    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5, alt: alt });
  }
  return coordinates;
}

// Distance Haversine entre deux points (km)
function getDistance(p1, p2) {
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLon = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
            Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const formatNumber = (num) => Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");

export function ElevationProfile({ 
  selectedHuts, 
  onHutHover, 
  onPositionHover,
  flightProgress = null,  // Distance en km du survol 3D
  onSeekFlight = null     // Callback pour sauter à une position (clic)
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [cursorPoint, setCursorPoint] = useState(null);
  const chartRef = useRef(null);
  
  const chartHeight = 100;
  const chartHeightPx = 90;

  useEffect(() => {
    setHoveredPoint(null);
    setCursorPoint(null);
    if (onHutHover) onHutHover(null);
    if (onPositionHover) onPositionHover(null);
  }, [selectedHuts]);

  // Construire les données du profil
  const profileData = useMemo(() => {
    if (!selectedHuts || selectedHuts.length < 2) return null;

    const allPoints = [];
    let cumulativeDistance = 0;

    for (let i = 0; i < selectedHuts.length; i++) {
      const hut = selectedHuts[i];
      if (hut.isRestDay && i > 0) continue;

      const isFirstHut = i === 0;
      let firstPolylineAltitude = null;
      
      if (!isFirstHut) {
        const steps = hut.steps || [];
        let segmentHasAltitude = false;
        
        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
          const step = steps[stepIndex];
          const isLastStep = stepIndex === steps.length - 1;
          
          if (step.geometry_polyline) {
            const coords = decodePolyline(step.geometry_polyline);
            
            if (coords.length > 0) {
              if (firstPolylineAltitude === null && coords[0].alt > 0) {
                firstPolylineAltitude = coords[0].alt / 100;
              }
              
              const alts = coords.map(c => c.alt).filter(a => a !== 0);
              const hasValidAlt = alts.length > coords.length * 0.5;
              
              if (hasValidAlt) {
                segmentHasAltitude = true;
                
                for (let j = 0; j < coords.length; j++) {
                  const coord = coords[j];
                  
                  if (j > 0) {
                    cumulativeDistance += getDistance(coords[j-1], coord);
                  }
                  
                  allPoints.push({
                    distance: cumulativeDistance,
                    altitude: coord.alt / 100,
                    lat: coord.lat,
                    lng: coord.lng,
                    isHut: false,
                    isVia: false
                  });
                }
                
                if (!isLastStep && coords.length > 0) {
                  const lastPoint = allPoints[allPoints.length - 1];
                  if (lastPoint) {
                    lastPoint.isVia = true;
                    lastPoint.viaName = hut.via || `Via ${stepIndex + 1}`;
                    lastPoint.viaHutId = step.to_hut_id;
                  }
                }
              } else {
                for (let j = 1; j < coords.length; j++) {
                  cumulativeDistance += getDistance(coords[j-1], coords[j]);
                }
                
                if (!isLastStep) {
                  const lastCoord = coords[coords.length - 1];
                  allPoints.push({
                    distance: cumulativeDistance,
                    altitude: 500,
                    lat: lastCoord?.lat,
                    lng: lastCoord?.lng,
                    isHut: false,
                    isVia: true,
                    viaName: hut.via || `Via ${stepIndex + 1}`,
                    viaHutId: step.to_hut_id
                  });
                }
              }
            }
          }
        }
        
        if (!segmentHasAltitude) {
          const prevHut = selectedHuts[i-1];
          const startAlt = prevHut.altitude || (allPoints.length > 0 ? allPoints[allPoints.length-1].altitude : 500);
          const endAlt = hut.altitude || startAlt;
          const segmentDist = hut.total_distance || 0;
          const elevGain = hut.elevation_gain || 0;
          const elevLoss = hut.elevation_loss || 0;
          
          const startDist = cumulativeDistance;
          const peakAlt = startAlt + elevGain;
          const totalElev = elevGain + elevLoss;
          const peakPosition = totalElev > 0 ? elevGain / totalElev : 0.5;
          
          const numPoints = Math.max(10, Math.ceil(segmentDist * 2));
          
          for (let j = 1; j <= numPoints; j++) {
            const ratio = j / numPoints;
            const dist = startDist + segmentDist * ratio;
            let alt;
            
            if (ratio <= peakPosition) {
              const climbRatio = peakPosition > 0 ? ratio / peakPosition : 0;
              alt = startAlt + elevGain * climbRatio;
            } else {
              const descentRatio = peakPosition < 1 ? (ratio - peakPosition) / (1 - peakPosition) : 1;
              alt = peakAlt - elevLoss * descentRatio;
            }
            
            allPoints.push({ distance: dist, altitude: alt, isHut: false });
          }
          
          cumulativeDistance += segmentDist;
        }
      }

      let hutAlt = hut.altitude;
      
      if (!hutAlt || hutAlt <= 0) {
        if (isFirstHut && i + 1 < selectedHuts.length) {
          const nextHut = selectedHuts[i + 1];
          if (!nextHut.isRestDay && nextHut.steps && nextHut.steps.length > 0) {
            const firstStep = nextHut.steps[0];
            if (firstStep.geometry_polyline) {
              const coords = decodePolyline(firstStep.geometry_polyline);
              if (coords.length > 0 && coords[0].alt > 0) {
                hutAlt = coords[0].alt / 100;
              }
            }
          }
        }
        
        if (!hutAlt || hutAlt <= 0) {
          hutAlt = allPoints.length > 0 ? allPoints[allPoints.length-1].altitude : 500;
        }
      }
      
      if (isFirstHut) {
        allPoints.push({
          distance: 0,
          altitude: hutAlt,
          lat: hut.latitude || hut.lat,
          lng: hut.longitude || hut.lng || hut.lon,
          name: hut.name,
          hutId: hut.hut_id || hut.id,
          isHut: true,
          index: i
        });
      } else {
        allPoints.push({
          distance: cumulativeDistance,
          altitude: hutAlt,
          lat: hut.latitude || hut.lat,
          lng: hut.longitude || hut.lng || hut.lon,
          name: hut.name,
          hutId: hut.hut_id || hut.id,
          isHut: true,
          index: i
        });
      }
    }

    const validPoints = allPoints
      .filter(p => p.altitude > 0 && p.altitude < 5000)
      .sort((a, b) => a.distance - b.distance);

    return validPoints.length >= 2 ? validPoints : null;
  }, [selectedHuts]);

  // Calculer les échelles
  const chartData = useMemo(() => {
    if (!profileData || profileData.length < 2) return null;

    const altitudes = profileData.map(p => p.altitude);
    const minAlt = Math.min(...altitudes);
    const maxAlt = Math.max(...altitudes);
    const maxDist = profileData[profileData.length - 1].distance;

    const range = maxAlt - minAlt;
    const padding = Math.max(30, range * 0.1);
    const yMin = Math.floor((minAlt - padding) / 50) * 50;
    const yMax = Math.ceil((maxAlt + padding) / 50) * 50;
    const yRange = yMax - yMin;

    const yTicks = [];
    const tickStep = yRange <= 200 ? 50 : yRange <= 500 ? 100 : 200;
    for (let y = yMin; y <= yMax; y += tickStep) {
      yTicks.push(y);
    }

    return {
      points: profileData,
      hutPoints: profileData.filter(p => p.isHut),
      viaPoints: profileData.filter(p => p.isVia),
      yMin, yMax, yRange, xMax: maxDist, yTicks
    };
  }, [profileData]);

  // Calculer la position du curseur de vol
  const flightCursor = useMemo(() => {
    if (flightProgress === null || !chartData || !profileData) return null;
    
    const { yMin, yRange, xMax } = chartData;
    
    // Trouver le point le plus proche de la distance de vol
    let closest = profileData[0];
    let minDiff = Infinity;
    for (const p of profileData) {
      const diff = Math.abs(p.distance - flightProgress);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }
    
    // Interpoler l'altitude si nécessaire
    let altitude = closest.altitude;
    const idx = profileData.indexOf(closest);
    if (idx > 0 && idx < profileData.length - 1) {
      const prev = profileData[idx - 1];
      const next = profileData[idx + 1];
      if (flightProgress > prev.distance && flightProgress < next.distance) {
        const t = (flightProgress - prev.distance) / (next.distance - prev.distance);
        altitude = prev.altitude + (next.altitude - prev.altitude) * t;
      }
    }
    
    const x = (flightProgress / xMax) * 100;
    const y = ((altitude - yMin) / yRange) * 100;
    
    return { x, y, altitude, distance: flightProgress };
  }, [flightProgress, chartData, profileData]);

  if (!chartData) return null;

  const { points, hutPoints, viaPoints, yMin, yRange, xMax, yTicks } = chartData;
  
  const generatePath = () => {
    if (points.length < 2) return '';
    return points.map((p, i) => {
      const x = (p.distance / xMax) * 100;
      const y = chartHeight - ((p.altitude - yMin) / yRange) * chartHeight;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const linePath = generatePath();
  const lastPoint = points[points.length - 1];
  const lastX = (lastPoint.distance / xMax) * 100;
  const areaPath = linePath + ` L ${lastX} ${chartHeight} L 0 ${chartHeight} Z`;

  const handleMarkerHover = (point) => {
    setHoveredPoint(point);
    if (point && (point.isHut || point.isVia)) {
      const hutId = point.hutId || point.viaHutId;
      if (onHutHover && hutId) onHutHover(hutId);
      if (onPositionHover && point.lat && point.lng) {
        onPositionHover({ lat: point.lat, lng: point.lng });
      }
    } else if (!point) {
      if (onHutHover) onHutHover(null);
      if (onPositionHover) onPositionHover(null);
    }
  };
  
  const isNearHut = (distance) => {
    const threshold = xMax * 0.02;
    return hutPoints.some(h => Math.abs(h.distance - distance) < threshold);
  };

  // Gestion du clic pour seek
  const handleChartClick = (e) => {
    if (!onSeekFlight || !chartRef.current) return;
    
    const rect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const targetDistance = ratio * xMax;
    
    onSeekFlight(targetDistance);
  };

  return (
    <div className="elevation-profile">
      <div className="elevation-profile-header">
        <span className="elevation-profile-title">Profil altimétrique</span>
        {flightProgress !== null && (
          <span className="elevation-profile-flight-indicator">
            🎬 Survol en cours
          </span>
        )}
      </div>
      
      <div className="elevation-profile-content">
        {/* Axe Y */}
        <div className="elevation-axis-y">
          {yTicks.slice().reverse().map((tick, i) => (
            <div key={i} className="elevation-tick-y">
              <span>{formatNumber(tick)}</span>
            </div>
          ))}
        </div>
        
        {/* Graphique */}
        <div 
          ref={chartRef}
          className={`elevation-chart ${onSeekFlight ? 'elevation-chart-clickable' : ''}`}
          onClick={handleChartClick}
          onMouseMove={(e) => {
            if (!chartRef.current) return;
            const rect = chartRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, x / rect.width));
            const targetDistance = ratio * xMax;
            
            if (isNearHut(targetDistance)) {
              setCursorPoint(null);
              return;
            }
            
            let closest = points[0];
            let minDiff = Infinity;
            for (const p of points) {
              const diff = Math.abs(p.distance - targetDistance);
              if (diff < minDiff) {
                minDiff = diff;
                closest = p;
              }
            }
            
            if (!closest.isHut) {
              setCursorPoint(closest);
              if (onPositionHover && closest.lat && closest.lng) {
                onPositionHover({ lat: closest.lat, lng: closest.lng });
              }
              if (onHutHover) onHutHover(null);
            }
          }}
          onMouseLeave={() => {
            setCursorPoint(null);
            if (onPositionHover) onPositionHover(null);
            if (onHutHover) onHutHover(null);
          }}
        >
          <svg 
            viewBox={`0 0 100 ${chartHeight}`} 
            preserveAspectRatio="none" 
            className="elevation-svg"
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            
            {yTicks.map((tick, i) => {
              const y = chartHeight - ((tick - yMin) / yRange) * chartHeight;
              return (
                <line key={i} x1="0" y1={y} x2="100" y2={y} className="elevation-grid" />
              );
            })}
            
            <path d={areaPath} fill="url(#areaGradient)" />
            <path d={linePath} className="elevation-line" />
          </svg>
          
          {/* Marqueurs des cabanes */}
          {hutPoints.map((p, i) => {
            const x = (p.distance / xMax) * 100;
            const y = ((p.altitude - yMin) / yRange) * 100;
            const isHovered = hoveredPoint?.hutId === p.hutId;
            const isFirst = i === 0;
            const isLast = i === hutPoints.length - 1;
            const isHigh = y > 70;
            const lineHeight = Math.max(0, (y / 100) * chartHeightPx - 5);
            
            return (
              <div
                key={i}
                className={`elevation-marker ${isHovered ? 'elevation-marker-hovered' : ''}`}
                style={{ left: `${x}%`, bottom: `${y}%` }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setCursorPoint(null);
                  handleMarkerHover(p);
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  handleMarkerHover(null);
                }}
              >
                <div className="elevation-marker-cabin">
                  <CabinIcon size={22} />
                </div>
                {isHovered && (
                  <>
                    <div className="elevation-marker-line" style={{ height: `${lineHeight}px` }}></div>
                    <div className={`elevation-marker-tooltip ${isFirst ? 'tooltip-left' : ''} ${isLast ? 'tooltip-right' : ''} ${isHigh ? 'tooltip-below' : ''}`}>
                      <div className="elevation-tooltip-name">{p.name}</div>
                      <div className="elevation-tooltip-data">
                        <span className="tooltip-altitude">{formatNumber(p.altitude)} m</span>
                        <span className="tooltip-distance">{p.distance.toFixed(1)} km</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Marqueurs via */}
          {viaPoints.map((p, i) => {
            const x = (p.distance / xMax) * 100;
            const y = ((p.altitude - yMin) / yRange) * 100;
            const isHovered = hoveredPoint?.viaHutId === p.viaHutId && hoveredPoint?.isVia;
            const isHigh = y > 70;
            const lineHeight = Math.max(0, (y / 100) * chartHeightPx - 4);
            
            return (
              <div
                key={`via-${i}`}
                className={`elevation-via-marker ${isHovered ? 'elevation-via-marker-hovered' : ''}`}
                style={{ left: `${x}%`, bottom: `${y}%` }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setCursorPoint(null);
                  handleMarkerHover(p);
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  handleMarkerHover(null);
                }}
              >
                <div className="elevation-via-dot"></div>
                {isHovered && (
                  <>
                    <div className="elevation-marker-line" style={{ height: `${lineHeight}px` }}></div>
                    <div className={`elevation-marker-tooltip ${isHigh ? 'tooltip-below' : ''}`}>
                      <div className="elevation-tooltip-name elevation-tooltip-via">
                        <span className="via-label">via</span> {p.viaName}
                      </div>
                      <div className="elevation-tooltip-data">
                        <span className="tooltip-altitude">{formatNumber(p.altitude)} m</span>
                        <span className="tooltip-distance">{p.distance.toFixed(1)} km</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          
          {/* Curseur hover normal (masqué si survol 3D actif) */}
          {cursorPoint && !cursorPoint.isHut && flightProgress === null && (() => {
            const cursorY = ((cursorPoint.altitude - yMin) / yRange) * 100;
            const lineHeight = Math.max(0, (cursorY / 100) * chartHeightPx - 3);
            return (
              <div 
                className="elevation-cursor"
                style={{ left: `${(cursorPoint.distance / xMax) * 100}%`, bottom: `${cursorY}%` }}
              >
                <div className="elevation-cursor-dot"></div>
                <div className="elevation-cursor-line" style={{ height: `${lineHeight}px` }}></div>
                <div className="elevation-cursor-tooltip">{formatNumber(cursorPoint.altitude)} m</div>
              </div>
            );
          })()}
          
          {/* CURSEUR DE VOL 3D */}
          {flightCursor && (
            <div 
              className="elevation-flight-cursor"
              style={{ left: `${flightCursor.x}%`, bottom: `${flightCursor.y}%` }}
            >
              <div className="elevation-flight-cursor-dot"></div>
              <div 
                className="elevation-flight-cursor-line" 
                style={{ height: `${Math.max(0, (flightCursor.y / 100) * chartHeightPx - 6)}px` }}
              ></div>
              <div className="elevation-flight-cursor-tooltip">
                <span>{formatNumber(flightCursor.altitude)} m</span>
                <span className="flight-cursor-distance">{flightCursor.distance.toFixed(1)} km</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Axe X */}
      <div className="elevation-axis-x">
        <span>0</span>
        <span>{(xMax / 2).toFixed(0)}</span>
        <span>{xMax.toFixed(0)} km</span>
      </div>
    </div>
  );
}
