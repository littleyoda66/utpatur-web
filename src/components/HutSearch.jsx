// src/components/HutSearch.jsx
import React, { useState, useEffect, useRef } from 'react';
import { hutsApi } from '../services/api';
import { Search, MapPin } from 'lucide-react';
import './HutSearch.css';

export function HutSearch({ onSelect, placeholder = "Rechercher une cabane..." }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef(null);
  const timeoutRef = useRef(null);

  // Fermer les résultats si clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recherche avec debounce
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // Annuler la recherche précédente
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsLoading(true);

    // Debounce de 300ms
    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await hutsApi.search(query, 20);
        setResults(data);
        setShowResults(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Erreur recherche:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query]);

  const handleSelect = (hut) => {
    onSelect(hut);
    setQuery('');
    setResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showResults || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="hut-search" ref={searchRef}>
      <div className="search-input-wrapper">
        <Search className="search-icon" size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
          placeholder={placeholder}
          className="search-input"
        />
        {isLoading && (
          <div className="search-loading">
            <div className="spinner-sm" />
          </div>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="search-results">
          {results.map((hut, index) => (
            <button
              key={hut.hut_id}
              onClick={() => handleSelect(hut)}
              className={`search-result-item ${
                index === selectedIndex ? 'selected' : ''
              }`}
            >
              <MapPin size={16} className="result-icon" />
              <div className="result-info">
                <div className="result-name">{hut.name}</div>
                <div className="result-meta">
                  {hut.country_code && (
                    <span className="result-country">{hut.country_code}</span>
                  )}
                  {hut.latitude && hut.longitude && (
                    <span className="result-coords">
                      {hut.latitude.toFixed(3)}, {hut.longitude.toFixed(3)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="search-results">
          <div className="search-no-results">
            Aucune cabane trouvée pour "{query}"
          </div>
        </div>
      )}
    </div>
  );
}
