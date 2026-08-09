import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import {
  COLLECT_LABEL,
  LIFESTYLE_LABEL,
  RADII,
  toggleLifeStyle,
  type CollectType,
  type LifeStyle,
  type Preferences,
  type Radius,
} from '../lib/preferences';
import { useShopStore } from '../model/store';

type Props = { onDone: () => void };

const COLLECTS: CollectType[] = ['tous', 'touch-collect', 'livraison', 'a-commander'];
const STYLES: LifeStyle[] = ['vegetarien', 'vegan', 'halal'];

/**
 * « Ma Fan Zone » — les préférences de recherche de la maquette.
 *
 * On édite une COPIE locale et on ne l'applique qu'au bouton : sans cela,
 * chaque tap changerait les résultats derrière l'écran, et « Retour »
 * n'annulerait rien.
 */
export function PreferencesScreen({ onDone }: Props) {
  const saved = useShopStore((s) => s.preferences);
  const setPreferences = useShopStore((s) => s.setPreferences);
  const [draft, setDraft] = useState<Preferences>(saved);

  const apply = () => {
    setPreferences(draft);
    onDone();
  };

  return (
    <Screen testID="preferences-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-8">
        <View className="pb-4 pt-2">
          <AppText variant="display" className="text-2xl">
            Ma Fan Zone
          </AppText>
          <AppText variant="caption" className="mt-0.5">
            Ce que vous réglez ici filtre vraiment vos résultats.
          </AppText>
        </View>

        {/* Type de collecte */}
        <Section title="Type de collecte" icon="package">
          <View className="flex-row flex-wrap gap-2">
            {COLLECTS.map((c) => (
              <Chip
                key={c}
                testID={`pref-collect-${c}`}
                label={COLLECT_LABEL[c]}
                active={draft.collect === c}
                onPress={() => setDraft({ ...draft, collect: c })}
              />
            ))}
          </View>
          <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 12 }}>
            Le mode de retrait n’est pas encore porté par les offres : il ne filtre donc rien pour
            l’instant.
          </AppText>
        </Section>

        {/* Rayon */}
        <Section title="Autour de moi" icon="map-pin">
          <View className="flex-row flex-wrap gap-2">
            {RADII.map((r) => (
              <Chip
                key={r}
                testID={`pref-radius-${r}`}
                label={`${r} km`}
                active={draft.radiusKm === r}
                onPress={() => setDraft({ ...draft, radiusKm: r as Radius })}
              />
            ))}
          </View>
        </Section>

        {/* Life style */}
        <Section title="Life Style" icon="heart">
          <View className="flex-row flex-wrap gap-2">
            {STYLES.map((l) => (
              <Chip
                key={l}
                testID={`pref-style-${l}`}
                label={LIFESTYLE_LABEL[l]}
                active={draft.lifestyle.includes(l)}
                onPress={() =>
                  setDraft({ ...draft, lifestyle: toggleLifeStyle(draft.lifestyle, l) })
                }
              />
            ))}
          </View>
          <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 12 }}>
            Une offre dont le régime n’est pas renseigné n’apparaît pas : mieux vaut en manquer une
            que d’en proposer une qui ne convient pas.
          </AppText>
        </Section>

        {/* Actions */}
        <View className="mt-6 gap-2">
          <Pressable
            testID="pref-apply"
            accessibilityRole="button"
            accessibilityLabel="Appliquer les préférences"
            onPress={apply}
            className="items-center rounded-control bg-brand-500 py-4 active:bg-brand-600"
          >
            <AppText className="font-sans-bold text-ink-inverse">Appliquer</AppText>
          </Pressable>
          <Pressable
            testID="pref-back"
            accessibilityRole="button"
            accessibilityLabel="Retour sans appliquer"
            onPress={onDone}
            className="items-center py-3"
          >
            <AppText variant="caption" className="text-ink-muted">
              Retour
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: 'package' | 'map-pin' | 'heart';
  children: React.ReactNode;
}) {
  return (
    <View className="mt-5 gap-2.5">
      <View className="flex-row items-center gap-2">
        <Feather name={icon} size={16} color={colors.brand600} />
        <AppText className="font-sans-semibold text-ink">{title}</AppText>
      </View>
      {children}
    </View>
  );
}

function Chip({
  testID,
  label,
  active,
  onPress,
}: {
  testID: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={cn('rounded-pill px-4 py-2.5', active ? 'bg-brand-500' : 'bg-surface-muted')}
    >
      <AppText
        className={cn('font-sans-semibold', active ? 'text-ink-inverse' : 'text-ink-muted')}
        style={{ fontSize: 13 }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
