// src/components/RouteBuilderPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useRouteStore } from '../store/routeStore';
import { hutsApi, itinerariesApi } from '../services/api';
import { StartPointSelector } from './StartPointSelector';
import { ReachableHutsList } from './ReachableHutsList';
import { RouteMap } from './RouteMap';
import { Trash2, Bed, Compass, TrendingUp, TrendingDown, Train, Bus, Ship, Lock, Unlock } from 'lucide-react';
import { ElevationProfile } from './ElevationProfile';
import './RouteBuilderPanel.css';
import { ClosedRouteActions } from './ClosedRouteActions';
import './ClosedRouteActions.css';
import { LoadItinerary } from './LoadItinerary';
import './LoadItinerary.css';
import { MapWrapper } from './MapWrapper';


// Icône de transport selon le mode
function TransportIcon({ mode, size = 12 }) {
  const props = { size, strokeWidth: 1.5 };
  switch (mode) {
    case 'train': return <Train {...props} className="transport-icon transport-icon-train" />;
    case 'bus': return <Bus {...props} className="transport-icon transport-icon-bus" />;
    case 'boat': return <Ship {...props} className="transport-icon transport-icon-boat" />;
    default: return null;
  }
}

// Composant pour afficher les icônes transport d'une cabane
function TransportIcons({ transports }) {
  if (!transports || transports.length === 0) return null;
  
  // Extraire les modes uniques
  const modes = [...new Set(transports.map(t => t.transport?.mode).filter(Boolean))];
  if (modes.length === 0) return null;
  
  return (
    <span className="transport-icons">
      {modes.map(mode => (
        <TransportIcon key={mode} mode={mode} size={11} />
      ))}
    </span>
  );
}

// Composant drapeau SVG compact
function Flag({ countryCode, size = 14 }) {
  if (!countryCode) return null;
  
  const code = countryCode.toUpperCase();
  const height = size * 0.7;
  
  if (code === 'NO' || code === 'NOR') {
    return (
      <svg className="timeline-flag" viewBox="0 0 22 16" width={size} height={height}>
        <rect width="22" height="16" fill="#BA0C2F"/>
        <rect x="6" width="4" height="16" fill="#fff"/>
        <rect y="6" width="22" height="4" fill="#fff"/>
        <rect x="7" width="2" height="16" fill="#00205B"/>
        <rect y="7" width="22" height="2" fill="#00205B"/>
      </svg>
    );
  }
  
  if (code === 'SE' || code === 'SWE') {
    return (
      <svg className="timeline-flag" viewBox="0 0 16 10" width={size} height={height}>
        <rect width="16" height="10" fill="#006AA7"/>
        <rect x="5" width="2" height="10" fill="#FECC00"/>
        <rect y="4" width="16" height="2" fill="#FECC00"/>
      </svg>
    );
  }
  
  if (code === 'FI' || code === 'FIN') {
    return (
      <svg className="timeline-flag" viewBox="0 0 18 11" width={size} height={height}>
        <rect width="18" height="11" fill="#fff"/>
        <rect x="5" width="3" height="11" fill="#003580"/>
        <rect y="4" width="18" height="3" fill="#003580"/>
      </svg>
    );
  }
  
  return null;
}

