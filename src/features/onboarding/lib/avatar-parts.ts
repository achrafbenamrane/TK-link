import type { CustomAvatar } from '../model/schema';

/**
 * Les pièces de l'avatar personnalisé — pures, sans dépendance au rendu (le dessin vit dans
 * `ui/avatar-figure.tsx`). Chaque champ de `CustomAvatar` est un index dans l'une de ces listes.
 */

export type Swatch = {
  label: string;
  hex: string;
  /** Fond sombre : le logo s'écrit en blanc dessus. */ dark?: boolean;
};

/** Le rose de la marque — sur un vêtement rose, « TK » passe en blanc pour rester lisible. */
export const TK_PINK = '#FF1478';

export const SKIN: Swatch[] = [
  { label: 'Très clair', hex: '#FFE0C7' },
  { label: 'Clair', hex: '#F5C9A0' },
  { label: 'Hâlé', hex: '#E0A877' },
  { label: 'Mat', hex: '#C68642' },
  { label: 'Brun', hex: '#8D5524' },
  { label: 'Foncé', hex: '#5C3A1E' },
];

export const HAIR_COLORS: Swatch[] = [
  { label: 'Noir', hex: '#1B1B1F' },
  { label: 'Châtain foncé', hex: '#4A2C17' },
  { label: 'Châtain', hex: '#7A4A25' },
  { label: 'Roux', hex: '#B4472B' },
  { label: 'Blond', hex: '#E3C26B' },
  { label: 'Gris', hex: '#C9CBD1' },
  { label: 'Rose', hex: TK_PINK },
  { label: 'Bleu', hex: '#3B82F6' },
];

export const EYE_COLORS: Swatch[] = [
  { label: 'Marron', hex: '#4A2A14' },
  { label: 'Vert', hex: '#2E7D32' },
  { label: 'Bleu', hex: '#2563EB' },
  { label: 'Gris', hex: '#6B7280' },
  { label: 'Noir', hex: '#1F1F1F' },
];

/** Tissus : vêtements ET casquettes partagent la même palette. */
export const FABRICS: Swatch[] = [
  { label: 'Rose TK', hex: TK_PINK, dark: true },
  { label: 'Noir', hex: '#1F2024', dark: true },
  { label: 'Blanc', hex: '#F7F7F8' },
  { label: 'Gris', hex: '#B8BCC6' },
  { label: 'Bleu marine', hex: '#1E3A8A', dark: true },
  { label: 'Bleu', hex: '#3B82F6', dark: true },
  { label: 'Vert', hex: '#15803D', dark: true },
  { label: 'Jaune', hex: '#F5B82E' },
];

export const BACKGROUNDS: Swatch[] = [
  { label: 'Rose pâle', hex: '#FDE2EA' },
  { label: 'Bleu pâle', hex: '#DCEEFC' },
  { label: 'Vert pâle', hex: '#DDF3E4' },
  { label: 'Crème', hex: '#FFF1D0' },
  { label: 'Lavande', hex: '#E9E4FB' },
  { label: 'Nuit', hex: '#1F2937', dark: true },
];

/**
 * Les champs de l'éditeur, dans le sens où on les lit : leur libellé et leurs choix. `swatch` se
 * choisit sur une pastille de couleur, `shape` sur un aperçu de l'avatar avec ce choix.
 */
export type FieldDef =
  | { kind: 'swatch'; label: string; options: Swatch[] }
  | { kind: 'shape'; label: string; options: string[] };

export const FIELDS: Record<keyof CustomAvatar, FieldDef> = {
  skin: { kind: 'swatch', label: 'Teint', options: SKIN },
  face: {
    kind: 'shape',
    label: 'Forme du visage',
    options: ['Rond', 'Ovale', 'Carré', 'Menton pointu'],
  },
  freckles: {
    kind: 'shape',
    label: 'Taches de rousseur',
    options: ['Aucune', 'Taches de rousseur'],
  },
  eyes: {
    kind: 'shape',
    label: 'Forme des yeux',
    options: ['Ronds', 'En amande', 'Rieurs', 'Endormis', 'Grands, cils'],
  },
  eyeColor: { kind: 'swatch', label: 'Couleur des yeux', options: EYE_COLORS },
  brows: {
    kind: 'shape',
    label: 'Sourcils',
    options: ['Droits', 'Arqués', 'Épais', 'Fins et hauts'],
  },
  nose: { kind: 'shape', label: 'Nez', options: ['Petit', 'Rond', 'Long'] },
  mouth: {
    kind: 'shape',
    label: 'Bouche',
    options: ['Sourire', 'Grand sourire', 'Neutre', 'En coin', 'Surprise'],
  },
  hair: {
    kind: 'shape',
    label: 'Coiffure',
    options: [
      'Chauve',
      'Courts',
      'Rasés',
      'Bouclés',
      'Longs',
      'Chignon',
      'Banane',
      'Carré',
      'Queue de cheval',
    ],
  },
  hairColor: { kind: 'swatch', label: 'Couleur des cheveux', options: HAIR_COLORS },
  beard: {
    kind: 'shape',
    label: 'Barbe',
    options: ['Aucune', 'Moustache', 'Bouc', 'Barbe pleine', 'Barbe de trois jours'],
  },
  glasses: {
    kind: 'shape',
    label: 'Lunettes',
    options: ['Aucune', 'Rondes', 'Carrées', 'De soleil'],
  },
  top: {
    kind: 'shape',
    label: 'Haut',
    options: ['T-shirt', 'T-shirt col V', 'Sweat à capuche', 'Veste'],
  },
  topColor: { kind: 'swatch', label: 'Couleur du haut', options: FABRICS },
  cap: { kind: 'shape', label: 'Couvre-chef', options: ['Aucun', 'Casquette', 'Bonnet', 'Bob'] },
  capColor: { kind: 'swatch', label: 'Couleur du couvre-chef', options: FABRICS },
  bg: { kind: 'swatch', label: 'Fond', options: BACKGROUNDS },
};

