// src/store/routeStore.js
/**
 * Store Zustand pour la gestion de l'itinéraire
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Marge en degrés (~5.5km)
const BOUNDS_MARGIN = 0.05;

// Bounds par défaut (Laponie)
const DEFAULT_BOUNDS = {
  minLat: 67.5,
  maxLat: 69.0,
  minLng: 17.5,
  maxLng: 20.5
};

/**
 * Calcule les bounds à partir des cabanes
 */
function calculateBounds(selectedHuts, reachableHuts, isRouteClosed) {
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  let hasPoints = false;

  // Cabanes de l'itinéraire
  selectedHuts.forEach(hut => {
    if (hut?.latitude && hut?.longitude) {
      minLat = Math.min(minLat, hut.latitude);
      maxLat = Math.max(maxLat, hut.latitude);
      minLng = Math.min(minLng, hut.longitude);
      maxLng = Math.max(maxLng, hut.longitude);
      hasPoints = true;
    }
  });

  // Cabanes atteignables (seulement si itinéraire ouvert)
  if (!isRouteClosed) {
    reachableHuts.forEach(hut => {
      if (hut?.latitude && hut?.longitude) {
        minLat = Math.min(minLat, hut.latitude);
        maxLat = Math.max(maxLat, hut.latitude);
        minLng = Math.min(minLng, hut.longitude);
        maxLng = Math.max(maxLng, hut.longitude);
        hasPoints = true;
      }
    });
  }

  if (!hasPoints) {
    return DEFAULT_BOUNDS;
  }

  return {
    minLat: minLat - BOUNDS_MARGIN,
    maxLat: maxLat + BOUNDS_MARGIN,
    minLng: minLng - BOUNDS_MARGIN,
    maxLng: maxLng + BOUNDS_MARGIN
  };
}

