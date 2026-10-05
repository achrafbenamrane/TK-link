import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Screen, ThemeToggle } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { formatCents } from '../lib/billing';
import { WHOLESALE_STATUS_LABEL } from '../lib/wholesale-orders';
import { canSupplierPublish } from '../lib/supplier';
import {
  selectOffers,
  selectSupplier,
  selectWholesaleOrders,
  useMerchantStore,
} from '../model/store';

export type WholesalerTarget =
  'new' | 'orders' | 'catalog' | 'offers' | 'documents' | 'payouts' | 'account' | 'setup';

type Props = {
  /** Le nom de l'entreprise, vérifiée. */
  companyName: string;
  area?: string;
  renderAvatar?: () => ReactNode;
  onOpen: (target: WholesalerTarget) => void;
};

const TILES: {
  key: WholesalerTarget;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
}[] = [
  { key: 'new', label: 'Nouvelle offre', icon: 'tag' },
  { key: 'orders', label: 'Commandes', icon: 'truck' },
  { key: 'catalog', label: 'Catalogue', icon: 'package' },
  { key: 'documents', label: 'Factures', icon: 'file-text' },
  { key: 'payouts', label: 'Versements', icon: 'credit-card' },
  { key: 'account', label: 'Paramètres', icon: 'settings' },
];

/**
 * LE TABLEAU DE BORD DU GROSSISTE / FOURNISSEUR — l'accueil de son parcours (étape 6 :
 * « accès au tableau de bord fournisseur »).
 *
 * Il ne ressemble PAS à celui du commerçant : le grossiste vend des LOTS à des
 * commerçants, il prépare, emballe et expédie. Ses chiffres sont ceux de ses offres B2B et
 * des commandes de commerçants qu'il a reçues — rien n'est inventé.
 */
