// src/components/StageCard.jsx
import React from 'react';
import { formatNumber } from '../utils/formatNumber';

export function StageCard({
  label,          // ex: "Jour 1" / "Day 1" / "Étape suivante"
  fromName,       // nom de la cabane de départ
  toName,         // nom de la cabane d’arrivée
  distanceKm,     // nombre
  dPlus,          // nombre (m)
  dMinus,         // nombre (m)
  isActive = false,    // étape actuellement sélectionnée
  isCandidate = false, // proposition de prochaine étape
  onClick,             // clic sur la carte (surbrillance sur la map, etc.)
  onRemove,            // pour supprimer l’étape (optionnel)
  primaryActionLabel,  // ex: "Ajouter comme étape" pour les suggestions
  onPrimaryAction,     // callback pour le bouton principal (optionnel)
}) {
  const handleRemove = (event) => {
    event.stopPropagation();
    if (onRemove) onRemove();
  };

  const handlePrimaryAction = (event) => {
    event.stopPropagation();
    if (onPrimaryAction) onPrimaryAction();
  };

  return (
    <div
      className={[
        'stage-card',
        isActive ? 'stage-card--active' : '',
        isCandidate ? 'stage-card--candidate' : '',
      ].join(' ')}
      onClick={onClick}
    >
      <div className="stage-card__header">
        {label && <span className="stage-card__label">{label}</span>}

        {onRemove && (
          <button
            type="button"
            className="stage-card__remove"
            onClick={handleRemove}
            aria-label="Remove stage"
          >
            ×
          </button>
        )}
      </div>

      <div className="stage-card__body">
        <div className="stage-card__route">
          <span className="stage-card__hut stage-card__hut--from">{fromName}</span>
          <span className="stage-card__arrow">→</span>
          <span className="stage-card__hut stage-card__hut--to">{toName}</span>
        </div>

        <div className="stage-card__metrics">
          <span className="stage-card__metric">
            {formatNumber(distanceKm, 1)} km
          </span>
          <span className="stage-card__metric">
            +{formatNumber(dPlus, 0)} m
          </span>
          <span className="stage-card__metric">
            -{formatNumber(dMinus, 0)} m
          </span>
        </div>
      </div>

      {primaryActionLabel && onPrimaryAction && (
        <div className="stage-card__footer">
          <button
            type="button"
            className="stage-card__primary-action"
            onClick={handlePrimaryAction}
          >
            {primaryActionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
