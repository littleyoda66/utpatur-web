// src/components/RouteBuilderPanel.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { StageCard } from './StageCard';
import { getHuts, getReachableHuts } from '../api/utpaturApi';
import { formatNumber } from '../utils/formatNumber';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap, Tooltip, Popup, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RouteMap } from './RouteMap';

const { BaseLayer } = LayersControl;

// Icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@1.0.0/img/marker-icon-2x-orange.png',
  iconUrl:
    'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@1.0.0/img/marker-icon-orange.png',
  shadowUrl:
    'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@1.0.0/img/marker-shadow.png',
  iconSize: [18, 29],  // tes tailles actuelles
  iconAnchor: [9, 29],
  popupAnchor: [1, -24],
  shadowSize: [30, 30],
});

// Marqueurs encore plus petits / discrets pour les cabanes atteignables
const reachableIcon = new L.Icon({
  iconRetinaUrl:
    'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@1.0.0/img/marker-icon-2x-orange.png',
  iconUrl:
    'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@1.0.0/img/marker-icon-orange.png',
  shadowUrl:
    'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@1.0.0/img/marker-shadow.png',
  iconSize: [12, 20],
  iconAnchor: [6, 20],
  popupAnchor: [0, -18],
  shadowSize: [20, 20],
});

// Un "jour" de l'itinéraire
function createDay({ dayIndex, hut, isRest, segmentFromPrevious }) {
  return {
    id: `${hut.hut_id}-${dayIndex}-${isRest ? 'rest' : 'move'}`,
    dayIndex,
    hut,
    isRest: !!isRest,
    segmentFromPrevious: segmentFromPrevious || null,
  };
}

// Ajuste le zoom de la carte sur l’ensemble de l’itinéraire
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



