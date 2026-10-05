import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText } from './text';

export type PrepTicketProps = {
  testID?: string;
  /** « Commande 7F3A2B » — de quoi retrouver la commande à la main. */
  reference: string;
  /** Une ligne de contexte : le mode de remise, ou le commerçant acheteur. */
  subtitle?: string;
  lines: { label: string; qty: number }[];
  /** Ce que le QR de l'étiquette porte : l'identité de la commande. */
  qrValue: string;
};

/**
 * LE TICKET DE PRÉPARATION AVEC ÉTIQUETTE QR DÉTACHABLE — CDC V1.1, Commerçant et Grossiste
 * (VALIDÉ) : « dès la commande passée et le paiement confirmé, un ticket de préparation avec
 * une partie détachable autocollante portant un QR code de la commande, à coller sur le produit
 * à livrer ou à emporter ».
 *
 * Ici, le ticket tel qu'il sort de l'imprimante, à l'écran. L'impression elle-même demande
 * l'imprimante à étiquettes thermique (Bluetooth ou USB) : tant qu'elle n'est pas connectée,
 * on le dit au lieu de laisser croire qu'un ticket est parti.
 *
 * Composant partagé : le commerçant (feature `shop`) et le grossiste (feature `merchant`) ne
 * s'importent pas, mais impriment le même ticket.
 */
export function PrepTicket({ testID, reference, subtitle, lines, qrValue }: PrepTicketProps) {
  return (
    <View testID={testID} className="gap-2 rounded-control border border-line bg-surface p-3.5">
      <View className="flex-row items-center justify-between">
        <AppText className="font-sans-bold text-ink" style={{ fontSize: 13 }}>
          Ticket de préparation
        </AppText>
        <AppText variant="caption" className="text-ink-faint">
          {reference}
        </AppText>
      </View>
      {subtitle ? (
        <AppText variant="caption" className="text-ink-muted">
          {subtitle}
        </AppText>
      ) : null}

      <View className="gap-1 border-t border-line pt-2">
        {lines.map((l) => (
          <View key={l.label} className="flex-row items-center gap-2">
            <AppText className="flex-1 text-ink" style={{ fontSize: 13 }} numberOfLines={2}>
              {l.label}
            </AppText>
            <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
              ×{l.qty}
            </AppText>
          </View>
        ))}
      </View>

      {/* La partie détachable : celle qu'on colle sur le produit. */}
      <View className="items-center gap-2 border-t border-dashed border-line pt-3">
        <AppText variant="caption" className="text-ink-faint">
          ✂ Partie détachable — à coller sur le produit
        </AppText>
        {/* Fond blanc : un QR sur fond sombre n'est pas lu par tous les scanners. */}
        <View className="rounded-card bg-white p-2.5">
          <QRCode value={qrValue} size={96} color="#0A0A0D" backgroundColor="#FFFFFF" />
        </View>
        <AppText variant="caption" className="text-center text-ink-faint" style={{ fontSize: 11 }}>
          Impression automatique dès qu’une imprimante à étiquettes (Bluetooth ou USB) est
          connectée.
        </AppText>
      </View>
    </View>
  );
}
