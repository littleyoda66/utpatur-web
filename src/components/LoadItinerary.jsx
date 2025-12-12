// src/components/LoadItinerary.jsx
import React, { useState } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { itinerariesApi } from '../services/api';
import { useRouteStore } from '../store/routeStore';
import './LoadItinerary.css';

/**
 * Champ pour charger un itinéraire sauvegardé par son code
 */
export function LoadItinerary() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { restoreItinerary } = useRouteStore();

  const handleLoad = async () => {
    if (!code.trim() || code.length !== 6) {
      setError('Le code doit contenir 6 caractères');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await itinerariesApi.load(code);
      
      // Restaurer l'itinéraire complet avec les polylines
      restoreItinerary({
        huts: data.huts,
        segments: data.segments,
        steps: data.steps || [],
        code: data.code,
        startDate: data.start_date,
        maxDistance: data.max_distance,
        maxSegments: data.max_segments
      });
      
      // Vider le champ
      setCode('');
      
    } catch (err) {
      console.error('Erreur chargement:', err);
      setError(err.message || 'Itinéraire non trouvé');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleLoad();
    }
  };

  return (
    <div className="load-itinerary">
      <div className="load-itinerary-input-group">
        <input
          type="text"
          className="load-itinerary-input"
          placeholder="Code itinéraire"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          maxLength={6}
          disabled={isLoading}
        />
        <button
          className="load-itinerary-btn"
          onClick={handleLoad}
          disabled={isLoading || !code.trim()}
          title="Charger l'itinéraire"
        >
          {isLoading ? (
            <Loader2 size={16} className="spinning" />
          ) : (
            <Search size={16} />
          )}
        </button>
      </div>
      
      {error && (
        <div className="load-itinerary-error">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
