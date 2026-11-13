/**
 * LA RÉDUCTION DU PANIER — le crédit de parrainage, en euros.
 *
 * - Commande LOCALE (démonstration) : le crédit, borné aux articles.
 * - Commande du SERVEUR : le crédit du serveur, borné à la commission de TK LINK sur les articles —
 *   le même calcul que `reserve_flash` (migration 0019). En Stripe « Direct charges », le prélèvement
 *   de TK LINK ne peut pas être négatif : TK LINK n'offre que ce qu'il aurait prélevé, et le reste du
 *   crédit sert aux commandes suivantes.
 *
 * La commission se calcule en centimes, arrondie comme sur le serveur (`round` de Postgres et
 * `Math.round` arrondissent tous deux 0,5 vers le haut pour un montant positif).
 */
export function cartDiscount(input: {
  serverMode: boolean;
  /** Montant des articles, en euros. */
  subtotal: number;
  /** Crédit local disponible, en euros. */
  credit: number;
  /** Crédit du serveur restant, en euros. */
  serverCredit: number;
  /** Commission de TK LINK, en pourcentage (5). */
  commissionPct: number;
}): number {
  const { serverMode, subtotal, credit, serverCredit, commissionPct } = input;
  const cents = (euros: number) => Math.round(euros * 100);
  if (serverMode) {
    const commission = Math.round((cents(subtotal) * commissionPct) / 100);
    return Math.min(Math.max(0, cents(serverCredit)), commission) / 100;
  }
  return Math.min(Math.max(0, cents(credit)), cents(subtotal)) / 100;
}
