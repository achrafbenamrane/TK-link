import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { z } from 'zod';

import { asyncStorageBackend } from '@/shared/lib/storage';

/**
 * PARRAINAGE — CDC V1.1, Utilisateur > Process (VALIDÉ) : « un lien ou code
 * d'invitation permet de partager l'application ; une récompense financée par TK
 * Link est débloquée pour les deux après un premier achat réel du filleul ».
 *
 * ⚠️ Sans back-end, seul le côté FILLEUL est réellement observable : on voit sa
 * propre commande. Le côté parrain (« mon filleul a acheté ») est une donnée du
 * serveur ; l'écran le dit au lieu d'inventer un compteur de filleuls.
 *
 * États du crédit du filleul :
 *   aucun        — pas de code saisi
 *   a_debloquer  — code saisi, en attente du premier achat
 *   disponible   — premier achat fait : le crédit s'applique à la commande suivante
 *   utilise      — consommé
 */
export type CreditState = 'aucun' | 'a_debloquer' | 'disponible' | 'utilise';

const PersistedSchema = z.object({
  myCode: z.string().default(''),
  referredBy: z.string().nullable().default(null),
  credit: z.enum(['aucun', 'a_debloquer', 'disponible', 'utilise']).default('aucun'),
});

/** Un code TK-XXXXXX, sans caractères qui se confondent (0/O, 1/I). */
const CODE_RE = /^TK-[A-HJ-NP-Z2-9]{6}$/;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeReferralCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `TK-${out}`;
}

export function normaliseCode(input: string): string {
  return input.trim().toUpperCase();
}

export type ApplyResult =
  | { ok: true }
  | { ok: false; reason: 'invalide' | 'son_propre_code' | 'deja_parraine' | 'deja_client' };

type State = {
  myCode: string;
  referredBy: string | null;
  credit: CreditState;
  /** Crée mon code au premier besoin, et le garde. */
  ensureCode: () => string;
  /**
   * Saisit le code d'un parrain. Refusé : un code mal formé, le sien, un second
   * parrain, ou — le parrainage invitant des NOUVEAUX clients — quand on a déjà
   * commandé.
   */
  applyCode: (code: string, hasOrdered: boolean) => ApplyResult;
  /** À appeler après chaque commande payée : le premier achat débloque le crédit. */
  onPurchase: () => void;
  /** À appeler quand le crédit a servi à payer une commande. */
  consumeCredit: () => void;
  reset: () => void;
};

export const useReferralStore = create<State>()(
  persist(
    (set, get) => ({
      myCode: '',
      referredBy: null,
      credit: 'aucun',

      ensureCode: () => {
        const existing = get().myCode;
        if (existing) return existing;
        const code = makeReferralCode();
        set({ myCode: code });
        return code;
      },

      applyCode: (code, hasOrdered) => {
        const wanted = normaliseCode(code);
        if (!CODE_RE.test(wanted)) return { ok: false as const, reason: 'invalide' as const };
        if (wanted === get().myCode) {
          return { ok: false as const, reason: 'son_propre_code' as const };
        }
        if (get().referredBy) return { ok: false as const, reason: 'deja_parraine' as const };
        if (hasOrdered) return { ok: false as const, reason: 'deja_client' as const };
        set({ referredBy: wanted, credit: 'a_debloquer' });
        return { ok: true as const };
      },

      onPurchase: () => {
        if (get().credit === 'a_debloquer') set({ credit: 'disponible' });
      },

      consumeCredit: () => {
        if (get().credit === 'disponible') set({ credit: 'utilise' });
      },

      reset: () => set({ referredBy: null, credit: 'aucun' }),
    }),
    {
      name: 'tklink-referral-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({ myCode: s.myCode, referredBy: s.referredBy, credit: s.credit }),
      merge: (persisted, current) => {
        const parsed = PersistedSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

export const selectCredit = (s: State) => s.credit;
export const selectReferredBy = (s: State) => s.referredBy;
