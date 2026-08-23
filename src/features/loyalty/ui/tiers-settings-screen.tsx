import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { colors } from '@/shared/theme/colors';

import type { Tier } from '../lib/tiers';
import { selectTiers, useMerchantLoyaltyStore } from '../model/merchant-store';

/** Un palier en cours de saisie : les nombres y sont du texte, comme au clavier. */
type Draft = { cost: string; reward: string };

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
export function TiersSettingsScreen() {
  const tiers = useMerchantLoyaltyStore(selectTiers);
  const setTiers = useMerchantLoyaltyStore((s) => s.setTiers);

  const [drafts, setDrafts] = useState<Draft[]>(() =>
    tiers.map((t) => ({ cost: String(t.cost), reward: t.reward })),
  );
  const [errors, setErrors] = useState<(string | undefined)[]>([]);

  const set = (index: number, key: keyof Draft, value: string) => {
    setDrafts((list) => list.map((d, i) => (i === index ? { ...d, [key]: value } : d)));
    // L'erreur part dès qu'on retouche la ligne : la laisser affichée pendant la
    // correction donne l'impression que la saisie ne sert à rien.
    setErrors((list) => (list[index] ? list.map((e, i) => (i === index ? undefined : e)) : list));
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
    }));

    setTiers(next);
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
              <TextInput
                testID={`tier-reward-${i + 1}`}
                value={d.reward}
                onChangeText={(v) => set(i, 'reward', v)}
                placeholder="Ex. 1 boisson offerte"
                placeholderTextColor={colors.inkFaint}
                maxLength={60}
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
      </ScrollView>
    </Screen>
  );
}
