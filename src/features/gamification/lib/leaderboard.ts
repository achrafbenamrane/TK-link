import { dayKey } from './progression';

/**
 * Le classement du quartier — la comparaison sociale, en local.
 *
 * ⚠️ DONNÉES DE DÉMO. Les voisins sont fabriqués côté téléphone en attendant
 * le back-end : c'est le même parti pris que le catalogue et les coupons
 * d'exemple. Le jour où le serveur renverra un vrai classement, seule cette
 * fonction disparaît — l'écran, lui, ne change pas.
 *
 * Les voisins sont ANCRÉS sur l'XP du joueur, pas sur des valeurs absolues :
 * un tableau où l'on est irrattrapablement dernier ne motive personne. Il y a
 * toujours quelqu'un juste devant (une cible), et dès les premiers points,
 * quelqu'un derrière (une raison de ne pas lâcher). Un compte tout neuf, lui,
 * est bien dernier : personne ne peut être en dessous de zéro.
 */

export type LeaderRow = {
  id: string;
  name: string;
  xp: number;
  /** Vrai pour la ligne du joueur. */
  you: boolean;
  /** Rang, à partir de 1. */
  rank: number;
};

/** Prénoms du quartier — figés, pour que le classement ne change pas de tête. */
const RIVALS = [
  { id: 'r_ines', name: 'Inès', factor: 1.9 },
  { id: 'r_karim', name: 'Karim', factor: 1.42 },
  { id: 'r_sofia', name: 'Sofia', factor: 1.14 },
  { id: 'r_marius', name: 'Marius', factor: 0.82 },
  { id: 'r_lea', name: 'Léa', factor: 0.58 },
  { id: 'r_yanis', name: 'Yanis', factor: 0.33 },
];

/** Plancher d'XP : sans lui, un joueur à 0 XP verrait six voisins à 0. */
const FLOOR_XP = 140;

/**
 * Plafond de l'ancrage. Sans lui, les voisins grandiraient éternellement avec
 * le joueur : la première place serait mathématiquement inatteignable, ce qui
 * viderait le classement de son sens. Au-delà du dernier rang (« Légende
 * locale », 3 000 XP), le quartier arrête de suivre — et on finit par passer
 * devant tout le monde.
 */
const CEILING_XP = 3000;

/** Hachage déterministe d'une chaîne, dans [0, 1[. */
function unit(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Le classement du jour : les voisins bougent d'un jour à l'autre (la graine
 * contient la date) mais restent stables pendant la session — un tableau qui
 * change à chaque rendu donnerait l'impression d'un bug.
 */
export function neighbourhoodBoard(xp: number, nowMs: number): LeaderRow[] {
  const day = dayKey(nowMs);
  const base = Math.min(Math.max(xp, FLOOR_XP), CEILING_XP);

  const rivals = RIVALS.map((r) => {
    // ±15 % de bruit quotidien : le classement respire sans devenir illisible.
    const jitter = 0.85 + unit(`${day}-${r.id}`) * 0.3;
    let value = Math.max(10, Math.round(base * r.factor * jitter));
    // Jamais l'XP exacte du joueur : une égalité rendrait le rang ambigu.
    if (value === xp) value += 1;
    return { id: r.id, name: r.name, xp: value, you: false };
  });

  return [...rivals, { id: 'you', name: 'Vous', xp, you: true }]
    .sort((a, b) => b.xp - a.xp)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/** La ligne du joueur dans un classement. */
export function youRow(rows: LeaderRow[]): LeaderRow | undefined {
  return rows.find((r) => r.you);
}

/**
 * Combien d'XP pour doubler la personne juste devant. `0` en tête : il n'y a
 * plus rien à rattraper, et afficher « 0 XP à rattraper » serait faux.
 */
export function xpToPassNext(rows: LeaderRow[]): number {
  const me = rows.findIndex((r) => r.you);
  if (me <= 0) return 0;
  const ahead = rows[me - 1]!;
  return Math.max(1, ahead.xp - rows[me]!.xp + 1);
}
