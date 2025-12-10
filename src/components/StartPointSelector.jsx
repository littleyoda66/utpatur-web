// src/components/StartPointSelector.jsx
import React, { useState, useMemo } from 'react';
import { Search, X, MapPin, Train, Bus, Ship, Footprints } from 'lucide-react';
import './StartPointSelector.css';

// Composant drapeau SVG
function Flag({ countryCode, size = 16 }) {
  if (!countryCode) return null;
  
  const code = countryCode.toUpperCase();
  const height = size * 0.7;
  
  if (code === 'NO' || code === 'NOR') {
    return (
      <svg className="flag-icon" viewBox="0 0 22 16" width={size} height={height}>
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
      <svg className="flag-icon" viewBox="0 0 16 10" width={size} height={height}>
        <rect width="16" height="10" fill="#006AA7"/>
        <rect x="5" width="2" height="10" fill="#FECC00"/>
        <rect y="4" width="16" height="2" fill="#FECC00"/>
      </svg>
    );
  }
  
  if (code === 'FI' || code === 'FIN') {
    return (
      <svg className="flag-icon" viewBox="0 0 18 11" width={size} height={height}>
        <rect width="18" height="11" fill="#fff"/>
        <rect x="5" width="3" height="11" fill="#003580"/>
        <rect y="4" width="18" height="3" fill="#003580"/>
      </svg>
    );
  }
  
  return null;
}

// Icône de transport selon le mode
function TransportIcon({ mode, size = 14 }) {
  const props = { size, strokeWidth: 1.5 };
  
  switch (mode) {
    case 'train':
      return <Train {...props} />;
    case 'bus':
      return <Bus {...props} />;
    case 'boat':
      return <Ship {...props} />;
    default:
      return <Footprints {...props} />;
  }
}

// Données des trailheads (points d'accès en transport public)
const TRAILHEADS = [
  {
    name: 'STF Abisko Turiststation',
    hut_id: 470930791,
    country_code: 'SE',
    latitude: 68.3585719,
    longitude: 18.7836749,
    transport: { mode: 'train', line: 'Malmbanan', duration: '1h15', hub: 'Kiruna' }
  },
  {
    name: 'Nikkaluokta Sarri AB',
    hut_id: 13104276489,
    country_code: 'SE',
    latitude: 67.8509132,
    longitude: 19.0119961,
    transport: { mode: 'bus', line: '92', duration: '1h30', hub: 'Kiruna', seasonal: true }
  },
  {
    name: 'Hotell Riksgränsen',
    hut_id: 4093500789,
    country_code: 'SE',
    latitude: 68.426456,
    longitude: 18.1249828,
    transport: { mode: 'train', line: 'Malmbanan', duration: '1h30', hub: 'Kiruna' }
  },
  {
    name: 'Kvikkjokk Fjällstation',
    hut_id: 1356458317,
    country_code: 'SE',
    latitude: 66.9537277,
    longitude: 17.7196067,
    transport: { mode: 'bus', line: '47', duration: '2h', hub: 'Jokkmokk' }
  },
  {
    name: 'Saltoluokta Fjällstation',
    hut_id: 1356402863,
    country_code: 'SE',
    latitude: 67.3940048,
    longitude: 18.5204549,
    transport: { mode: 'boat', line: 'STF', duration: '30min', hub: 'Kebnats', seasonal: true }
  },
  {
    name: 'Vakkotavare Fjällstuga',
    hut_id: 339299833,
    country_code: 'SE',
    latitude: 67.5818276,
    longitude: 18.1006482,
    transport: { mode: 'bus', line: '93', duration: '3h20', hub: 'Gällivare', seasonal: true }
  },
  {
    name: 'Gargia fjellstue',
    hut_id: 1356457850,
    country_code: 'NO',
    latitude: 69.8064524,
    longitude: 23.4895015,
    transport: { mode: 'bus', duration: '45min', hub: 'Alta' }
  }
];

