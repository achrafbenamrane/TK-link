/**
 * La galerie d'avatars — les dix illustrations livrées par le client.
 *
 * `require` n'accepte que des chemins littéraux : Metro résout les assets à la
 * compilation, une clé dynamique ne marcherait pas. D'où cette table écrite à
 * la main, comme celle des visuels produits.
 *
 * Les fichiers embarqués sont les vignettes 256² ; les rendus d'origine (1024²,
 * 14 Mo au total) vivent dans `assets/avatars/source/`, hors dépôt et hors
 * bundle. Un avatar ne dépasse jamais 128 px à l'écran : embarquer les
 * originaux aurait triplé le poids de l'app pour un rendu identique.
 */

export type AvatarPreset = {
  /** Identifiant stable — l'index sert au stockage, pas au repérage humain. */
  id: string;
  /** Ce qui distingue visuellement l'avatar, pour les lecteurs d'écran. */
  label: string;
  source: number;
};

export const AVATARS: AvatarPreset[] = [
  {
    id: 'sac',
    label: 'Sac de courses',
    source: require('../../../../assets/avatars/avatar-01-sac.png'),
  },
  {
    id: 'tickets',
    label: 'Tickets en main',
    source: require('../../../../assets/avatars/avatar-02-tickets.png'),
  },
  {
    id: 'foulard',
    label: 'Foulard bleu',
    source: require('../../../../assets/avatars/avatar-03-foulard.png'),
  },
  {
    id: 'cheveux-longs',
    label: 'Cheveux longs',
    source: require('../../../../assets/avatars/avatar-04-cheveux-longs.png'),
  },
  {
    id: 'costume',
    label: 'Costume',
    source: require('../../../../assets/avatars/avatar-05-costume.png'),
  },
  {
    id: 'casquette',
    label: 'Casquette',
    source: require('../../../../assets/avatars/avatar-06-casquette.png'),
  },
  {
    id: 'lunettes',
    label: 'Lunettes',
    source: require('../../../../assets/avatars/avatar-07-lunettes.png'),
  },
  {
    id: 'barbe',
    label: 'Barbe',
    source: require('../../../../assets/avatars/avatar-08-barbe.png'),
  },
  {
    id: 'tenue-blanche',
    label: 'Tenue blanche',
    source: require('../../../../assets/avatars/avatar-09-tenue-blanche.png'),
  },
  {
    id: 'blonde',
    label: 'Cheveux blonds',
    source: require('../../../../assets/avatars/avatar-10-blonde.png'),
  },
];

/**
 * L'illustration d'un index, bornée. Un index hors galerie (avatar stocké par
 * une version qui en proposait davantage) retombe sur le premier plutôt que de
 * rendre un trou.
 */
export function avatarAt(preset: number): AvatarPreset {
  return AVATARS[preset % AVATARS.length] ?? AVATARS[0]!;
}
