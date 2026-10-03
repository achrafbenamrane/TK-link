import { Feather } from '@expo/vector-icons';
import { ScrollView, View } from 'react-native';

import { AppText, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { useColors } from '@/shared/theme/theme-provider';

import { COMMISSION_PCT, commissionCents, formatCents, netCents } from '../lib/billing';

/** Une vente conclue, résumée par la route. */
export type PayoutLine = {
  id: string;
  ref: string;
  title: string;
  totalCents: number;
};

type Props = {
  /** Les ventes honorées (retirées ou livrées) — la base de ce qui sera versé. */
  sales: PayoutLine[];
};

/**
 * VERSEMENTS — l'onglet que la V1.1 exige du commerçant (Commerçant > Flux
 * finance, VALIDÉ) : « le calendrier et les montants de paiement issus de Stripe
 * Connect — TK Link ne construit pas de moteur de trésorerie propre, il expose
 * les données déjà disponibles côté PSP ».
 *
 * Stripe n'est pas branché : l'écran montre donc ce que le commerçant peut déjà
 * vérifier lui-même — ce qu'il a vendu, la commission de TK LINK (5 %, CDC
 * §5.4), et la part qui lui revient — en disant clairement que c'est une
 * ESTIMATION. Les dates et les montants définitifs viendront du PSP ; on ne les
 * invente pas.
 */
export function PayoutsScreen({ sales }: Props) {
  const colors = useColors();
  const gross = sales.reduce((sum, s) => sum + s.totalCents, 0);
  const fee = commissionCents(gross);
  const net = netCents(gross);

  return (
    <Screen testID="payouts-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-10 pt-2">
        <BackButton fallbackHref="/" />
        <AppText variant="display" className="mb-1">
          Versements
        </AppText>
        <AppText variant="caption" className="mb-4">
          Ce qui vous revient sur vos ventes honorées.
        </AppText>

        <View
          testID="payouts-summary"
          className="mb-4 gap-3 rounded-card border border-brand-500 bg-surface-muted p-4"
        >
          <AppText variant="caption">À verser (estimation)</AppText>
          <AppText className="font-display text-ink" style={{ fontSize: 34, lineHeight: 42 }}>
            {formatCents(net)}
          </AppText>
          <View className="gap-1.5 border-t border-line pt-3">
            <Row label="Ventes honorées" value={formatCents(gross)} />
            <Row
              label={`Commission TK LINK (${COMMISSION_PCT} %)`}
              value={`− ${formatCents(fee)}`}
            />
          </View>
        </View>

        <View className="mb-4 flex-row items-start gap-2.5 rounded-card bg-surface-muted p-3.5">
          <Feather name="info" size={15} color={colors.inkFaint} />
          <AppText variant="caption" className="flex-1 text-ink-muted" style={{ fontSize: 12 }}>
            Estimation calculée sur vos ventes : le calendrier et les montants définitifs viendront
            de Stripe Connect, sans que TK LINK ne tienne votre trésorerie.
          </AppText>
        </View>

        <AppText variant="title" className="mb-2 text-base">
          Détail
        </AppText>
        {sales.length === 0 ? (
          <View className="rounded-card border border-dashed border-line p-4">
            <AppText variant="caption" className="text-center text-ink-faint">
              Aucune vente honorée pour l’instant.
            </AppText>
          </View>
        ) : (
          <View className="gap-2">
            {sales.map((s) => (
              <View
                key={s.id}
                testID={`payout-${s.id}`}
                className="flex-row items-center gap-3 rounded-card border border-line bg-surface-muted p-3"
              >
                <View className="flex-1">
                  <AppText className="font-sans-semibold text-ink" numberOfLines={1}>
                    {s.title}
                  </AppText>
                  <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11.5 }}>
                    {s.ref}
                  </AppText>
                </View>
                <View className="items-end">
                  <AppText className="font-sans-bold text-ink">
                    {formatCents(netCents(s.totalCents))}
                  </AppText>
                  <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11 }}>
                    sur {formatCents(s.totalCents)}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <AppText variant="caption">{label}</AppText>
      <AppText className="font-sans-semibold text-ink">{value}</AppText>
    </View>
  );
}
