// src/components/SchematicMap.jsx
import React from 'react';
import { formatNumber } from '../utils/formatNumber';
import './SchematicMap.css';

/**
 * Carte schématique verticale de l’itinéraire.
 *
 * Nouveau modèle :
 *   - days: [
 *       {
 *         id,
 *         dayIndex,
 *         hut: { name, ... },
 *         isRest?: boolean,
 *         segmentFromPrevious?: { distanceKm, dplusM, dminusM },
 *       },
 *       ...
 *     ]
 *
 * Compat : on accepte aussi encore une prop `route` qui joue le même rôle.
 */
export function SchematicMap({ days, route, onRemoveDay }) {
  const stages = days || route || [];

  if (!stages || stages.length === 0) {
    return (
      <div className="schematic-map schematic-map--empty">
        Ajoute au moins une journée pour voir la carte schématique.
      </div>
    );
  }

  const width = 260;
  const stepY = 70;
  const marginTop = 30;
  const height = marginTop + stepY * (stages.length - 1) + 40;

  return (
    <div className="schematic-map">
      <svg
        className="schematic-map__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Carte schématique de l’itinéraire"
      >
        {stages.map((day, index) => {
          const x = 70;
          const y = marginTop + index * stepY;
          const isLast = index === stages.length - 1;
          const isRest =
            day.isRest === true || day.isRestDay === true || !day.segmentFromPrevious;

          const elements = [];

          // Segment depuis le jour précédent
          if (index > 0) {
            const prevY = marginTop + (index - 1) * stepY;
            const lineColor = isLast ? '#2563eb' : '#d1d5db';
            const lineWidth = isLast ? 3 : 2;

            elements.push(
              <line
                key={`line-${day.id}`}
                x1={x}
                y1={prevY}
                x2={x}
                y2={y}
                stroke={lineColor}
                strokeWidth={lineWidth}
                strokeLinecap="round"
              />,
            );

            const midY = (prevY + y) / 2;

            // Données du segment (distance, D+, D-)
            const segment = day.segmentFromPrevious || {};
            const distanceKm =
              typeof segment.distanceKm === 'number'
                ? segment.distanceKm
                : day.distanceKm;
            const dPlus =
              typeof segment.dplusM === 'number'
                ? segment.dplusM
                : segment.dPlus ?? day.dPlus;
            const dMinus =
              typeof segment.dminusM === 'number'
                ? segment.dminusM
                : segment.dMinus ?? day.dMinus;

            elements.push(
              <text
                key={`metrics-${day.id}`}
                x={x + 16}
                y={midY + 4}
                className="schematic-map__metrics-label"
              >
                {isRest
                  ? 'Jour de repos'
                  : `${formatNumber(distanceKm, 1)} km · +${formatNumber(
                      dPlus || 0,
                      0,
                    )} / -${formatNumber(dMinus || 0, 0)}`}
              </text>,
            );
          }

          elements.push(
            <NodeAndLabel
              key={`node-${day.id}`}
              x={x}
              y={y}
              day={day}
              index={index}
              isLast={isLast}
              isRest={isRest}
              onRemoveDay={onRemoveDay}
            />,
          );

          return <g key={`group-${day.id}`}>{elements}</g>;
        })}
      </svg>
    </div>
  );
}

function NodeAndLabel({ x, y, day, index, isLast, isRest, onRemoveDay }) {
  const radius = 7;
  const strokeColor = isLast ? '#2563eb' : '#9ca3af';
  const fillColor = isRest ? '#f9fafb' : isLast ? '#2563eb' : '#ffffff';

  const dayNumber =
    typeof day.dayIndex === 'number' ? day.dayIndex : index; // Jour 0, 1, 2...

  const hutName = day.hut?.name || day.toName || day.name || 'Cabane';

  return (
    <>
      <circle
        cx={x}
        cy={y}
        r={radius}
        stroke={strokeColor}
        strokeWidth={2}
        fill={fillColor}
      />

      <text
        x={x - 30}
        y={y - 14}
        textAnchor="end"
        className="schematic-map__day-label"
      >
        Jour {dayNumber}
        {day.isRest && ' · repos'}
      </text>

      <text
        x={x + 16}
        y={y + 2}
        className="schematic-map__cabane-label"
      >
        {hutName}
      </text>

      {onRemoveDay && (
        <text
          x={x + 160}
          y={y + 4}
          className="schematic-map__delete"
          onClick={() => onRemoveDay(index)}
        >
          ×
        </text>
      )}
    </>
  );
}
