import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText, Button } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import {
  cancelOrder,
  fetchPickupCode,
  type OrdersError,
  type ServerOrder,
  startPayment,
} from '../../lib/orders-api';
import { pickupPayload } from '../../lib/pickup';
import { CHECKOUT_ERROR, openPaymentPage } from '../../lib/server-checkout';
import { ServerReportIssue } from './server-issue';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const PAID = ['payee', 'acceptee', 'preparation', 'prete'];

/**
 * LE BLOC D’UNE COMMANDE DU SERVEUR, sous son suivi (rapport d’avancement du 13/11/2026) :
 *
 * - « À payer » : la réservation tient jusqu’à HH:MM ; payer (page Stripe) ou annuler (le stock
 *   revient aux autres clients).
 * - Touch & Collect payé : le QR et le code de retrait à montrer au commerçant.
 * - Livraison : le lien de suivi du coursier Uber Direct, dès que la course est commandée.
 * - « Signaler un problème » (0027) : le serveur route vers un remboursement ou vers le back-office
 *   (`ServerReportIssue`) ; sans signalement possible, le support, rattaché à la commande.
 */
export function ServerOrderPanel({
  order,
  now,
  onChanged,
}: {
  order: ServerOrder;
  now: number;
  /** Relire la commande (après paiement, annulation…). */
  onChanged: () => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const [busy, setBusy] = useState<'pay' | 'cancel' | null>(null);
  const [error, setError] = useState<OrdersError | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const pickup = order.fulfilment === 'touch-collect' && PAID.includes(order.status);
  useEffect(() => {
    if (!pickup) return;
    let alive = true;
    void fetchPickupCode(order.id).then((c) => {
      if (alive) setCode(c);
    });
    return () => {
      alive = false;
    };
  }, [pickup, order.id]);

  const toPay = order.status === 'paiement_attente';
  const expired = toPay && order.reservedUntil < now;

  const pay = async () => {
    if (busy) return;
    setBusy('pay');
    setError(null);
    const res = await startPayment(order.id);
    if (res.ok) await openPaymentPage(res.value);
    else setError(res.code);
    setBusy(null);
    onChanged();
  };

  const cancel = async () => {
    if (busy) return;
    setBusy('cancel');
    setError(null);
    const res = await cancelOrder(order.id);
    setBusy(null);
    if (!res.ok) {
      setError(res.code);
      return;
    }
    onChanged();
    router.replace('/commandes');
  };

  return (
    <View className="mb-4 gap-4">
      {toPay ? (
        <View
          testID="server-order-to-pay"
          className="gap-3 rounded-card border border-brand-500 bg-surface p-4"
        >
          <AppText className="font-sans-bold text-ink">
            {expired ? 'Réservation expirée' : 'Commande à payer'}
          </AppText>
          <AppText variant="caption">
            {expired
              ? 'Le stock a été rendu aux autres clients. Repassez commande depuis l’accueil.'
              : `Votre réservation tient jusqu’à ${hhmm(order.reservedUntil)}. Le paiement se fait sur une page sécurisée de Stripe (carte, Apple Pay, Google Pay).`}
          </AppText>
          {!expired ? (
            <View className="gap-2">
              <Button
                testID="server-order-pay"
                label="Payer"
                loading={busy === 'pay'}
                disabled={busy !== null}
                onPress={() => void pay()}
              />
              <Button
                testID="server-order-cancel"
                label="Annuler la commande"
                variant="ghost"
                loading={busy === 'cancel'}
                disabled={busy !== null}
                onPress={() => void cancel()}
              />
            </View>
          ) : null}
          {error ? (
            <AppText testID="server-order-error" variant="caption" className="text-danger">
              {CHECKOUT_ERROR[error]}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {pickup ? (
        <View
          testID="server-order-pickup"
          className="items-center gap-3 rounded-card border border-line bg-surface p-5"
        >
          <AppText className="font-sans-bold text-ink">Votre code de retrait</AppText>
          {code ? (
            <>
              {/* Fond blanc : un QR sur fond sombre perd du contraste et certains scanners le refusent. */}
              <View className="rounded-card bg-white p-3">
                <QRCode
                  value={pickupPayload(order.id, code)}
                  size={160}
                  color="#0A0A0D"
                  backgroundColor="#FFFFFF"
                />
              </View>
              <AppText
                testID="server-order-pickup-code"
                className="font-display text-ink"
                style={{ fontSize: 28, letterSpacing: 6, fontVariant: ['tabular-nums'] }}
              >
                {code}
              </AppText>
              <AppText variant="caption" className="text-center">
                Montrez ce QR (ou dites ce code) au commerçant pour retirer votre commande.
              </AppText>
            </>
          ) : (
            <ActivityIndicator color={colors.brand500} />
          )}
        </View>
      ) : null}

      {order.fulfilment === 'livraison' && order.trackingUrl ? (
        <Pressable
          testID="server-order-tracking"
          accessibilityRole="link"
          accessibilityLabel="Suivre le coursier Uber Direct"
          onPress={() => order.trackingUrl && void Linking.openURL(order.trackingUrl)}
          className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-4 active:opacity-70"
        >
          <Feather name="navigation" size={18} color={colors.brand500} />
          <View className="flex-1">
            <AppText className="font-sans-bold text-ink">Suivre le coursier</AppText>
            <AppText variant="caption">Sa position en direct, par Uber Direct.</AppText>
          </View>
          <Feather name="external-link" size={16} color={colors.inkFaint} />
        </Pressable>
      ) : null}

      <ServerReportIssue order={order} onChanged={onChanged} />
    </View>
  );
}
