import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, TextInput, View } from 'react-native';

import { PLATFORM_SETTINGS } from '@/shared/lib/platform-settings';
import { AppText, Button, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { useColors } from '@/shared/theme/theme-provider';

import { selectCredit, selectReferredBy, useReferralStore } from '../model/store';

const REASON_TEXT = {
  invalide: 'Ce code n’est pas valide. Il ressemble à TK-ABC234.',
  son_propre_code: 'C’est votre propre code : il faut celui d’un proche.',
  deja_parraine: 'Vous avez déjà un parrain.',
  deja_client: 'Le parrainage s’adresse aux nouveaux clients : vous avez déjà commandé.',
} as const;

type Props = {
  /** A-t-on déjà passé une commande ? Fourni par la route (la boutique n'est pas importée ici). */
  hasOrdered: boolean;
};

/**
 * PARRAINER ET ÊTRE PARRAINÉ — CDC V1.1.
 *
 * Un code (et un lien) à partager ; la récompense — financée par TK LINK — est
 * débloquée pour les deux après le premier achat réel du filleul. Le côté
 * parrain dépend du serveur : l'écran explique la règle, sans compteur inventé.
 */
export function ReferralScreen({ hasOrdered }: Props) {
  const colors = useColors();
  const myCode = useReferralStore((s) => s.myCode);
  const ensureCode = useReferralStore((s) => s.ensureCode);
  const applyCode = useReferralStore((s) => s.applyCode);
  const credit = useReferralStore(selectCredit);
  const referredBy = useReferralStore(selectReferredBy);

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureCode();
  }, [ensureCode]);

  const reward = PLATFORM_SETTINGS.referralRewardEur;
  const link = `https://tklink.fr/invite/${myCode}`;

  const share = async () => {
    try {
      await Share.share({
        message: `Rejoins-moi sur TK LINK : ${reward} € offerts après ton premier achat avec mon code ${myCode} — ${link}`,
      });
    } catch {
      // partage indisponible (web) : le code reste affiché
    }
  };

  const submit = () => {
    const res = applyCode(input, hasOrdered);
    if (res.ok) {
      setError(null);
      setInput('');
    } else {
      setError(REASON_TEXT[res.reason]);
    }
  };

  return (
    <Screen testID="referral-screen" padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-5 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-1 pt-2">
          <BackButton fallbackHref="/profil" />
          <AppText variant="display" className="text-2xl">
            Parrainage
          </AppText>
          <AppText variant="caption">
            {reward} € crédités à vous et à votre filleul, après son premier achat. Offert par TK
            LINK.
          </AppText>
        </View>

        <View className="items-center gap-3 rounded-card bg-surface-inverse p-5">
          <AppText variant="caption" className="text-ink-inverse/70">
            Votre code d’invitation
          </AppText>
          <AppText
            testID="referral-code"
            className="font-display text-ink-inverse"
            style={{ fontSize: 30, letterSpacing: 3 }}
          >
            {myCode}
          </AppText>
          <AppText variant="caption" className="text-ink-inverse/70" numberOfLines={1}>
            {link}
          </AppText>
          <Pressable
            testID="referral-share"
            accessibilityRole="button"
            accessibilityLabel="Partager mon code d’invitation"
            onPress={share}
            className="flex-row items-center gap-2 rounded-control bg-brand-500 px-5 py-3 active:bg-brand-600"
          >
            <Feather name="share-2" size={15} color={colors.inkInverse} />
            <AppText className="font-sans-bold text-ink-inverse">Inviter un proche</AppText>
          </Pressable>
        </View>

        <View className="gap-2.5 rounded-card border border-line bg-surface p-4">
          <AppText variant="label">J’ai un code de parrainage</AppText>

          {referredBy ? (
            <View testID="referral-status" className="gap-1">
              <AppText className="font-sans-semibold text-ink">Parrain : {referredBy}</AppText>
              <AppText variant="caption" className="text-ink-faint">
                {credit === 'a_debloquer'
                  ? `Passez votre première commande : ${reward} € seront crédités sur la suivante.`
                  : credit === 'disponible'
                    ? `${reward} € de crédit disponibles : ils s’appliquent à votre prochaine commande.`
                    : 'Votre crédit de parrainage a été utilisé.'}
              </AppText>
            </View>
          ) : (
            <>
              <TextInput
                testID="referral-input"
                value={input}
                onChangeText={(v) => {
                  setInput(v.toUpperCase());
                  setError(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="TK-ABC234"
                placeholderTextColor={colors.inkFaint}
                accessibilityLabel="Code de parrainage"
                className="rounded-control border border-line bg-surface px-3.5 py-3 font-sans text-ink"
                style={{ fontSize: 15, letterSpacing: 1 }}
              />
              {error ? (
                <AppText testID="referral-error" variant="caption" className="text-danger">
                  {error}
                </AppText>
              ) : null}
              <Button
                testID="referral-apply"
                label="Valider le code"
                disabled={input.trim().length === 0}
                onPress={submit}
              />
            </>
          )}
        </View>

        <AppText variant="caption" className="text-center text-ink-faint">
          Le crédit se déduit au moment du paiement. Le suivi de vos filleuls est géré par TK LINK.
        </AppText>
      </ScrollView>
    </Screen>
  );
}
