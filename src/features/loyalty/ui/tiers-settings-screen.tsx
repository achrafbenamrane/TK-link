import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { useColors } from '@/shared/theme/theme-provider';

import { PROGRAM_UNITS, UNIT_LABEL, type ProgramUnit, type Tier } from '../lib/tiers';
import { programOf, selectPrograms, useMerchantLoyaltyStore } from '../model/merchant-store';

/** Un produit du commerçant, proposé comme récompense. */
export type RewardProduct = { id: string; title: string };

type Props = {
  /** Le commerçant dont on règle le programme — passé par la route (composition). */
  merchantId: string;
  /**
   * Les produits du commerçant, passés par la route : cette tranche n'importe ni
   * le catalogue ni l'espace commerçant. Absent ou vide : seule la saisie libre
   * reste possible.
   */
  products?: RewardProduct[];
};

/** Un palier en cours de saisie : les nombres y sont du texte, comme au clavier. */
type Draft = { cost: string; reward: string; productId?: string };

const REWARD_MAX = 60;

/**
 * LES QUATRE PALIERS, RÉGLÉS PAR LE COMMERÇANT — CDC §8.3.
 *
 * Les paliers étaient écrits en dur et partagés par toutes les enseignes : un
 * boulanger offrait « 4 californias saumon-cheese ». Le §8.3 demande qu'ils
 * soient configurables, et c'est le minimum pour qu'une fidélité veuille dire
 * quelque chose — la récompense doit ressembler à ce que le commerce vend.
 *
 * Deux garde-fous, tous deux vérifiés avant l'enregistrement :
 *
 *  • les coûts doivent CROÎTRE. Un palier 3 moins cher que le palier 2 rendrait
 *    le second inatteignable en pratique — personne ne s'arrête à mi-chemin
 *    d'une récompense moins chère qui suit.
 *  • aucun palier vide. Un avantage sans libellé s'affiche comme une case
 *    blanche sur la carte du client, qui ne saura pas ce qu'il a gagné.
 *
 * Les avantages DÉJÀ RÉCLAMÉS ne sont pas repris : un client qui a obtenu sa
 * boisson ne la rend pas parce que le barème a changé.
 */
