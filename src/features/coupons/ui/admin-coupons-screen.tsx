import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen, TextField } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { formatDiscount, isPromoLive } from '../lib/coupons';
import type { Discount, PromoCode } from '../model/schema';
import { selectPromoCatalog, useCouponsStore } from '../model/store';

const DAY = 24 * 3600 * 1000;
const EXPIRY_PRESETS: { label: string; ms: number | null }[] = [
  { label: 'Sans', ms: null },
  { label: '24 h', ms: DAY },
  { label: '7 j', ms: 7 * DAY },
  { label: '30 j', ms: 30 * DAY },
];

function statusOf(p: PromoCode, now: number): { label: string; tone: 'live' | 'off' } {
  if (isPromoLive(p, now)) return { label: 'Actif', tone: 'live' };
  if (!p.active) return { label: 'Coupé', tone: 'off' };
  if (p.expiresAt !== null && p.expiresAt <= now) return { label: 'Expiré', tone: 'off' };
  return { label: 'Épuisé', tone: 'off' };
}

/**
 * Espace admin — génération et gestion des codes promo (source 2).
 *
 * En production, cet écran est protégé par un rôle et écrit côté serveur : un
 * client ne doit pas pouvoir forger des réductions. Ici, en démo, il écrit dans
 * le store local pour montrer le concept de bout en bout.
 */
