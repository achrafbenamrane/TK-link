import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { pickImage, pickVideo, VIDEO_REFUSAL } from '@/shared/lib/image-picker';
import { AppText, Button, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { useColors } from '@/shared/theme/theme-provider';

import {
  DAY_LABEL,
  DAYS,
  MAX_PHOTOS,
  MAX_PRESENTATION,
  MAX_VIDEOS,
  normaliseTime,
  validateHours,
  type Day,
  type Hours,
} from '../lib/shop-profile';
import { OFFER_MODES, type OfferMode, type ShopProfile } from '../model/schema';
import { selectProfile, useMerchantStore } from '../model/store';

const MODE_LABEL: Record<OfferMode, string> = {
  'touch-collect': 'Touch & Collect',
  livraison: 'Livraison',
};

/**
 * LA BOUTIQUE — étape 7 du parcours du client : « horaires, zone, Touch &
 * Collect, livraison », et CDC V1.1 : « profil (photos, vidéos, présentation) ».
 *
 * C'est ce que le client voit sur la fiche de l'enseigne (« Site magasin » de la
 * maquette). Les horaires sont vides tant qu'on ne les a pas réglés : on
 * n'affiche pas d'horaires inventés.
 */
export function ShopSettingsScreen({ onPreview }: { onPreview?: () => void } = {}) {
  const colors = useColors();
  const saved = useMerchantStore(selectProfile);
  const saveProfile = useMerchantStore((s) => s.saveProfile);

  const [draft, setDraft] = useState<ShopProfile>(saved);
  const [errors, setErrors] = useState<Partial<Record<Day | 'modes', string>>>({});
  const [done, setDone] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const patch = (next: Partial<ShopProfile>) => {
    setDraft((d) => ({ ...d, ...next }));
    setDone(false);
  };
  const setDay = (day: Day, change: Partial<Hours[Day]>) => {
    patch({ hours: { ...draft.hours, [day]: { ...draft.hours[day], ...change } } });
    setErrors((e) => ({ ...e, [day]: undefined }));
  };

  const addMedia = async (kind: 'photos' | 'videos', source: 'galerie' | 'camera') => {
    if (kind === 'videos') {
      // Format standard : une vidéo trop longue ou trop lourde est refusée, et on dit pourquoi.
      const video = await pickVideo(source);
      if (video.ok) {
        setVideoError(null);
        patch({ videos: [...draft.videos, video.uri] });
      } else if (video.reason !== 'annule') {
        setVideoError(VIDEO_REFUSAL[video.reason]);
      }
      return;
    }
    const uri = await pickImage(source, { aspect: [4, 3] });
    if (uri) patch({ photos: [...draft.photos, uri] });
  };
  const removeMedia = (kind: 'photos' | 'videos', uri: string) =>
    patch({ [kind]: draft[kind].filter((u) => u !== uri) } as Partial<ShopProfile>);

  const toggleMode = (m: OfferMode) =>
    patch({
      modes: draft.modes.includes(m) ? draft.modes.filter((x) => x !== m) : [...draft.modes, m],
    });

  const save = () => {
    const found: Partial<Record<Day | 'modes', string>> = validateHours(draft.hours);
    if (draft.modes.length === 0) found.modes = 'Choisissez au moins un mode de remise';
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    saveProfile(draft);
    setDone(true);
  };

  const media = (kind: 'photos' | 'videos', max: number, label: string) => (
    <View className="gap-2 rounded-card border border-line bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" className="text-ink-faint">
          {draft[kind].length}/{max}
        </AppText>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {draft[kind].map((uri) => (
          <View
            key={uri}
            testID={`shop-${kind}-item`}
            className="h-20 w-20 overflow-hidden rounded-control bg-surface-muted"
          >
            {kind === 'photos' ? (
              <Image
                source={{ uri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Feather name="play-circle" size={26} color={colors.brand500} />
              </View>
            )}
            <Pressable
              testID={`shop-${kind}-remove`}
              accessibilityRole="button"
              accessibilityLabel="Retirer"
              hitSlop={6}
              onPress={() => removeMedia(kind, uri)}
              className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-pill bg-black/60"
            >
              <Feather name="x" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        ))}
        {draft[kind].length < max ? (
          <>
            <Pressable
              testID={`shop-${kind}-add-galerie`}
              accessibilityRole="button"
              accessibilityLabel={`Ajouter depuis la galerie : ${label}`}
              onPress={() => addMedia(kind, 'galerie')}
              className="h-20 w-20 items-center justify-center rounded-control border border-dashed border-brand-500 bg-brand-50"
            >
              <Feather name="image" size={20} color={colors.brand500} />
            </Pressable>
            <Pressable
              testID={`shop-${kind}-add-camera`}
              accessibilityRole="button"
              accessibilityLabel={`Ajouter avec la caméra : ${label}`}
              onPress={() => addMedia(kind, 'camera')}
              className="h-20 w-20 items-center justify-center rounded-control border border-dashed border-brand-500 bg-brand-50"
            >
              <Feather name="camera" size={20} color={colors.brand500} />
            </Pressable>
          </>
        ) : null}
      </View>
      {kind === 'videos' ? (
        <>
          <AppText variant="caption" className="text-ink-faint">
            30 secondes et 50 Mo au maximum.
          </AppText>
          {videoError ? (
            <AppText testID="shop-video-error" variant="caption" className="text-danger">
              {videoError}
            </AppText>
          ) : null}
        </>
      ) : null}
    </View>
  );

  return (
    <Screen testID="shop-settings-screen" padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-5 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-1 pt-2">
          <BackButton fallbackHref="/" />
          <AppText variant="display" className="text-2xl">
            Ma boutique
          </AppText>
          <AppText variant="caption">
            Ce que vos clients voient sur la fiche de votre enseigne.
          </AppText>
        </View>

        <View className="gap-2 rounded-card border border-line bg-surface p-4">
          <AppText variant="label">Présentation</AppText>
          <TextInput
            testID="shop-presentation"
            value={draft.presentation}
            onChangeText={(v) => patch({ presentation: v.slice(0, MAX_PRESENTATION) })}
            multiline
            numberOfLines={4}
            placeholder="Parlez de votre commerce en quelques lignes"
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel="Présentation du commerce"
            className="min-h-[88px] rounded-control border border-line bg-surface px-3.5 py-3 font-sans text-ink"
            style={{ fontSize: 14, textAlignVertical: 'top' }}
          />
          <AppText variant="caption" className="self-end text-ink-faint">
            {draft.presentation.length}/{MAX_PRESENTATION}
          </AppText>
        </View>

        {media('photos', MAX_PHOTOS, 'Photos')}
        {media('videos', MAX_VIDEOS, 'Vidéos')}

        <View className="gap-2 rounded-card border border-line bg-surface p-4">
          <AppText variant="label">Horaires</AppText>
          {DAYS.map((day) => {
            const h = draft.hours[day];
            return (
              <View key={day} className="gap-1">
                <View className="flex-row items-center gap-2">
                  <AppText className="w-24 text-ink" style={{ fontSize: 13.5 }}>
                    {DAY_LABEL[day]}
                  </AppText>
                  <Switch
                    testID={`shop-hours-${day}-open`}
                    accessibilityLabel={`${DAY_LABEL[day]} ouvert`}
                    value={h.open}
                    onValueChange={(open) => setDay(day, { open })}
                    trackColor={{ true: colors.brand500, false: colors.line }}
                  />
                  {h.open ? (
                    <View className="flex-1 flex-row items-center justify-end gap-1.5">
                      <TextInput
                        testID={`shop-hours-${day}-from`}
                        value={h.from}
                        onChangeText={(v) => setDay(day, { from: v })}
                        onEndEditing={() => setDay(day, { from: normaliseTime(h.from) })}
                        accessibilityLabel={`${DAY_LABEL[day]} ouverture`}
                        className="w-16 rounded-control border border-line px-2 py-1.5 text-center font-sans text-ink"
                        style={{ fontSize: 13.5 }}
                      />
                      <AppText variant="caption">à</AppText>
                      <TextInput
                        testID={`shop-hours-${day}-to`}
                        value={h.to}
                        onChangeText={(v) => setDay(day, { to: v })}
                        onEndEditing={() => setDay(day, { to: normaliseTime(h.to) })}
                        accessibilityLabel={`${DAY_LABEL[day]} fermeture`}
                        className="w-16 rounded-control border border-line px-2 py-1.5 text-center font-sans text-ink"
                        style={{ fontSize: 13.5 }}
                      />
                    </View>
                  ) : (
                    <AppText variant="caption" className="flex-1 text-right text-ink-faint">
                      Fermé
                    </AppText>
                  )}
                </View>
                {errors[day] ? (
                  <AppText
                    testID={`shop-hours-${day}-error`}
                    variant="caption"
                    className="text-danger"
                  >
                    {errors[day]}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </View>

        <View className="gap-2 rounded-card border border-line bg-surface p-4">
          <AppText variant="label">Zone</AppText>
          <TextInput
            testID="shop-zone"
            value={draft.zone}
            onChangeText={(v) => patch({ zone: v })}
            placeholder="Ex. Toulouse centre, rayon 5 km"
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel="Zone de chalandise"
            className="rounded-control border border-line bg-surface px-3.5 py-3 font-sans text-ink"
            style={{ fontSize: 14 }}
          />
          <AppText variant="label" className="mt-2">
            Modes de remise
          </AppText>
          <View className="flex-row gap-2">
            {OFFER_MODES.map((m) => {
              const on = draft.modes.includes(m);
              return (
                <Pressable
                  key={m}
                  testID={`shop-mode-${m}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={MODE_LABEL[m]}
                  onPress={() => toggleMode(m)}
                  className={cn(
                    'flex-1 items-center rounded-control border py-3',
                    on ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface-muted',
                  )}
                >
                  <AppText
                    className={cn('font-sans-semibold', on ? 'text-brand-600' : 'text-ink-muted')}
                    style={{ fontSize: 13 }}
                  >
                    {MODE_LABEL[m]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {errors.modes ? (
            <AppText testID="shop-modes-error" variant="caption" className="text-danger">
              {errors.modes}
            </AppText>
          ) : null}
        </View>

        {done ? (
          <AppText testID="shop-saved" variant="caption" className="text-center text-success">
            Boutique enregistrée.
          </AppText>
        ) : null}
        <Button testID="shop-save" label="Enregistrer" onPress={save} />
        {onPreview ? (
          <Button
            testID="shop-preview"
            label="Voir ma vitrine"
            variant="secondary"
            onPress={onPreview}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
