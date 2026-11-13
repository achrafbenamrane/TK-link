import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Switch, View } from 'react-native';

import { isSupabaseConfigured } from '@/shared/lib/env';
import { AppText, Button, Screen, TextField } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { ShopVideo } from '@/shared/ui/shop-video';
import { useColors } from '@/shared/theme/theme-provider';

import {
  checkMedia,
  fetchMyMedia,
  type MediaApiError,
  type MediaKind,
  setMediaVisible,
  type ShopMedia,
  startMedia,
} from '../lib/media-api';

/** Toutes les 5 secondes tant qu’un visuel est en cours (une vidéo prend 1 à 3 minutes). */
const POLL_MS = 5000;

const ERROR: Record<MediaApiError, string> = {
  not_signed_in: 'Reconnectez-vous pour créer des visuels.',
  shop_not_validated: 'Votre boutique doit d’abord être validée par TK LINK.',
  no_shop: 'Déposez d’abord le dossier de votre commerce.',
  quota_exhausted: 'Limite du jour atteinte : 10 images et 2 vidéos par jour. Revenez demain.',
  not_configured: 'La création de visuels n’est pas encore activée par TK LINK.',
  ai_failed: 'La création n’a pas pu démarrer. Réessayez dans un instant.',
  network: 'Pas de connexion. Réessayez.',
  unknown: 'Une erreur est survenue. Réessayez.',
};

/**
 * VISUELS IA — rapport d’avancement du 13/11/2026 : « les commerçants présentent leur boutique sans
 * produire eux-mêmes les visuels ». Deux formats : une image, ou une vidéo de 5 secondes.
 *
 * Le commerçant décrit ce qu’il veut montrer (facultatif) ; le serveur écrit la demande au modèle
 * (fal.ai) à partir de son nom et de sa catégorie, tient le quota et range le résultat. Chaque
 * visuel prêt se montre ou se cache sur la vitrine. Une création ratée n’est pas décomptée.
 */
