// src/store/routeStore.js
/**
 * Store Zustand pour la gestion de l'itinéraire
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

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
      
      // Actions
      
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
        
        return {
          selectedHuts: [hut],
          currentRoute: null,
          reachableHuts: [],
          error: null
        };
      }),
      
      /**
       * Ajouter une cabane à l'itinéraire
       * Note: On autorise les boucles et passages multiples
       */
      addHut: (hut, steps = []) => set((state) => {
        // Plus de vérification de doublon - on autorise les boucles
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
          error: null
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
            error: null
          };
        }
        
        // Recalculer la route
        // TODO: implémenter le recalcul correct
        return {
          selectedHuts: newSelectedHuts,
          reachableHuts: [],
          error: null
        };
      }),
      
      /**
       * Réinitialiser l'itinéraire
       */
      resetRoute: () => set({
        selectedHuts: [],
        currentRoute: null,
        reachableHuts: [],
        error: null
      }),
      
      /**
       * Définir les cabanes atteignables
       */
      setReachableHuts: (huts) => set({ reachableHuts: huts }),
      
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
        const { selectedHuts, currentRoute } = get();
        return {
          version: '2.0.0',
          date: new Date().toISOString(),
          huts: selectedHuts,
          route: currentRoute
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
      }
    }),
    { name: 'RouteStore' }
  )
);
