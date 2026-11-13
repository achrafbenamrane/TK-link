import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText, Button, ScreenIntro } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { friendlyAuthError } from '../model/auth-errors';
import { DEMO_CODE } from '../model/demo-session';
import { OTP_LENGTH, OtpSchema } from '../model/schema';
import type { AuthResult } from '../model/store';

type Props = {
  title: string;
  /** Où le code est parti, DÉJÀ masqué (« n•••@exemple.fr ») : l'écran ne montre jamais l'adresse entière. */
  sentTo: string;
  /**
   * Remplace la phrase « Nous avons envoyé un code à… ». Le mot de passe oublié ne doit PAS affirmer
   * qu'un code est parti : ce serait avouer qu'un compte existe pour cette adresse.
   */
  description?: string;
  /** Valide le code. En cas de succès, c'est le parent qui change d'écran. */
  onSubmit: (code: string) => Promise<AuthResult>;
  /** Demande un nouveau code. */
  onResend: () => Promise<AuthResult>;
  /** « Modifier l'adresse », « Retour »… Absent : pas de lien. */
  onBack?: () => void;
  backLabel?: string;
  submitLabel?: string;
  /** Aucun serveur n'envoie de code : on affiche celui de la démonstration. */
  demo?: boolean;
  /** Délai avant de pouvoir redemander un code (Supabase en impose un : 60 s par défaut). */
  cooldownSeconds?: number;
  /** Préfixe des identifiants de test — plusieurs étapes de code peuvent coexister dans l'app. */
  testIDPrefix?: string;
};

/**
 * LA SAISIE DU CODE — six chiffres reçus par e-mail ou par SMS.
 *
 * Un seul champ plutôt que six cases : les claviers iOS et Android savent le remplir tout seuls
 * depuis le SMS reçu (`oneTimeCode` / `sms-otp`), ce que six champs séparés cassent souvent. Dès que
 * le sixième chiffre est tapé, le code part — pas de bouton à chercher. Le bouton reste là pour qui
 * préfère valider à la main.
 *
 * Un code faux ou périmé vide le champ (on en saisit un autre) ; une erreur réseau le garde (le code,
 * lui, était bon). « Renvoyer le code » est bloqué pendant le délai imposé par le serveur : sans ça,
 * un utilisateur impatient viderait le quota d'envois — et le budget SMS.
 */
export function CodeStep({
  title,
  sentTo,
  description,
  onSubmit,
  onResend,
  onBack,
  backLabel = 'Retour',
  submitLabel = 'Valider',
  demo = false,
  cooldownSeconds = 60,
  testIDPrefix = 'code',
}: Props) {
  const colors = useColors();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);
  const [wait, setWait] = useState(cooldownSeconds);
  // Un second appel pendant le premier (saisie automatique + appui sur le bouton) enverrait le code
  // deux fois — et le second serait refusé, le premier l'ayant consommé.
  const busy = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const submit = async (value: string) => {
    if (busy.current) return;
    if (!OtpSchema.safeParse(value).success) {
      setError(`Le code comporte ${OTP_LENGTH} chiffres.`);
      return;
    }
    busy.current = true;
    setSubmitting(true);
    setError(null);
    const result = await onSubmit(value);
    busy.current = false;
    setSubmitting(false);
    if (!result.ok) {
      setError(friendlyAuthError(result.error));
      if (result.error === 'otp_invalid') setCode('');
    }
  };

  const change = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    setError(null);
    setResent(false);
    if (digits.length === OTP_LENGTH) void submit(digits);
  };

  const resend = async () => {
    if (wait > 0) return;
    const result = await onResend();
    if (result.ok) {
      setResent(true);
      setError(null);
      setWait(cooldownSeconds);
    } else {
      setError(friendlyAuthError(result.error));
    }
  };

  return (
    <View testID={`${testIDPrefix}-step`}>
      <ScreenIntro
        title={title}
        subtitle={
          description ?? (
            <>
              Nous avons envoyé un code à {OTP_LENGTH} chiffres à{' '}
              <AppText className="font-sans-bold text-sm text-ink">{sentTo}</AppText>.
            </>
          )
        }
      />
      <View className="gap-4">
        <TextInput
          testID={`${testIDPrefix}-input`}
          value={code}
          onChangeText={change}
          keyboardType="number-pad"
          // Le clavier propose le code reçu par SMS au-dessus des touches.
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={OTP_LENGTH}
          autoFocus
          placeholder="••••••"
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel={`Code à ${OTP_LENGTH} chiffres`}
          editable={!submitting}
          className="h-14 rounded-control border border-line bg-surface-muted text-center font-sans-bold text-ink"
          style={{ fontSize: 26, letterSpacing: 10 }}
        />

        {demo ? (
          <AppText
            testID={`${testIDPrefix}-demo`}
            variant="caption"
            className="text-center text-ink-faint"
          >
            Démonstration : aucun message n’est envoyé. Saisissez {DEMO_CODE}.
          </AppText>
        ) : null}

        {error ? (
          <View className="flex-row items-start gap-2 rounded-control border border-brand-200 bg-brand-50 p-3">
            <Feather name="alert-circle" size={15} color={colors.brand600} />
            <AppText
              testID={`${testIDPrefix}-error`}
              variant="caption"
              className="flex-1 text-brand-600"
            >
              {error}
            </AppText>
          </View>
        ) : null}

        {resent && !error ? (
          <AppText
            testID={`${testIDPrefix}-resent`}
            variant="caption"
            className="text-center text-success"
          >
            Un nouveau code vient d’être envoyé.
          </AppText>
        ) : null}

        <Button
          testID={`${testIDPrefix}-submit`}
          label={submitLabel}
          loading={submitting}
          disabled={code.length !== OTP_LENGTH}
          onPress={() => void submit(code)}
        />

        <Pressable
          testID={`${testIDPrefix}-resend`}
          accessibilityRole="button"
          accessibilityLabel="Renvoyer le code"
          accessibilityState={{ disabled: wait > 0 }}
          disabled={wait > 0}
          onPress={() => void resend()}
          className="py-1"
        >
          <AppText
            variant="caption"
            className={
              wait > 0 ? 'text-center text-ink-faint' : 'text-center font-sans-bold text-brand-600'
            }
          >
            {wait > 0 ? `Renvoyer le code dans ${wait} s` : 'Renvoyer le code'}
          </AppText>
        </Pressable>

        {onBack ? (
          <Pressable
            testID={`${testIDPrefix}-back`}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            onPress={onBack}
            className="py-1"
          >
            <AppText variant="caption" className="text-center text-ink-muted">
              {backLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
