/**
 * La progression du chasseur — ce qui transforme « une boutique » en « une
 * chasse ».
 *
 * Le principe : chaque geste rapporte quelque chose de VISIBLE. Attraper un
 * flash, gagner un jeu, revenir un jour de plus. Sans cela, l'app ne donne
 * aucune raison de l'ouvrir demain — c'est ce qui la fait ressembler à une
 * place de marché.
 *
 * Tout est pur ici : ni date implicite, ni stockage. L'instant est TOUJOURS
 * passé en paramètre, sinon les séries deviennent intestables.
 */

export type Rank = { level: number; title: string; minXp: number };

/**
 * Les paliers. Les écarts grandissent : le niveau 2 s'atteint vite (on veut
 * que la première récompense tombe dans la première session), les suivants se
 * méritent.
 */
export const RANKS: Rank[] = [
  { level: 1, title: 'Curieux', minXp: 0 },
  { level: 2, title: 'Chineur', minXp: 100 },
  { level: 3, title: 'Dénicheur', minXp: 300 },
  { level: 4, title: 'Chasseur', minXp: 700 },
  { level: 5, title: 'Expert du flash', minXp: 1500 },
  { level: 6, title: 'Légende locale', minXp: 3000 },
];

/** XP gagnée par type d'action. */
export const XP = {
  /** Attraper une vente flash. */
  catch: 40,
  /** Gagner à un jeu. */
  game: 25,
  /** Première ouverture du jour. */
  visit: 10,
  /** Partager des points à un proche. */
  share: 15,
} as const;

export type XpSource = keyof typeof XP;

/** Le rang correspondant à un total d'XP. */
export function rankOf(xp: number): Rank {
  let found = RANKS[0]!;
  for (const r of RANKS) if (xp >= r.minXp) found = r;
  return found;
}

/** Le rang suivant, ou `null` au sommet. */
export function nextRank(xp: number): Rank | null {
  return RANKS.find((r) => r.minXp > xp) ?? null;
}

/**
 * Où l'on en est DANS le niveau courant : la barre de progression.
 * Au dernier rang, la barre est pleine — pas un dixième de pixel de vide qui
 * laisserait croire qu'il reste quelque chose à faire.
 */
export function levelProgress(xp: number): { ratio: number; toGo: number } {
  const current = rankOf(xp);
  const next = nextRank(xp);
  if (!next) return { ratio: 1, toGo: 0 };
  const span = next.minXp - current.minXp;
  return {
    ratio: Math.min(1, Math.max(0, (xp - current.minXp) / span)),
    toGo: next.minXp - xp,
  };
}

/* ─── Séries ──────────────────────────────────────────────────────────── */

/** Jour civil local, au format AAAA-MM-JJ. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Nombre de jours civils entre deux instants. */
export function daysBetween(fromMs: number, toMs: number): number {
  const a = new Date(fromMs);
  const b = new Date(toMs);
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((db - da) / 86_400_000);
}

export type Streak = { count: number; lastDay: string | null };

/**
 * Met la série à jour pour une activité constatée à `nowMs`.
 *
 * Même jour → inchangé (on ne récompense pas le rafraîchissement compulsif).
 * Lendemain → +1. Au-delà → la série repart à 1, PAS à 0 : la journée en cours
 * compte, sinon revenir après une coupure serait puni deux fois.
 */
export function bumpStreak(streak: Streak, nowMs: number): Streak {
  const today = dayKey(nowMs);
  if (streak.lastDay === today) return streak;
  if (streak.lastDay === null) return { count: 1, lastDay: today };

  const [y, m, d] = streak.lastDay.split('-').map(Number);
  const lastMs = new Date(y!, (m ?? 1) - 1, d ?? 1).getTime();
  const gap = daysBetween(lastMs, nowMs);
  return { count: gap === 1 ? streak.count + 1 : 1, lastDay: today };
}

/** Une série est-elle encore vivante aujourd'hui ? (affichage uniquement) */
export function isStreakAlive(streak: Streak, nowMs: number): boolean {
  if (!streak.lastDay) return false;
  const [y, m, d] = streak.lastDay.split('-').map(Number);
  const lastMs = new Date(y!, (m ?? 1) - 1, d ?? 1).getTime();
  return daysBetween(lastMs, nowMs) <= 1;
}

/* ─── Missions du jour ────────────────────────────────────────────────── */

export type MissionKind = 'catch' | 'game' | 'visit';

export type Mission = {
  id: string;
  kind: MissionKind;
  label: string;
  target: number;
  xp: number;
};

const POOL: Omit<Mission, 'id'>[] = [
  { kind: 'catch', label: 'Attrapez 1 vente flash', target: 1, xp: 30 },
  { kind: 'catch', label: 'Attrapez 2 ventes flash', target: 2, xp: 60 },
  { kind: 'game', label: 'Gagnez une partie', target: 1, xp: 25 },
  { kind: 'game', label: 'Gagnez deux parties', target: 2, xp: 50 },
  { kind: 'visit', label: 'Ouvrez l’app aujourd’hui', target: 1, xp: 10 },
];

/**
 * Les trois missions du jour, TIRÉES DE FAÇON DÉTERMINISTE à partir de la date :
 * tout le monde a les mêmes, elles ne changent pas si l'on rouvre l'app, et
 * elles sont rejouables en test sans figer d'horloge.
 */
export function dailyMissions(nowMs: number): Mission[] {
  const key = dayKey(nowMs);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;

  const pool = [...POOL];
  const out: Mission[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const [picked] = pool.splice(h % pool.length, 1);
    out.push({ ...picked!, id: `${key}-${i}` });
  }
  return out;
}

/** Compteurs du jour, par type d'action. */
export type DailyCounts = Record<MissionKind, number>;

export const EMPTY_COUNTS: DailyCounts = { catch: 0, game: 0, visit: 0 };

export function missionDone(mission: Mission, counts: DailyCounts): boolean {
  return counts[mission.kind] >= mission.target;
}

/** Progression d'une mission, bornée à [0, 1]. */
export function missionRatio(mission: Mission, counts: DailyCounts): number {
  if (mission.target <= 0) return 1;
  return Math.min(1, counts[mission.kind] / mission.target);
}

/** Combien de missions sont accomplies. */
export function missionsDone(missions: Mission[], counts: DailyCounts): number {
  return missions.filter((m) => missionDone(m, counts)).length;
}
