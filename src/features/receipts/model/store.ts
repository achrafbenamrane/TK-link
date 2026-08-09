import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { makeId } from '@/shared/lib/id';
import { asyncStorageBackend } from '@/shared/lib/storage';

import { certificateFor, splitVat, toInvoice } from '../lib/receipts';
import { seedReceipts } from './seed';
import {
  PersistedReceiptsSchema,
  type Receipt,
  type ReceiptCategory,
  type ReceiptLine,
} from './schema';

/**
 * Portefeuille de tickets — la table centrale de TK LINK.
 *
 * ⚠️ ZUSTAND v5 : un sélecteur AUQUEL ON S'ABONNE doit renvoyer une référence
 * stable ou une primitive. Les sélecteurs exportés ici ne filtrent donc jamais :
 * on s'abonne à la tranche brute (`selectReceipts`) et on dérive avec `useMemo`
 * dans l'écran. Un `.filter()` dans un sélecteur abonné = boucle infinie =
 * plantage (voir docs/quality/quality-score.md).
 */

/** Ce qu'un lecteur en caisse enverra ; en démo, on le simule. */
export type IncomingReceipt = {
  merchant: string;
  lines: ReceiptLine[];
  category?: ReceiptCategory;
  channel?: 'store' | 'online';
  /** Défaut : maintenant. */
  issuedAt?: number;
};

type ReceiptsState = {
  receipts: Receipt[];

  /**
   * Arrivée d'un ticket. En production c'est le lecteur (ou le back-end) qui
   * déclenche ça ; en démo, le bouton « simuler un passage en caisse ».
   */
  addReceipt: (incoming: IncomingReceipt) => Receipt;
  /** Ticket → facture certifiée (« certificat de facture unique »). */
  convertToInvoice: (id: string) => void;
  /** Épingler un ticket (garantie, note de frais). */
  togglePinned: (id: string) => void;
  /** Affecter un code fournisseur — le classement qu'attend la comptabilité. */
  setSupplierCode: (id: string, code: string) => void;
  removeReceipt: (id: string) => void;
  /** Remet l'historique de démonstration (écran de réglages). */
  resetDemo: () => void;
};

export const useReceiptsStore = create<ReceiptsState>()(
  persist(
    (set) => ({
      receipts: seedReceipts(),

      addReceipt: (incoming) => {
        const totalCents = incoming.lines.reduce((s, l) => s + l.unitCents * l.qty, 0);
        const { netCents, vatCents } = splitVat(totalCents);
        const issuedAt = incoming.issuedAt ?? Date.now();
        const base = {
          id: makeId(),
          merchant: incoming.merchant,
          reference: `TK-${new Date(issuedAt).getFullYear()}-${String(Date.now()).slice(-4)}`,
          issuedAt,
          currency: 'EUR',
          totalCents,
          vatCents,
          netCents,
          dueAt: null,
          category: incoming.category ?? 'autre',
          supplierCode: '',
          lines: incoming.lines,
          channel: incoming.channel ?? 'store',
          kind: 'ticket' as const,
          certificateId: '',
          pointsEarned: Math.floor(totalCents / 100),
          pinned: false,
        };
        set((s) => ({ receipts: [base, ...s.receipts] }));
        return base;
      },

      convertToInvoice: (id) =>
        set((s) => ({ receipts: s.receipts.map((r) => (r.id === id ? toInvoice(r) : r)) })),

      togglePinned: (id) =>
        set((s) => ({
          receipts: s.receipts.map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r)),
        })),

      setSupplierCode: (id, code) =>
        set((s) => ({
          receipts: s.receipts.map((r) => (r.id === id ? { ...r, supplierCode: code } : r)),
        })),

      removeReceipt: (id) => set((s) => ({ receipts: s.receipts.filter((r) => r.id !== id) })),

      resetDemo: () => set({ receipts: seedReceipts() }),
    }),
    {
      name: 'tklink-receipts-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({ receipts: s.receipts }),
      merge: (persisted, current) => {
        const parsed = PersistedReceiptsSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/* ---- sélecteurs : tranches brutes uniquement (voir l'avertissement en tête) ---- */

export const selectReceipts = (s: ReceiptsState) => s.receipts;
/** Primitive → sûr à l'abonnement. */
export const selectReceiptCount = (s: ReceiptsState) => s.receipts.length;
/** Primitive → sûr à l'abonnement. */
export const selectTotalPoints = (s: ReceiptsState) =>
  s.receipts.reduce((sum, r) => sum + r.pointsEarned, 0);

export { certificateFor };
