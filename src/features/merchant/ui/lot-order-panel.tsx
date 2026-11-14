import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Button } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { formatCents } from '../lib/billing';
import type { OfferMode, PublishedOffer } from '../model/schema';

/** Une ligne de commande B2B : au plus 999 (le serveur, 0023), et jamais plus que le stock. */
const B2B_MAX_PER_LINE = 999;

const MODE_LABEL: Record<OfferMode, string> = {
  'touch-collect': 'Retrait chez le grossiste',
  livraison: 'Expédiée par le grossiste',
};

export type LotCheckout = (input: {
  offerId: string;
  qty: number;
  fulfilment: OfferMode;
}) => Promise<string | null>;

type Props = {
  lot: PublishedOffer;
  /** Réserve et ouvre la page de paiement ; rend un message d'erreur, ou `null` si elle s'est ouverte. */
  checkout: LotCheckout;
  /** Le paiement s'est ouvert (et refermé) : la suite se lit dans « Mes achats ». */
  onDone: () => void;
  onClose: () => void;
};

/** Les bornes de la quantité : le minimum du grossiste, le stock, le plafond du serveur. */
export function lotBounds(lot: Pick<PublishedOffer, 'minQty' | 'stockLeft'>): {
  min: number;
  max: number;
} {
  const min = Math.max(1, lot.minQty);
  return { min, max: Math.min(lot.stockLeft, B2B_MAX_PER_LINE) };
}

/**
 * COMMANDER UNE OFFRE PRO (migration 0023) — sous le lot choisi : la quantité (jamais sous le minimum
 * du grossiste, CDC V1.1), le mode de remise, le total, et le paiement en ligne (« paiement
 * instantané dans l'app pour toutes les commandes B2B en V1 »).
 */
export function LotOrderPanel({ lot, checkout, onDone, onClose }: Props) {
  const colors = useColors();
  const { min, max } = lotBounds(lot);
  const [qty, setQty] = useState(min);
  const [mode, setMode] = useState<OfferMode>(lot.modes[0] ?? 'touch-collect');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const soldOut = max < min;

  const pay = async () => {
    setBusy(true);
    setError(null);
    const message = await checkout({ offerId: lot.id, qty, fulfilment: mode });
    setBusy(false);
    if (message) setError(message);
    else onDone();
  };

  const step = (delta: number) => setQty((q) => Math.min(max, Math.max(min, q + delta)));

  return (
    <View testID={`lot-panel-${lot.id}`} className="mt-3 gap-3 border-t border-line pt-3">
      {soldOut ? (
        <AppText variant="caption" className="text-ink-muted">
          Il reste moins que la commande minimale : ce lot ne se commande plus.
        </AppText>
      ) : (
        <>
          <View className="flex-row items-center justify-between">
            <AppText className="font-sans-semibold text-ink">Quantité</AppText>
            <View className="flex-row items-center gap-3">
              <Pressable
                testID={`lot-panel-minus-${lot.id}`}
                accessibilityRole="button"
                accessibilityLabel="Un lot de moins"
                disabled={qty <= min}
                onPress={() => step(-1)}
                className="h-10 w-10 items-center justify-center rounded-pill border border-line bg-surface-muted"
              >
                <Feather name="minus" size={16} color={qty <= min ? colors.inkFaint : colors.ink} />
              </Pressable>
              <AppText
                testID={`lot-panel-qty-${lot.id}`}
                className="w-12 text-center font-display text-ink"
                style={{ fontSize: 18 }}
              >
                {qty}
              </AppText>
              <Pressable
                testID={`lot-panel-plus-${lot.id}`}
                accessibilityRole="button"
                accessibilityLabel="Un lot de plus"
                disabled={qty >= max}
                onPress={() => step(1)}
                className="h-10 w-10 items-center justify-center rounded-pill border border-line bg-surface-muted"
              >
                <Feather name="plus" size={16} color={qty >= max ? colors.inkFaint : colors.ink} />
              </Pressable>
            </View>
          </View>
          {min > 1 ? (
            <AppText variant="caption" className="-mt-2 text-ink-faint">
              {`Au moins ${min} lots · ${lot.stockLeft} disponibles`}
            </AppText>
          ) : null}

          <View className="flex-row flex-wrap gap-2">
            {lot.modes.map((m) => (
              <Pressable
                key={m}
                testID={`lot-panel-mode-${m}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: mode === m }}
                onPress={() => setMode(m)}
                className={cn(
                  'rounded-pill border px-3 py-2',
                  mode === m ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
                )}
              >
                <AppText
                  className={cn(
                    'font-sans-semibold',
                    mode === m ? 'text-brand-600' : 'text-ink-muted',
                  )}
                  style={{ fontSize: 12.5 }}
                >
                  {MODE_LABEL[m]}
                </AppText>
              </Pressable>
            ))}
          </View>

          {error ? (
            <AppText testID="lot-panel-error" variant="caption" className="text-danger">
              {error}
            </AppText>
          ) : null}

          <Button
            testID={`lot-panel-pay-${lot.id}`}
            label={`Payer ${formatCents(lot.priceCents * qty)}`}
            loading={busy}
            onPress={() => void pay()}
          />
        </>
      )}
      <Pressable
        testID={`lot-panel-close-${lot.id}`}
        accessibilityRole="button"
        onPress={onClose}
        className="items-center py-1"
      >
        <AppText variant="caption" className="text-ink-muted">
          Fermer
        </AppText>
      </Pressable>
    </View>
  );
}
