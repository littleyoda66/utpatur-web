// src/components/ElevationProfile.jsx
import React, { useMemo, useState, useRef } from 'react';
import './ElevationProfile.css';

// Icône SVG de cabane - esquisse minimale, symétrique
function CabinIcon({ size = 24, className = '' }) {
  return (
    <svg 
      width={size} 
      height={size * 0.55} 
      viewBox="0 0 32 17" 
      fill="none" 
      className={className}
    >
      {/* Toit */}
      <path 
        d="M6 12L16 4L26 12" 
        stroke="currentColor"
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Murs et sol */}
      <path 
        d="M8 11V16H24V11" 
        stroke="currentColor"
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Porte */}
      <path 
        d="M14 16V12H18V16" 
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Décoder une polyline Google encodée avec altitude (precision 1e5 pour lat/lng, 1e2 pour alt)
function decodePolyline(encoded) {
  if (!encoded) return [];
  
  const coordinates = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0, lng = 0, alt = 0;

  while (index < len) {
    // Latitude
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    // Longitude
    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    // Altitude (si présente)
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

    coordinates.push({ 
      lat: lat / 1e5, 
      lng: lng / 1e5, 
      alt: alt // Garder en centimètres pour plus de précision
    });
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

// Formater les nombres avec apostrophe
const formatNumber = (num) => Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");

export function ElevationProfile({ selectedHuts, onHutHover, onPositionHover }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const chartRef = useRef(null);
  
  const chartHeight = 100;

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
      
      // Pour chaque cabane après la première, extraire les points du trajet
      if (!isFirstHut) {
        const steps = hut.steps || [];
        let segmentHasAltitude = false;
        
        // Essayer d'extraire les altitudes des polylines
        for (const step of steps) {
          if (step.geometry_polyline) {
            const coords = decodePolyline(step.geometry_polyline);
            
            if (coords.length > 0) {
              // Garder l'altitude du premier point pour la cabane précédente
              if (firstPolylineAltitude === null && coords[0].alt > 0) {
                firstPolylineAltitude = coords[0].alt / 100;
              }
              
              // Vérifier si les altitudes sont valides (non nulles et variées)
              const alts = coords.map(c => c.alt).filter(a => a !== 0);
              const hasValidAlt = alts.length > coords.length * 0.5;
              
              if (hasValidAlt) {
                segmentHasAltitude = true;
                
                // Prendre TOUS les points
                for (let j = 0; j < coords.length; j++) {
                  const coord = coords[j];
                  
                  if (j > 0) {
                    cumulativeDistance += getDistance(coords[j-1], coord);
                  }
                  
                  allPoints.push({
                    distance: cumulativeDistance,
                    altitude: coord.alt / 100, // Convertir en mètres
                    lat: coord.lat,
                    lng: coord.lng,
                    isHut: false
                  });
                }
              } else {
                // Pas d'altitude valide, juste accumuler la distance et les coords
                for (let j = 1; j < coords.length; j++) {
                  cumulativeDistance += getDistance(coords[j-1], coords[j]);
                }
              }
            }
          }
        }
        
        // Si pas de données d'altitude dans les polylines, interpoler
        if (!segmentHasAltitude) {
          const prevHut = selectedHuts[i-1];
          const startAlt = prevHut.altitude || (allPoints.length > 0 ? allPoints[allPoints.length-1].altitude : 500);
          const endAlt = hut.altitude || startAlt;
          const segmentDist = hut.total_distance || 0;
          const elevGain = hut.elevation_gain || 0;
          const elevLoss = hut.elevation_loss || 0;
          
          const startDist = cumulativeDistance;
          
          // Créer des points intermédiaires réalistes
          // Montée jusqu'au point haut, puis descente
          const peakAlt = startAlt + elevGain;
          const totalElev = elevGain + elevLoss;
          const peakPosition = totalElev > 0 ? elevGain / totalElev : 0.5;
          
          const numPoints = Math.max(10, Math.ceil(segmentDist * 2)); // 2 points par km
          
          for (let j = 1; j <= numPoints; j++) {
            const ratio = j / numPoints;
            const dist = startDist + segmentDist * ratio;
            let alt;
            
            if (ratio <= peakPosition) {
              // Phase de montée
              const climbRatio = peakPosition > 0 ? ratio / peakPosition : 0;
              alt = startAlt + elevGain * climbRatio;
            } else {
              // Phase de descente
              const descentRatio = peakPosition < 1 ? (ratio - peakPosition) / (1 - peakPosition) : 1;
              alt = peakAlt - elevLoss * descentRatio;
            }
            
            allPoints.push({
              distance: dist,
              altitude: alt,
              isHut: false
            });
          }
          
          cumulativeDistance += segmentDist;
        }
      }

      // Ajouter le point de la cabane
      let hutAlt = hut.altitude;
      
      // Si pas d'altitude définie, utiliser le premier point de la polyline suivante
      // ou le dernier point calculé
      if (!hutAlt || hutAlt <= 0) {
        if (isFirstHut && i + 1 < selectedHuts.length) {
          // Pour la première cabane, regarder la polyline du segment suivant
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
        
        // Sinon utiliser le dernier point ou 500m par défaut
        if (!hutAlt || hutAlt <= 0) {
          hutAlt = allPoints.length > 0 ? allPoints[allPoints.length-1].altitude : 500;
        }
      }
      
      // Corriger la distance pour la première cabane
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

    // Filtrer les points avec altitude invalide et trier par distance
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

    // Arrondir les bornes
    const range = maxAlt - minAlt;
    const padding = Math.max(30, range * 0.1);
    const yMin = Math.floor((minAlt - padding) / 50) * 50;
    const yMax = Math.ceil((maxAlt + padding) / 50) * 50;
    const yRange = yMax - yMin;

    // Graduations
    const yTicks = [];
    const tickStep = yRange <= 200 ? 50 : yRange <= 500 ? 100 : 200;
    for (let y = yMin; y <= yMax; y += tickStep) {
      yTicks.push(y);
    }

    return {
      points: profileData,
      hutPoints: profileData.filter(p => p.isHut),
      yMin, yMax, yRange, xMax: maxDist, yTicks
    };
  }, [profileData]);

  if (!chartData) return null;

  const { points, hutPoints, yMin, yRange, xMax, yTicks } = chartData;
  
  // Générer le path SVG (lignes droites entre chaque point)
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
    if (point && point.isHut) {
      if (onHutHover) onHutHover(point.hutId);
      if (onPositionHover && point.lat && point.lng) {
        onPositionHover({ lat: point.lat, lng: point.lng });
      }
    } else if (!point) {
      if (onHutHover) onHutHover(null);
      if (onPositionHover) onPositionHover(null);
    }
  };
  
  // État séparé pour le curseur (points non-cabane)
  const [cursorPoint, setCursorPoint] = useState(null);
  
  // Vérifier si on est proche d'une cabane
  const isNearHut = (distance) => {
    const threshold = xMax * 0.02; // 2% de la distance totale
    return hutPoints.some(h => Math.abs(h.distance - distance) < threshold);
  };

  return (
    <div className="elevation-profile">
      <div className="elevation-profile-header">
        <span className="elevation-profile-title">Profil altimétrique</span>
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
          className="elevation-chart"
          onMouseMove={(e) => {
            if (!chartRef.current) return;
            const rect = chartRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, x / rect.width));
            const targetDistance = ratio * xMax;
            
            // Si on est proche d'une cabane, ne pas afficher le curseur
            if (isNearHut(targetDistance)) {
              setCursorPoint(null);
              return;
            }
            
            // Trouver le point le plus proche
            let closest = points[0];
            let minDiff = Infinity;
            for (const p of points) {
              const diff = Math.abs(p.distance - targetDistance);
              if (diff < minDiff) {
                minDiff = diff;
                closest = p;
              }
            }
            
            // Ne mettre à jour que si ce n'est pas une cabane
            if (!closest.isHut) {
              setCursorPoint(closest);
              
              // Envoyer la position au parent
              if (onPositionHover && closest.lat && closest.lng) {
                onPositionHover({ lat: closest.lat, lng: closest.lng });
              }
              
              // Pas de cabane survolée
              if (onHutHover) {
                onHutHover(null);
              }
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
            
            {/* Grille horizontale */}
            {yTicks.map((tick, i) => {
              const y = chartHeight - ((tick - yMin) / yRange) * chartHeight;
              return (
                <line key={i} x1="0" y1={y} x2="100" y2={y} className="elevation-grid" />
              );
            })}
            
            {/* Zone remplie */}
            <path d={areaPath} fill="url(#areaGradient)" />
            
            {/* Ligne du profil */}
            <path d={linePath} className="elevation-line" />
          </svg>
          
          {/* Marqueurs des cabanes */}
          {hutPoints.map((p, i) => {
            const x = (p.distance / xMax) * 100;
            const y = ((p.altitude - yMin) / yRange) * 100;
            const isHovered = hoveredPoint?.hutId === p.hutId;
            const isFirst = i === 0;
            const isLast = i === hutPoints.length - 1;
            const isHigh = y > 70; // Si au-dessus de 70%, tooltip en dessous
            
            return (
              <div
                key={i}
                className={`elevation-marker ${isHovered ? 'elevation-marker-hovered' : ''}`}
                style={{ left: `${x}%`, bottom: `${y}%` }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setCursorPoint(null); // Effacer le curseur
                  handleMarkerHover(p);
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  handleMarkerHover(null);
                }}
              >
              <div className="elevation-marker-cabin">
                  <CabinIcon size={24} />
                </div>
                {isHovered && (
                  <>
                    <div className={`elevation-marker-line ${isHigh ? 'line-below' : ''}`}></div>
                    <div 
                      className={`elevation-marker-tooltip ${isFirst ? 'tooltip-left' : ''} ${isLast ? 'tooltip-right' : ''} ${isHigh ? 'tooltip-below' : ''}`}
                    >
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
          
          {/* Indicateur de position survolée (pour les points non-cabane) */}
          {cursorPoint && !cursorPoint.isHut && (
            <div 
              className="elevation-cursor"
              style={{ 
                left: `${(cursorPoint.distance / xMax) * 100}%`,
                bottom: `${((cursorPoint.altitude - yMin) / yRange) * 100}%`
              }}
            >
              <div className="elevation-cursor-dot"></div>
              <div className="elevation-cursor-line"></div>
              <div className="elevation-cursor-tooltip">
                {formatNumber(cursorPoint.altitude)} m
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
