// src/components/AdminPanel.jsx
import React, { useState } from 'react';
import { adminApi } from '../services/api';
import { HutSearch } from './HutSearch';
import { Plus, Search, MapPin, Link as LinkIcon, AlertCircle } from 'lucide-react';
import './AdminPanel.css';

export function AdminPanel() {
  const [activeSection, setActiveSection] = useState('search'); // search, import, link
  const [osmQuery, setOsmQuery] = useState('');
  const [osmResults, setOsmResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // État pour la création de segment
  const [fromHut, setFromHut] = useState(null);
  const [toHut, setToHut] = useState(null);
  const [routePreview, setRoutePreview] = useState(null);

  // Recherche OSM
  const handleSearchOSM = async () => {
    if (osmQuery.length < 2) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const results = await adminApi.searchOverpass(osmQuery, 20);
      setOsmResults(results);
      if (results.length === 0) {
        setError('Aucun résultat trouvé dans OSM');
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de la recherche OSM');
    } finally {
      setIsLoading(false);
    }
  };

  // Importer une cabane depuis OSM
  const handleImportHut = async (osmHut) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const imported = await adminApi.importHut({
        name: osmHut.name,
        latitude: osmHut.latitude,
        longitude: osmHut.longitude,
        country_code: osmHut.country_code,
        osm_id: osmHut.osm_id,
        raw_tags: osmHut.raw_tags
      });
      
      setSuccess(`Cabane "${imported.name}" importée avec succès (ID: ${imported.hut_id})`);
      
      // Retirer de la liste
      setOsmResults(prev => prev.filter(h => h.osm_id !== osmHut.osm_id));
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'importation');
    } finally {
      setIsLoading(false);
    }
  };

  // Prévisualiser un segment
  const handlePreviewRoute = async () => {
    if (!fromHut || !toHut) {
      setError('Sélectionnez deux cabanes');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const preview = await adminApi.previewRoute(
        fromHut.latitude,
        fromHut.longitude,
        toHut.latitude,
        toHut.longitude
      );
      setRoutePreview(preview);
    } catch (err) {
      setError(err.message || 'Erreur lors du calcul de l\'itinéraire');
    } finally {
      setIsLoading(false);
    }
  };

  // Créer le segment
  const handleCreateLink = async (bidirectional = false) => {
    if (!routePreview) {
      setError('Calculez d\'abord l\'itinéraire');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await adminApi.createLink({
        from_hut_id: fromHut.hut_id,
        to_hut_id: toHut.hut_id,
        distance_km: routePreview.distance_km,
        dplus_m: routePreview.dplus_m,
        dminus_m: routePreview.dminus_m,
        geometry_polyline: routePreview.geometry_polyline,
        bidirectional
      });

      setSuccess(
        `Segment créé : ${fromHut.name} → ${toHut.name}` +
        (bidirectional ? ' (bidirectionnel)' : '')
      );

      // Reset
      setFromHut(null);
      setToHut(null);
      setRoutePreview(null);
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du segment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>Panneau d'administration</h2>
        <p className="text-muted text-sm">
          Gestion du graphe de cabanes
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          ✓ {success}
        </div>
      )}

      {/* Sections tabs */}
      <div className="admin-tabs">
        <button
          onClick={() => setActiveSection('import')}
          className={`admin-tab ${activeSection === 'import' ? 'active' : ''}`}
        >
          <Plus size={16} />
          Importer une cabane
        </button>

        <button
          onClick={() => setActiveSection('link')}
          className={`admin-tab ${activeSection === 'link' ? 'active' : ''}`}
        >
          <LinkIcon size={16} />
          Créer un segment
        </button>
      </div>

      {/* Section Import */}
      {activeSection === 'import' && (
        <div className="admin-section">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Rechercher dans OpenStreetMap</h3>
            </div>

            <div className="search-osm-form">
              <div className="form-group">
                <input
                  type="text"
                  value={osmQuery}
                  onChange={(e) => setOsmQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearchOSM();
                  }}
                  placeholder="Nom de la cabane..."
                  className="form-input"
                />
              </div>

              <button
                onClick={handleSearchOSM}
                disabled={isLoading || osmQuery.length < 2}
                className="btn btn-primary"
              >
                <Search size={16} />
                Rechercher dans OSM
              </button>
            </div>

            {isLoading && (
              <div className="loading-state">
                <div className="spinner" />
                <p className="text-sm text-muted">Recherche dans OpenStreetMap...</p>
              </div>
            )}

            {osmResults.length > 0 && (
              <div className="osm-results">
                {osmResults.map((hut) => (
                  <div key={hut.osm_id} className="osm-result-item">
                    <div className="osm-result-info">
                      <div className="osm-result-name">
                        <MapPin size={16} />
                        {hut.name}
                      </div>
                      <div className="osm-result-meta">
                        {hut.country_code && (
                          <span className="badge badge-info">{hut.country_code}</span>
                        )}
                        {hut.tourism && (
                          <span className="text-xs text-muted">{hut.tourism}</span>
                        )}
                        <span className="text-xs text-muted">
                          {hut.latitude.toFixed(4)}, {hut.longitude.toFixed(4)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleImportHut(hut)}
                      disabled={isLoading}
                      className="btn btn-sm btn-primary"
                    >
                      <Plus size={14} />
                      Importer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section Création de segment */}
      {activeSection === 'link' && (
        <div className="admin-section">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Créer un segment entre deux cabanes</h3>
            </div>

            <div className="link-form">
              <div className="form-group">
                <label className="form-label">Cabane de départ</label>
                {fromHut ? (
                  <div className="selected-hut">
                    <span>{fromHut.name}</span>
                    <button
                      onClick={() => setFromHut(null)}
                      className="btn btn-sm btn-outline"
                    >
                      Changer
                    </button>
                  </div>
                ) : (
                  <HutSearch onSelect={setFromHut} placeholder="Rechercher..." />
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Cabane d'arrivée</label>
                {toHut ? (
                  <div className="selected-hut">
                    <span>{toHut.name}</span>
                    <button
                      onClick={() => setToHut(null)}
                      className="btn btn-sm btn-outline"
                    >
                      Changer
                    </button>
                  </div>
                ) : (
                  <HutSearch onSelect={setToHut} placeholder="Rechercher..." />
                )}
              </div>

              <button
                onClick={handlePreviewRoute}
                disabled={!fromHut || !toHut || isLoading}
                className="btn btn-primary"
              >
                Calculer l'itinéraire
              </button>

              {routePreview && (
                <div className="route-preview">
                  <h4>Aperçu du segment</h4>
                  <div className="preview-stats">
                    <div className="preview-stat">
                      <span>Distance:</span>
                      <strong>{routePreview.distance_km.toFixed(2)} km</strong>
                    </div>
                    <div className="preview-stat">
                      <span>D+:</span>
                      <strong>{Math.round(routePreview.dplus_m)} m</strong>
                    </div>
                    <div className="preview-stat">
                      <span>D-:</span>
                      <strong>{Math.round(routePreview.dminus_m)} m</strong>
                    </div>
                  </div>

                  <div className="preview-actions">
                    <button
                      onClick={() => handleCreateLink(false)}
                      disabled={isLoading}
                      className="btn btn-primary"
                    >
                      Créer segment →
                    </button>
                    <button
                      onClick={() => handleCreateLink(true)}
                      disabled={isLoading}
                      className="btn btn-secondary"
                    >
                      Créer bidirectionnel ↔
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