export function StartPointSelector({ huts, onSelect, isLoading }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyTrailheads, setShowOnlyTrailheads] = useState(true);

  // Créer un set des IDs de trailheads pour lookup rapide
  const trailheadIds = useMemo(() => 
    new Set(TRAILHEADS.map(t => t.hut_id)), 
    []
  );

  // Enrichir les huts avec les infos de transport
  const enrichedHuts = useMemo(() => {
    if (!huts) return [];
    
    return huts.map(hut => {
      const trailhead = TRAILHEADS.find(t => t.hut_id === (hut.hut_id || hut.id));
      return {
        ...hut,
        isTrailhead: !!trailhead,
        transport: trailhead?.transport || null
      };
    });
  }, [huts]);

  // Filtrer les résultats
  const filteredHuts = useMemo(() => {
    let results = enrichedHuts;

    // Filtre trailheads
    if (showOnlyTrailheads) {
      results = results.filter(h => h.isTrailhead);
    }

    // Filtre recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(h => 
        h.name?.toLowerCase().includes(query)
      );
    }

    // Trier : trailheads en premier, puis alphabétique
    return results.sort((a, b) => {
      if (a.isTrailhead && !b.isTrailhead) return -1;
      if (!a.isTrailhead && b.isTrailhead) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [enrichedHuts, searchQuery, showOnlyTrailheads]);

  const handleSelect = (hut) => {
    onSelect(hut);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  if (isLoading) {
    return (
      <div className="start-selector">
        <div className="start-selector-loading">
          <div className="start-selector-spinner" />
          <span>Chargement des cabanes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="start-selector">
      {/* Header */}
      <div className="start-selector-header">
        <div className="start-selector-title">
          <MapPin size={18} strokeWidth={1.5} />
          <span>Point de départ</span>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="start-selector-search">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher une cabane..."
          className="search-input"
        />
        {searchQuery && (
          <button className="search-clear" onClick={clearSearch}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Toggle trailheads */}
      <label className="start-selector-toggle">
        <input
          type="checkbox"
          checked={showOnlyTrailheads}
          onChange={(e) => setShowOnlyTrailheads(e.target.checked)}
        />
        <span className="toggle-switch" />
        <span className="toggle-label">Accès transports publics</span>
      </label>

      {/* Liste des cabanes */}
      <div className="start-selector-list">
        {showOnlyTrailheads && !searchQuery && (
          <div className="start-selector-section-label">
            Points d'accès recommandés
          </div>
        )}

        {filteredHuts.length === 0 ? (
          <div className="start-selector-empty">
            <p>Aucune cabane trouvée</p>
            {showOnlyTrailheads && (
              <button 
                className="start-selector-show-all"
                onClick={() => setShowOnlyTrailheads(false)}
              >
                Voir toutes les cabanes
              </button>
            )}
          </div>
        ) : (
          filteredHuts.map((hut) => (
            <button
              key={hut.hut_id || hut.id}
              className={`start-selector-item ${hut.isTrailhead ? 'is-trailhead' : ''}`}
              onClick={() => handleSelect(hut)}
            >
              <div className="item-main">
                <div className="item-name">
                  <Flag countryCode={hut.country_code} size={14} />
                  <span>{hut.name}</span>
                </div>
                {hut.transport ? (
                  <div className="item-transport">
                    <TransportIcon mode={hut.transport.mode} />
                    <span className="transport-details">
                      {hut.transport.mode === 'train' && `Train ${hut.transport.line}`}
                      {hut.transport.mode === 'bus' && `Bus ${hut.transport.line}`}
                      {hut.transport.mode === 'boat' && `Bateau ${hut.transport.line}`}
                      {' · '}
                      {hut.transport.duration} depuis {hut.transport.hub}
                    </span>
                    {hut.transport.seasonal && (
                      <span className="transport-seasonal">saisonnier</span>
                    )}
                  </div>
                ) : (
                  <div className="item-transport item-transport-walk">
                    <Footprints size={14} strokeWidth={1.5} />
                    <span>Accès à pied uniquement</span>
                  </div>
                )}
              </div>
              <div className="item-arrow">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
          ))
        )}

        {/* Afficher le compteur si filtrage actif */}
        {!showOnlyTrailheads && filteredHuts.length > 0 && (
          <div className="start-selector-count">
            {filteredHuts.length} cabane{filteredHuts.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}