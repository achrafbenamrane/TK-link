'use client';

/**
 * LES AVIS — CDC V1.1 (Utilisateur > Points) : « après une commande terminée, notation du
 * commerçant par étoiles et tags rapides, sans texte libre ; la moyenne s'affiche sur la
 * vitrine du commerçant ».
 *
 * Sans texte libre, il n'y a rien à modérer : le commerçant voit une moyenne et les tags qui
 * reviennent, pas des commentaires. Les tags sont ceux de l'app (`shop/lib/rating.ts`) — le web et
 * l'app doivent proposer exactement les mêmes.
 */
export const RATING_TAGS = [
  'Rapide',
  'Produit frais',
  'Bien emballé',
  'Accueil agréable',
  'Conforme à l’offre',
  'Bon rapport qualité-prix',
];

/** Notes de démonstration : [étoiles, tags]. */
const DEMO_RATINGS = [
  [5, ['Rapide', 'Produit frais']],
  [5, ['Accueil agréable', 'Conforme à l’offre']],
  [4, ['Rapide']],
  [5, ['Produit frais', 'Bon rapport qualité-prix']],
  [4, ['Bien emballé', 'Conforme à l’offre']],
  [3, ['Bon rapport qualité-prix']],
  [5, ['Rapide', 'Accueil agréable']],
  [5, ['Produit frais']],
  [4, ['Rapide', 'Bien emballé']],
  [2, []],
  [5, ['Accueil agréable']],
  [4, ['Conforme à l’offre', 'Bon rapport qualité-prix']],
];

/** La synthèse d'une liste de notes — pure, donc testable sans écran. */
export function summarize(ratings) {
  const count = ratings.length;
  const sum = ratings.reduce((s, [stars]) => s + stars, 0);
  const byStars = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: ratings.filter(([s]) => s === stars).length,
  }));
  const tagCounts = new Map();
  for (const [, tags] of ratings)
    for (const t of tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tags = RATING_TAGS.map((tag) => ({ tag, count: tagCounts.get(tag) ?? 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
  return { count, average: count ? sum / count : 0, byStars, tags };
}

function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export default function ReviewsCard() {
  const s = summarize(DEMO_RATINGS);
  const top = Math.max(1, ...s.byStars.map((b) => b.count));
  return (
    <div className="tkpro-card" style={{ marginBottom: 18 }} data-testid="reviews-card">
      <div className="tkpro-card-head">
        <h2>Avis de vos clients</h2>
        <span className="tkpro-note-inline">Données de démonstration</span>
      </div>
      <div className="tkpro-reviews">
        <div className="tkpro-reviews-avg">
          <b>{s.average.toFixed(1).replace('.', ',')}</b>
          <span aria-hidden="true">{stars(Math.round(s.average))}</span>
          <em>{s.count} avis · affichés sur votre vitrine</em>
        </div>
        <div className="tkpro-reviews-bars">
          {s.byStars.map((b) => (
            <div key={b.stars} className="row">
              <span>{b.stars} ★</span>
              <i>
                <u style={{ width: `${Math.round((b.count / top) * 100)}%` }} />
              </i>
              <span>{b.count}</span>
            </div>
          ))}
        </div>
        <div className="tkpro-reviews-tags">
          {s.tags.map((t) => (
            <span className="tkpro-tag ticket" key={t.tag}>
              {t.tag} · {t.count}
            </span>
          ))}
        </div>
      </div>
      <p className="tkpro-note" style={{ margin: '0 18px 18px' }}>
        Les clients notent par étoiles et par tags rapides, sans texte libre : il n’y a rien à
        modérer.
      </p>
    </div>
  );
}
