// src/services/api.js
/**
 * Service API centralisé avec gestion d'erreurs
 */
import axios from 'axios';
import { getApiUrl, getAuthHeaders, config } from '../config';

// Instance axios configurée
const apiClient = axios.create({
  baseURL: `${config.apiUrl}/api/${config.apiVersion}`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Intercepteur de réponse pour gérer les erreurs globalement
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'Erreur réseau';
    console.error('API Error:', message, error);
    return Promise.reject({ message, status: error.response?.status });
  }
);

// ===== HUTS API =====

export const hutsApi = {
  /**
   * Liste toutes les cabanes
   */
  async list(params = {}) {
    const { data } = await apiClient.get('/huts/', { params });
    return data;
  },

/**
   * Récupère les trailheads (cabanes accessibles en transports publics)
   */
  async getTrailheads() {
    const response = await apiClient.get('/huts/trailheads');
    return response.data;
  },
  
  
  /**
   * Recherche de cabanes par nom
   */
  async search(query, limit = 20) {
    const { data } = await apiClient.get('/huts/search', {
      params: { query, limit }
    });
    return data;
  },

  /**
   * Détails d'une cabane
   */
  async getById(hutId) {
    const { data } = await apiClient.get(`/huts/${hutId}`);
    return data;
  },

  /**
   * Cabanes atteignables depuis une cabane
   */
  async getReachable(hutId, maxDistanceKm = 35, maxSegments = 2) {
    const { data } = await apiClient.get(`/huts/${hutId}/reachable`, {
      params: {
        max_distance_km: maxDistanceKm,
        max_segments: maxSegments
      }
    });
    return data;
  }
};

// ===== ADMIN API =====

export const adminApi = {
  /**
   * Recherche fuzzy de cabanes (admin)
   */
  async searchHuts(query, limit = 20) {
    const { data } = await apiClient.get('/admin/huts/search', {
      params: { query, limit },
      headers: getAuthHeaders()
    });
    return data;
  },

  /**
   * Recherche OSM via Overpass
   */
  async searchOverpass(query, limit = 20) {
    const { data } = await apiClient.get('/admin/huts/overpass-search', {
      params: { query, limit },
      headers: getAuthHeaders()
    });
    return data;
  },

  /**
   * Importer une cabane depuis OSM
   */
  async importHut(hutData) {
    const { data } = await apiClient.post('/admin/huts/import', hutData, {
      headers: getAuthHeaders()
    });
    return data;
  },

  /**
   * Prévisualiser un segment via ORS
   */
  async previewRoute(fromLat, fromLon, toLat, toLon) {
    const { data } = await apiClient.post(
      '/admin/routes/preview',
      {
        from_lat: fromLat,
        from_lon: fromLon,
        to_lat: toLat,
        to_lon: toLon
      },
      { headers: getAuthHeaders() }
    );
    return data;
  },

  /**
   * Créer un segment LINK entre deux cabanes
   */
  async createLink(linkData) {
    const { data } = await apiClient.post('/admin/links', linkData, {
      headers: getAuthHeaders()
    });
    return data;
  }
};

// Helper pour vérifier l'état de l'API
export const checkHealth = async () => {
  try {
    const { data } = await axios.get(`${config.apiUrl}/health`, { timeout: 5000 });
    return data;
  } catch (error) {
    console.error('Health check failed:', error);
    return null;
  }
};

// ===== EXPORT API =====

export const exportApi = {
  /**
   * Génère un KML pour l'itinéraire et retourne l'URL
   * @param {Object} routeData - Données de l'itinéraire
   * @param {Array} routeData.selectedHuts - Liste des cabanes sélectionnées
   * @param {string} routeData.startDate - Date de départ (YYYY-MM-DD)
   * @param {string} routeData.expeditionName - Nom de l'expédition (optionnel)
   */
  async generateKml(routeData) {
    const { selectedHuts, startDate, expeditionName = 'Expédition Laponie' } = routeData;
    
    // Transformer les données pour l'API
    const huts = selectedHuts.map(hut => ({
      hut_id: String(hut.hut_id || hut.id),  // Convertir en string
      name: hut.name,
      latitude: hut.latitude,
      longitude: hut.longitude,
      country_code: hut.country_code || null,
      is_rest_day: hut.isRestDay || false
    }));
    
    // Construire les segments (entre chaque paire de cabanes)
    const segments = selectedHuts.slice(1).map((hut, index) => ({
      distance_km: hut.total_distance || 0,
      elevation_gain: Math.round(hut.elevation_gain || 0),
      elevation_loss: Math.round(hut.elevation_loss || 0),
      day_index: index + 1
    }));
    
    const { data } = await apiClient.post('/export/kml', {
      huts,
      segments,
      start_date: startDate,
      expedition_name: expeditionName
    });
    
    return data;
  },

  /**
   * Génère un GPX pour l'itinéraire et retourne l'URL
   * @param {Object} routeData - Données de l'itinéraire
   * @param {Array} routeData.selectedHuts - Liste des cabanes sélectionnées
   * @param {string} routeData.startDate - Date de départ (YYYY-MM-DD)
   * @param {string} routeData.expeditionName - Nom de l'expédition (optionnel)
   */
  async generateGpx(routeData) {
    const { selectedHuts, startDate, expeditionName = 'Expédition Laponie' } = routeData;
    
    // Transformer les données pour l'API
    const huts = selectedHuts.map(hut => ({
      hut_id: String(hut.hut_id || hut.id),
      name: hut.name,
      latitude: hut.latitude,
      longitude: hut.longitude,
      country_code: hut.country_code || null,
      is_rest_day: hut.isRestDay || false
    }));
    
    // Construire les segments (entre chaque paire de cabanes)
    const segments = selectedHuts.slice(1).map((hut, index) => ({
      distance_km: hut.total_distance || 0,
      elevation_gain: Math.round(hut.elevation_gain || 0),
      elevation_loss: Math.round(hut.elevation_loss || 0),
      day_index: index + 1
    }));
    
    const { data } = await apiClient.post('/export/gpx', {
      huts,
      segments,
      start_date: startDate,
      expedition_name: expeditionName
    });
    
    return data;
  }
};
