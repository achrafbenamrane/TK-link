import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Button, Screen } from '@/shared/ui';
import { ThemeScope, useColors, useScheme } from '@/shared/theme/theme-provider';

import {
  DEFAULT_CUSTOM,
  EDITOR_TABS,
  FIELDS,
  pick,
  randomCustom,
  sameCustom,
} from '../lib/avatar-parts';
import type { Avatar, CustomAvatar } from '../model/schema';
import { AvatarFigure, type FigureZoom } from './avatar-figure';

type Props = {
  visible: boolean;
  /** L'avatar actuel : l'éditeur part de son `custom`, ou du modèle par défaut. */
  initial: Avatar;
  onSave: (avatar: Avatar) => void;
  onClose: () => void;
};

/** Un choix de forme : l'avatar lui-même, avec ce choix appliqué — on choisit en regardant. */
function ShapeOption({
  fieldKey,
  index,
  draft,
  zoom,
  label,
  onPress,
}: {
  fieldKey: keyof CustomAvatar;
  index: number;
  draft: CustomAvatar;
  zoom: FigureZoom;
  label: string;
  onPress: () => void;
}) {
  const selected = pick(draft, fieldKey) === index;
  // Un couvre-chef cacherait la coiffure qu'on est en train de comparer.
  const preview: CustomAvatar = {
    ...draft,
    [fieldKey]: index,
    ...(fieldKey === 'hair' || fieldKey === 'beard' ? { cap: 0 } : {}),
  };
  return (
    <Pressable
      testID={`avatar-opt-${fieldKey}-${index}`}
      accessibilityRole="button"
      accessibilityLabel={`${FIELDS[fieldKey].label} : ${label}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        'w-[22.5%] items-center gap-1 rounded-card border p-1',
        selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface-muted',
      )}
    >
      <View className="overflow-hidden rounded-control">
        <AvatarFigure avatar={preview} size={64} zoom={zoom} />
      </View>
      <AppText
        className={cn(
          'text-center',
          selected ? 'font-sans-semibold text-brand-600' : 'text-ink-muted',
        )}
        style={{ fontSize: 9.5, lineHeight: 12 }}
        numberOfLines={2}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/** Un choix de couleur : une pastille. */
function SwatchOption({
  fieldKey,
  index,
  selected,
  hex,
  label,
  onPress,
}: {
  fieldKey: keyof CustomAvatar;
  index: number;
  selected: boolean;
  hex: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`avatar-opt-${fieldKey}-${index}`}
      accessibilityRole="button"
      accessibilityLabel={`${FIELDS[fieldKey].label} : ${label}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-pill border-2',
        selected ? 'border-brand-500' : 'border-transparent',
      )}
    >
      <View className="h-8 w-8 rounded-pill border border-line" style={{ backgroundColor: hex }} />
    </Pressable>
  );
}

/**
 * L'ÉDITEUR D'AVATAR — demande du client : « modifiable, avec tenues, détails du visage,
 * casquettes… », à la manière de Bitmoji. On travaille sur un BROUILLON : fermer l'éditeur sans
 * enregistrer ne change rien à l'avatar de l'utilisateur.
 *
 * Le logo TK LINK n'est pas une option : il est dessiné par les tenues et les couvre-chefs
 * eux-mêmes (voir `AvatarFigure`), l'éditeur se contente de le rappeler.
 */
