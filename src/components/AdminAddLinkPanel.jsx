// src/components/AdminAddLinkPanel.jsx
import React, { useState, useEffect } from 'react';
import {
  adminFuzzySearchHuts,
  adminPreviewRoute,
  adminCreateLink,
  adminOverpassSearchHuts,
  getAdminToken,
  setAdminToken,
  adminImportHutFromOverpass,
} from '../api/utpaturApi.js';
import { formatNumber } from '../utils/formatNumber';

const cardStyle = {
  borderRadius: '0.75rem',
  border: '1px solid #e5e7eb',
  padding: '0.75rem 1rem',
  background: '#ffffff',
  marginBottom: '1rem',
};

export function AdminAddLinkPanel() {
  // Token admin
  const [tokenInput, setTokenInput] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [tokenMessage, setTokenMessage] = useState('');

  // Saisie des noms de cabane
  const [fromName, setFromName] = useState('');
  const [toName, setToName] = useState('');

  // Candidats AuraDB
  const [fromCandidates, setFromCandidates] = useState([]);
  const [toCandidates, setToCandidates] = useState([]);
  const [fromSelectedId, setFromSelectedId] = useState(null);
  const [toSelectedId, setToSelectedId] = useState(null);

  // Candidats Overpass
  const [fromOverpassCandidates, setFromOverpassCandidates] = useState([]);
  const [toOverpassCandidates, setToOverpassCandidates] = useState([]);
  const [fromOverpassSelectedId, setFromOverpassSelectedId] = useState(null);
  const [toOverpassSelectedId, setToOverpassSelectedId] = useState(null);

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Prévisualisation ORS
  const [distanceKm, setDistanceKm] = useState(null);
  const [dplusM, setDplusM] = useState(null);
  const [dminusM, setDminusM] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');

  // Création de segment
  const [bidirectional, setBidirectional] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Charger le token déjà stocké (si présent)
  useEffect(() => {
    const saved = getAdminToken();
    if (saved) {
      setTokenInput(saved);
      setHasToken(true);
      setTokenMessage('Token admin chargé depuis le navigateur.');
    }
  }, []);

  const handleSaveToken = () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setAdminToken(null);
      setHasToken(false);
      setTokenMessage('Token supprimé.');
      return;
    }
    setAdminToken(trimmed);
    setHasToken(true);
    setTokenMessage('Token admin enregistré localement (localStorage).');
  };

  const handleSearchCabins = async () => {
    setSearchError('');
    setSuccessMessage('');
    setPreviewError('');
    setCreateError('');
    setDistanceKm(null);
    setDplusM(null);
    setDminusM(null);
    setFromOverpassCandidates([]);
    setToOverpassCandidates([]);
    setFromOverpassSelectedId(null);
    setToOverpassSelectedId(null);
    setHasSearched(false);

    const qFrom = fromName.trim();
    const qTo = toName.trim();

    if (qFrom.length < 2 || qTo.length < 2) {
      setSearchError(
        'Merci de saisir au moins 2 caractères pour chaque nom de cabane.',
      );
      return;
    }

    if (!getAdminToken()) {
      setSearchError('Token admin requis pour utiliser les fonctions admin.');
      return;
    }

    setIsSearching(true);

    try {
      const [fromRes, toRes] = await Promise.all([
        adminFuzzySearchHuts(qFrom),
        adminFuzzySearchHuts(qTo),
      ]);

      setFromCandidates(fromRes);
      setToCandidates(toRes);

      if (fromRes.length > 0) {
        setFromSelectedId(fromRes[0].hut_id);
      } else {
        setFromSelectedId(null);
      }

      if (toRes.length > 0) {
        setToSelectedId(toRes[0].hut_id);
      } else {
        setToSelectedId(null);
      }

      let anyMissing = false;

      if (fromRes.length === 0) {
        anyMissing = true;
        try {
          const osmFrom = await adminOverpassSearchHuts(qFrom);
          setFromOverpassCandidates(osmFrom);
          if (osmFrom.length > 0) {
            setFromOverpassSelectedId(osmFrom[0].osm_id);
          }
        } catch (err) {
          console.error(err);
          setFromOverpassCandidates([]);
        }
      }

      if (toRes.length === 0) {
        anyMissing = true;
        try {
          const osmTo = await adminOverpassSearchHuts(qTo);
          setToOverpassCandidates(osmTo);
          if (osmTo.length > 0) {
            setToOverpassSelectedId(osmTo[0].osm_id);
          }
        } catch (err) {
          console.error(err);
          setToOverpassCandidates([]);
        }
      }

      if (anyMissing) {
        setSearchError(
          "Attention : au moins une des deux cabanes n'a pas été trouvée dans la base. Des résultats Overpass (OSM) sont proposés à titre indicatif.",
        );
      }
    } catch (err) {
      console.error(err);
      setSearchError(
        err.message || 'Erreur lors de la recherche des cabanes.',
      );
      setFromCandidates([]);
      setToCandidates([]);
      setFromOverpassCandidates([]);
      setToOverpassCandidates([]);
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  // Sélections actuelles (AuraDB & Overpass)
  const selectedFromHut = fromCandidates.find(
    (h) => h.hut_id === fromSelectedId,
  );
  const selectedToHut = toCandidates.find((h) => h.hut_id === toSelectedId);

  const selectedFromOverpass = fromOverpassCandidates.find(
    (c) => c.osm_id === fromOverpassSelectedId,
  );
  const selectedToOverpass = toOverpassCandidates.find(
    (c) => c.osm_id === toOverpassSelectedId,
  );

  // Pour la prévisualisation ORS : on accepte AuraDB OU Overpass
  const selectedFromPoint = selectedFromHut ?? selectedFromOverpass;
  const selectedToPoint = selectedToHut ?? selectedToOverpass;
  const canPreviewRoute = !!selectedFromPoint && !!selectedToPoint;

  // Pour la création de segment : il faut 2 cabanes AuraDB
  const haveBothAuraHuts = !!selectedFromHut && !!selectedToHut;

  const handlePreviewRoute = async () => {
    setPreviewError('');
    setSuccessMessage('');
    setCreateError('');

    if (!selectedFromPoint || !selectedToPoint) {
      setPreviewError(
        'Merci de sélectionner une cabane de départ et une cabane d’arrivée (dans la base ou via Overpass) pour prévisualiser le segment.',
      );
      return;
    }

    const { latitude: fromLat, longitude: fromLon } = selectedFromPoint;
    const { latitude: toLat, longitude: toLon } = selectedToPoint;

    if (
      fromLat == null ||
      fromLon == null ||
      toLat == null ||
      toLon == null
    ) {
      setPreviewError(
        'Les coordonnées (lat/lon) de ces cabanes ne sont pas complètes.',
      );
      return;
    }

    setIsPreviewing(true);

    try {
      const result = await adminPreviewRoute(fromLat, fromLon, toLat, toLon);

      setDistanceKm(result.distance_km);
      setDplusM(result.dplus_m);
      setDminusM(result.dminus_m);
    } catch (err) {
      console.error(err);
      setPreviewError(err.message || "Erreur lors de l'appel à ORS.");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCreateLink = async () => {
    setCreateError('');
    setSuccessMessage('');

    if (!haveBothAuraHuts) {
      setCreateError(
        'Pour créer le segment dans la base, il faut sélectionner une cabane de départ et une cabane d’arrivée présentes dans AuraDB.',
      );
      return;
    }

    if (
      distanceKm == null ||
      Number.isNaN(Number(distanceKm)) ||
      dplusM == null ||
      Number.isNaN(Number(dplusM)) ||
      dminusM == null ||
      Number.isNaN(Number(dminusM))
    ) {
      setCreateError(
        'Merci de vérifier les valeurs distance / D+ / D- avant de créer le segment.',
      );
      return;
    }

    const payload = {
      from_hut_id: selectedFromHut.hut_id,
      to_hut_id: selectedToHut.hut_id,
      distance_km: Number(distanceKm),
      dplus_m: Number(dplusM),
      dminus_m: Number(dminusM),
      bidirectional,
    };

    setIsCreating(true);

    try {
      const res = await adminCreateLink(payload);
      console.log('CreateLinkResponse', res);
      setSuccessMessage(
        `Segment créé : ${selectedFromHut.name} → ${selectedToHut.name} ` +
          `(aller${bidirectional ? ' + retour' : ''}).`,
      );
    } catch (err) {
      console.error(err);
      setCreateError(
        err.message || 'Erreur lors de la création du segment dans AuraDB.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleImportFromOverpass = async (side) => {
    setCreateError('');
    setSuccessMessage('');

    const candidate =
      side === 'from' ? selectedFromOverpass : selectedToOverpass;

    if (!candidate) {
      setCreateError(
        "Aucune cabane Overpass sélectionnée à importer pour ce côté.",
      );
      return;
    }

    try {
      const newHut = await adminImportHutFromOverpass({
        name: candidate.name,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        country_code: candidate.country_code ?? null,
        osm_id: candidate.osm_id,
        raw_tags: candidate.raw_tags ?? {},
      });

      if (side === 'from') {
        setFromCandidates((prev) => [...prev, newHut]);
        setFromSelectedId(newHut.hut_id);
      } else {
        setToCandidates((prev) => [...prev, newHut]);
        setToSelectedId(newHut.hut_id);
      }

      setSuccessMessage(
        `Cabane importée dans AuraDB : ${newHut.name} (id ${newHut.hut_id}).`,
      );
    } catch (err) {
      console.error(err);
      setCreateError(
        err.message ||
          "Erreur lors de l'import de la cabane depuis Overpass vers AuraDB.",
      );
    }
  };

  // Affichage d'un candidat Overpass avec bouton radio + liens
  const renderOverpassItem = (c, group) => {
    const osmUrl = `https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}&zoom=15`;
    const websiteRaw = c.raw_tags?.website;
    const websiteUrl =
      websiteRaw && websiteRaw.startsWith('http')
        ? websiteRaw
        : websiteRaw
        ? `https://${websiteRaw}`
        : null;

    const checked =
      group === 'from'
        ? fromOverpassSelectedId === c.osm_id
        : toOverpassSelectedId === c.osm_id;

    const onChange = () => {
      if (group === 'from') {
        setFromOverpassSelectedId(c.osm_id);
      } else {
        setToOverpassSelectedId(c.osm_id);
      }
    };

    return (
      <li key={`${group}-${c.osm_id}`} style={{ marginBottom: '0.25rem' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.4rem',
            cursor: 'pointer',
          }}
        >
          <input
            type="radio"
            name={group === 'from' ? 'from-overpass' : 'to-overpass'}
            checked={checked}
            onChange={onChange}
            style={{ marginTop: '0.2rem' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
            <span>
              {c.name}{' '}
              <span style={{ color: '#9ca3af' }}>
                ({c.latitude.toFixed(4)}, {c.longitude.toFixed(4)})
              </span>
            </span>
            <div style={{ fontSize: '0.75rem' }}>
              <a
                href={osmUrl}
                target="_blank"
                rel="noreferrer"
                style={{ marginRight: '0.5rem' }}
              >
                Voir sur OSM
              </a>
              {websiteUrl && (
                <a href={websiteUrl} target="_blank" rel="noreferrer">
                  Site web
                </a>
              )}
            </div>
          </div>
        </label>
      </li>
    );
  };

  return (
    <div style={{ padding: '1.5rem 0' }}>
      <h2 style={{ marginBottom: '1rem' }}>Admin — Ajouter un segment</h2>

      {/* 1. Accès admin */}
      <section style={cardStyle}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          1. Accès admin
        </h3>
        <p
          style={{
            fontSize: '0.8rem',
            color: '#6b7280',
            marginBottom: '0.5rem',
          }}
        >
          Saisis le <strong>token admin</strong> défini côté backend
          (variable d’environnement <code>ADMIN_TOKEN</code>).
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="password"
            placeholder="Token admin"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            style={{
              flex: 1,
              padding: '0.35rem 0.5rem',
              fontSize: '0.85rem',
              borderRadius: '0.5rem',
              border: '1px solid #d1d5db',
            }}
          />
          <button
            type="button"
            onClick={handleSaveToken}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              borderRadius: '0.5rem',
              border: '1px solid #d1d5db',
              background: '#f3f4f6',
              cursor: 'pointer',
            }}
          >
            Enregistrer
          </button>
        </div>

        {tokenMessage && (
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            {tokenMessage}
          </div>
        )}
      </section>

      {/* 2. Choisir les cabanes */}
      <section style={cardStyle}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          2. Choisir les cabanes à relier
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#6b7280',
                marginBottom: '0.25rem',
              }}
            >
              Cabane de départ (nom approximatif)
            </div>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Ex: Unna Allakas"
              style={{
                width: '100%',
                padding: '0.35rem 0.5rem',
                fontSize: '0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
              }}
            />
          </div>

          <div>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#6b7280',
                marginBottom: '0.25rem',
              }}
            >
              Cabane d’arrivée (nom approximatif)
            </div>
            <input
              type="text"
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              placeholder="Ex: Alesjaure"
              style={{
                width: '100%',
                padding: '0.35rem 0.5rem',
                fontSize: '0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
              }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSearchCabins}
          disabled={!hasToken || isSearching}
          style={{
            borderRadius: '999px',
            border: 'none',
            padding: '0.4rem 0.9rem',
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: hasToken && !isSearching ? 'pointer' : 'default',
            background: hasToken ? '#2563eb' : '#e5e7eb',
            color: hasToken ? '#ffffff' : '#9ca3af',
          }}
        >
          {isSearching ? 'Recherche en cours…' : 'Chercher dans la base'}
        </button>

        {searchError && (
          <div
            style={{
              fontSize: '0.8rem',
              color: '#b91c1c',
              marginTop: '0.5rem',
            }}
          >
            {searchError}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            marginTop: '0.75rem',
          }}
        >
          {/* Candidats départ AuraDB */}
          <div>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#6b7280',
                marginBottom: '0.25rem',
              }}
            >
              Cabanes de départ (base AuraDB)
            </div>
            {fromCandidates.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                Aucune cabane trouvée dans la base.
              </div>
            ) : (
              <div
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  padding: '0.35rem 0.4rem',
                }}
              >
                {fromCandidates.map((hut) => (
                  <label
                    key={hut.hut_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.8rem',
                      padding: '0.15rem 0.25rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="from-hut"
                      value={hut.hut_id}
                      checked={fromSelectedId === hut.hut_id}
                      onChange={() => setFromSelectedId(hut.hut_id)}
                    />
                    <span>
                      {hut.name}
                      {hut.country_code && (
                        <span style={{ color: '#9ca3af' }}>
                          {' '}
                          · {hut.country_code}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {hasSearched && (
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#6b7280',
                  marginTop: '0.5rem',
                }}
              >
                <div style={{ marginBottom: '0.25rem' }}>
                  Cabanes trouvées dans OSM (Overpass, non encore dans la base) :
                </div>
                {fromOverpassCandidates.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    Aucune cabane trouvée dans OSM pour cette recherche.
                  </div>
                ) : (
                  <>
                    <ul style={{ paddingLeft: '1rem', margin: 0 }}>
                      {fromOverpassCandidates.map((c) =>
                        renderOverpassItem(c, 'from'),
                      )}
                    </ul>
                    {selectedFromOverpass && (
                      <button
                        type="button"
                        onClick={() => handleImportFromOverpass('from')}
                        style={{
                          marginTop: '0.35rem',
                          borderRadius: '999px',
                          border: '1px solid #d1d5db',
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.75rem',
                          background: '#f9fafb',
                          cursor: 'pointer',
                        }}
                      >
                        Importer la cabane sélectionnée dans AuraDB
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Candidats arrivée AuraDB */}
          <div>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#6b7280',
                marginBottom: '0.25rem',
              }}
            >
              Cabanes d’arrivée (base AuraDB)
            </div>
            {toCandidates.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                Aucune cabane trouvée dans la base.
              </div>
            ) : (
              <div
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  padding: '0.35rem 0.4rem',
                }}
              >
                {toCandidates.map((hut) => (
                  <label
                    key={hut.hut_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.8rem',
                      padding: '0.15rem 0.25rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="to-hut"
                      value={hut.hut_id}
                      checked={toSelectedId === hut.hut_id}
                      onChange={() => setToSelectedId(hut.hut_id)}
                    />
                    <span>
                      {hut.name}
                      {hut.country_code && (
                        <span style={{ color: '#9ca3af' }}>
                          {' '}
                          · {hut.country_code}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {hasSearched && (
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#6b7280',
                  marginTop: '0.5rem',
                }}
              >
                <div style={{ marginBottom: '0.25rem' }}>
                  Cabanes trouvées dans OSM (Overpass, non encore dans la base) :
                </div>
                {toOverpassCandidates.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    Aucune cabane trouvée dans OSM pour cette recherche.
                  </div>
                ) : (
                  <>
                    <ul style={{ paddingLeft: '1rem', margin: 0 }}>
                      {toOverpassCandidates.map((c) =>
                        renderOverpassItem(c, 'to'),
                      )}
                    </ul>
                    {selectedToOverpass && (
                      <button
                        type="button"
                        onClick={() => handleImportFromOverpass('to')}
                        style={{
                          marginTop: '0.35rem',
                          borderRadius: '999px',
                          border: '1px solid #d1d5db',
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.75rem',
                          background: '#f9fafb',
                          cursor: 'pointer',
                        }}
                      >
                        Importer la cabane sélectionnée dans AuraDB
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. ORS + création du segment */}
      <section style={cardStyle}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          3. Proposer le segment et le créer
        </h3>

        <p
          style={{
            fontSize: '0.8rem',
            color: '#6b7280',
            marginBottom: '0.5rem',
          }}
        >
          OpenRouteService sera utilisé pour proposer une distance et un D+ / D-,
          que tu pourras ensuite ajuster avant de créer le segment dans AuraDB.
          Pour l’instant, la création de segment ne fonctionne qu’avec des
          cabanes déjà présentes dans la base (candidats AuraDB, pas Overpass).
        </p>

        <button
          type="button"
          onClick={handlePreviewRoute}
          disabled={!canPreviewRoute || isPreviewing}
          style={{
            borderRadius: '999px',
            border: 'none',
            padding: '0.4rem 0.9rem',
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: canPreviewRoute && !isPreviewing ? 'pointer' : 'default',
            background: canPreviewRoute ? '#2563eb' : '#e5e7eb',
            color: canPreviewRoute ? '#ffffff' : '#9ca3af',
            marginBottom: '0.75rem',
          }}
        >
          {isPreviewing
            ? 'Demande à ORS en cours…'
            : 'Proposer les valeurs (OpenRouteService)'}
        </button>

        {previewError && (
          <div
            style={{
              fontSize: '0.8rem',
              color: '#b91c1c',
              marginBottom: '0.75rem',
            }}
          >
            {previewError}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#6b7280',
                marginBottom: '0.25rem',
              }}
            >
              Distance (km)
            </div>
            <input
              type="number"
              step="0.1"
              value={distanceKm ?? ''}
              onChange={(e) =>
                setDistanceKm(
                  e.target.value === '' ? null : Number(e.target.value),
                )
              }
              style={{
                width: '100%',
                padding: '0.35rem 0.5rem',
                fontSize: '0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
              }}
            />
            {distanceKm != null && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  marginTop: '0.25rem',
                }}
              >
                {formatNumber(distanceKm, 1)} km
              </div>
            )}
          </div>

          <div>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#6b7280',
                marginBottom: '0.25rem',
              }}
            >
              D+ (m)
            </div>
            <input
              type="number"
              step="1"
              value={dplusM ?? ''}
              onChange={(e) =>
                setDplusM(
                  e.target.value === '' ? null : Number(e.target.value),
                )
              }
              style={{
                width: '100%',
                padding: '0.35rem 0.5rem',
                fontSize: '0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
              }}
            />
            {dplusM != null && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  marginTop: '0.25rem',
                }}
              >
                {formatNumber(dplusM, 0)} m
              </div>
            )}
          </div>

          <div>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#6b7280',
                marginBottom: '0.25rem',
              }}
            >
              D- (m)
            </div>
            <input
              type="number"
              step="1"
              value={dminusM ?? ''}
              onChange={(e) =>
                setDminusM(
                  e.target.value === '' ? null : Number(e.target.value),
                )
              }
              style={{
                width: '100%',
                padding: '0.35rem 0.5rem',
                fontSize: '0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
              }}
            />
            {dminusM != null && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  marginTop: '0.25rem',
                }}
              >
                {formatNumber(dminusM, 0)} m
              </div>
            )}
          </div>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.8rem',
            marginBottom: '0.75rem',
          }}
        >
          <input
            type="checkbox"
            checked={bidirectional}
            onChange={(e) => setBidirectional(e.target.checked)}
          />
          <span>Créer aussi le segment dans le sens inverse</span>
        </label>

        <button
          type="button"
          onClick={handleCreateLink}
          disabled={isCreating}
          style={{
            borderRadius: '999px',
            border: 'none',
            padding: '0.4rem 0.9rem',
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: !isCreating ? 'pointer' : 'default',
            background: '#16a34a',
            color: '#ffffff',
          }}
        >
          {isCreating ? 'Création en cours…' : 'Créer le segment (LINK)'}
        </button>

        {createError && (
          <div
            style={{
              fontSize: '0.8rem',
              color: '#b91c1c',
              marginTop: '0.5rem',
            }}
          >
            {createError}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              fontSize: '0.8rem',
              color: '#15803d',
              marginTop: '0.5rem',
            }}
          >
            {successMessage}
          </div>
        )}
      </section>
    </div>
  );
}
