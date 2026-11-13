import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Button } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import {
  fetchPaymentsStatus,
  openPaymentsOnboarding,
  type PaymentsError,
  type PaymentsStatus,
} from '../lib/payments-api';

const ERROR: Record<PaymentsError, string> = {
  not_configured: 'Le paiement en ligne n’est pas encore activé par TK LINK.',
  shop_not_validated: 'Votre boutique doit d’abord être validée par TK LINK.',
  no_shop: 'Déposez d’abord le dossier de votre commerce.',
  not_onboarded: 'Inscrivez d’abord votre commerce chez Stripe.',
  network: 'Pas de connexion. Réessayez.',
  unknown: 'Une erreur est survenue. Réessayez dans un instant.',
};

/**
 * PAIEMENTS EN LIGNE — l’inscription du commerce chez Stripe (CDC V1.1 : Stripe Connect). Sans
 * elle, les clients ne peuvent pas payer ses Flash dans l’app. Stripe recueille l’identité et
 * l’IBAN ; l’état revient du serveur (webhook Stripe), relu au retour du navigateur.
 */
export function PaymentsSetupCard() {
  const colors = useColors();
  const [status, setStatus] = useState<PaymentsStatus | null | undefined>(undefined);
  const [error, setError] = useState<PaymentsError | null>(null);
  const [opening, setOpening] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetchPaymentsStatus();
    if (res.ok) setStatus(res.value);
    else {
      setStatus(null);
      setError(res.code);
    }
  }, []);

  useEffect(() => {
    // Lecture initiale depuis le serveur : l'état n'est posé qu'à la réponse.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec le serveur
    void reload();
  }, [reload]);

  const open = async () => {
    if (opening) return;
    setOpening(true);
    setError(null);
    const res = await openPaymentsOnboarding();
    setOpening(false);
    if (!res.ok) setError(res.code);
    await reload();
  };

  if (status === undefined) {
    return (
      <View className="mb-4 items-center rounded-card border border-line bg-surface p-4">
        <ActivityIndicator color={colors.brand500} />
      </View>
    );
  }

  return (
    <View
      testID="payments-setup"
      className="mb-4 gap-3 rounded-card border border-line bg-surface p-4"
    >
      <View className="flex-row items-center gap-2">
        <Feather
          name={status === 'actif' ? 'check-circle' : 'credit-card'}
          size={18}
          color={status === 'actif' ? colors.success : colors.brand500}
        />
        <AppText testID="payments-setup-title" className="font-sans-bold text-ink">
          {status === 'actif'
            ? 'Paiements en ligne activés'
            : status === 'en_cours'
              ? 'Inscription aux paiements en cours'
              : 'Recevez vos paiements en ligne'}
        </AppText>
      </View>
      <AppText variant="caption">
        {status === 'actif'
          ? 'Vos clients paient leurs Flash dans l’app. Stripe vous verse votre part, commission de 5 % déduite.'
          : status === 'en_cours'
            ? 'Stripe vérifie vos informations, ou il en manque. Reprenez l’inscription là où vous l’avez laissée.'
            : 'Inscrivez votre commerce chez Stripe, notre prestataire de paiement : identité et IBAN, en 5 minutes. TK LINK ne voit jamais vos coordonnées bancaires.'}
      </AppText>
      {status !== 'actif' && error !== 'not_configured' ? (
        <Button
          testID="payments-setup-open"
          label={status === 'en_cours' ? 'Compléter mon inscription' : 'Recevoir mes paiements'}
          loading={opening}
          disabled={opening}
          onPress={() => void open()}
        />
      ) : null}
      {error ? (
        <AppText testID="payments-setup-error" variant="caption" className="text-danger">
          {ERROR[error]}
        </AppText>
      ) : null}
    </View>
  );
}