export function WholesalerDashboardScreen({ companyName, area, renderAvatar, onOpen }: Props) {
  const colors = useColors();
  const offers = useMerchantStore(selectOffers).filter((o) => o.audience === 'commercants');
  const orders = useMerchantStore(selectWholesaleOrders);
  const supplier = useMerchantStore(selectSupplier);
  const validated = canSupplierPublish(supplier.status);

  const active = offers.filter((o) => o.state === 'publiee' && !o.offline && o.stockLeft > 0);
  const todo = orders.filter((o) => o.status === 'recue').length;
  const inProgress = orders.filter(
    (o) => o.status === 'preparation' || o.status === 'expediee',
  ).length;
  const revenue = orders.reduce((s, o) => s + o.totalCents, 0);

  return (
    <Screen testID="wholesaler-dashboard" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-28 pt-2">
        {/* En-tête : l'entreprise, vérifiée */}
        <View className="flex-row items-center gap-3 pb-4">
          <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-pill border-2 border-brand-500 bg-surface-muted">
            {renderAvatar ? (
              renderAvatar()
            ) : (
              <Feather name="package" size={22} color={colors.brand500} />
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <AppText variant="title" className="shrink text-lg" numberOfLines={1}>
                {companyName}
              </AppText>
              <Feather name="check-circle" size={15} color={colors.brand500} />
            </View>
            <AppText variant="caption" className="text-ink-faint" numberOfLines={1}>
              Fournisseur{area ? ` · ${area}` : ''}
            </AppText>
          </View>
          <View className="items-end gap-2">
            <Pressable
              testID="wholesaler-bell"
              accessibilityRole="button"
              accessibilityLabel={`${todo} commande${todo > 1 ? 's' : ''} à préparer`}
              hitSlop={8}
              onPress={() => onOpen('orders')}
            >
              <Feather name="bell" size={20} color={colors.ink} />
              {todo > 0 ? (
                <View className="absolute -right-1.5 -top-1.5 h-4 min-w-[16px] items-center justify-center rounded-pill bg-brand-500 px-1">
                  <AppText className="font-sans-bold text-white" style={{ fontSize: 9 }}>
                    {todo}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
            <ThemeToggle />
          </View>
        </View>

        {/* Compte pas encore validé : l'étape à finir (3 à 6 du schéma) */}
        {validated ? null : (
          <Pressable
            testID="wholesaler-setup-banner"
            accessibilityRole="button"
            accessibilityLabel="Finaliser mon dossier fournisseur"
            onPress={() => onOpen('setup')}
            className="mb-4 flex-row items-center gap-3 rounded-card border border-warning bg-surface-muted p-3.5"
          >
            <Feather name="shield" size={20} color={colors.brand500} />
            <View className="flex-1">
              <AppText className="font-sans-bold text-ink" style={{ fontSize: 13.5 }}>
                {supplier.status === 'en_verification'
                  ? 'Dossier en cours de contrôle'
                  : 'Finalisez votre dossier fournisseur'}
              </AppText>
              <AppText variant="caption" style={{ fontSize: 11.5 }}>
                La publication d’offres s’ouvre une fois votre entreprise vérifiée par TK LINK.
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color={colors.inkFaint} />
          </Pressable>
        )}

        {/* Nouvelle offre pro */}
        <View
          testID="wholesaler-new-offer"
          className="mb-4 gap-3 rounded-card border border-brand-500 bg-surface-muted p-4"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-pill border border-brand-500">
              <Feather name="tag" size={22} color={colors.brand500} />
            </View>
            <View className="flex-1">
              <AppText variant="title" className="text-lg">
                Nouvelle offre pro
              </AppText>
              <AppText variant="caption" style={{ fontSize: 12.5 }}>
                Publiez un lot, un prix grossiste et une quantité minimale : les commerçants le
                voient tout de suite.
              </AppText>
            </View>
          </View>
          <View className="flex-row items-center gap-5">
            <View className="flex-1 flex-row items-center gap-2">
              <AppText className="font-display text-brand-500" style={{ fontSize: 26 }}>
                {active.length}
              </AppText>
              <AppText variant="caption" className="flex-1" style={{ fontSize: 11 }}>
                offres actives
              </AppText>
            </View>
            <View className="flex-1 flex-row items-center gap-2">
              <AppText className="font-display text-brand-500" style={{ fontSize: 26 }}>
                {todo}
              </AppText>
              <AppText variant="caption" className="flex-1" style={{ fontSize: 11 }}>
                commandes à préparer
              </AppText>
            </View>
          </View>
          <Pressable
            testID="wholesaler-create-offer"
            accessibilityRole="button"
            accessibilityLabel="Créer une offre pro"
            onPress={() => onOpen(validated ? 'new' : 'setup')}
            className="flex-row items-center justify-center gap-2 rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
          >
            <AppText className="font-sans-bold text-white">
              {validated ? 'Créer une offre pro' : 'Finaliser mon dossier'}
            </AppText>
            <Feather name="plus-circle" size={17} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Les chiffres qui existent vraiment */}
        <View className="mb-4 flex-row gap-2">
          {[
            { v: String(active.length), l: 'Offres actives', i: 'tag' as const },
            { v: String(orders.length), l: 'Commandes reçues', i: 'truck' as const },
            {
              v: `${Math.round(revenue / 100).toLocaleString('fr-FR')} €`,
              l: 'Chiffre d’affaires B2B',
              i: 'trending-up' as const,
            },
            { v: String(inProgress), l: 'En cours', i: 'clock' as const },
          ].map((t) => (
            <View
              key={t.l}
              className="flex-1 items-center gap-1 rounded-card border border-line bg-surface-muted px-1 py-3"
            >
              <Feather name={t.i} size={16} color={colors.brand500} />
              <AppText className="font-display text-ink" style={{ fontSize: 15 }} numberOfLines={1}>
                {t.v}
              </AppText>
              <AppText
                variant="caption"
                className="text-center text-ink-faint"
                style={{ fontSize: 10 }}
                numberOfLines={2}
              >
                {t.l}
              </AppText>
            </View>
          ))}
        </View>

        {/* Contrôles & sécurité — le bandeau du schéma */}
        <View testID="wholesaler-controls" className="mb-4 flex-row gap-2">
          {[
            { l: 'Identité entreprise', ok: validated, i: 'shield' as const },
            { l: 'Compte sécurisé', ok: supplier.deviceEnrolled, i: 'lock' as const },
            { l: 'Stock temps réel', ok: true, i: 'refresh-cw' as const },
            { l: 'Factures & traçabilité', ok: true, i: 'file-text' as const },
          ].map((c) => (
            <View
              key={c.l}
              testID={`wholesaler-control-${c.ok ? 'ok' : 'todo'}`}
              className="flex-1 items-center gap-1 rounded-card border border-line bg-surface-muted px-1 py-2.5"
            >
              <Feather name={c.i} size={15} color={c.ok ? colors.brand500 : colors.inkFaint} />
              <AppText
                variant="caption"
                className={c.ok ? 'text-center text-ink' : 'text-center text-ink-faint'}
                style={{ fontSize: 9.5 }}
                numberOfLines={2}
              >
                {c.l}
              </AppText>
              <AppText className={c.ok ? 'text-success' : 'text-ink-faint'} style={{ fontSize: 9 }}>
                {c.ok ? 'Vérifié' : 'À faire'}
              </AppText>
            </View>
          ))}
        </View>

        {/* Les raccourcis */}
        <View className="mb-5 flex-row flex-wrap gap-2">
          {TILES.map((t) => (
            <Pressable
              key={t.key}
              testID={`wholesaler-open-${t.key}`}
              accessibilityRole="button"
              accessibilityLabel={t.label}
              onPress={() => onOpen(t.key)}
              className="w-[31.5%] items-center gap-1.5 rounded-card border border-line bg-surface-muted px-1 py-3 active:opacity-70"
            >
              <Feather name={t.icon} size={22} color={colors.brand500} />
              <AppText
                className="text-center font-sans-semibold text-ink"
                style={{ fontSize: 11.5 }}
                numberOfLines={2}
              >
                {t.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {/* Offres en cours */}
        <View className="mb-5 gap-2">
          <View className="flex-row items-center justify-between">
            <AppText variant="title" className="text-base">
              Offres en cours
            </AppText>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => onOpen('offers')}>
              <AppText className="font-sans-semibold text-accent-deep" style={{ fontSize: 13 }}>
                Voir tout
              </AppText>
            </Pressable>
          </View>
          {active.length === 0 ? (
            <View className="rounded-card border border-dashed border-line p-4">
              <AppText variant="caption" className="text-center text-ink-faint">
                Aucune offre en ligne pour l’instant.
              </AppText>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-2.5">
              {active.slice(0, 4).map((o) => (
                <View
                  key={o.id}
                  testID={`wholesaler-offer-${o.id}`}
                  className="w-[48%] flex-row items-center gap-2.5 rounded-card border border-line bg-surface-muted p-2.5"
                >
                  <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-control bg-surface-sunken">
                    {o.photoUri ? (
                      <Image
                        source={{ uri: o.photoUri }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                    ) : (
                      <Feather name="package" size={20} color={colors.brand500} />
                    )}
                  </View>
                  <View className="flex-1 gap-0.5">
                    <AppText
                      className="font-sans-semibold text-ink"
                      style={{ fontSize: 12 }}
                      numberOfLines={2}
                    >
                      {o.title}
                    </AppText>
                    <AppText className="font-sans-bold text-brand-500" style={{ fontSize: 13 }}>
                      {formatCents(o.priceCents)}
                    </AppText>
                    <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 10 }}>
                      Stock : {o.stockLeft}
                      {o.minQty > 1 ? ` · min. ${o.minQty}` : ''}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Commandes récentes */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <AppText variant="title" className="text-base">
              Commandes récentes
            </AppText>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => onOpen('orders')}>
              <AppText className="font-sans-semibold text-accent-deep" style={{ fontSize: 13 }}>
                Voir tout
              </AppText>
            </Pressable>
          </View>
          {orders.length === 0 ? (
            <View className="rounded-card border border-dashed border-line p-4">
              <AppText variant="caption" className="text-center text-ink-faint">
                Aucune commande pour l’instant.
              </AppText>
            </View>
          ) : (
            <View className="overflow-hidden rounded-card border border-line bg-surface-muted">
              {orders.slice(0, 4).map((o, i) => (
                <View
                  key={o.id}
                  testID={`wholesaler-recent-${o.id}`}
                  className={`flex-row items-center gap-2 px-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}
                >
                  <AppText
                    className="flex-1 font-sans-semibold text-ink"
                    style={{ fontSize: 12 }}
                    numberOfLines={1}
                  >
                    {o.title}
                  </AppText>
                  <AppText className="text-ink-muted" style={{ fontSize: 11 }}>
                    {o.qty} lot{o.qty > 1 ? 's' : ''}
                  </AppText>
                  <View className="rounded-sm border border-accent px-1.5 py-0.5">
                    <AppText className="text-accent-deep" style={{ fontSize: 9.5 }}>
                      {WHOLESALE_STATUS_LABEL[o.status]}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