export function AiMediaScreen() {
  const colors = useColors();
  const [items, setItems] = useState<ShopMedia[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [brief, setBrief] = useState('');
  const [starting, setStarting] = useState<MediaKind | null>(null);
  const [error, setError] = useState<MediaApiError | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    const res = await fetchMyMedia();
    if (!alive.current) return;
    setLoaded(true);
    if (res.ok) setItems(res.value);
    else setError(res.code);
  }, []);

  useEffect(() => {
    alive.current = true;
    // Lecture initiale depuis le serveur : l'état n'est posé qu'à la réponse.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec le serveur
    if (isSupabaseConfigured) void reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);

  // Relever les créations en cours, puis relire la liste.
  const pending = items.filter((m) => m.status === 'en_cours').map((m) => m.id);
  const pendingKey = pending.join(',');
  useEffect(() => {
    if (!pendingKey) return;
    const id = setInterval(() => {
      void Promise.all(pendingKey.split(',').map((m) => checkMedia(m))).then(() => reload());
    }, POLL_MS);
    return () => clearInterval(id);
  }, [pendingKey, reload]);

  const create = async (kind: MediaKind) => {
    if (starting) return;
    setStarting(kind);
    setError(null);
    const res = await startMedia(kind, brief);
    setStarting(null);
    if (!res.ok) {
      setError(res.code);
      return;
    }
    await reload();
  };

  const toggle = async (media: ShopMedia, visible: boolean) => {
    setItems((list) => list.map((m) => (m.id === media.id ? { ...m, visible } : m)));
    const res = await setMediaVisible(media.id, visible);
    if (!res.ok) {
      setItems((list) => list.map((m) => (m.id === media.id ? { ...m, visible: !visible } : m)));
      setError(res.code);
    }
  };

  return (
    <Screen testID="ai-media-screen" padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-5 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-1 pt-2">
          <BackButton fallbackHref="/boutique" />
          <AppText variant="display" className="text-2xl">
            Visuels IA
          </AppText>
          <AppText variant="caption">
            Une image ou une courte vidéo de votre boutique, créée en quelques instants à partir de
            votre description. Vous choisissez ce qui s’affiche sur votre vitrine.
          </AppText>
        </View>

        {!isSupabaseConfigured ? (
          <View testID="ai-media-demo" className="rounded-card border border-line bg-surface p-4">
            <AppText variant="caption">
              Disponible avec un compte relié au serveur TK LINK. En démonstration, rien n’est créé.
            </AppText>
          </View>
        ) : (
          <View className="gap-3 rounded-card border border-line bg-surface p-4">
            <AppText variant="label">Ce que vos clients doivent voir (facultatif)</AppText>
            <TextField
              testID="ai-media-brief"
              value={brief}
              onChangeText={(v) => setBrief(v.slice(0, 300))}
              placeholder="Ex. pains au levain, vitrine en bois, ambiance du matin"
              accessibilityLabel="Description du visuel"
              multiline
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  testID="ai-media-create-image"
                  label="Créer une image"
                  loading={starting === 'image'}
                  disabled={starting !== null}
                  onPress={() => void create('image')}
                />
              </View>
              <View className="flex-1">
                <Button
                  testID="ai-media-create-video"
                  label="Créer une vidéo"
                  variant="secondary"
                  loading={starting === 'video'}
                  disabled={starting !== null}
                  onPress={() => void create('video')}
                />
              </View>
            </View>
            <AppText variant="caption" className="text-ink-faint">
              10 images et 2 vidéos par jour. Une vidéo dure 5 secondes et prend 1 à 3 minutes.
            </AppText>
            {error ? (
              <AppText testID="ai-media-error" variant="caption" className="text-danger">
                {ERROR[error]}
              </AppText>
            ) : null}
          </View>
        )}

        {isSupabaseConfigured && loaded && items.length === 0 ? (
          <View testID="ai-media-empty" className="items-center gap-2 py-6">
            <Feather name="image" size={28} color={colors.inkFaint} />
            <AppText variant="caption" className="text-center">
              Aucun visuel pour l’instant. Créez le premier ci-dessus.
            </AppText>
          </View>
        ) : null}

        {items.map((m) => (
          <View
            key={m.id}
            testID={`ai-media-${m.id}`}
            className="gap-3 overflow-hidden rounded-card border border-line bg-surface p-3"
          >
            {m.status === 'pret' && m.url ? (
              m.kind === 'video' ? (
                <ShopVideo source={{ uri: m.url }} height={190} testID={`ai-media-${m.id}-video`} />
              ) : (
                <Image
                  testID={`ai-media-${m.id}-image`}
                  source={{ uri: m.url }}
                  contentFit="cover"
                  accessibilityLabel="Visuel de la boutique"
                  style={{ width: '100%', height: 190, borderRadius: 12 }}
                />
              )
            ) : (
              <View className="h-28 items-center justify-center gap-2 rounded-control bg-surface-muted">
                {m.status === 'en_cours' ? (
                  <>
                    <ActivityIndicator color={colors.brand500} />
                    <AppText testID={`ai-media-${m.id}-pending`} variant="caption">
                      {m.kind === 'video'
                        ? 'Vidéo en cours de création…'
                        : 'Image en cours de création…'}
                    </AppText>
                  </>
                ) : (
                  <AppText testID={`ai-media-${m.id}-failed`} variant="caption">
                    La création a échoué. Elle n’est pas décomptée.
                  </AppText>
                )}
              </View>
            )}

            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <AppText variant="label">{m.kind === 'video' ? 'Vidéo' : 'Image'}</AppText>
                {m.brief ? (
                  <AppText variant="caption" numberOfLines={2}>
                    {m.brief}
                  </AppText>
                ) : null}
              </View>
              {m.status === 'pret' ? (
                <View className="flex-row items-center gap-2">
                  <AppText variant="caption">Sur ma vitrine</AppText>
                  <Switch
                    testID={`ai-media-${m.id}-visible`}
                    value={m.visible}
                    onValueChange={(v) => void toggle(m, v)}
                    accessibilityLabel="Montrer ce visuel sur ma vitrine"
                  />
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
