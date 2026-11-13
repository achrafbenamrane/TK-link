import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, TextInput, View } from 'react-native';

import { isSupabaseConfigured } from '@/shared/lib/env';
import { formatEuros } from '@/shared/lib/money';
import { usePlatformSettings } from '@/shared/lib/platform-overrides';
import { AppText, Button, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { useColors } from '@/shared/theme/theme-provider';

import { type ApplyResult, selectCredit, selectReferredBy, useReferralStore } from '../model/store';

const REASON_TEXT: Record<Exclude<ApplyResult, { ok: true }>['reason'], string> = {
  invalide: 'Ce code n’est pas valide. Il ressemble à TK-ABC234.',
  son_propre_code: 'C’est votre propre code : il faut celui d’un proche.',
  deja_parraine: 'Vous avez déjà un parrain.',
  deja_client: 'Le parrainage s’adresse aux nouveaux clients : vous avez déjà commandé.',
  indisponible: 'Le parrainage ne répond pas. Vérifiez votre connexion et réessayez.',
};

type Props = {
  /** A-t-on déjà passé une commande ? Fourni par la route (la boutique n'est pas importée ici). */
  hasOrdered: boolean;
};

/**
 * PARRAINER ET ÊTRE PARRAINÉ — CDC V1.1.
 *
 * Un code (et un lien) à partager ; la récompense — financée par TK LINK — est débloquée pour les
 * deux après le premier achat réel du filleul.
 *
 * Avec le serveur (migration 0019), tout vient de lui : mon code, mon parrain, mon crédit restant et
 * mes filleuls. Le crédit s'y déduit à la réservation, À HAUTEUR DE LA PART DE TK LINK sur chaque
 * commande (Stripe « Direct charges » : TK LINK n'offre que ce qu'il aurait prélevé) — l'écran le dit,
 * pour que personne n'attende 5 € d'un coup. Sans la migration, l'écran garde le parrainage local.
 */
export function ReferralScreen({ hasOrdered }: Props) {
  const colors = useColors();
  const localCode = useReferralStore((s) => s.myCode);
  const ensureCode = useReferralStore((s) => s.ensureCode);
  const applyCode = useReferralStore((s) => s.applyCode);
  const applyOnServer = useReferralStore((s) => s.applyOnServer);
  const syncServer = useReferralStore((s) => s.syncServer);
  const server = useReferralStore((s) => s.server);
  const credit = useReferralStore(selectCredit);
  const localReferredBy = useReferralStore(selectReferredBy);

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    ensureCode();
  }, [ensureCode]);
  useFocusEffect(
    useCallback(() => {
      if (isSupabaseConfigured) void syncServer();
    }, [syncServer]),
  );

  const settings = usePlatformSettings();
  const reward = server ? server.creditCents / 100 : settings.referralRewardEur;
  const commission = String(settings.commissionB2cPct).replace('.', ',');
  const myCode = server?.code ?? localCode;
  const referredBy = server ? server.referrerCode : localReferredBy;
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

  const submit = async () => {
    setSending(true);
    const res = server ? await applyOnServer(input) : applyCode(input, hasOrdered);
    setSending(false);
    if (res.ok) {
      setError(null);
      setInput('');
    } else {
      setError(REASON_TEXT[res.reason]);
    }
  };

  // Ce que dit la ligne « Parrain » : en attente du premier achat, crédit restant, ou utilisé.
  const status = server
    ? !server.unlocked
      ? `Passez votre première commande : ${reward} € seront crédités à vous et à votre parrain dès qu’elle sera récupérée ou livrée.`
      : server.balanceCents > 0
        ? `Crédit débloqué. Il se déduit de vos prochaines commandes.`
        : 'Votre crédit de parrainage a été utilisé.'
    : credit === 'a_debloquer'
      ? `Passez votre première commande : ${reward} € seront crédités sur la suivante.`
      : credit === 'disponible'
        ? `${reward} € de crédit disponibles : ils s’appliquent à votre prochaine commande.`
        : 'Votre crédit de parrainage a été utilisé.';

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
            {`${reward} € crédités à vous et à votre filleul, après son premier achat. Offert par TK LINK.`}
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

        {/* Mon crédit et mes filleuls — le serveur seul les connaît. */}
        {server && (server.balanceCents > 0 || server.invited > 0) ? (
          <View
            testID="referral-balance"
            className="gap-1.5 rounded-card border border-line bg-surface p-4"
          >
            <View className="flex-row items-baseline justify-between gap-3">
              <AppText variant="label">Votre crédit</AppText>
              <AppText
                testID="referral-balance-amount"
                className="font-display text-xl text-brand-600"
              >
                {formatEuros(server.balanceCents / 100)}
              </AppText>
            </View>
            {server.invited > 0 ? (
              <AppText testID="referral-invited" variant="caption" className="text-ink-muted">
                {`${server.invited} proche${server.invited > 1 ? 's' : ''} invité${server.invited > 1 ? 's' : ''} · ${server.invitedUnlocked} premier${server.invitedUnlocked > 1 ? 's' : ''} achat${server.invitedUnlocked > 1 ? 's' : ''}`}
              </AppText>
            ) : null}
            <AppText variant="caption" className="text-ink-faint">
              {`Il se déduit à chaque commande, à hauteur de la part de TK LINK (${commission} % du montant) : il sert donc sur plusieurs commandes.`}
            </AppText>
          </View>
        ) : null}

        <View className="gap-2.5 rounded-card border border-line bg-surface p-4">
          <AppText variant="label">J’ai un code de parrainage</AppText>

          {referredBy ? (
            <View testID="referral-status" className="gap-1">
              <AppText className="font-sans-semibold text-ink">Parrain : {referredBy}</AppText>
              <AppText variant="caption" className="text-ink-faint">
                {status}
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
                loading={sending}
                disabled={input.trim().length === 0}
                onPress={() => void submit()}
              />
            </>
          )}
        </View>

        <AppText variant="caption" className="text-center text-ink-faint">
          {server
            ? 'Le crédit se déduit au moment de réserver ; il revient si la réservation est annulée.'
            : 'Le crédit se déduit au moment du paiement. Le suivi de vos filleuls est géré par TK LINK.'}
        </AppText>
      </ScrollView>
    </Screen>
  );
}
