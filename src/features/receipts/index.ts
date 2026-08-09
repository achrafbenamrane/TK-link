/**
 * PUBLIC API de la fonctionnalité « tickets » — le cœur de TK LINK.
 *
 * Le ticket de caisse n'est plus imprimé : il arrive ici, devient une facture
 * certifiée, et ses données alimentent la comptabilité.
 */
export { ReceiptsScreen } from './ui/receipts-screen';
export { ReceiptDetailScreen } from './ui/receipt-detail-screen';
export {
  useReceiptsStore,
  selectReceipts,
  selectReceiptCount,
  selectTotalPoints,
  type IncomingReceipt,
} from './model/store';
export type { Receipt, ReceiptCategory, ReceiptChannel, ReceiptKind } from './model/schema';
export {
  formatMoney,
  formatGrams,
  formatLiters,
  ecoImpact,
  groupByMonth,
  searchReceipts,
  splitVat,
  toInvoice,
  CATEGORY_LABEL,
} from './lib/receipts';