export function AdminCouponsScreen() {
  const router = useRouter();
  const catalog = useCouponsStore(selectPromoCatalog);
  const createPromo = useCouponsStore((s) => s.createPromo);
  const setActive = useCouponsStore((s) => s.setPromoActive);
  const setExpiry = useCouponsStore((s) => s.setPromoExpiry);

  const [kind, setKind] = useState<Discount['kind']>('amount');
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [cap, setCap] = useState('');
  const [expiryMs, setExpiryMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Instant de référence pour les libellés d'état, figé au montage : appeler
  // Date.now() pendant le rendu rend le composant non idempotent. Les actions,
  // elles, lisent l'heure RÉELLE au moment du clic (voir plus bas).
  const [now] = useState(() => Date.now());

  const onCreate = () => {
    const n = Number(value.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      setError('Indiquez une valeur de réduction.');
      return;
    }
    const discount: Discount =
      kind === 'amount'
        ? { kind: 'amount', cents: Math.round(n * 100) }
        : { kind: 'percent', pct: Math.min(100, Math.round(n)) };

    const res = createPromo({
      discount,
      code: code.trim() || undefined,
      maxRedemptions: cap.trim() ? Math.max(1, Math.round(Number(cap))) : null,
      expiresAt: expiryMs ? Date.now() + expiryMs : null,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setValue('');
    setCode('');
    setCap('');
    setExpiryMs(null);
    setError(null);
  };

  const shareCode = (p: PromoCode) => {
    void Share.share({
      message: `🎁 Code TK LINK : ${p.code} — ${formatDiscount(p.discount)} sur votre prochain passage en caisse !`,
    });
  };

  return (
    <Screen padded={false} testID="admin-coupons-screen">
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-1">
        <Pressable
          testID="admin-back"
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={10}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        >
          <Feather name="chevron-left" size={26} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <AppText className="font-sans-bold text-ink">Espace admin · Codes promo</AppText>
          <AppText variant="caption" className="text-xs text-ink-faint">
            Démo locale — la vraie gestion vit côté serveur.
          </AppText>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-5 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          {/* Générateur */}
          <View className="mb-6 gap-3 rounded-card border border-line bg-surface p-4">
            <AppText className="font-sans-bold text-ink">Nouveau code</AppText>

            <View className="flex-row gap-2">
              {(['amount', 'percent'] as const).map((k) => (
                <Pressable
                  key={k}
                  testID={`admin-kind-${k}`}
                  onPress={() => setKind(k)}
                  className={cn(
                    'flex-1 items-center rounded-control border py-2.5',
                    kind === k ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface-muted',
                  )}
                >
                  <AppText
                    className={cn(
                      'font-sans-semibold text-sm',
                      kind === k ? 'text-ink-inverse' : 'text-ink-muted',
                    )}
                  >
                    {k === 'amount' ? 'Montant (€)' : 'Pourcentage (%)'}
                  </AppText>
                </Pressable>
              ))}
            </View>

            <View className="flex-row gap-2">
              <View className="w-28 flex-row">
                <TextField
                  testID="admin-value"
                  placeholder={kind === 'amount' ? '5' : '20'}
                  keyboardType="numeric"
                  value={value}
                  onChangeText={(v) => {
                    setValue(v);
                    setError(null);
                  }}
                />
              </View>
              <View className="flex-1 flex-row">
                <TextField
                  testID="admin-code"
                  placeholder="Code (vide = auto)"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={code}
                  onChangeText={setCode}
                />
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              <AppText variant="caption" className="text-ink-muted">
                Limite
              </AppText>
              <View className="w-24 flex-row">
                <TextField
                  testID="admin-cap"
                  placeholder="illimité"
                  keyboardType="numeric"
                  value={cap}
                  onChangeText={setCap}
                />
              </View>
              <AppText variant="caption" className="text-ink-muted">
                Expire
              </AppText>
              <View className="flex-1 flex-row justify-end gap-1.5">
                {EXPIRY_PRESETS.map((e) => (
                  <Pressable
                    key={e.label}
                    testID={`admin-expiry-${e.label}`}
                    onPress={() => setExpiryMs(e.ms)}
                    className={cn(
                      'rounded-pill border px-2.5 py-1.5',
                      expiryMs === e.ms ? 'border-ink bg-ink' : 'border-line bg-surface',
                    )}
                  >
                    <AppText
                      className={cn(
                        'font-sans-semibold text-xs',
                        expiryMs === e.ms ? 'text-ink-inverse' : 'text-ink-muted',
                      )}
                    >
                      {e.label}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>

            {error ? (
              <AppText variant="caption" className="text-brand-600">
                {error}
              </AppText>
            ) : null}

            <Pressable
              testID="admin-create"
              accessibilityRole="button"
              onPress={onCreate}
              className="flex-row items-center justify-center gap-2 rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
            >
              <Feather name="plus" size={16} color={colors.inkInverse} />
              <AppText className="font-sans-bold text-ink-inverse">Générer le code</AppText>
            </Pressable>
          </View>

          {/* Catalogue */}
          <AppText variant="title" className="mb-2 text-lg">
            Codes existants
          </AppText>
          {catalog.map((p) => {
            const st = statusOf(p, now);
            return (
              <View
                key={p.id}
                testID={`admin-promo-${p.id}`}
                className="mb-3 gap-2.5 rounded-card border border-line bg-surface p-4"
              >
                <View className="flex-row items-center gap-2">
                  <AppText
                    className="font-display text-ink"
                    style={{ fontSize: 18, lineHeight: 24 }}
                  >
                    {p.code}
                  </AppText>
                  <View
                    className={cn(
                      'rounded-pill px-2 py-0.5',
                      st.tone === 'live' ? 'bg-success/15' : 'bg-surface-sunken',
                    )}
                  >
                    <AppText
                      className={cn(
                        'font-sans-bold text-[10px]',
                        st.tone === 'live' ? 'text-success' : 'text-ink-faint',
                      )}
                    >
                      {st.label}
                    </AppText>
                  </View>
                  <View className="flex-1" />
                  <AppText className="font-sans-bold text-brand-600">
                    {formatDiscount(p.discount)}
                  </AppText>
                </View>

                <AppText variant="caption" className="text-xs text-ink-faint">
                  {p.redeemedCount} utilisation{p.redeemedCount > 1 ? 's' : ''}
                  {p.maxRedemptions !== null ? ` / ${p.maxRedemptions}` : ' · illimité'}
                  {p.expiresAt !== null
                    ? ` · expire le ${new Date(p.expiresAt).toLocaleDateString('fr-FR')}`
                    : ''}
                </AppText>

                <View className="flex-row gap-2 border-t border-line pt-2.5">
                  <Pressable
                    testID={`admin-toggle-${p.id}`}
                    accessibilityRole="button"
                    onPress={() => setActive(p.id, !p.active)}
                    hitSlop={6}
                  >
                    <AppText variant="caption" className="font-sans-semibold text-ink">
                      {p.active ? 'Couper' : 'Réactiver'}
                    </AppText>
                  </Pressable>
                  {p.expiresAt === null || p.expiresAt > now ? (
                    <Pressable
                      testID={`admin-expire-${p.id}`}
                      accessibilityRole="button"
                      onPress={() => setExpiry(p.id, Date.now())}
                      hitSlop={6}
                    >
                      <AppText variant="caption" className="font-sans-semibold text-brand-600">
                        Expirer maintenant
                      </AppText>
                    </Pressable>
                  ) : null}
                  <View className="flex-1" />
                  <Pressable
                    testID={`admin-share-${p.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Partager ${p.code}`}
                    onPress={() => shareCode(p)}
                    hitSlop={6}
                  >
                    <Feather name="share-2" size={15} color={colors.ink} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
