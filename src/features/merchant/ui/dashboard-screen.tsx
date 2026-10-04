import { Feather } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen, ThemeToggle } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { formatCents, freeLeft } from '../lib/billing';
import { liveOffers, secondsLeft } from '../lib/offers';
import { selectOffers, selectUsed, useMerchantStore } from '../model/store';

/** Une commande, déjà résumée par la route : `merchant` ne connaît pas `shop`. */
export type DashboardOrder = {
  id: string;
  /** « #TKL-1028 ». */
  ref: string;
  title: string;
  /** « Touch & Collect » ou « Livraison ». */
  modeLabel: string;
  statusLabel: string;
  /** À faire (orange), en cours (bleu), terminé (vert). */
  tone: 'todo' | 'progress' | 'done';
  totalCents: number;
};

export type DashboardTarget =
  | 'flash'
  | 'orders'
  | 'loyalty'
  | 'stats'
  | 'offers'
  | 'wholesale'
  | 'payouts'
  | 'documents'
  | 'shop'
  | 'account';

type Props = {
  shopName: string;
  area?: string;
  /** L'avatar du commerce — fourni par la route (la galerie vit dans `onboarding`). */
  renderAvatar?: () => ReactNode;
  /** Les commandes du commerce, de la plus récente à la plus ancienne. */
  orders: DashboardOrder[];
  /** Combien de paliers de fidélité le commerçant a réglés (CDC §8.3). */
  tiersCount: number;
  onOpen: (target: DashboardTarget) => void;
};

const TILES: {
  key: DashboardTarget;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
}[] = [
  { key: 'flash', label: 'Flash', icon: 'zap' },
  { key: 'orders', label: 'Commandes', icon: 'shopping-bag' },
  { key: 'loyalty', label: 'Fidélité', icon: 'award' },
  { key: 'stats', label: 'Statistiques', icon: 'bar-chart-2' },
  { key: 'offers', label: 'Produits / Stock', icon: 'box' },
  { key: 'wholesale', label: 'Grossistes', icon: 'package' },
  { key: 'payouts', label: 'Versements', icon: 'credit-card' },
  { key: 'documents', label: 'Documents', icon: 'file-text' },
  { key: 'shop', label: 'Site magasin', icon: 'home' },
  { key: 'account', label: 'Paramètres', icon: 'settings' },
];

const TONE_CLASS: Record<DashboardOrder['tone'], string> = {
  todo: 'border-warning text-warning',
  progress: 'border-accent text-accent-deep',
  done: 'border-success text-success',
};

