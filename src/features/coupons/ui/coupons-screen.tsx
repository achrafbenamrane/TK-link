import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen, TextField } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import type { RedeemFailure } from '../model/schema';
import { selectWallet, useCouponsStore } from '../model/store';
import { CouponTicket } from './coupon-ticket';

const FAILURE_FR: Record<RedeemFailure, string> = {
  unknown: 'Code inconnu. Vérifiez la saisie.',
  inactive: 'Ce code n’est plus actif.',
  expired: 'Ce code a expiré.',
  already_claimed: 'Vous avez déjà utilisé ce code.',
  cap_reached: 'Ce code a atteint sa limite d’utilisations.',
};

export function CouponsScreen() {
  const router = useRouter();
  const wallet = useCouponsStore(selectWallet);
  const redeemPromo = useCouponsStore((s) => s.redeemPromo);

  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const available = wallet.filter((c) => c.usedAt === null);

  const onRedeem = () => {
    if (!code.trim()) return;
    const res = redeemPromo(code);
    if (res.ok) {
      setFeedback({ ok: true, msg: 'Coupon ajouté à votre portefeuille 🎉' });
      setCode('');
    } else {
      setFeedback({ ok: false, msg: FAILURE_FR[res.reason] });
    }
  };

  return (
    <Screen testID="coupons-screen">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="pb-4 pt-2">
            <AppText variant="display" className="text-3xl">
              Mes coupons
            </AppText>
            <AppText variant="caption" className="mt-1">
              Gagnés en jouant, ou reçus sur les réseaux.
            </AppText>
          </View>

          {/* SOURCE 2 — saisie d'un code promo */}
          <View className="mb-5 gap-2 rounded-card border border-line bg-surface-muted p-4">
            <AppText className="font-sans-bold text-ink">Vous avez un code ?</AppText>
            <View className="flex-row gap-2">
              <View className="flex-1 flex-row">
                <TextField
                  testID="coupon-code-input"
                  placeholder="Ex. BIENVENUE"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={code}
                  onChangeText={(v) => {
                    setCode(v);
                    setFeedback(null);
                  }}
                  onSubmitEditing={onRedeem}
                />
              </View>
              <Pressable
                testID="coupon-redeem"
                accessibilityRole="button"
                accessibilityLabel="Valider le code"
                onPress={onRedeem}
                disabled={!code.trim()}
                className={cn(
                  'items-center justify-center rounded-control px-5',
                  code.trim() ? 'bg-brand-500 active:bg-brand-600' : 'bg-surface-sunken',
                )}
              >
                <AppText
                  className={cn(
                    'font-sans-bold',
                    code.trim() ? 'text-ink-inverse' : 'text-ink-faint',
                  )}
                >
                  OK
                </AppText>
              </Pressable>
            </View>
            {feedback ? (
              <View className="flex-row items-center gap-1.5">
                <Feather
                  name={feedback.ok ? 'check-circle' : 'alert-circle'}
                  size={13}
                  color={feedback.ok ? colors.success : colors.brand600}
                />
                <AppText
                  variant="caption"
                  className={cn('text-xs', feedback.ok ? 'text-success' : 'text-brand-600')}
                >
                  {feedback.msg}
                </AppText>
              </View>
            ) : null}
          </View>

          {/* SOURCE 1 — jouer pour gagner : ouvre les jeux */}
          <Pressable
            testID="coupon-play"
            accessibilityRole="button"
            onPress={() => router.push('/jeux')}
            className="mb-5 flex-row items-center gap-3 rounded-card bg-ink p-4 active:opacity-90"
          >
            <View className="h-11 w-11 items-center justify-center rounded-pill bg-brand-500">
              <Feather name="gift" size={20} color={colors.inkInverse} />
            </View>
            <View className="flex-1">
              <AppText className="font-sans-bold text-ink-inverse">
                Jouez, gagnez des coupons
              </AppText>
              <AppText variant="caption" className="text-ink-inverse/60">
                Cartes mémoire, quiz… un coupon à gagner.
              </AppText>
            </View>
            <Feather name="chevron-right" size={20} color={colors.inkInverse} />
          </Pressable>

          {/* Portefeuille */}
          <View className="mb-2 flex-row items-baseline justify-between">
            <AppText variant="title" className="text-lg">
              Portefeuille
            </AppText>
            <AppText variant="caption" className="text-ink-faint">
              {available.length} disponible{available.length > 1 ? 's' : ''}
            </AppText>
          </View>

          {wallet.length === 0 ? (
            <View className="items-center px-8 pt-10" testID="coupons-empty">
              <Feather name="tag" size={28} color={colors.inkFaint} />
              <AppText variant="title" className="mt-3 text-center text-ink-faint">
                Aucun coupon pour l’instant
              </AppText>
              <AppText variant="caption" className="mt-1 text-center">
                Saisissez un code, ou jouez pour en gagner un.
              </AppText>
            </View>
          ) : (
            wallet.map((c) => <CouponTicket key={c.id} coupon={c} />)
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
