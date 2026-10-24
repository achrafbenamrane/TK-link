import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { friendlyAuthError } from '../model/auth-errors';
import { maskEmail, maskPhone } from '../model/identifier';
import { selectDemoMode, useAuthStore } from '../model/store';
import { CodeStep } from './code-step';

type Step = 'email' | 'phone-offer' | 'phone-code';

type Props = {
  /** L'adresse du compte, déjà normalisée. */
  email: string;
  /** Le numéro saisi à l'inscription, en E.164 — vide s'il n'y en a pas (ou s'il est illisible). */
  phone: string;
  /** Le serveur exige de confirmer l'adresse : un code vient de partir, aucune session n'existe encore. */
  needsEmailCode: boolean;
  /** Tout est en ordre : la route poursuit (accueil, centres d'intérêt…). */
  onDone: () => void;
  /** « Modifier mon adresse » : retour au formulaire. */
  onBack: () => void;
  /** Le numéro peut-il être vérifié par SMS ? Faux tant qu'aucun fournisseur de SMS n'est branché. */
  phoneEnabled: boolean;
};

/** Le numéro saisi peut-il être vérifié par SMS ? Il faut un numéro lisible ET un fournisseur de SMS. */
function canVerifyPhone(phone: string, phoneEnabled: boolean): boolean {
  return phoneEnabled && phone !== '';
}

/**
 * Y a-t-il quelque chose à vérifier après l'inscription ? Sinon la route poursuit sans afficher
 * cet écran. Décidé par le PARENT, avant de monter le composant : un rendu ne doit pas déclencher
 * de navigation.
 */
export function needsVerification(input: {
  needsEmailCode: boolean;
  phone: string;
  phoneEnabled: boolean;
}): boolean {
  return input.needsEmailCode || canVerifyPhone(input.phone, input.phoneEnabled);
}

/**
 * CE QUI SUIT L'INSCRIPTION — confirmer l'adresse, puis (facultatif) vérifier le numéro.
 *
 * 1. **Code par e-mail**, quand le serveur l'exige : sans lui, il n'y a pas de session.
 * 2. **Vérification du numéro**, proposée une fois connecté. Un numéro vérifié permet de se
 *    connecter avec lui ; un numéro non vérifié reste un simple contact (le livreur peut vous
 *    appeler), sans droit de connexion.
 *
 * La seconde étape n'est JAMAIS bloquante : « Plus tard » est toujours là, et une panne du
 * fournisseur de SMS ne doit pas empêcher quelqu'un d'entrer dans l'app avec son e-mail déjà
 * confirmé. Le numéro se vérifie aussi plus tard, depuis « Mon compte ».
 */
export function SignUpVerification({
  email,
  phone,
  needsEmailCode,
  onDone,
  onBack,
  phoneEnabled,
}: Props) {
  const colors = useColors();
  const demo = useAuthStore(selectDemoMode);
  const confirmSignUp = useAuthStore((s) => s.confirmSignUp);
  const resendSignUpCode = useAuthStore((s) => s.resendSignUpCode);
  const startPhoneVerification = useAuthStore((s) => s.startPhoneVerification);
  const confirmPhone = useAuthStore((s) => s.confirmPhone);
  const resendPhoneCode = useAuthStore((s) => s.resendPhoneCode);

  const offerPhone = canVerifyPhone(phone, phoneEnabled);
  const [step, setStep] = useState<Step>(needsEmailCode ? 'email' : 'phone-offer');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendPhoneCode = async () => {
    setSending(true);
    setError(null);
    const result = await startPhoneVerification(phone);
    setSending(false);
    if (result.ok) setStep('phone-code');
    else setError(friendlyAuthError(result.error));
  };

  if (step === 'email') {
    return (
      <CodeStep
        testIDPrefix="verify-email"
        title="Confirmez votre e-mail"
        sentTo={maskEmail(email)}
        demo={demo}
        onSubmit={async (code) => {
          const result = await confirmSignUp(email, code);
          if (result.ok) {
            if (offerPhone) setStep('phone-offer');
            else onDone();
          }
          return result;
        }}
        onResend={() => resendSignUpCode(email)}
        onBack={onBack}
        backLabel="Modifier mon adresse e-mail"
      />
    );
  }

  if (step === 'phone-code') {
    return (
      <CodeStep
        testIDPrefix="verify-phone"
        title="Vérifiez votre numéro"
        sentTo={maskPhone(phone)}
        demo={demo}
        onSubmit={async (code) => {
          const result = await confirmPhone(phone, code);
          if (result.ok) onDone();
          return result;
        }}
        onResend={() => resendPhoneCode(phone)}
        onBack={() => setStep('phone-offer')}
        backLabel="Retour"
      />
    );
  }

  return (
    <View testID="verify-phone-offer" className="gap-4">
      <View className="items-center gap-3">
        <View className="h-14 w-14 items-center justify-center rounded-pill border border-brand-200 bg-brand-50">
          <Feather name="smartphone" size={24} color={colors.brand500} />
        </View>
        <AppText variant="title" className="text-center">
          Vérifier votre numéro
        </AppText>
        <AppText variant="caption" className="text-center text-ink-muted">
          Votre compte est créé. Vérifiez {maskPhone(phone)} par SMS pour pouvoir aussi vous
          connecter avec votre numéro. Vous pouvez le faire plus tard depuis « Mon compte ».
        </AppText>
      </View>

      {error ? (
        <View className="flex-row items-start gap-2 rounded-control border border-brand-200 bg-brand-50 p-3">
          <Feather name="alert-circle" size={15} color={colors.brand600} />
          <AppText testID="verify-phone-error" variant="caption" className="flex-1 text-brand-600">
            {error}
          </AppText>
        </View>
      ) : null}

      <Button
        testID="verify-phone-send"
        label="Recevoir le code par SMS"
        loading={sending}
        onPress={() => void sendPhoneCode()}
      />
      <Pressable
        testID="verify-phone-later"
        accessibilityRole="button"
        accessibilityLabel="Plus tard"
        onPress={onDone}
        className="py-1"
      >
        <AppText variant="caption" className="text-center font-sans-semibold text-ink-muted">
          Plus tard
        </AppText>
      </Pressable>
    </View>
  );
}
