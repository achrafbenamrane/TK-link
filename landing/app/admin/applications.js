/**
 * Les dossiers des professionnels, côté back-office : les lignes `shops` (migration 0010) mises en
 * forme pour les cartes « Demandes d’inscription » de `/admin`. Pur, testé par
 * `landing/__tests__/admin-applications.test.ts`.
 *
 * Le statut du serveur fait foi : `valide` → accepté, `refuse` → refusé (avec son motif),
 * `en_verification` → à trancher.
 */

/** MIROIR des catégories de l'app (src/shared/lib/categories.ts). */
export const CATEGORY_LABEL = {
  restauration: 'Restauration',
  'high-tech': 'High-tech',
  maison: 'Maison',
  mode: 'Mode',
  beaute: 'Beauté',
  sport: 'Sport',
  auto: 'Auto',
  services: 'Services',
};

export const SHOP_DECISIONS = ['valide', 'refuse', 'en_verification'];

/** Une ligne `shops` (+ profil et e-mail du titulaire) → la carte d'une demande. */
export function toApplication(shop, profile, email) {
  const contact = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  return {
    id: shop.id,
    shop: shop.name,
    contact: contact || '—',
    email: email || '—',
    phone: profile?.contact_phone || '—',
    role: shop.kind,
    activity: CATEGORY_LABEL[shop.category] ?? shop.category,
    siret: shop.siret ?? '',
    address: shop.address ?? '',
    submittedAt: shop.submitted_at,
    // Le justificatif (Kbis) n'est pas encore déposé dans l'app : la carte le dit.
    document: null,
    status: shop.status,
  };
}

/** Les décisions déjà prises, au format de la page : `{ [id]: { decision, reason } }`. */
export function decisionsOf(shops) {
  const out = {};
  for (const s of shops ?? []) {
    if (s.status === 'valide') out[s.id] = { decision: 'accepted' };
    else if (s.status === 'refuse')
      out[s.id] = { decision: 'refused', reason: s.review_note ?? '' };
  }
  return out;
}

/** Un refus porte toujours un motif : 3 à 300 caractères (le professionnel le lit dans l'app). */
export function validNote(note) {
  const text = typeof note === 'string' ? note.trim() : '';
  return text.length >= 3 && text.length <= 300 ? text : null;
}
