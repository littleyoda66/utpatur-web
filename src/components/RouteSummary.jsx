// src/components/RouteSummary.jsx
import React from 'react';
import { Calendar, Route, TrendingUp, TrendingDown, Trash2, RotateCcw, Download } from 'lucide-react';
import './RouteSummary.css';

export function RouteSummary({ stats, selectedHuts, onRemoveLast, onReset }) {
  const handleExport = () => {
    const routeData = {
      version: '2.0.0',
      date: new Date().toISOString(),
      huts: selectedHuts,
      stats
    };

    const dataStr = JSON.stringify(routeData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `itineraire-laponie-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="route-summary card">
      <div className="card-header">
        <h2 className="card-title">Résumé de l'itinéraire</h2>
      </div>

      {/* Stats grid */}
      <div className="summary-stats">
        <div className="summary-stat">
          <div className="summary-stat-icon">
            <Calendar size={20} />
          </div>
          <div className="summary-stat-content">
            <div className="summary-stat-label">Jours</div>
            <div className="summary-stat-value">{stats.days}</div>
          </div>
        </div>

        <div className="summary-stat">
          <div className="summary-stat-icon">
            <Route size={20} />
          </div>
          <div className="summary-stat-content">
            <div className="summary-stat-label">Distance totale</div>
            <div className="summary-stat-value">
              {stats.totalDistance.toFixed(1)} km
            </div>
          </div>
        </div>

        <div className="summary-stat">
          <div className="summary-stat-icon success">
            <TrendingUp size={20} />
          </div>
          <div className="summary-stat-content">
            <div className="summary-stat-label">D+</div>
            <div className="summary-stat-value">
              {Math.round(stats.totalDplus)} m
            </div>
          </div>
        </div>

        <div className="summary-stat">
          <div className="summary-stat-icon error">
            <TrendingDown size={20} />
          </div>
          <div className="summary-stat-content">
            <div className="summary-stat-label">D-</div>
            <div className="summary-stat-value">
              {Math.round(stats.totalDminus)} m
            </div>
          </div>
        </div>
      </div>

      {/* Itinerary list */}
      {selectedHuts.length > 0 && (
        <div className="itinerary-list">
          <h3 className="itinerary-title">Étapes</h3>
          {selectedHuts.map((hut, index) => (
            <div key={hut.hut_id} className="itinerary-item">
              <div className="itinerary-day">J{index + 1}</div>
              <div className="itinerary-hut">
                <div className="itinerary-hut-name">{hut.name}</div>
                <div className="itinerary-hut-country">{hut.country_code}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Average per day */}
      {stats.segments > 0 && (
        <div className="summary-avg">
          <p className="text-sm text-muted">
            Moyenne par jour: {stats.avgDistance.toFixed(1)} km
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="summary-actions">
        {selectedHuts.length > 1 && (
          <button
            onClick={onRemoveLast}
            className="btn btn-sm btn-outline"
            title="Retirer dernière étape"
          >
            <Trash2 size={16} />
            Retirer dernier
          </button>
        )}

        <button
          onClick={onReset}
          className="btn btn-sm btn-outline"
          title="Recommencer"
        >
          <RotateCcw size={16} />
          Recommencer
        </button>

        {selectedHuts.length > 1 && (
          <button
            onClick={handleExport}
            className="btn btn-sm btn-primary"
            title="Exporter l'itinéraire"
          >
            <Download size={16} />
            Exporter
          </button>
        )}
      </div>
    </div>
  );
}