export const FIELD_KEYS = Object.keys(FIELDS) as (keyof CustomAvatar)[];

/**
 * Les onglets de l'éditeur : un thème, des champs, et le cadrage des aperçus (un nez se juge sur
 * un visage en gros plan, une tenue sur le buste).
 */
export type EditorTab = {
  id: string;
  label: string;
  fields: (keyof CustomAvatar)[];
  zoom: 'face' | 'head' | 'chest' | 'full';
  /** Ce qui s'écrit sous les choix — la règle du logo, par exemple. */
  note?: string;
};

export const EDITOR_TABS: EditorTab[] = [
  { id: 'visage', label: 'Visage', fields: ['skin', 'face', 'freckles'], zoom: 'face' },
  { id: 'yeux', label: 'Yeux', fields: ['eyes', 'eyeColor', 'brows'], zoom: 'face' },
  { id: 'nez-bouche', label: 'Nez & bouche', fields: ['nose', 'mouth'], zoom: 'face' },
  { id: 'cheveux', label: 'Cheveux', fields: ['hair', 'hairColor'], zoom: 'head' },
  {
    id: 'barbe',
    label: 'Barbe',
    fields: ['beard'],
    zoom: 'face',
    note: 'La barbe prend la couleur des cheveux.',
  },
  { id: 'lunettes', label: 'Lunettes', fields: ['glasses'], zoom: 'face' },
  {
    id: 'tenue',
    label: 'Tenue',
    fields: ['top', 'topColor'],
    zoom: 'chest',
    note: 'Le logo TK LINK est toujours sur la tenue.',
  },
  {
    id: 'casquette',
    label: 'Casquette',
    fields: ['cap', 'capColor'],
    zoom: 'head',
    note: 'Le logo TK LINK est toujours sur le couvre-chef.',
  },
  { id: 'fond', label: 'Fond', fields: ['bg'], zoom: 'full' },
];

/** Le point de départ de l'éditeur — le même que les valeurs par défaut du schéma. */
export const DEFAULT_CUSTOM: CustomAvatar = {
  skin: 1,
  face: 0,
  freckles: 0,
  eyes: 0,
  eyeColor: 0,
  brows: 0,
  nose: 0,
  mouth: 0,
  hair: 1,
  hairColor: 1,
  beard: 0,
  glasses: 0,
  top: 0,
  topColor: 0,
  cap: 0,
  capColor: 1,
  bg: 0,
};

/** Combien de choix propose un champ. */
export const optionCount = (key: keyof CustomAvatar): number => FIELDS[key].options.length;

/**
 * Le choix d'un champ ramené dans sa liste. Un index hors liste (avatar enregistré par une version
 * qui proposait moins — ou plus — de choix) retombe dans la liste au lieu de dessiner un trou.
 */
export function pick(avatar: CustomAvatar, key: keyof CustomAvatar): number {
  return avatar[key] % optionCount(key);
}

/** Les pastilles d'un champ de couleur, ou rien si le champ est une forme. */
export function swatchOf(avatar: CustomAvatar, key: keyof CustomAvatar): Swatch {
  const field = FIELDS[key];
  const options = field.kind === 'swatch' ? field.options : SKIN;
  return options[pick(avatar, key)] ?? options[0]!;
}

/**
 * Un avatar tiré au hasard — le bouton « Au hasard » de l'éditeur. Le hasard est injectable pour
 * que les tests décrivent un résultat. Pas d'uniforme partout : la plupart des gens ne portent ni
 * barbe, ni lunettes, ni couvre-chef — un tirage rempli d'accessoires ferait caricature.
 */
export function randomCustom(rand: () => number = Math.random): CustomAvatar {
  const draw = (key: keyof CustomAvatar) =>
    Math.min(optionCount(key) - 1, Math.floor(rand() * optionCount(key)));
  const rare = (key: keyof CustomAvatar, chance: number) => (rand() < chance ? draw(key) : 0);

  const next = { ...DEFAULT_CUSTOM };
  for (const key of FIELD_KEYS) next[key] = draw(key);
  next.beard = rare('beard', 0.3);
  next.glasses = rare('glasses', 0.3);
  next.cap = rare('cap', 0.35);
  next.freckles = rare('freckles', 0.2);
  return next;
}

/** Vrai quand deux avatars composés sont identiques. */
export function sameCustom(a: CustomAvatar, b: CustomAvatar): boolean {
  return FIELD_KEYS.every((key) => a[key] === b[key]);
}

/**
 * Éclaircit (`amount` > 0) ou assombrit (`amount` < 0) une couleur `#RRGGBB`, de 0 à 1 — pour les
 * ombres du dessin (sourcils, ourlets, nez) sans multiplier les palettes.
 */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