export const useRouteStore = create(
  devtools(
    (set, get) => ({
      // État
      selectedHuts: [],
      currentRoute: null,
      reachableHuts: [],
      isLoading: false,
      error: null,
      maxDistanceKm: 35,
      maxSegments: 2,
      isRouteClosed: false,
      itineraryCode: null, // Code unique de l'itinéraire sauvegardé
      trailheads: [], // Cache des trailheads avec infos transport
      mapBounds: DEFAULT_BOUNDS, // Bounds pour la carte
      
      // Actions
      
      /**
       * Recalculer les bounds (appelé automatiquement par les autres actions)
       */
      updateBounds: () => set((state) => ({
        mapBounds: calculateBounds(state.selectedHuts, state.reachableHuts, state.isRouteClosed)
      })),
      
      /**
       * Charger les trailheads depuis l'API
       */
      setTrailheads: (trailheads) => set({ trailheads }),
      
      /**
       * Récupérer les infos transport d'une cabane
       */
      getTransportInfo: (hutId) => {
        const { trailheads } = get();
        return trailheads.filter(t => t.hut_id === hutId);
      },
      
      /**
       * Vérifier si une cabane est un trailhead
       */
      isTrailhead: (hutId) => {
        const { trailheads } = get();
        return trailheads.some(t => t.hut_id === hutId);
      },
      
      /**
       * Sélectionner une cabane de départ
       */
      setStartHut: (hut) => set((state) => {
        // Si déjà des cabanes, on demande confirmation
        if (state.selectedHuts.length > 0) {
          const confirmed = window.confirm(
            'Changer la cabane de départ réinitialisera votre itinéraire. Continuer ?'
          );
          if (!confirmed) return state;
        }
        
        const newSelectedHuts = [hut];
        return {
          selectedHuts: newSelectedHuts,
          currentRoute: null,
          reachableHuts: [],
          error: null,
          isRouteClosed: false,
          mapBounds: calculateBounds(newSelectedHuts, [], false)
        };
      }),
      
      /**
       * Ajouter une cabane à l'itinéraire
       * Note: On autorise les boucles et passages multiples
       */
      addHut: (hut, steps = []) => set((state) => {
        // Si l'itinéraire est clos, on ne peut pas ajouter
        if (state.isRouteClosed) return state;
        
        const newSelectedHuts = [...state.selectedHuts, hut];
        
        // Construire la route complète avec les steps (qui contiennent geometry_polyline)
        const newRoute = {
          huts: newSelectedHuts,
          steps: [...(state.currentRoute?.steps || []), ...steps],
          totalDistance: (state.currentRoute?.totalDistance || 0) + 
            steps.reduce((sum, s) => sum + (s.distance_km || 0), 0),
          totalDplus: (state.currentRoute?.totalDplus || 0) + 
            steps.reduce((sum, s) => sum + (s.dplus_m || 0), 0),
          totalDminus: (state.currentRoute?.totalDminus || 0) + 
            steps.reduce((sum, s) => sum + (s.dminus_m || 0), 0),
        };
        
        return {
          selectedHuts: newSelectedHuts,
          currentRoute: newRoute,
          reachableHuts: [],
          error: null,
          mapBounds: calculateBounds(newSelectedHuts, [], state.isRouteClosed)
        };
      }),
      
      /**
       * Retirer la dernière cabane
       */
      removeLastHut: () => set((state) => {
        if (state.selectedHuts.length === 0) return state;
        
        const newSelectedHuts = state.selectedHuts.slice(0, -1);
        
        if (newSelectedHuts.length === 0) {
          return {
            selectedHuts: [],
            currentRoute: null,
            reachableHuts: [],
            error: null,
            isRouteClosed: false,
            mapBounds: DEFAULT_BOUNDS
          };
        }
        
        // Recalculer la route
        return {
          selectedHuts: newSelectedHuts,
          reachableHuts: [],
          error: null,
          isRouteClosed: false,
          mapBounds: calculateBounds(newSelectedHuts, [], false)
        };
      }),
      
      /**
       * Réinitialiser l'itinéraire
       */
      resetRoute: () => set({
        selectedHuts: [],
        currentRoute: null,
        reachableHuts: [],
        error: null,
        isRouteClosed: false,
        itineraryCode: null,
        mapBounds: DEFAULT_BOUNDS
      }),
      
      /**
       * Définir le code de l'itinéraire
       */
      setItineraryCode: (code) => set({ itineraryCode: code }),
      
      /**
       * Clore l'itinéraire
       */
      closeRoute: () => set((state) => ({
        isRouteClosed: true,
        reachableHuts: [],
        mapBounds: calculateBounds(state.selectedHuts, [], true)
      })),
      
      /**
       * Rouvrir l'itinéraire
       */
      reopenRoute: () => set((state) => ({
        isRouteClosed: false,
        mapBounds: calculateBounds(state.selectedHuts, state.reachableHuts, false)
      })),
      
      /**
       * Définir les cabanes atteignables
       */
      setReachableHuts: (huts) => set((state) => ({
        reachableHuts: huts,
        mapBounds: calculateBounds(state.selectedHuts, huts, state.isRouteClosed)
      })),
      
      /**
       * Définir les paramètres de recherche
       */
      setMaxDistance: (distance) => set({ maxDistanceKm: distance }),
      setMaxSegments: (segments) => set({ maxSegments: segments }),
      
      /**
       * Gestion du loading et des erreurs
       */
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      
      /**
       * Exporter l'itinéraire en JSON
       */
      exportRoute: () => {
        const { selectedHuts, currentRoute, isRouteClosed } = get();
        return {
          version: '2.0.0',
          date: new Date().toISOString(),
          huts: selectedHuts,
          route: currentRoute,
          isRouteClosed
        };
      },
      
      /**
       * Calculer les statistiques
       */
      getStats: () => {
        const { selectedHuts, currentRoute } = get();
        
        if (!currentRoute) {
          return {
            days: selectedHuts.length > 0 ? 1 : 0,
            totalDistance: 0,
            totalDplus: 0,
            totalDminus: 0,
            segments: 0
          };
        }
        
        return {
          days: selectedHuts.length,
          totalDistance: currentRoute.totalDistance,
          totalDplus: currentRoute.totalDplus,
          totalDminus: currentRoute.totalDminus,
          segments: currentRoute.steps?.length || 0,
          avgDistance: currentRoute.totalDistance / (selectedHuts.length - 1 || 1)
        };
      },
      
      /**
       * Restaurer un itinéraire complet (depuis un code sauvegardé)
       */
      restoreItinerary: (data) => set((state) => {
        const { huts, segments, steps, code, startDate, maxDistance, maxSegments } = data;
        
        // Les steps sont dans l'ordre : tous les steps pour atteindre hut[1], puis hut[2], etc.
        // On doit les regrouper par cabane de destination dans l'ordre de l'itinéraire
        const allSteps = steps || [];
        let stepIndex = 0;
        
        // Reconstruire selectedHuts avec les infos de segment ET les steps
        const selectedHuts = huts.map((hut, hutIndex) => {
          const segment = hutIndex > 0 ? segments[hutIndex - 1] : null;
          const hutId = String(hut.hut_id);
          
          // Pour la première cabane, pas de steps
          if (hutIndex === 0) {
            return {
              ...hut,
              id: hut.hut_id,
              hut_id: hut.hut_id,
              total_distance: 0,
              elevation_gain: 0,
              elevation_loss: 0,
              isRestDay: hut.is_rest_day || false,
              steps: []
            };
          }
          
          // Collecter les steps jusqu'à atteindre cette cabane (to_hut_id === hutId)
          const hutSteps = [];
          while (stepIndex < allSteps.length) {
            const step = allSteps[stepIndex];
            hutSteps.push(step);
            stepIndex++;
            
            // Si ce step mène à cette cabane, on a fini pour cette cabane
            if (String(step.to_hut_id) === hutId) {
              break;
            }
          }
          
          return {
            ...hut,
            id: hut.hut_id,
            hut_id: hut.hut_id,
            total_distance: segment?.distance_km || 0,
            elevation_gain: segment?.elevation_gain || 0,
            elevation_loss: segment?.elevation_loss || 0,
            isRestDay: hut.is_rest_day || false,
            steps: hutSteps
          };
        });
        
        // Reconstruire currentRoute avec les steps (contenant les polylines)
        const totalDistance = segments.reduce((sum, s) => sum + (s.distance_km || 0), 0);
        const totalDplus = segments.reduce((sum, s) => sum + (s.elevation_gain || 0), 0);
        const totalDminus = segments.reduce((sum, s) => sum + (s.elevation_loss || 0), 0);
        
        const currentRoute = {
          huts: selectedHuts,
          steps: allSteps,
          totalDistance,
          totalDplus,
          totalDminus
        };
        
        return {
          selectedHuts,
          currentRoute,
          reachableHuts: [],
          isRouteClosed: true,
          itineraryCode: code,
          maxDistanceKm: maxDistance || 35,
          maxSegments: maxSegments || 2,
          error: null,
          mapBounds: calculateBounds(selectedHuts, [], true)
        };
      })
    }),
    { name: 'RouteStore' }
  )
);