export function RouteBuilderPanel() {
  const {
    selectedHuts,
    currentRoute,
    reachableHuts,
    maxDistanceKm,
    maxSegments,
    isLoading,
    error,
    isRouteClosed,
    trailheads,
    mapBounds,
    itineraryCode,
    setStartHut,
    addHut,
    removeLastHut,
    resetRoute,
    closeRoute,
    reopenRoute,
    setReachableHuts,
    setMaxDistance,
    setMaxSegments,
    setLoading,
    setError,
    clearError,
    getStats,
    setTrailheads,
    getTransportInfo,
    setItineraryCode
  } = useRouteStore();

  const [allHuts, setAllHuts] = useState([]);
  const [isLoadingHuts, setIsLoadingHuts] = useState(true);
  const [hoveredHutId, setHoveredHutId] = useState(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [profileHoverPosition, setProfileHoverPosition] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    // Date par défaut : demain
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  // Fonction pour formater une date
  const formatDate = (dateStr, dayOffset) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + dayOffset);
    return date;
  };

  const formatDateShort = (date) => {
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatDateFull = (date) => {
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Formater un nombre avec apostrophe comme séparateur de milliers
  const formatNumber = (num) => {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  };

  // Charger toutes les cabanes et les trailheads au démarrage
  useEffect(() => {
    const loadAllHuts = async () => {
      setIsLoadingHuts(true);
      try {
        // Utiliser hutsApi.list() pour récupérer toutes les cabanes
        const response = await hutsApi.list();
        const huts = response.huts || response || [];
        setAllHuts(Array.isArray(huts) ? huts : []);
      } catch (err) {
        console.error('Erreur chargement cabanes:', err);
        setAllHuts([]);
      } finally {
        setIsLoadingHuts(false);
      }
    };

    const loadTrailheads = async () => {
      try {
        const response = await hutsApi.getTrailheads();
        const data = response || [];
        setTrailheads(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Erreur chargement trailheads:', err);
        setTrailheads([]);
      }
    };

    loadAllHuts();
    loadTrailheads();
  }, [setTrailheads]);

  // Charger les cabanes atteignables quand on sélectionne une cabane
  // Avec debounce pour éviter trop d'appels API lors du changement de paramètres
  useEffect(() => {
    if (selectedHuts.length === 0) {
      setReachableHuts([]);
      return;
    }

    // Si l'itinéraire est clos, ne pas charger les cabanes atteignables
    if (isRouteClosed) {
      setReachableHuts([]);
      return;
    }

    const lastHut = selectedHuts[selectedHuts.length - 1];
    const hutId = lastHut.hut_id || lastHut.id;
    
    if (!hutId) {
      console.error('Pas de hut_id trouvé pour:', lastHut);
      return;
    }

    // Debounce de 300ms pour les changements de paramètres
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      clearError();

      try {
        const response = await hutsApi.getReachable(hutId, maxDistanceKm, maxSegments);
        
        // Vérifier si la réponse contient une erreur
        if (response && response.detail) {
          throw new Error(typeof response.detail === 'string' ? response.detail : JSON.stringify(response.detail));
        }
        
        // Adapter selon la structure de la réponse
        const huts = response.huts || response.reachable_huts || response || [];
        
        // Pas de filtrage : on autorise toutes les cabanes atteignables
        // même celles déjà visitées (pour permettre les boucles)
        setReachableHuts(Array.isArray(huts) ? huts : []);
      } catch (err) {
        console.error('Erreur chargement cabanes atteignables:', err);
        const errorMsg = typeof err === 'string' ? err : (err.message || 'Erreur lors du chargement');
        setError(errorMsg);
        setReachableHuts([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [selectedHuts, maxDistanceKm, maxSegments, isRouteClosed, setReachableHuts, setLoading, clearError, setError]);

  const handleSelectStartHut = (hut) => {
    setStartHut(hut);
  };

  const handleAddHut = (reachableHut) => {
    // La structure est directe : hut_id, name, total_distance_km, total_dplus_m, etc.
    const enrichedHut = {
      hut_id: reachableHut.hut_id,
      id: reachableHut.hut_id,
      name: reachableHut.name,
      latitude: reachableHut.latitude,
      longitude: reachableHut.longitude,
      country_code: reachableHut.country_code,
      // Mapper les propriétés avec les bons noms
      total_distance: reachableHut.total_distance_km || 0,
      elevation_gain: reachableHut.total_dplus_m || 0,
      elevation_loss: reachableHut.total_dminus_m || 0,
      segments: reachableHut.segments || 1,
      via: reachableHut.via || null,
      steps: reachableHut.steps || []
    };
    
    addHut(enrichedHut, enrichedHut.steps);
  };

  const handleRemoveDay = (index) => {
    // Sortir de la vue 3D si active
    if (is3DMode) setIs3DMode(false);
    
    if (index === 0) {
      resetRoute();
    } else {
      const hutsToKeep = selectedHuts.slice(0, index);
      resetRoute();
      hutsToKeep.forEach((hut, i) => {
        if (i === 0) {
          setStartHut(hut);
        } else {
          addHut(hut, hut.steps || []);
        }
      });
    }
  };

  // Ajouter un jour de repos (rester à la même cabane)
  const handleRestDay = () => {
    if (!lastHut) return;
    
    const restDayHut = {
      ...lastHut,
      hut_id: lastHut.hut_id || lastHut.id,
      id: lastHut.hut_id || lastHut.id,
      total_distance: 0,
      elevation_gain: 0,
      elevation_loss: 0,
      segments: 0,
      via: null,
      steps: [],
      isRestDay: true
    };
    
    addHut(restDayHut, []);
  };

  const stats = getStats();
  const lastHut = selectedHuts.length > 0 ? selectedHuts[selectedHuts.length - 1] : null;

  // Calculer les stats manuellement pour éviter les NaN
  const computedStats = {
    days: selectedHuts.length > 0 ? selectedHuts.length - 1 : 0,
    totalDistance: selectedHuts.reduce((sum, hut, i) => {
      if (i === 0) return 0;
      return sum + (hut.total_distance || 0);
    }, 0),
    totalElevationGain: selectedHuts.reduce((sum, hut, i) => {
      if (i === 0) return 0;
      return sum + (hut.elevation_gain || 0);
    }, 0),
    totalElevationLoss: selectedHuts.reduce((sum, hut, i) => {
      if (i === 0) return 0;
      return sum + (hut.elevation_loss || 0);
    }, 0)
  };

  // Fonction pour formater les erreurs
  const formatError = (err) => {
    if (!err) return null;
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    if (Array.isArray(err)) return err.map(e => e.msg || e.message || String(e)).join(', ');
    return String(err);
  };

  return (
    <div className="route-builder-3col">
      {/* COLONNE GAUCHE */}
      <div className="route-builder-left">
        <div className="column-header">
          <h2>Planification</h2>
          <p className="text-muted text-sm">
            Choisissez votre cabane de départ et configurez vos paramètres
          </p>
        </div>

        <div className="column-content">
          {/* Charger un itinéraire sauvegardé */}
          {selectedHuts.length === 0 && (
            <LoadItinerary />
          )}
          
          {/* Cabane de départ - cachée une fois sélectionnée */}
          {selectedHuts.length === 0 && (
		  <StartPointSelector
			huts={allHuts}
			trailheads={trailheads}
			onSelect={handleSelectStartHut}
			isLoading={isLoadingHuts}
		  />
)}

          {/* Paramètres */}
          {selectedHuts.length > 0 && !isRouteClosed && (
            <div className="section-card parameters-card">
              <h3 className="section-title">Paramètres de la prochaine étape</h3>
              
              <div className="param-group">
                <label className="param-label">
                  <span>Distance maximale par jour</span>
                  <span className={`param-value ${maxDistanceKm >= 30 ? 'param-value-warning' : ''}`}>{maxDistanceKm} km</span>
                </label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={maxDistanceKm}
                    onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                    className={`slider ${maxDistanceKm >= 30 ? 'slider-warning' : ''}`}
                  />
                  <div className="slider-ticks">
                    {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(val => (
                      <div key={val} className={`slider-tick ${val >= 30 ? 'slider-tick-warning' : ''}`} />
                    ))}
                  </div>
                </div>
                <div className="slider-labels">
                  <span>5 km</span>
                  <span>50 km</span>
                </div>
              </div>

              <div className="param-group param-group-inline">
                <label className="param-label">
                  <span>Segments maximum</span>
                  <div className="segments-selector">
                    {[1, 2, 3].map(num => (
                      <button
                        key={num}
                        className={`segment-btn ${maxSegments === num ? 'segment-btn-active' : ''}`}
                        onClick={() => setMaxSegments(num)}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Cabanes atteignables */}
          {selectedHuts.length > 0 && !isRouteClosed && (
            <div className="section-card">
              <h3 className="section-title">
                Cabanes atteignables depuis {lastHut?.name}
              </h3>
              
              {error && (
                <div className="alert alert-error mb-3">
                  {formatError(error)}
                </div>
              )}

              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p className="text-sm text-muted">Recherche des cabanes atteignables...</p>
                </div>
              ) : reachableHuts.length === 0 ? (
                <div className="empty-state">
                  <p className="text-muted text-sm">Aucune cabane atteignable avec ces paramètres.</p>
                  <p className="text-muted text-xs">Essayez d'augmenter la distance maximale.</p>
                </div>
              ) : (
                <>
                  {/* Bouton jour de repos */}
                  <button
                    className="btn-rest-day"
                    onClick={handleRestDay}
                    title="Ajouter un jour de repos à cette cabane"
                  >
                    <span className="btn-rest-day-icon"><Bed size={16} /></span>
                    <span className="btn-rest-day-text">Jour de repos à {lastHut?.name?.split(' ')[0]}...</span>
                  </button>
                  
                  <ReachableHutsList 
                    huts={reachableHuts} 
                    onSelect={handleAddHut}
                    hoveredHutId={hoveredHutId}
                    onHover={setHoveredHutId}
                    trailheads={trailheads}
                  />
                </>
              )}
            </div>
          )}

          {/* Zone itinéraire clos avec actions */}
			{selectedHuts.length > 0 && isRouteClosed && (
			  <div className="section-card closed-route-overlay">
				<div className="closed-route-content">
				  <Lock size={48} strokeWidth={1.5} className="closed-route-icon" />
				  <p className="closed-route-text">Itinéraire clos</p>
				  <p className="closed-route-hint">Rouvrez l'itinéraire pour continuer la planification</p>
				</div>
				
				{/* Zone d'actions export */}
				<ClosedRouteActions 
				  selectedHuts={selectedHuts}
				  startDate={startDate}
				  onToggle3D={setIs3DMode}
				  is3DMode={is3DMode}
				  itineraryCode={itineraryCode}
				/>
			  </div>
			)}
        </div>
      </div>

      {/* COLONNE CENTRALE */}
      <div className="route-builder-center">
        <div className="column-header">
          <h2>Itinéraire en cours</h2>
        </div>

        <div className="column-content">
          {selectedHuts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📍</div>
              <h3 className="empty-state-title">Aucun itinéraire</h3>
              <p className="text-muted text-sm">
                Commencez par sélectionner une cabane de départ
              </p>
            </div>
          ) : (
            <>
              {/* En-tête du calendrier */}
              <div className="expedition-header">
                <div className="expedition-title">
                  <Compass size={18} strokeWidth={1} className="expedition-icon" />
                  <span>Expédition</span>
                </div>
                <div className="expedition-date-picker">
                  <label htmlFor="start-date">Départ</label>
                  <input
                    type="date"
                    id="start-date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="date-input"
                  />
                </div>
              </div>

              {/* Résumé élégant */}
              <div className="expedition-summary">
                <div className="expedition-stat">
                  <span className="expedition-stat-value">{computedStats.days}</span>
                  <span className="expedition-stat-label">jours</span>
                </div>
                <div className="expedition-stat-divider"></div>
                <div className="expedition-stat">
                  <span className="expedition-stat-value">{formatNumber(computedStats.totalDistance)}</span>
                  <span className="expedition-stat-label">km</span>
                </div>
                <div className="expedition-stat-divider"></div>
                <div className="expedition-stat">
                  <span className="expedition-stat-value expedition-stat-up">
                    <TrendingUp size={14} strokeWidth={2} />
                    {formatNumber(computedStats.totalElevationGain)}
                  </span>
                  <span className="expedition-stat-label">m</span>
                </div>
                <div className="expedition-stat-divider"></div>
                <div className="expedition-stat">
                  <span className="expedition-stat-value expedition-stat-down">
                    <TrendingDown size={14} strokeWidth={2} />
                    {formatNumber(computedStats.totalElevationLoss)}
                  </span>
                  <span className="expedition-stat-label">m</span>
                </div>
              </div>

              {/* Calendrier */}
              <div className="expedition-calendar">
                {/* Bloc transport d'arrivée (avant la première cabane si trailhead) */}
                {(() => {
                  const firstHut = selectedHuts[0];
                  const firstHutId = firstHut?.hut_id || firstHut?.id;
                  const firstTransports = trailheads.filter(t => t.hut_id === firstHutId);
                  if (firstTransports.length > 0) {
                    return (
                      <div className="transport-block transport-block-arrival">
                        <div className="transport-block-icon">
                          <Compass size={14} />
                        </div>
                        <div className="transport-block-content">
                          <div className="transport-block-title">Accès transports publics</div>
                          {firstTransports.map((t, idx) => (
                            t.transport && (
                              <div key={idx} className="transport-block-option">
                                <TransportIcon mode={t.transport.mode} size={12} />
                                <span>
                                  {t.transport.mode === 'train' ? 'Train' : t.transport.mode === 'bus' ? 'Bus' : 'Bateau'}
                                  {t.transport.line && ` ${t.transport.line}`}
                                  {t.transport.hub && ` depuis ${t.transport.hub}`}
                                  {t.transport.duration && ` (${t.transport.duration})`}
                                </span>
                                {t.transport.seasonal && <span className="transport-seasonal">Saisonnier</span>}
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {selectedHuts.map((hut, index) => {
                  const dayDate = formatDate(startDate, index);
                  const isToday = new Date().toDateString() === dayDate.toDateString();
                  const nextHut = selectedHuts[index + 1];
                  const showSegment = nextHut && !nextHut.isRestDay;
                  const hutId = hut.hut_id || hut.id;
                  const hutTransports = trailheads.filter(t => t.hut_id === hutId);
                  
                  return (
                    <React.Fragment key={`${hut.hut_id || hut.id}-${index}`}>
                      {/* Jour */}
                      <div className={`calendar-day ${index === selectedHuts.length - 1 ? 'calendar-day-current' : ''} ${hut.isRestDay ? 'calendar-day-rest' : ''}`}>
                        <div className="calendar-day-date">
                          <span className="calendar-day-weekday">
                            {dayDate.toLocaleDateString('fr-FR', { weekday: 'short' })}
                          </span>
                          <span className="calendar-day-number">
                            {dayDate.getDate()}
                          </span>
                          <span className="calendar-day-month">
                            {dayDate.toLocaleDateString('fr-FR', { month: 'short' })}
                          </span>
                        </div>
                        
                        <div className="calendar-day-content">
                          <div className="calendar-day-header">
                            <span className={`calendar-day-badge ${hut.isRestDay ? 'calendar-day-badge-rest' : ''}`}>
                              {hut.isRestDay ? <span className="zzz-icon">Zzz</span> : `J${index}`}
                            </span>
                            {index === 0 && <span className="calendar-day-tag">Départ</span>}
                            {hut.isRestDay && <span className="calendar-day-tag calendar-day-tag-rest">Repos</span>}
                          </div>
                          
                          <div className="calendar-day-hut">
                            <Flag countryCode={hut.country_code} size={14} />
                            <span className="calendar-day-hut-name">{hut.name}</span>
                            <TransportIcons transports={hutTransports} />
                          </div>
                          
                          {(hut.via || hut.via_hut) && !hut.isRestDay && (
                            <div className="calendar-day-via">via {hut.via || hut.via_hut?.name || hut.via_hut}</div>
                          )}
                        </div>

                        {index > 0 && (
                          <button
                            className="calendar-day-delete"
                            onClick={() => handleRemoveDay(index)}
                            title="Retirer cette étape"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {/* Segment de marche */}
                      {showSegment && (
                        <div className="calendar-segment">
                          <div className="calendar-segment-line"></div>
                          <div className="calendar-segment-stats">
                            <span className="calendar-segment-distance">{(nextHut.total_distance || 0).toFixed(1)} km</span>
                            <span className="calendar-segment-elevation">↑{Math.round(nextHut.elevation_gain || 0)}</span>
                            <span className="calendar-segment-elevation">↓{Math.round(nextHut.elevation_loss || 0)}</span>
                            {nextHut.segments > 1 && (
                              <span className="calendar-segment-warning">⚡ {nextHut.segments} seg.</span>
                            )}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Bloc transport de départ (après la dernière cabane si trailhead et itinéraire clos) */}
                {isRouteClosed && (() => {
                  const lastHut = selectedHuts[selectedHuts.length - 1];
                  const lastHutId = lastHut?.hut_id || lastHut?.id;
                  const lastTransports = trailheads.filter(t => t.hut_id === lastHutId);
                  if (lastTransports.length > 0) {
                    return (
                      <div className="transport-block transport-block-departure">
                        <div className="transport-block-icon">
                          <Compass size={14} />
                        </div>
                        <div className="transport-block-content">
                          <div className="transport-block-title">Retour transports publics</div>
                          {lastTransports.map((t, idx) => (
                            t.transport && (
                              <div key={idx} className="transport-block-option">
                                <TransportIcon mode={t.transport.mode} size={12} />
                                <span>
                                  {t.transport.mode === 'train' ? 'Train' : t.transport.mode === 'bus' ? 'Bus' : 'Bateau'}
                                  {t.transport.line && ` ${t.transport.line}`}
                                  {t.transport.hub && ` vers ${t.transport.hub}`}
                                  {t.transport.duration && ` (${t.transport.duration})`}
                                </span>
                                {t.transport.seasonal && <span className="transport-seasonal">Saisonnier</span>}
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Bouton clore/rouvrir l'itinéraire */}
              {selectedHuts.length > 1 && (
                <button
                  className={`btn btn-sm w-full mt-3 ${isRouteClosed ? 'btn-outline btn-secondary' : 'btn-primary'}`}
                  onClick={async () => {
                    if (isRouteClosed) {
                      reopenRoute();
                      setItineraryCode(null);
                    } else {
                      closeRoute();
                      // Sauvegarder l'itinéraire et obtenir un code
                      try {
                        console.log('DEBUG - currentRoute:', currentRoute);
                        console.log('DEBUG - currentRoute.steps:', currentRoute?.steps);
                        const result = await itinerariesApi.save({
                          selectedHuts,
                          currentRoute,
                          startDate,
                          maxDistance: maxDistanceKm,
                          maxSegments
                        });
                        setItineraryCode(result.code);
                      } catch (err) {
                        console.error('Erreur sauvegarde itinéraire:', err);
                        // On clôt quand même, juste pas de code
                      }
                    }
                  }}
                  disabled={isRouteClosed && is3DMode}
                  title={isRouteClosed && is3DMode ? "Fermez d'abord la vue 3D" : undefined}
                >
                  {isRouteClosed ? (
                    <>
                      <Unlock size={14} />
                      <span>Rouvrir l'itinéraire</span>
                    </>
                  ) : (
                    <>
                      <Lock size={14} />
                      <span>Clore l'itinéraire</span>
                    </>
                  )}
                </button>
              )}

              {/* Bouton réinitialiser */}
              <button
                className="btn btn-outline btn-danger btn-sm w-full mt-2"
                onClick={() => {
                  if (is3DMode) setIs3DMode(false);
                  resetRoute();
                }}
              >
                Réinitialiser
              </button>
            </>
          )}
        </div>
      </div>

      {/* COLONNE DROITE - Profil + Carte */}
      <div className="route-builder-right">
        {selectedHuts.length >= 2 && (
          <ElevationProfile 
            selectedHuts={selectedHuts} 
            onHutHover={setHoveredHutId}
            onPositionHover={setProfileHoverPosition}
          />
        )}
        <div className="map-container">
          <MapWrapper 
			  selectedHuts={selectedHuts} 
			  reachableHuts={isRouteClosed ? [] : reachableHuts}
			  hoveredHutId={hoveredHutId}
			  onHutHover={setHoveredHutId}
			  onHutClick={handleAddHut}
			  profileHoverPosition={profileHoverPosition}
			  isRouteClosed={isRouteClosed}
			  is3DMode={is3DMode}
			  onToggle3D={setIs3DMode}
			  mapBounds={mapBounds}
			/>
        </div>
      </div>
    </div>
  );
}