export function TiersSettingsScreen({ merchantId, products = [] }: Props) {
  const colors = useColors();
  const programs = useMerchantLoyaltyStore(selectPrograms);
  const saveProgram = useMerchantLoyaltyStore((s) => s.saveProgram);
  const program = programOf(programs, merchantId);
  const tiers = program.tiers;
  // Un programme enregistré est en ligne : son unité ne bouge plus (CDC V1.1).
  const locked = programs[merchantId] !== undefined;
  const [unit, setUnit] = useState<ProgramUnit>(program.unit);

  const [drafts, setDrafts] = useState<Draft[]>(() =>
    tiers.map((t) => ({ cost: String(t.cost), reward: t.reward, productId: t.productId })),
  );
  // Le palier dont la liste de produits est ouverte (un seul à la fois).
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);
  const [errors, setErrors] = useState<(string | undefined)[]>([]);
  const redeemReward = useMerchantLoyaltyStore((s) => s.redeemReward);
  const [code, setCode] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const redeem = () => {
    const res = redeemReward(merchantId, code);
    setRedeemMsg(
      res.ok
        ? { ok: true, text: `Validée : ${res.reward.label}` }
        : {
            ok: false,
            text:
              res.reason === 'deja_utilisee'
                ? 'Cette récompense a déjà été utilisée ou partagée.'
                : 'Code inconnu chez vous.',
          },
    );
    if (res.ok) setCode('');
  };

  const set = (index: number, key: 'cost' | 'reward', value: string) => {
    // Retoucher le texte à la main, c'est choisir « Autre récompense » : le lien
    // avec le produit se défait.
    setDrafts((list) =>
      list.map((d, i) =>
        i === index
          ? { ...d, [key]: value, ...(key === 'reward' ? { productId: undefined } : {}) }
          : d,
      ),
    );
    // L'erreur part dès qu'on retouche la ligne : la laisser affichée pendant la
    // correction donne l'impression que la saisie ne sert à rien.
    setErrors((list) => (list[index] ? list.map((e, i) => (i === index ? undefined : e)) : list));
  };

  const pickProduct = (index: number, product: RewardProduct | null) => {
    setDrafts((list) =>
      list.map((d, i) =>
        i === index
          ? product
            ? { ...d, reward: product.title.slice(0, REWARD_MAX), productId: product.id }
            : { ...d, productId: undefined }
          : d,
      ),
    );
    setErrors((list) => (list[index] ? list.map((e, i) => (i === index ? undefined : e)) : list));
    setPickerOpen(null);
  };

  const save = () => {
    const found: (string | undefined)[] = [];
    let previous = 0;

    drafts.forEach((d, i) => {
      const cost = Number.parseInt(d.cost, 10);
      if (!Number.isFinite(cost) || cost <= 0) found[i] = 'Indiquez un nombre de points';
      else if (cost <= previous) found[i] = 'Doit être supérieur au palier précédent';
      else if (!d.reward.trim()) found[i] = 'Indiquez l’avantage obtenu';
      if (Number.isFinite(cost) && cost > previous) previous = cost;
    });

    if (found.some(Boolean)) {
      setErrors(found);
      return;
    }

    const next: Tier[] = drafts.map((d, i) => ({
      rank: i + 1,
      cost: Number.parseInt(d.cost, 10),
      reward: d.reward.trim(),
      ...(d.productId ? { productId: d.productId } : {}),
    }));

    saveProgram(merchantId, { unit, tiers: next });
    setErrors([]);
    Alert.alert(
      'Paliers enregistrés',
      'Vos clients verront le nouveau barème dès leur prochaine visite. Les avantages déjà réclamés leur restent acquis.',
    );
  };

  return (
    <Screen testID="tiers-settings-screen" padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-5 pb-10 pt-2"
        keyboardShouldPersistTaps="handled"
      >
        <BackButton fallbackHref="/profil" />

        <View className="gap-1">
          <AppText variant="display" className="text-2xl">
            Paliers de fidélité
          </AppText>
          <AppText variant="caption">
            Ce que vos clients obtiennent, et à combien de points. Le barème est propre à votre
            commerce.
          </AppText>
        </View>

        {/* L'unité de calcul — choisie à la création, figée une fois en ligne. */}
        <View className="gap-2 rounded-card border border-line bg-surface p-4">
          <AppText variant="label">Unité de calcul</AppText>
          <View className="flex-row gap-2">
            {PROGRAM_UNITS.map((u) => {
              const on = unit === u;
              return (
                <Pressable
                  key={u}
                  testID={`program-unit-${u}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: locked }}
                  accessibilityLabel={UNIT_LABEL[u].title}
                  disabled={locked}
                  onPress={() => setUnit(u)}
                  className={cn(
                    'flex-1 gap-0.5 rounded-control border p-3',
                    on ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface-muted',
                    locked && !on && 'opacity-50',
                  )}
                >
                  <AppText
                    className={cn('font-sans-semibold', on ? 'text-brand-600' : 'text-ink-muted')}
                    style={{ fontSize: 13 }}
                  >
                    {UNIT_LABEL[u].title}
                  </AppText>
                  <AppText variant="caption" style={{ fontSize: 11 }}>
                    {UNIT_LABEL[u].rule}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText testID="program-unit-note" variant="caption" className="text-ink-faint">
            {locked
              ? 'Votre programme est en ligne : l’unité de calcul ne peut plus être modifiée.'
              : 'Ce choix sera définitif une fois le programme enregistré.'}
          </AppText>
        </View>

        {drafts.map((d, i) => (
          <View
            key={`tier-${i}`}
            testID={`tier-row-${i + 1}`}
            className="gap-2.5 rounded-card border border-line bg-surface p-4"
          >
            <View className="flex-row items-center gap-2">
              <View className="h-7 w-7 items-center justify-center rounded-pill bg-brand-500">
                <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 12 }}>
                  {i + 1}
                </AppText>
              </View>
              <AppText variant="label">
                Palier {i + 1} sur {drafts.length}
              </AppText>
            </View>

            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                Points nécessaires
              </AppText>
              <TextInput
                testID={`tier-cost-${i + 1}`}
                value={d.cost}
                onChangeText={(v) => set(i, 'cost', v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="20"
                placeholderTextColor={colors.inkFaint}
                accessibilityLabel={`Points nécessaires pour le palier ${i + 1}`}
                className={cn(
                  'rounded-control border bg-surface px-3.5 py-3 font-sans text-ink',
                  errors[i] ? 'border-danger' : 'border-line',
                )}
                style={{ fontSize: 15 }}
              />
            </View>

            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                Avantage obtenu
              </AppText>

              {/* Choisir l'un de ses produits… */}
              {products.length > 0 ? (
                <View className="gap-1.5">
                  <Pressable
                    testID={`loyalty-reward-product-open-${i + 1}`}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: pickerOpen === i }}
                    accessibilityLabel={`Choisir un de mes produits pour le palier ${i + 1}`}
                    onPress={() => setPickerOpen((o) => (o === i ? null : i))}
                    className="flex-row items-center justify-between rounded-control border border-line bg-surface-muted px-3.5 py-3"
                  >
                    <AppText
                      className="flex-1 font-sans-medium text-ink-muted"
                      style={{ fontSize: 14 }}
                      numberOfLines={1}
                    >
                      {products.find((p) => p.id === d.productId)?.title ??
                        'Choisir un de mes produits'}
                    </AppText>
                    <Feather
                      name={pickerOpen === i ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.inkMuted}
                    />
                  </Pressable>
                  {pickerOpen === i ? (
                    <View
                      testID={`loyalty-reward-product-list-${i + 1}`}
                      className="overflow-hidden rounded-control border border-line bg-surface"
                    >
                      {products.map((p) => (
                        <Pressable
                          key={p.id}
                          testID={`loyalty-reward-product-${p.id}`}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: d.productId === p.id }}
                          accessibilityLabel={p.title}
                          onPress={() => pickProduct(i, p)}
                          className={cn(
                            'px-3.5 py-3 active:bg-surface-muted',
                            d.productId === p.id && 'bg-brand-50',
                          )}
                        >
                          <AppText className="text-ink" style={{ fontSize: 14 }} numberOfLines={2}>
                            {p.title}
                          </AppText>
                        </Pressable>
                      ))}
                      <Pressable
                        testID="loyalty-reward-product-other"
                        accessibilityRole="radio"
                        accessibilityState={{ selected: !d.productId }}
                        accessibilityLabel="Autre récompense"
                        onPress={() => pickProduct(i, null)}
                        className="border-t border-line px-3.5 py-3 active:bg-surface-muted"
                      >
                        <AppText
                          className="font-sans-medium text-ink-muted"
                          style={{ fontSize: 14 }}
                        >
                          Autre récompense
                        </AppText>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : (
                <AppText
                  testID={`loyalty-reward-product-empty-${i + 1}`}
                  variant="caption"
                  className="text-ink-faint"
                >
                  Aucun produit publié pour l’instant
                </AppText>
              )}

              {/* …ou écrire une autre récompense. */}
              <TextInput
                testID={`tier-reward-${i + 1}`}
                value={d.reward}
                onChangeText={(v) => set(i, 'reward', v)}
                placeholder="Ex. 1 boisson offerte"
                placeholderTextColor={colors.inkFaint}
                maxLength={REWARD_MAX}
                accessibilityLabel={`Avantage du palier ${i + 1}`}
                className={cn(
                  'rounded-control border bg-surface px-3.5 py-3 font-sans text-ink',
                  errors[i] ? 'border-danger' : 'border-line',
                )}
                style={{ fontSize: 15 }}
              />
            </View>

            {errors[i] ? (
              <AppText testID={`tier-error-${i + 1}`} variant="caption" className="text-danger">
                {errors[i]}
              </AppText>
            ) : null}
          </View>
        ))}

        <Pressable
          testID="tiers-save"
          accessibilityRole="button"
          accessibilityLabel="Enregistrer les paliers"
          onPress={save}
          className="flex-row items-center justify-center gap-2 rounded-control bg-brand-500 py-4 active:bg-brand-600"
        >
          <Feather name="check" size={17} color={colors.inkInverse} />
          <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 15 }}>
            Enregistrer
          </AppText>
        </Pressable>

        <AppText variant="caption" className="text-center text-ink-faint">
          Les avantages déjà réclamés par vos clients leur restent acquis.
        </AppText>

        {/* Valider une récompense — le client montre son QR ; on lit le code. */}
        <View
          testID="reward-redeem"
          className="gap-2.5 rounded-card border border-line bg-surface p-4"
        >
          <AppText variant="label">Valider une récompense</AppText>
          <AppText variant="caption" className="text-ink-faint">
            Scannez le QR du client, ou saisissez le code affiché sous le QR.
          </AppText>
          <TextInput
            testID="reward-redeem-code"
            value={code}
            onChangeText={(v) => {
              setCode(v.toUpperCase());
              setRedeemMsg(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="TK-XXXXXX"
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel="Code de la récompense"
            className="rounded-control border border-line bg-surface px-3.5 py-3 font-sans text-ink"
            style={{ fontSize: 15, letterSpacing: 1 }}
          />
          {redeemMsg ? (
            <AppText
              testID="reward-redeem-result"
              variant="caption"
              className={redeemMsg.ok ? 'text-success' : 'text-danger'}
            >
              {redeemMsg.text}
            </AppText>
          ) : null}
          <Pressable
            testID="reward-redeem-submit"
            accessibilityRole="button"
            accessibilityLabel="Valider la récompense"
            disabled={code.trim().length === 0}
            onPress={redeem}
            className={cn(
              'items-center rounded-control bg-surface-inverse py-3',
              code.trim().length === 0 && 'opacity-40',
            )}
          >
            <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 14 }}>
              Valider
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