function timeLabel(seconds: number): string {
  if (seconds <= 0) return 'terminée';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${two(h)}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/**
 * LE TABLEAU DE BORD DU COMMERÇANT — l'onglet « Accueil » de la maquette.
 *
 * Il n'est PAS l'écran d'ouverture : la V1.1 veut que l'appareil du commerce
 * s'ouvre sur la liste des commandes en cours — « ni les réglages ni les
 * chiffres » — pour qu'un employé marque une commande prête sans rien voir
 * d'autre. Le tableau de bord, lui, est à un geste.
 *
 * Aucun chiffre n'est inventé : tout vient de ce que le commerçant a publié et
 * de ce qui lui a été commandé. « Clients fidélisés » et le chiffre d'affaires
 * des autres jours exigent le serveur (CDC §12.2) ; ils viendront avec lui.
 */
export function MerchantDashboardScreen({
  shopName,
  area,
  renderAvatar,
  orders,
  tiersCount,
  onOpen,
}: Props) {
  const colors = useColors();
  const [now] = useState(() => Date.now());
  const offers = useMerchantStore(selectOffers);
  const used = useMerchantStore(selectUsed);

  const live = liveOffers(offers, now);
  const todo = orders.filter((o) => o.tone === 'todo').length;
  const revenue = orders.reduce((sum, o) => sum + o.totalCents, 0);
  const free = freeLeft(used);

  return (
    <Screen testID="merchant-dashboard" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-28 pt-2">
        {/* En-tête : le commerce, vérifié, et le mode d'affichage. */}
        <View className="flex-row items-center gap-3 pb-4">
          <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-pill border-2 border-brand-500 bg-surface-muted">
            {renderAvatar ? (
              renderAvatar()
            ) : (
              <Feather name="shopping-bag" size={22} color={colors.brand500} />
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <AppText variant="title" className="shrink text-lg" numberOfLines={1}>
                {shopName}
              </AppText>
              <Feather name="check-circle" size={15} color={colors.brand500} />
            </View>
            {area ? (
              <View className="mt-0.5 flex-row items-center gap-1">
                <Feather name="map-pin" size={12} color={colors.accent} />
                <AppText variant="caption" className="text-accent-deep" numberOfLines={1}>
                  {area}
                </AppText>
              </View>
            ) : null}
          </View>
          <ThemeToggle />
        </View>

        {/* Nouveau Flash — l'appel à l'action de la maquette. */}
        <View
          testID="dashboard-new-flash"
          className="mb-4 gap-3 rounded-card border border-brand-500 bg-surface-muted p-4"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-pill border border-brand-500">
              <Feather name="zap" size={22} color={colors.brand500} />
            </View>
            <View className="flex-1">
              <AppText variant="title" className="text-lg">
                Nouveau Flash
              </AppText>
              <AppText variant="caption" style={{ fontSize: 12.5 }}>
                Créez une opération Flash et attirez plus de clients dès maintenant.
              </AppText>
            </View>
          </View>
          <View className="flex-row items-center gap-5">
            <Stat value={String(live.length)} label="Flash actifs" tone="brand" />
            <Stat value={String(free)} label="opérations Flash gratuites restantes" tone="brand" />
          </View>
          <Pressable
            testID="dashboard-create-flash"
            accessibilityRole="button"
            accessibilityLabel="Créer un Flash"
            onPress={() => onOpen('flash')}
            className="flex-row items-center justify-center gap-2 rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
          >
            <AppText className="font-sans-bold text-ink-inverse">Créer un Flash</AppText>
            <Feather name="plus-circle" size={17} color={colors.inkInverse} />
          </Pressable>
        </View>

        {/* Les chiffres qui existent vraiment. */}
        <View className="mb-4 flex-row gap-2">
          <Tile value={String(live.length)} label="Flash actifs" icon="zap" />
          <Tile value={String(orders.length)} label="Commandes" icon="shopping-bag" />
          <Tile value={formatCents(revenue)} label="Chiffre d’affaires" icon="trending-up" />
          <Tile value={String(todo)} label="À préparer" icon="clock" />
        </View>

        {/* Les raccourcis. */}
        <View className="mb-5 flex-row flex-wrap gap-2">
          {TILES.map((t) => (
            <Pressable
              key={t.key}
              testID={`dashboard-open-${t.key}`}
              accessibilityRole="button"
              accessibilityLabel={t.label}
              onPress={() => onOpen(t.key)}
              className="w-[23%] items-center gap-1.5 rounded-card border border-line bg-surface-muted px-1 py-3 active:opacity-70"
            >
              <Feather name={t.icon} size={22} color={colors.brand500} />
              <AppText
                className="text-center font-sans-semibold text-ink"
                style={{ fontSize: 11 }}
                numberOfLines={1}
              >
                {t.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        <Section title="Flash en cours" action="Voir tout" onAction={() => onOpen('offers')}>
          {live.length === 0 ? (
            <Empty text="Aucun Flash en ligne pour l’instant." />
          ) : (
            live.slice(0, 3).map((o) => (
              <View
                key={o.id}
                testID={`dashboard-flash-${o.id}`}
                className="flex-row items-center gap-3 rounded-card border border-line bg-surface-muted p-3"
              >
                <View className="flex-1">
                  <AppText className="font-sans-semibold text-ink" numberOfLines={1}>
                    {o.title}
                  </AppText>
                  <View className="mt-0.5 flex-row items-center gap-1.5">
                    <Feather name="clock" size={12} color={colors.brand600} />
                    <AppText variant="caption" className="text-brand-600">
                      {timeLabel(secondsLeft(o, now))}
                    </AppText>
                  </View>
                </View>
                <View className="items-end">
                  <AppText className="font-sans-bold text-brand-600">
                    {formatCents(o.priceCents)}
                  </AppText>
                  <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11 }}>
                    Stock : {o.stockLeft} restants
                  </AppText>
                </View>
              </View>
            ))
          )}
        </Section>

        <Section title="Commandes récentes" action="Voir tout" onAction={() => onOpen('orders')}>
          {orders.length === 0 ? (
            <Empty text="Aucune commande pour l’instant." />
          ) : (
            orders.slice(0, 3).map((o) => (
              <View
                key={o.id}
                testID={`dashboard-order-${o.id}`}
                className="flex-row items-center gap-3 rounded-card border border-line bg-surface-muted p-3"
              >
                <View className="flex-1">
                  <AppText className="font-sans-semibold text-ink" numberOfLines={1}>
                    {o.title}
                  </AppText>
                  <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11.5 }}>
                    {o.ref} · {o.modeLabel}
                  </AppText>
                </View>
                <View className={cn('rounded-pill border px-2.5 py-1', TONE_CLASS[o.tone])}>
                  <AppText
                    className={cn('font-sans-semibold', TONE_CLASS[o.tone].split(' ')[1])}
                    style={{ fontSize: 11 }}
                  >
                    {o.statusLabel}
                  </AppText>
                </View>
              </View>
            ))
          )}
        </Section>

        <Pressable
          testID="dashboard-loyalty"
          accessibilityRole="button"
          accessibilityLabel="Gérer ma fidélité"
          onPress={() => onOpen('loyalty')}
          className="flex-row items-center gap-3 rounded-card border border-brand-500 bg-surface-muted p-4"
        >
          <Feather name="award" size={24} color={colors.brand500} />
          <View className="flex-1">
            <AppText variant="title" className="text-base">
              Fidélité
            </AppText>
            <AppText variant="caption" style={{ fontSize: 12.5 }}>
              {tiersCount} palier{tiersCount > 1 ? 's' : ''} réglé{tiersCount > 1 ? 's' : ''} · à
              vous de choisir les récompenses
            </AppText>
          </View>
          <Feather name="chevron-right" size={18} color={colors.inkFaint} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

/* ---------------------------------------------------------------- morceaux */

function Stat({ value, label, tone }: { value: string; label: string; tone: 'brand' }) {
  void tone;
  return (
    <View className="flex-1 flex-row items-center gap-2">
      <AppText className="font-display text-brand-500" style={{ fontSize: 26, lineHeight: 32 }}>
        {value}
      </AppText>
      <AppText variant="caption" className="flex-1" style={{ fontSize: 11 }}>
        {label}
      </AppText>
    </View>
  );
}

function Tile({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
}) {
  const colors = useColors();
  return (
    <View className="flex-1 items-center gap-1 rounded-card border border-line bg-surface-muted px-1 py-3">
      <Feather name={icon} size={16} color={colors.brand500} />
      <AppText
        className="font-display text-ink"
        style={{ fontSize: 16, lineHeight: 20 }}
        numberOfLines={1}
      >
        {value}
      </AppText>
      <AppText
        variant="caption"
        className="text-center text-ink-faint"
        style={{ fontSize: 10 }}
        numberOfLines={2}
      >
        {label}
      </AppText>
    </View>
  );
}

function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <View className="mb-5 gap-2">
      <View className="flex-row items-center justify-between">
        <AppText variant="title" className="text-base">
          {title}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          hitSlop={8}
          onPress={onAction}
        >
          <AppText className="font-sans-semibold text-accent-deep" style={{ fontSize: 13 }}>
            {action}
          </AppText>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View className="rounded-card border border-dashed border-line p-4">
      <AppText variant="caption" className="text-center text-ink-faint">
        {text}
      </AppText>
    </View>
  );
}
