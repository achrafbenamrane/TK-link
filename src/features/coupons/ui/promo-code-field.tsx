import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import type { RedeemFailure } from '../model/schema';
import { useCouponsStore } from '../model/store';

const FAILURE_FR: Record<RedeemFailure, string> = {
  unknown: 'Code inconnu. Vérifiez la saisie.',
  inactive: 'Ce code n’est plus actif.',
  expired: 'Ce code a expiré.',
  already_claimed: 'Vous avez déjà utilisé ce code.',
  cap_reached: 'Ce code a atteint sa limite d’utilisations.',
};

/**
 * LE BLOC COUPONS de La Chasse : ce qu'on possède, puis comment en obtenir.
 *
 * Les deux tiennent dans UN seul encadré, et c'est le sujet. Séparés, ils
 * posaient deux fois la même question à deux endroits — « où sont mes
 * coupons ? », « où saisir mon code ? » — alors qu'on y répond d'un même
 * regard : voici ton portefeuille, voici comment le remplir.
 *
 * Un code arrive par Instagram ou par un flyer : on l'a en main quelques
 * secondes, et le chercher trois écrans plus loin suffit à le perdre. D'où sa
 * place ici, juste au-dessus des jeux — l'autre façon d'obtenir un coupon.
 *
 * Le composant se suffit à lui-même : il porte sa saisie, son verdict et sa
 * remise à zéro. Rien à câbler côté écran.
 */
export function PromoCodeField() {
  const router = useRouter();
  const redeemPromo = useCouponsStore((s) => s.redeemPromo);
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const onRedeem = () => {
    if (!code.trim()) return;
    const res = redeemPromo(code);
    if (res.ok) {
      setFeedback({ ok: true, msg: 'Coupon ajouté 🎉 Il s’applique au panier.' });
      setCode('');
    } else {
      setFeedback({ ok: false, msg: FAILURE_FR[res.reason] });
    }
  };

  return (
    <View testID="hub-promo" className="mx-5 gap-3 rounded-card bg-surface-muted p-4">
      {/* Le portefeuille EN PREMIER : on regarde ce qu'on a avant de chercher
          à en ajouter. Vert, parce que c'est l'action qui mène à quelque
          chose qu'on possède déjà. */}
      <Pressable
        testID="hub-my-coupons"
        accessibilityRole="button"
        accessibilityLabel="Voir mes coupons"
        onPress={() => router.push('/coupons')}
        className="flex-row items-center gap-3 rounded-control bg-brand-500 px-3.5 py-3 active:bg-brand-600"
      >
        <View className="h-9 w-9 items-center justify-center rounded-control bg-ink-inverse/20">
          <Feather name="tag" size={17} color={colors.inkInverse} />
        </View>
        <AppText className="flex-1 font-sans-bold text-ink-inverse" style={{ fontSize: 14.5 }}>
          Mes coupons
        </AppText>
        <Feather name="chevron-right" size={18} color={colors.inkInverse} />
      </Pressable>

      <View className="h-px bg-line" />

      <View className="flex-row items-center gap-2">
        <Feather name="plus-circle" size={15} color={colors.brand600} />
        <AppText className="font-sans-bold text-ink" style={{ fontSize: 14 }}>
          Vous avez un code ?
        </AppText>
      </View>

      <View className="flex-row items-center gap-2">
        <TextInput
          testID="hub-promo-input"
          value={code}
          onChangeText={(v) => {
            setCode(v);
            // Le verdict précédent ne vaut plus dès qu'on retouche le code :
            // le laisser afficherait « Code inconnu » sous une saisie neuve.
            if (feedback) setFeedback(null);
          }}
          placeholder="Ex. BIENVENUE"
          placeholderTextColor={colors.inkFaint}
          className="flex-1 rounded-control bg-surface px-4 font-sans text-ink"
          style={{ height: 46, fontSize: 15 }}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={onRedeem}
          accessibilityLabel="Votre code promo"
        />
        <Pressable
          testID="hub-promo-submit"
          accessibilityRole="button"
          accessibilityLabel="Valider le code promo"
          disabled={!code.trim()}
          onPress={onRedeem}
          className={cn(
            'items-center justify-center rounded-control px-5',
            code.trim() ? 'bg-brand-500 active:bg-brand-600' : 'bg-surface-sunken',
          )}
          style={{ height: 46 }}
        >
          <AppText
            className={cn('font-sans-bold', code.trim() ? 'text-ink-inverse' : 'text-ink-faint')}
            style={{ fontSize: 14 }}
          >
            OK
          </AppText>
        </Pressable>
      </View>

      {feedback ? (
        <AppText
          testID="hub-promo-feedback"
          variant="caption"
          className={cn('font-sans-semibold', feedback.ok ? 'text-brand-600' : 'text-danger')}
        >
          {feedback.msg}
        </AppText>
      ) : null}
    </View>
  );
}