function EditorBody({ initial, onSave, onClose }: Omit<Props, 'visible'>) {
  const colors = useColors();
  const [draft, setDraft] = useState<CustomAvatar>(initial.custom ?? DEFAULT_CUSTOM);
  const [tabId, setTabId] = useState(EDITOR_TABS[0]!.id);
  const tab = EDITOR_TABS.find((t) => t.id === tabId) ?? EDITOR_TABS[0]!;

  const set = (key: keyof CustomAvatar, index: number) => setDraft((d) => ({ ...d, [key]: index }));
  const unchanged = initial.custom ? sameCustom(draft, initial.custom) : false;

  return (
    <Screen testID="avatar-editor" padded={false}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
        <Pressable
          testID="avatar-editor-close"
          accessibilityRole="button"
          accessibilityLabel="Fermer sans enregistrer"
          hitSlop={10}
          onPress={onClose}
        >
          <Feather name="x" size={24} color={colors.ink} />
        </Pressable>
        <AppText variant="title">Mon avatar</AppText>
        <View className="w-6" />
      </View>

      <View className="items-center gap-3 pb-3">
        <View
          className="overflow-hidden rounded-pill border-2 border-brand-500"
          testID="avatar-editor-preview"
        >
          <AvatarFigure avatar={draft} size={156} />
        </View>
        <View className="flex-row gap-2">
          <Pressable
            testID="avatar-editor-random"
            accessibilityRole="button"
            accessibilityLabel="Avatar au hasard"
            onPress={() => setDraft(randomCustom())}
            className="flex-row items-center gap-2 rounded-pill bg-surface-muted px-4 py-2"
          >
            <Feather name="shuffle" size={15} color={colors.ink} />
            <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
              Au hasard
            </AppText>
          </Pressable>
          <Pressable
            testID="avatar-editor-reset"
            accessibilityRole="button"
            accessibilityLabel="Revenir au modèle de départ"
            onPress={() => setDraft(DEFAULT_CUSTOM)}
            className="flex-row items-center gap-2 rounded-pill bg-surface-muted px-4 py-2"
          >
            <Feather name="rotate-ccw" size={15} color={colors.ink} />
            <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
              Réinitialiser
            </AppText>
          </Pressable>
        </View>
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-5 py-1"
          accessibilityLabel="Parties de l’avatar"
        >
          {EDITOR_TABS.map((t) => {
            const on = t.id === tab.id;
            return (
              <Pressable
                key={t.id}
                testID={`avatar-tab-${t.id}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setTabId(t.id)}
                className={cn(
                  'rounded-pill border px-4 py-2',
                  on ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface-muted',
                )}
              >
                <AppText
                  className={cn('font-sans-semibold', on ? 'text-ink-inverse' : 'text-ink-muted')}
                  style={{ fontSize: 13 }}
                >
                  {t.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 py-4"
        showsVerticalScrollIndicator={false}
      >
        {tab.fields.map((key) => {
          const field = FIELDS[key];
          // Pas de couleur à choisir pour un couvre-chef qu'on ne porte pas.
          if (key === 'capColor' && pick(draft, 'cap') === 0) return null;
          return (
            <View key={key} className="gap-2" testID={`avatar-field-${key}`}>
              <AppText variant="label">{field.label}</AppText>
              <View className="flex-row flex-wrap gap-2">
                {field.kind === 'swatch'
                  ? field.options.map((swatch, i) => (
                      <SwatchOption
                        key={swatch.label}
                        fieldKey={key}
                        index={i}
                        selected={pick(draft, key) === i}
                        hex={swatch.hex}
                        label={swatch.label}
                        onPress={() => set(key, i)}
                      />
                    ))
                  : field.options.map((label, i) => (
                      <ShapeOption
                        key={label}
                        fieldKey={key}
                        index={i}
                        draft={draft}
                        zoom={tab.zoom}
                        label={label}
                        onPress={() => set(key, i)}
                      />
                    ))}
              </View>
            </View>
          );
        })}
        {tab.note ? (
          <View className="flex-row items-center gap-2 rounded-control bg-brand-50 px-3 py-2.5">
            <Feather name="zap" size={15} color={colors.brand500} />
            <AppText testID="avatar-editor-note" variant="caption" className="flex-1 text-ink">
              {tab.note}
            </AppText>
          </View>
        ) : null}
      </ScrollView>

      <View className="px-5 pb-4 pt-2">
        <Button
          testID="avatar-editor-save"
          label={unchanged ? 'Terminé' : 'Enregistrer mon avatar'}
          onPress={() => onSave({ preset: initial.preset, custom: draft })}
        />
      </View>
    </Screen>
  );
}

export function AvatarEditor({ visible, initial, onSave, onClose }: Props) {
  const scheme = useScheme();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Monté seulement ouvert : chaque ouverture repart d'un brouillon frais. */}
      {/* Le contenu d'une modale sort de la racine du thème sur le web : on lui redonne ses couleurs. */}
      {visible ? (
        <ThemeScope scheme={scheme}>
          <EditorBody initial={initial} onSave={onSave} onClose={onClose} />
        </ThemeScope>
      ) : null}
    </Modal>
  );
}
