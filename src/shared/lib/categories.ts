/**
 * Les 8 catégories d’offres TKLINK — CDC §4 et §23 Q2.
 *
 * Une seule taxonomie pour toute l’app, et c’est délibéré. Le CDC demande les
 * mêmes catégories à deux endroits : à l’onboarding pour déclarer ses centres
 * d’intérêt (§4), et à l’accueil pour filtrer les offres (§7) — en précisant
 * que « les offres correspondant à ses catégories d’intérêt doivent être
 * présentées en priorité ». Deux listes différentes rendraient cette phrase
 * impossible à tenir : on ne peut pas croiser des intérêts avec des catégories
 * qui ne parlent pas la même langue.
 *
 * Vit dans `shared` parce que `onboarding` et `shop` en ont besoin toutes les
 * deux et qu’une feature ne peut pas en importer une autre.
 *
 * ⚠️ Le CDC §23 Q2 marque cette liste « à valider » par Farid. Les identifiants
 * sont donc stables et neutres ; seuls les libellés bougeront s’il en change.
 */

export const CATEGORIES = [
  'restauration',
  'high-tech',
  'maison',
  'mode',
  'beaute',
  'sport',
  'auto',
  'services',
] as const;

export type Category = (typeof CATEGORIES)[number];

type CategoryInfo = {
  /** Libellé complet du CDC — utilisé à l’onboarding, où la place ne manque pas. */
  label: string;
  /** Libellé court — la barre de filtres de l’accueil est étroite. */
  short: string;
  emoji: string;
  /** Nom d’icône Feather. Typé `string` ici : `shared/lib` ne dépend d’aucun rendu. */
  icon: string;
};

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  restauration: {
    label: 'Restauration & Alimentation',
    short: 'Resto',
    emoji: '🍔',
    icon: 'coffee',
  },
  'high-tech': {
    label: 'High-Tech & Électronique',
    short: 'High-Tech',
    emoji: '📱',
    icon: 'smartphone',
  },
  maison: { label: 'Maison & Décoration', short: 'Maison', emoji: '🏠', icon: 'home' },
  mode: { label: 'Mode & Accessoires', short: 'Mode', emoji: '👗', icon: 'shopping-bag' },
  beaute: { label: 'Beauté & Bien-être', short: 'Beauté', emoji: '💄', icon: 'heart' },
  sport: { label: 'Sport & Loisirs', short: 'Sport', emoji: '⚽', icon: 'activity' },
  auto: { label: 'Auto & Mobilité', short: 'Auto', emoji: '🚗', icon: 'navigation' },
  services: { label: 'Services & Expériences', short: 'Services', emoji: '🎁', icon: 'gift' },
};

/** Libellés courts, la forme dont la barre de filtres a besoin. */
export const CATEGORY_LABELS: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c, CATEGORY_INFO[c].short]),
) as Record<Category, string>;

/** Garde d’entrée : une catégorie inconnue (donnée ancienne, back-end) est rejetée. */
export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/**
 * Une offre relève-t-elle des centres d’intérêt déclarés ? — CDC §7.
 *
 * Aucun intérêt déclaré = tout intéresse. C’est la seule réponse honnête : un
 * utilisateur qui n’a rien coché n’a pas dit « rien ne m’intéresse ».
 */
export function matchesInterests(category: Category, interests: Category[]): boolean {
  return interests.length === 0 || interests.includes(category);
}
