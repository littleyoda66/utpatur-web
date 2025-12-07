// src/components/StageCard.jsx
import React from 'react';
import './StageCard.css';
import { formatNumber } from '../utils/formatNumber';

export function StageCard({
  label,
  fromName,
  via,
  toName,
  distanceKm,
  dplusM,
  dminusM,
  isCandidate = false,
  isActive = false,
  isRest = false,
  onAdd,
  onRemove,
  // nouveau : pour relier au hut_id
  hutId,
  onHoverStart,
  onHoverEnd,
}) {
  const classNames = [
    'stage-card',
    isActive ? 'stage-card--active' : '',
    isCandidate ? 'stage-card--candidate' : '',
    isRest ? 'stage-card--rest' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const hasDistance = distanceKm !== null && distanceKm !== undefined;
  const hasDplus = dplusM !== null && dplusM !== undefined;
  const hasDminus = dminusM !== null && dminusM !== undefined;

  const isClickableCard = isCandidate && typeof onAdd === 'function';

  const handleMouseEnter = () => {
    if (isCandidate && onHoverStart && hutId != null) {
      onHoverStart(hutId);
    }
  };

  const handleMouseLeave = () => {
    if (isCandidate && onHoverEnd) {
      onHoverEnd();
    }
  };

  return (
    <div
      className={classNames}
      onClick={isClickableCard ? () => onAdd() : undefined}
      role={isClickableCard ? 'button' : undefined}
      tabIndex={isClickableCard ? 0 : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="stage-card__header">
        <span className="stage-card__label">{label}</span>
        {onRemove && (
          <button
            type="button"
            className="stage-card__remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Supprimer"
          >
            ×
          </button>
        )}
      </div>

      <div className="stage-card__body">
        <div className="stage-card__route">
          {isCandidate ? (
            <>
              {via && (
                <div className="stage-card__via">
                  via {via}
                </div>
              )}
              <div className="stage-card__route-main">
                <span className="stage-card__arrow">→</span>
                <span
                  className={
                    isRest
                      ? 'stage-card__hut stage-card__hut--rest'
                      : 'stage-card__hut'
                  }
                >
                  {toName}
                </span>
              </div>
            </>
          ) : (
            <>
              {fromName && (
                <span className="stage-card__hut">{fromName}</span>
              )}
              {fromName && <span className="stage-card__arrow">→</span>}
              <span
                className={
                  isRest
                    ? 'stage-card__hut stage-card__hut--rest'
                    : 'stage-card__hut'
                }
              >
                {toName}
              </span>
            </>
          )}
        </div>

        <div className="stage-card__metrics-row">
          <div className="stage-card__metrics">
            <span className="stage-card__metric">
              {hasDistance ? `${formatNumber(distanceKm, 1)} km` : '— km'}
            </span>
            <span className="stage-card__metric">
              {hasDplus ? `+${formatNumber(dplusM, 0)} m` : '+— m'}
            </span>
            <span className="stage-card__metric">
              {hasDminus ? `-${formatNumber(dminusM, 0)} m` : '-— m'}
            </span>
          </div>

          {isCandidate && onAdd && (
            <button
              type="button"
              className="stage-card__link-action"
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
            >
              + Ajouter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