export function RouteBuilderPanel() {
  const [allHuts, setAllHuts] = useState([]);
  const [isLoadingHuts, setIsLoadingHuts] = useState(false);
  const [hutsError, setHutsError] = useState('');

  const [days, setDays] = useState([]);
  const [maxDistance, setMaxDistance] = useState(25);
  const [allowTwoSegments, setAllowTwoSegments] = useState(true);

  const [reachableHuts, setReachableHuts] = useState([]);
  const [isLoadingReachable, setIsLoadingReachable] = useState(false);
  const [reachableError, setReachableError] = useState('');
  const [hoveredReachableHutId, setHoveredReachableHutId] = useState(null);

  const [startSearch, setStartSearch] = useState('');
  

  // Charger toutes les cabanes pour la cabane de départ
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoadingHuts(true);
      setHutsError('');
      try {
        const huts = await getHuts();
        if (!cancelled) {
          setAllHuts(huts);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setHutsError(
            err.message || 'Erreur lors du chargement de la liste des cabanes.',
          );
        }
      } finally {
        if (!cancelled) setIsLoadingHuts(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const lastDay = days.length > 0 ? days[days.length - 1] : null;
  const lastHut = lastDay ? lastDay.hut : null;

  // Nombre de jours affiché : on part de 0 (Jour 0, Jour 1, …)
  const totalDaysDisplay = lastDay ? lastDay.dayIndex : 0;

  // Cabanes atteignables depuis la fin de l’itinéraire
  useEffect(() => {
    if (!lastHut) {
      setReachableHuts([]);
      setReachableError('');
      return;
    }

    let cancelled = false;

    async function loadReachable() {
      setIsLoadingReachable(true);
      setReachableError('');
      try {
        const maxSegments = allowTwoSegments ? 2 : 1;
        const reachable = await getReachableHuts(
          lastHut.hut_id,
          maxDistance,
          maxSegments,
        );
        if (!cancelled) {
          setReachableHuts(reachable || []);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setReachableError(
            err.message || 'Erreur lors du calcul des cabanes atteignables.',
          );
        }
      } finally {
        if (!cancelled) setIsLoadingReachable(false);
      }
    }

    loadReachable();
    return () => {
      cancelled = true;
    };
  }, [lastHut?.hut_id, maxDistance, allowTwoSegments]);

  // Résumé de l’itinéraire
  const totalDistanceKm = useMemo(
    () =>
      days.reduce(
        (sum, d) =>
          sum + (d.segmentFromPrevious ? d.segmentFromPrevious.distanceKm || 0 : 0),
        0,
      ),
    [days],
  );

  const totalDplusM = useMemo(
    () =>
      days.reduce(
        (sum, d) =>
          sum + (d.segmentFromPrevious ? d.segmentFromPrevious.dplusM || 0 : 0),
        0,
      ),
    [days],
  );

  const totalDminusM = useMemo(
    () =>
      days.reduce(
        (sum, d) =>
          sum + (d.segmentFromPrevious ? d.segmentFromPrevious.dminusM || 0 : 0),
        0,
      ),
    [days],
  );

  const handleSelectStartHut = (hut) => {
    if (!hut) return;
    const day0 = createDay({
      dayIndex: 0,
      hut,
      isRest: false,
      segmentFromPrevious: null,
    });
    setDays([day0]);
  };

  const handleResetRoute = () => {
    if (
      !window.confirm(
        "Supprimer tout l’itinéraire et revenir au choix de la cabane de départ ?",
      )
    ) {
      return;
    }
    setDays([]);
    setReachableHuts([]);
  };

  const handleAddRestDay = () => {
    if (!lastDay) return;
    const newDay = createDay({
      dayIndex: lastDay.dayIndex + 1,
      hut: lastDay.hut,
      isRest: true,
      segmentFromPrevious: null,
    });
    setDays((prev) => [...prev, newDay]);
  };

 const handleAddStageFromCandidate = (candidate) => {
  if (!lastDay) return;

  let viaHut = null;
  if (
    (candidate.segments === 2 || candidate.segments === '2') &&
    candidate.via
  ) {
    viaHut =
      allHuts.find((h) => h.name === candidate.via) || null;
  }

  const segment = {
    distanceKm: candidate.distance_km ?? candidate.total_distance_km ?? 0,
    dplusM: candidate.dplus_m ?? candidate.total_dplus_m ?? 0,
    dminusM: candidate.dminus_m ?? candidate.total_dminus_m ?? 0,
    segments: candidate.segments ?? null,
    via: candidate.via ?? null,
    viaHut, // 👈 cabane intermédiaire avec latitude / longitude
  };

  const newDay = createDay({
    dayIndex: lastDay.dayIndex + 1,
    hut: candidate,
    isRest: false,
    segmentFromPrevious: segment,
  });

  setDays((prev) => [...prev, newDay]);
};

  const handleTruncateFromDayIndex = (startIndex) => {
    const day = days[startIndex];
    const label = day
      ? `le jour ${day.dayIndex} (${day.hut.name})`
      : `le jour ${startIndex}`;

    if (
      !window.confirm(
        `Supprimer ${label} et toutes les étapes suivantes ? Cette action est définitive.`,
      )
    ) {
      return;
    }

    setDays((prev) => prev.slice(0, startIndex));
  };

  const filteredStartHuts = useMemo(() => {
    const q = startSearch.trim().toLowerCase();
    if (!q) return allHuts.slice(0, 30);
    return allHuts
      .filter((h) => h.name && h.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [allHuts, startSearch]);

  const sliderAccentColor = maxDistance > 30 ? '#dc2626' : '#2563eb';

  // Itinéraire schématique (colonne centrale)
  const renderSchematicRoute = () => {
    if (days.length === 0) {
      return (
        <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>
          Commence par choisir une cabane de départ dans la colonne de gauche.
        </p>
      );
    }

    return (
      <div
        style={{
          marginTop: '0.75rem',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          padding: '0.75rem 0.75rem',
          background: '#f9fafb',
        }}
      >
        {days.map((day, index) => (
          <React.Fragment key={day.id}>
            {/* Segment depuis le jour précédent */}
            {index > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.15rem 0.25rem 0.15rem 0',
                  marginLeft: '18px',
                  fontSize: '0.8rem',
                  color: '#4b5563',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {/* | grisé à gauche de km */}
                  <span style={{ color: '#9ca3af' }}>|</span>
                  {day.isRest || !day.segmentFromPrevious ? (
                    <span>Jour de repos (aucun déplacement)</span>
                  ) : (
                    <>
                      <span>
                        {formatNumber(day.segmentFromPrevious.distanceKm, 1)} km
                      </span>
                      <span>+{formatNumber(day.segmentFromPrevious.dplusM, 0)} m</span>
                      <span>-{formatNumber(day.segmentFromPrevious.dminusM, 0)} m</span>
					  
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleTruncateFromDayIndex(index)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    lineHeight: 1,
                    color: '#9ca3af',
                  }}
                  title="Supprimer cette étape et les suivantes"
                >
                  ×
                </button>
              </div>
            )}

            {/* Noeud (jour) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem 0',
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '999px',
                  background: day.isRest ? '#e5e7eb' : '#2563eb',
                  border: '2px solid #ffffff',
                  boxShadow: '0 0 0 1px rgba(148,163,184,0.8)',
                  marginLeft: '12px',
                  flexShrink: 0,
                }}
              />
            <div
			  style={{
				flex: 1,
				padding: '0.25rem 0.5rem',
				borderRadius: '0.5rem',
				background: day.isRest ? '#f3f4f6' : '#ffffff',
				border: '1px solid #e5e7eb',
			  }}
			>
			  <div
				style={{
				  fontSize: '0.75rem',
				  color: '#6b7280',
				  marginBottom: '0.1rem',
				}}
			  >
				Jour {day.dayIndex}
				{day.isRest && ' · repos'}
			  </div>

			  <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
				{day.hut.name}
			  </div>

			  {index > 0 &&
				day.segmentFromPrevious &&
				day.segmentFromPrevious.segments === 2 &&
				day.segmentFromPrevious.via && (
				  <div
					style={{
					  fontSize: '0.75rem',
					  color: '#6b7280',
					  fontStyle: 'italic',
					  marginTop: '0.05rem',
					}}
				  >
					via {day.segmentFromPrevious.via}
				  </div>
				)}
</div>


              {index === 0 && days.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetRoute}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    color: '#9ca3af',
                    padding: '0 0.25rem',
                    whiteSpace: 'nowrap',
                  }}
                  title="Supprimer tout l’itinéraire"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '1.5rem',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}
    >
      {/* Colonne gauche : cabane de départ + paramètres + cabanes atteignables */}
      <div style={{ flex: '1 1 0', minWidth: '360px' }}>
        {/* Cabane de départ (visible seulement si aucun jour) */}
        {days.length === 0 && (
          <section
            style={{
              borderRadius: '0.75rem',
              border: '1px solid #e5e7eb',
              padding: '0.75rem 1rem',
              background: '#ffffff',
              marginBottom: '1rem',
            }}
          >
            <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Cabane de départ
            </h3>
            <p
              style={{
                fontSize: '0.8rem',
                color: '#6b7280',
                marginBottom: '0.5rem',
              }}
            >
              Choisis la première cabane de ton itinéraire. Ensuite, tu pourras
              ajouter des jours de marche ou de repos.
            </p>
            <input
              type="text"
              value={startSearch}
              onChange={(e) => setStartSearch(e.target.value)}
              placeholder="Rechercher une cabane (ex: Unna Allakas)"
              style={{
                width: '100%',
                padding: '0.35rem 0.5rem',
                fontSize: '0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
                marginBottom: '0.5rem',
              }}
            />

            {isLoadingHuts ? (
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                Chargement des cabanes…
              </div>
            ) : hutsError ? (
              <div style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                {hutsError}
              </div>
            ) : (
              <div
                style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  padding: '0.35rem 0.4rem',
                }}
              >
                {filteredStartHuts.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    Aucune cabane ne correspond à cette recherche.
                  </div>
                ) : (
                  filteredStartHuts.map((hut) => (
                    <button
                      key={hut.hut_id}
                      type="button"
                      onClick={() => handleSelectStartHut(hut)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.3rem 0.4rem',
                        fontSize: '0.8rem',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {hut.name}
                      {hut.country_code && (
                        <span style={{ color: '#9ca3af' }}>
                          {' '}
                          · {hut.country_code}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </section>
        )}

        {/* Paramètres + cabanes atteignables */}
        {days.length > 0 && (
          <>
            <section
              style={{
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb',
                padding: '0.75rem 1rem',
                background: '#ffffff',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Paramètres de la prochaine étape
              </h3>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.15rem',
                    }}
                  >
                    <span>Distance maximale par jour</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: maxDistance > 30 ? '#dc2626' : '#111827',
                      }}
                    >
                      {maxDistance} km
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={maxDistance}
                    onChange={(e) => setMaxDistance(Number(e.target.value))}
                    style={{
                      width: '100%',
                      accentColor: sliderAccentColor,
                    }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.7rem',
                      color: '#9ca3af',
                    }}
                  >
                    <span>0 km</span>
                    <span>40 km</span>
                  </div>
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allowTwoSegments}
                    onChange={(e) => setAllowTwoSegments(e.target.checked)}
                  />
                  <span>
                    Autoriser jusqu&apos;à 2 segments
                  </span>
                </label>

                <div>
                  <button
                    type="button"
                    onClick={handleAddRestDay}
                    style={{
                      borderRadius: '999px',
                      border: '1px solid #d1d5db',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      background: '#f9fafb',
                      cursor: 'pointer',
                    }}
                  >
                    Ajouter un jour de repos
                    {lastHut ? ` à ${lastHut.name}` : ''}
                  </button>
                </div>
              </div>
            </section>

            <section
              style={{
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb',
                padding: '0rem 1rem',
                background: '#ffffff',
              }}
            >
              <h3 style={{ fontSize: '0.9rem', marginBottom: '0.9rem' }}>
                Cabanes atteignables depuis{' '}
                <span style={{ fontWeight: 600 }}>
                  {lastHut ? lastHut.name : '…'}
                </span>
              </h3>
              

              {isLoadingReachable ? (
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Calcul des cabanes atteignables…
                </div>
              ) : reachableError ? (
                <div style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                  {reachableError}
                </div>
              ) : reachableHuts.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                  Aucune cabane atteignable dans ces conditions.
                </div>
              ) : (
                <div>
                  {reachableHuts.map((candidate) => (
				  <StageCard
					key={candidate.hut_id}
					//label="Destination"
					toName={candidate.name}
					via={candidate.segments === 2 && candidate.via ? candidate.via : null}
					distanceKm={
					  candidate.distance_km ?? candidate.total_distance_km
					}
					dplusM={candidate.dplus_m ?? candidate.total_dplus_m}
					dminusM={candidate.dminus_m ?? candidate.total_dminus_m}
					isCandidate
					isActive={hoveredReachableHutId === candidate.hut_id}
					onAdd={() => handleAddStageFromCandidate(candidate)}
					// 👇 AJOUTS pour le hover
					hutId={candidate.hut_id}
					onHoverStart={setHoveredReachableHutId}
					onHoverEnd={() => setHoveredReachableHutId(null)}
				  />
				))}

                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Colonne centrale : itinéraire en cours */}
      <div style={{ flex: '1 1 0', minWidth: '360px' }}>
        <section
          style={{
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb',
            padding: '0.75rem 1rem',
            background: '#ffffff',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Itinéraire en cours
          </h3>

          {days.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Aucun jour planifié pour l’instant.
            </p>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  fontSize: '0.8rem',
                  marginBottom: '0.35rem',
                }}
              >
                <div>
                  <div style={{ color: '#6b7280' }}>Jours</div>
                  <div style={{ fontWeight: 600 }}>{totalDaysDisplay}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280' }}>Distance</div>
                  <div style={{ fontWeight: 600 }}>
                    {formatNumber(totalDistanceKm, 1)} km
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6b7280' }}>D+ cumulé</div>
                  <div style={{ fontWeight: 600 }}>
                    {formatNumber(totalDplusM, 0)} m
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6b7280' }}>D- cumulé</div>
                  <div style={{ fontWeight: 600 }}>
                    {formatNumber(totalDminusM, 0)} m
                  </div>
                </div>
              </div>

              {renderSchematicRoute()}
            </>
          )}
        </section>
      </div>

      {/* Colonne droite : carte agrandie */}
      <div style={{ flex: '0 0 840px', maxWidth: '840px' }}>
	   <RouteMap
		  days={days}
		  reachableHuts={reachableHuts}
		  onSelectReachableHut={handleAddStageFromCandidate}
		  hoveredReachableHutId={hoveredReachableHutId} 
		  setHoveredReachableHutId={setHoveredReachableHutId}
		/>

      </div>
    </div>
  );
}
