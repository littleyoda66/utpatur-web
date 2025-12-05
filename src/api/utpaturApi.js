// src/api/utpaturApi.js

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const ADMIN_TOKEN_KEY = 'utpatur_admin_token';

// ---------------------------------------------------------
// Helpers généraux
// ---------------------------------------------------------

async function handleJsonResponse(resp) {
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Erreur API (HTTP ${resp.status}): ${text}`);
  }
  return await resp.json();
}

// ---------------------------------------------------------
// Token admin (stocké dans localStorage)
// ---------------------------------------------------------

export function getAdminToken() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token) {
  if (typeof window === 'undefined') return;
  try {
    if (!token) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    } else {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
    }
  } catch {
    // on ignore les erreurs de localStorage
  }
}

function buildAdminHeaders() {
  const token = getAdminToken();
  if (!token) {
    throw new Error('Token admin manquant');
  }
  return {
    'Content-Type': 'application/json',
    'x-admin-token': token,
  };
}

// ---------------------------------------------------------
// API publique "huts" (utilisée par l’appli principale)
// ---------------------------------------------------------

/**
 * Récupère la liste de toutes les cabanes.
 * GET /huts
 */
export async function fetchHuts() {
  const resp = await fetch(`${API_BASE_URL}/huts`);
  return await handleJsonResponse(resp);
}

// Alias au cas où certains composants utilisent getHuts()
export async function getHuts() {
  return fetchHuts();
}

/**
 * Récupère les cabanes atteignables depuis une cabane donnée.
 * GET /huts/{hut_id}/reachable?max_distance_km=...&max_segments=...
 */
export async function fetchReachableHuts(
  hutId,
  {
    maxDistanceKm,
    maxSegments,
  } = {},
) {
  const params = new URLSearchParams();
  if (maxDistanceKm != null) {
    params.set('max_distance_km', String(maxDistanceKm));
  }
  if (maxSegments != null) {
    params.set('max_segments', String(maxSegments));
  }

  const resp = await fetch(
    `${API_BASE_URL}/huts/${hutId}/reachable?${params.toString()}`,
  );
  return await handleJsonResponse(resp);
}

// Alias plus simple pour certains composants
export async function getReachableHuts(hutId, maxDistanceKm, maxSegments) {
  return fetchReachableHuts(hutId, { maxDistanceKm, maxSegments });
}

// ---------------------------------------------------------
// API admin : recherche de cabanes dans AuraDB
// ---------------------------------------------------------

/**
 * Fuzzy-search des cabanes dans AuraDB.
 * GET /admin/huts/fuzzy-search?query=...
 */
export async function adminFuzzySearchHuts(query, limit = 20) {
  const headers = buildAdminHeaders();
  const params = new URLSearchParams();
  params.set('query', query);
  params.set('limit', String(limit));

  const resp = await fetch(
    `${API_BASE_URL}/admin/huts/fuzzy-search?${params.toString()}`,
    {
      method: 'GET',
      headers,
    },
  );

  return await handleJsonResponse(resp);
}

/**
 * Recherche de cabanes / hébergements dans OSM via Overpass (Laponie).
 * GET /admin/huts/overpass-search?query=...
 */
export async function adminOverpassSearchHuts(query, limit = 20) {
  const headers = buildAdminHeaders();
  const params = new URLSearchParams();
  params.set('query', query);
  params.set('limit', String(limit));

  const resp = await fetch(
    `${API_BASE_URL}/admin/huts/overpass-search?${params.toString()}`,
    {
      method: 'GET',
      headers,
    },
  );

  return await handleJsonResponse(resp);
}

// ---------------------------------------------------------
// API admin : import d’une cabane Overpass → AuraDB
// ---------------------------------------------------------

/**
 * Crée un node Hut dans AuraDB à partir d’un résultat Overpass.
 * POST /admin/huts/import-from-overpass
 *
 * payload attendu :
 * {
 *   name, latitude, longitude,
 *   country_code, osm_id, raw_tags
 * }
 */
export async function adminImportHutFromOverpass(payload) {
  const headers = buildAdminHeaders();

  const resp = await fetch(
    `${API_BASE_URL}/admin/huts/import-from-overpass`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    },
  );

  return await handleJsonResponse(resp);
}

// ---------------------------------------------------------
// API admin : prévisualisation de segment via ORS
// ---------------------------------------------------------

/**
 * Utilise OpenRouteService pour proposer distance_km, dplus_m, dminus_m
 * entre deux points (lat/lon).
 * POST /admin/links/preview-route
 */
export async function adminPreviewRoute(
  fromLat,
  fromLon,
  toLat,
  toLon,
) {
  const headers = buildAdminHeaders();

  const resp = await fetch(
    `${API_BASE_URL}/admin/links/preview-route`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from_lat: fromLat,
        from_lon: fromLon,
        to_lat: toLat,
        to_lon: toLon,
      }),
    },
  );

  return await handleJsonResponse(resp);
}

// ---------------------------------------------------------
// API admin : création de segment LINK entre deux cabanes AuraDB
// ---------------------------------------------------------

/**
 * Crée un segment LINK entre deux cabanes AuraDB.
 * POST /admin/links
 *
 * payload :
 * {
 *   from_hut_id,
 *   to_hut_id,
 *   distance_km,
 *   dplus_m,
 *   dminus_m,
 *   bidirectional
 * }
 */
export async function adminCreateLink(payload) {
  const headers = buildAdminHeaders();

  const resp = await fetch(`${API_BASE_URL}/admin/links`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  return await handleJsonResponse(resp);
}
