import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import { AppText, Button, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { useColors } from '@/shared/theme/theme-provider';

import { formatCents } from '../lib/billing';
import { OFFER_MODES, type OfferMode } from '../model/schema';
import { selectOffers, selectProfile, useMerchantStore } from '../model/store';

/** Le grossiste retire ou expédie : jamais « Touch & Collect », qui est le mot du commerce. */
const MODE_LABEL: Record<OfferMode, string> = {
  'touch-collect': 'Retrait sur place',
  livraison: 'Expédition',
};

/**
 * LE PARAMÉTRAGE DU CATALOGUE — étape 7 du « Process grossiste / fournisseur » du client :
 * « stocks, lots, prix pro, livraison ».
 *
 * C'est l'équivalent, côté fournisseur, de la boutique du commerçant (horaires, zone, Touch &
 * Collect) : ce n'est PAS le même écran, parce qu'un grossiste ne règle pas des horaires
 * d'ouverture mais ce qu'il tient en stock, à quel prix, et comment il livre.
 */
export function WholesalerCatalogScreen({ onNewOffer }: { onNewOffer?: () => void } = {}) {
  const colors = useColors();
  const lots = useMerchantStore(selectOffers).filter(
    (o) => o.audience === 'commercants' && o.state === 'publiee' && !o.offline,
  );
  const profile = useMerchantStore(selectProfile);
  const saveProfile = useMerchantStore((s) => s.saveProfile);
  const adjustStock = useMerchantStore((s) => s.adjustStock);

  const [modes, setModes] = useState<OfferMode[]>(profile.modes);
  const [zone, setZone] = useState(profile.zone);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggle = (m: OfferMode) => {
    setModes((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
    setSaved(false);
  };

  const save = () => {
    if (modes.length === 0) {
      setError('Choisissez au moins un mode de livraison');
      return;
    }
    setError(null);
    saveProfile({ ...profile, modes, zone: zone.trim() });
    setSaved(true);
  };

  return (
    <Screen testID="wholesaler-catalog" padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-5 px-5 pb-10"
      >
        <View className="flex-row items-center gap-3 pt-2">
          <BackButton fallbackHref="/" />
          <View className="flex-1">
            <AppText variant="display" className="text-2xl">
              Catalogue
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              Vos lots, leur stock et la façon dont vous livrez.
            </AppText>
          </View>
        </View>

        {/* Stocks, lots, prix pro */}
        <View className="gap-2">
          <AppText variant="title" className="text-base">
            Stocks et lots
          </AppText>
          {lots.length === 0 ? (
            <View
              testID="wholesaler-catalog-empty"
              className="rounded-card border border-dashed border-line p-4"
            >
              <AppText variant="caption" className="text-center text-ink-faint">
                Aucun lot en ligne. Créez une offre pro : son stock se règle ici ensuite.
              </AppText>
            </View>
          ) : (
            lots.map((o) => (
              <View
                key={o.id}
                testID={`wholesaler-lot-${o.id}`}
                className="gap-2 rounded-card border border-line bg-surface-muted p-3.5"
              >
                <AppText className="font-sans-bold text-ink" numberOfLines={2}>
                  {o.title}
                </AppText>
                <View className="flex-row items-center justify-between">
                  <View>
                    <AppText className="font-sans-bold text-brand-500" style={{ fontSize: 15 }}>
                      {formatCents(o.priceCents)}
                      <AppText className="text-ink-faint" style={{ fontSize: 11 }}>
                        {'  '}prix pro · lot
                      </AppText>
                    </AppText>
                    {o.minQty > 1 ? (
                      <AppText variant="caption" className="text-ink-faint">
                        Minimum de commande : {o.minQty}
                      </AppText>
                    ) : null}
                  </View>
                  <View className="flex-row items-center gap-3">
                    <Pressable
                      testID={`wholesaler-lot-${o.id}-dec`}
                      accessibilityRole="button"
                      accessibilityLabel={`Retirer un lot de stock : ${o.title}`}
                      hitSlop={8}
                      onPress={() => adjustStock(o.id, -1)}
                      className="h-9 w-9 items-center justify-center rounded-pill border border-line"
                    >
                      <Feather name="minus" size={16} color={colors.ink} />
                    </Pressable>
                    <View className="min-w-[44px] items-center">
                      <AppText
                        testID={`wholesaler-lot-${o.id}-stock`}
                        className="font-display text-ink"
                        style={{ fontSize: 18 }}
                      >
                        {o.stockLeft}
                      </AppText>
                      <AppText variant="caption" style={{ fontSize: 10 }}>
                        en stock
                      </AppText>
                    </View>
                    <Pressable
                      testID={`wholesaler-lot-${o.id}-inc`}
                      accessibilityRole="button"
                      accessibilityLabel={`Ajouter un lot de stock : ${o.title}`}
                      hitSlop={8}
                      onPress={() => adjustStock(o.id, 1)}
                      className="h-9 w-9 items-center justify-center rounded-pill border border-brand-500"
                    >
                      <Feather name="plus" size={16} color={colors.brand500} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}
          {onNewOffer ? (
            <Button
              testID="wholesaler-catalog-new"
              label="Nouvelle offre pro"
              variant="secondary"
              onPress={onNewOffer}
            />
          ) : null}
        </View>

        {/* Livraison */}
        <View className="gap-2">
          <AppText variant="title" className="text-base">
            Livraison
          </AppText>
          <View className="gap-1 rounded-card border border-line bg-surface-muted px-3.5 py-1">
            {OFFER_MODES.map((m, i) => (
              <View
                key={m}
                className={`flex-row items-center justify-between py-3 ${i > 0 ? 'border-t border-line' : ''}`}
              >
                <AppText className="text-ink" style={{ fontSize: 14 }}>
                  {MODE_LABEL[m]}
                </AppText>
                <Switch
                  testID={`wholesaler-mode-${m}`}
                  accessibilityLabel={MODE_LABEL[m]}
                  value={modes.includes(m)}
                  onValueChange={() => toggle(m)}
                  trackColor={{ true: colors.brand500, false: colors.line }}
                />
              </View>
            ))}
          </View>
          {error ? (
            <AppText testID="wholesaler-modes-error" variant="caption" className="text-danger">
              {error}
            </AppText>
          ) : null}

          <AppText variant="caption" className="mt-1 font-sans-semibold text-ink-muted">
            Zone desservie
          </AppText>
          <TextInput
            testID="wholesaler-zone"
            value={zone}
            onChangeText={(v) => {
              setZone(v);
              setSaved(false);
            }}
            placeholder="Ex. Occitanie · expédition sous 48 h"
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel="Zone desservie"
            className="rounded-control border border-line bg-surface px-3.5 py-3 font-sans text-ink"
            style={{ fontSize: 15 }}
          />
        </View>

        <Button testID="wholesaler-catalog-save" label="Enregistrer" onPress={save} />
        {saved ? (
          <AppText testID="wholesaler-catalog-saved" variant="caption" className="text-center">
            Catalogue enregistré.
          </AppText>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
