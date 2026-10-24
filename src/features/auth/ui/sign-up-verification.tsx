import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Button } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { friendlyAuthError } from '../model/auth-errors';
import { maskEmail, maskPhone } from '../model/identifier';
import { selectDemoMode, useAuthStore } from '../model/store';
import { CodeStep } from './code-step';

type Props = {
  /** L'adresse du compte, déjà normalisée. */
  email: string;
  /** Le numéro saisi à l'inscription, en E.164 — vide s'il n'y en a pas (ou s'il est illisible). */
  phone: string;
  /** Le serveur exige de confirmer l'adresse : un code vient de partir, aucune session n'existe encore. */
  needsEmailCode: boolean;
  /** La connexion par numéro est proposée (sinon, rien à associer). */
  phoneEnabled: boolean;
  /**
   * Tout est en ordre : la route poursuit (type de compte relu sur le serveur, puis l'accueil). Elle
   * peut prendre un instant : l'écran garde son indicateur jusqu'au bout, et ne l'appelle qu'une fois.
   */
  onDone: () => void | Promise<void>;
  /** « Modifier mon adresse » : retour au formulaire. */
  onBack: () => void;
};

/** Le numéro peut-il être associé ? Il faut un numéro lisible ET la connexion par numéro proposée. */
function canLinkPhone(phone: string, phoneEnabled: boolean): boolean {
  return phoneEnabled && phone !== '';
}

/**
 * Y a-t-il quelque chose à faire après l'inscription ? Sinon la route poursuit sans afficher cet
 * écran. Décidé par le PARENT, avant de monter le composant : un rendu ne doit pas naviguer.
 */
export function needsFollowUp(input: {
  needsEmailCode: boolean;
  phone: string;
  phoneEnabled: boolean;
}): boolean {
  return input.needsEmailCode || canLinkPhone(input.phone, input.phoneEnabled);
}

/**
 * CE QUI SUIT L'INSCRIPTION.
 *
 * 1. **Le code reçu par e-mail**, quand le serveur l'exige : sans lui, il n'y a pas de session.
 * 2. **Le numéro est associé au compte**, tout seul, SANS code (décision du 24/10/2026 — la
 *    vérification par SMS viendra avec Prelude). Ensuite, on peut se connecter avec lui.
 *
 * L'association n'est JAMAIS bloquante : si le numéro est déjà pris, ou si le réseau lâche, on le
 * dit, et on laisse entrer — l'e-mail suffit pour se connecter, et le numéro se rattache aussi plus
 * tard (à la prochaine connexion, ou depuis « Mon compte »).
 */
export function SignUpVerification({
  email,
  phone,
  needsEmailCode,
  phoneEnabled,
  onDone,
  onBack,
}: Props) {
  const demo = useAuthStore(selectDemoMode);
  const confirmSignUp = useAuthStore((s) => s.confirmSignUp);
  const resendSignUpCode = useAuthStore((s) => s.resendSignUpCode);
  const linkPhone = canLinkPhone(phone, phoneEnabled);
  const [step, setStep] = useState<'email' | 'phone'>(needsEmailCode ? 'email' : 'phone');

  // La suite ne part qu'UNE fois, même si deux chemins y mènent (double appui sur « Continuer »,
  // association réussie pendant un appui) : la route relirait le profil et naviguerait deux fois.
  const finishing = useRef(false);
  const finish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      await onDone();
    } finally {
      finishing.current = false;
    }
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
            // Le code reste « en cours » jusqu'à la fin de la suite : le renvoyer serait refusé.
            if (linkPhone) setStep('phone');
            else await finish();
          }
          return result;
        }}
        onResend={() => resendSignUpCode(email)}
        onBack={onBack}
        backLabel="Modifier mon adresse e-mail"
      />
    );
  }

  return <PhoneLinkStep phone={phone} onDone={finish} />;
}

/** L'association du numéro : automatique, avec un message si elle échoue. */
function PhoneLinkStep({ phone, onDone }: { phone: string; onDone: () => Promise<void> }) {
  const colors = useColors();
  const link = useAuthStore((s) => s.linkPhone);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  // Le parent recrée `onDone` à chaque rendu : on garde la dernière version sans relancer l'effet
  // (le relancer annulerait la réponse en cours et laisserait l'écran tourner dans le vide).
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  // Un effet rejoué (mode strict de React) rappelle `link` : le store renvoie alors la MÊME requête
  // en cours (une seule association par numéro à la fois), et seule la dernière exécution répond.
  useEffect(() => {
    let alive = true;
    void link(phone).then((result) => {
      if (!alive) return;
      // Associé : l'indicateur reste affiché pendant que la route poursuit.
      if (result.ok) void done.current();
      else setError(friendlyAuthError(result.error));
    });
    return () => {
      alive = false;
    };
  }, [attempt, link, phone]);

  if (!error) {
    return (
      <View testID="verify-phone-linking" className="items-center gap-4 py-8">
        <ActivityIndicator color={colors.brand500} />
        <AppText variant="caption" className="text-center text-ink-muted">
          Association de votre numéro {maskPhone(phone)}…
        </AppText>
      </View>
    );
  }

  return (
    <View testID="verify-phone-failed" className="gap-4">
      <View className="items-center gap-3">
        <View className="h-14 w-14 items-center justify-center rounded-pill border border-brand-200 bg-brand-50">
          <Feather name="smartphone" size={24} color={colors.brand500} />
        </View>
        <AppText variant="title" className="text-center">
          Votre compte est créé
        </AppText>
        <AppText
          testID="verify-phone-error"
          variant="caption"
          className="text-center text-ink-muted"
        >
          {error}
        </AppText>
        <AppText variant="caption" className="text-center text-ink-faint">
          Vous pouvez vous connecter avec votre e-mail. Le numéro se règle depuis « Mon compte ».
        </AppText>
      </View>
      <Button
        testID="verify-phone-continue"
        label="Continuer"
        loading={leaving}
        onPress={() => {
          setLeaving(true);
          void onDone().finally(() => setLeaving(false));
        }}
      />
      <Button
        testID="verify-phone-retry"
        label="Réessayer"
        variant="secondary"
        onPress={() => {
          setError(null);
          setAttempt((n) => n + 1);
        }}
      />
    </View>
  );
}
