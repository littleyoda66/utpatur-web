# Modification UI - Organisation en 3 colonnes

## 📋 Changements demandés

Vous avez demandé de restructurer l'interface pour retrouver l'organisation suivante :

1. ✅ **Charger la liste complète des cabanes** pour la sélection de départ
2. ✅ **Paramètres visibles** au-dessus de la liste des cabanes atteignables  
3. ✅ **Organisation en 3 colonnes** :
   - **Gauche** : Choix des cabanes + paramètres + cabanes atteignables
   - **Centre** : Itinéraire en texte avec liste des jours
   - **Droite** : Carte géographique

## 📁 Fichiers modifiés

### 1. `RouteBuilderPanel.jsx`
Le composant principal a été restructuré avec :

#### Colonne gauche (380px)
- **Section Cabane de départ** :
  - Liste complète des cabanes chargée au démarrage
  - Recherche/filtrage avec le composant `HutSearch`
  - Affichage de la cabane sélectionnée avec bouton de changement
  
- **Section Paramètres** :
  - Distance maximale (slider 0-40 km)
  - Checkbox pour autoriser les segments
  - Toujours visible au-dessus des cabanes atteignables
  
- **Section Cabanes atteignables** :
  - Liste mise à jour automatiquement
  - Utilise le composant `ReachableHutsList` existant
  - États vides explicites

#### Colonne centrale
- **Résumé de l'itinéraire** :
  - Statistiques (jours, distance totale, D+)
  - Grid 3 colonnes pour l'affichage
  
- **Liste des jours** :
  - Carte pour chaque jour avec numéro
  - Affichage des stats (distance, D+, D-)
  - Bouton pour retirer une étape
  - Indication "via" pour les segments intermédiaires
  
- **Bouton de réinitialisation**

#### Colonne droite
- Composant `RouteMap` en pleine hauteur

### 2. `RouteBuilderPanel.css`
Le CSS a été entièrement revu pour supporter la nouvelle structure :

#### Layout principal
```css
.route-builder-3col {
  display: grid;
  grid-template-columns: 380px 1fr 1fr;
  height: calc(100vh - 65px);
}
```

#### Nouvelles classes
- `.column-header` : En-têtes de colonnes avec titre et description
- `.column-content` : Contenu scrollable
- `.section-card` : Cartes pour les différentes sections
- `.parameters-card` : Style spécial pour la section paramètres
- `.itinerary-summary` : Résumé avec grid
- `.day-card` : Cartes pour chaque jour
- Nombreuses classes utilitaires

#### Responsive
- Adaptation pour tablettes (< 1200px)
- Vue mobile simplifiée (< 968px)

## 🚀 Installation

### 1. Remplacer les fichiers existants

```bash
# Dans votre projet utpatur-web
cp RouteBuilderPanel.jsx src/components/
cp RouteBuilderPanel.css src/components/
```

### 2. Vérifier les dépendances

Le composant utilise :
- `HutSearch` (existant)
- `ReachableHutsList` (existant)
- `RouteMap` (existant)
- `RouteSummary` (peut être retiré si non utilisé ailleurs)
- `useRouteStore` (existant)
- `hutsApi` (existant)

### 3. Vérifier l'API

Le code suppose que l'API expose un endpoint pour récupérer toutes les cabanes :

```javascript
await hutsApi.getAllHuts()
```

Si ce endpoint n'existe pas, il faudra l'ajouter dans `services/api.js` :

```javascript
// Dans services/api.js
export const hutsApi = {
  // ... autres méthodes
  
  getAllHuts: async () => {
    const response = await fetch(`${API_BASE_URL}/huts`);
    if (!response.ok) throw new Error('Erreur chargement cabanes');
    return response.json();
  }
};
```

Et dans le backend Python (`huts_router.py`) :

```python
@router.get("/huts")
async def get_all_huts():
    """Récupérer toutes les cabanes"""
    query = """
    MATCH (h:Hut)
    RETURN h {
        .id,
        .name,
        .latitude,
        .longitude,
        .altitude,
        .country,
        .region
    } as hut
    ORDER BY h.name
    """
    
    with driver.session() as session:
        result = session.run(query)
        huts = [record["hut"] for record in result]
        
    return {"huts": huts}
```

## 🎨 Fonctionnalités clés

### Gestion de la cabane de départ
- Chargement de toutes les cabanes au démarrage
- Recherche en temps réel avec `HutSearch`
- Possibilité de changer après sélection

### Paramètres dynamiques
- Slider de distance réactif
- Checkbox pour segments
- Mise à jour automatique des cabanes atteignables

### Itinéraire
- Affichage jour par jour
- Statistiques cumulées
- Suppression par étape (retire l'étape ET toutes les suivantes)
- Indication des segments intermédiaires

### Carte
- Intégration du composant `RouteMap` existant
- Prend toute la hauteur de la colonne

## 🔄 Différences avec l'ancienne version

### Ajouts
- ✅ Liste complète des cabanes au démarrage
- ✅ Paramètres toujours visibles
- ✅ Organisation claire en 3 colonnes
- ✅ Meilleure hiérarchie visuelle
- ✅ En-têtes de colonnes descriptifs

### Conservé
- ✅ Composants existants réutilisés
- ✅ Store Zustand intact
- ✅ API calls identiques
- ✅ Logique métier inchangée

### Retiré
- Basculement entre étapes (workflow linéarisé)
- Modal de paramètres (intégré directement)

## 🐛 Points d'attention

1. **Performance** : Le chargement de toutes les cabanes se fait au démarrage. Si vous avez beaucoup de cabanes (>1000), envisagez :
   - Pagination
   - Recherche côté serveur
   - Virtualisation de la liste

2. **Responsive** : Le design est optimisé pour desktop (>1200px). Sur mobile, seule la colonne gauche est visible.

3. **État vide** : Des messages explicites sont affichés quand aucune cabane n'est sélectionnée.

## 📝 Prochaines étapes possibles

- [ ] Ajouter la gestion des jours de repos
- [ ] Permettre le réordonnancement des jours (drag & drop)
- [ ] Exporter l'itinéraire (PDF, GPX)
- [ ] Sauvegarder/charger des itinéraires
- [ ] Améliorer le responsive mobile

## ✅ Checklist de déploiement

- [ ] Remplacer `RouteBuilderPanel.jsx`
- [ ] Remplacer `RouteBuilderPanel.css`
- [ ] Ajouter endpoint `/huts` si nécessaire
- [ ] Tester le chargement initial
- [ ] Vérifier la sélection de cabane
- [ ] Tester l'ajout d'étapes
- [ ] Vérifier la suppression d'étapes
- [ ] Tester le changement de paramètres
- [ ] Valider l'affichage de la carte

---

Si vous avez des questions ou besoin d'ajustements, n'hésitez pas ! 🚀
