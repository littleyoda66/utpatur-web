// src/components/ReachableHutsList.jsx
import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import './ReachableHutsList.css';

// Composant drapeau SVG
function Flag({ countryCode }) {
  if (!countryCode) return null;
  
  const code = countryCode.toUpperCase();
  
  // Drapeau norvégien
  if (code === 'NO' || code === 'NOR') {
    return (
      <svg className="reachable-hut-flag" viewBox="0 0 22 16" width="18" height="13">
        <rect width="22" height="16" fill="#BA0C2F"/>
        <rect x="6" width="4" height="16" fill="#fff"/>
        <rect y="6" width="22" height="4" fill="#fff"/>
        <rect x="7" width="2" height="16" fill="#00205B"/>
        <rect y="7" width="22" height="2" fill="#00205B"/>
      </svg>
    );
  }
  
  // Drapeau suédois
  if (code === 'SE' || code === 'SWE') {
    return (
      <svg className="reachable-hut-flag" viewBox="0 0 16 10" width="18" height="13">
        <rect width="16" height="10" fill="#006AA7"/>
        <rect x="5" width="2" height="10" fill="#FECC00"/>
        <rect y="4" width="16" height="2" fill="#FECC00"/>
      </svg>
    );
  }
  
  // Drapeau finlandais
  if (code === 'FI' || code === 'FIN') {
    return (
      <svg className="reachable-hut-flag" viewBox="0 0 18 11" width="18" height="13">
        <rect width="18" height="11" fill="#fff"/>
        <rect x="5" width="3" height="11" fill="#003580"/>
        <rect y="4" width="18" height="3" fill="#003580"/>
      </svg>
    );
  }
  
  return null;
}

export function ReachableHutsList({ 
  huts = [], 
  onSelect, 
  hoveredHutId = null,
  onHover = () => {}
}) {
  const [sortBy, setSortBy] = useState('distance'); // 'distance' | 'name'

  const sortedHuts = useMemo(() => {
    if (!huts || huts.length === 0) return [];
    
    return [...huts].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '', 'sv'); // Tri suédois pour les caractères nordiques
      }
      // Par défaut : tri par distance
      return (a.total_distance_km || 0) - (b.total_distance_km || 0);
    });
  }, [huts, sortBy]);

  if (!huts || huts.length === 0) {
    return null;
  }

  return (
    <div className="reachable-huts-container">
      {/* Barre de tri */}
      <div className="reachable-huts-sort">
        <span className="sort-label">Trier par</span>
        <div className="sort-buttons">
          <button
            className={`sort-btn ${sortBy === 'distance' ? 'sort-btn-active' : ''}`}
            onClick={() => setSortBy('distance')}
          >
            Distance
          </button>
          <button
            className={`sort-btn ${sortBy === 'name' ? 'sort-btn-active' : ''}`}
            onClick={() => setSortBy('name')}
          >
            Nom
          </button>
        </div>
      </div>

      {/* Liste des cabanes */}
      <div className="reachable-huts-list">
        {sortedHuts.map((hut) => {
          const hutId = hut.hut_id || hut.id;
          const isHovered = hoveredHutId === hutId;
          
          return (
            <div
              key={hutId}
              className={`reachable-hut-card ${isHovered ? 'reachable-hut-card--hovered' : ''}`}
              onMouseEnter={() => onHover(hutId)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(hut)}
            >
              <div className="reachable-hut-info">
                <div className="reachable-hut-name">
                  <Flag countryCode={hut.country_code} />
                  {hut.name}
                </div>
                <div className="reachable-hut-stats">
                  <span>{(hut.total_distance_km || 0).toFixed(1)} km</span>
                  <span>+{Math.round(hut.total_dplus_m || 0)} m</span>
                  <span>-{Math.round(hut.total_dminus_m || 0)} m</span>
                  {hut.segments > 1 && (
                    <span className="segments-badge">{hut.segments} seg.</span>
                  )}
                </div>
                {hut.via && (
                  <div className="reachable-hut-via">via {hut.via}</div>
                )}
              </div>
              <div className="add-hut-icon">
                <Plus size={16} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
