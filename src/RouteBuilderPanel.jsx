import { StageCard } from './components/StageCard';

function RouteBuilderPanel() {
  return (
    <div>
      <h2>Itinéraire en cours</h2>

      <StageCard
        label="Jour 1"
        fromName="Unna Allakas Fjällstuga"
        toName="Alesjaurestugorna"
        distanceKm={18.7}
        dPlus={520}
        dMinus={430}
        isActive
        onClick={() => console.log('survol / clic pour surligner sur la carte')}
      />
    </div>
  );
}
