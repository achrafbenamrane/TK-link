import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { isGoogleConfigured } from '@/shared/lib/env';
import { AppText } from '@/shared/ui';
import { useColors, useScheme } from '@/shared/theme/theme-provider';

import { isAppleAvailable } from '../model/social/apple';
import type { SocialProvider } from '../model/social/types';
import { selectDemoMode, useAuthStore } from '../model/store';
import { AppleLogo, GoogleLogo } from './social-icons';

/**
 * QUELS BOUTONS AFFICHER — une règle pure, testée seule.
 *
 * - Hors démonstration : Google seulement s'il est branché (identifiant client présent) et hors web ;
 *   Apple seulement si le système l'offre (iOS 13+, capacité activée). Un bouton qui échouerait au
 *   toucher est pire qu'un bouton absent.
 * - En démonstration (aucun serveur) : on montre ce qui existera, pour que le client voie l'écran.
 *   Apple y reste réservé à iOS — et au web, où l'on prévisualise — comme en vrai.
 *
 * App Store 4.8 : dès qu'on propose Google sur iOS, on propose aussi Apple. Les deux règles ci-dessus
 * ne les séparent jamais sur un iPhone récent.
 */
export type SocialAvailability = { google: boolean; apple: boolean };

export function socialAvailability(input: {
  demo: boolean;
  os: string;
  googleConfigured: boolean;
  appleAvailable: boolean;
}): SocialAvailability {
  if (input.demo) return { google: true, apple: input.os === 'ios' || input.os === 'web' };
  return {
    google: input.googleConfigured && input.os !== 'web',
    apple: input.appleAvailable,
  };
}

export function useSocialAvailability(): SocialAvailability {
  const demo = useAuthStore(selectDemoMode);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (demo) return;
    let alive = true;
    void isAppleAvailable().then((ok) => {
      if (alive) setAppleAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, [demo]);

  return socialAvailability({
    demo,
    os: Platform.OS,
    googleConfigured: isGoogleConfigured,
    appleAvailable,
  });
}

const LABEL: Record<SocialProvider, string> = {
  google: 'Google',
  apple: 'Apple',
};

type ButtonProps = {
  provider: SocialProvider;
  onPress: () => void;
  /** Ce bouton attend la réponse du fournisseur. */
  loading?: boolean;
  /** Un autre parcours est en cours : on empêche le double appui. */
  disabled?: boolean;
  /** « full » : pleine largeur avec libellé. « icon » : carré compact, pour les rangées. */
  variant?: 'full' | 'icon';
  /** « Continuer avec » (défaut) ou « Se connecter avec ». */
  verb?: string;
};

/**
 * Un bouton « Continuer avec Google / Apple ».
 *
 * Apple impose un fond noir ou blanc et sa pomme : on suit le mode de l'app (blanc sur fond Nuit,
 * noir sur fond Jour) pour qu'il reste le bouton le plus lisible de l'écran. Google, lui, sur fond
 * neutre, avec son « G » en quatre couleurs.
 */
export function SocialButton({
  provider,
  onPress,
  loading = false,
  disabled = false,
  variant = 'full',
  verb = 'Continuer avec',
}: ButtonProps) {
  const colors = useColors();
  const scheme = useScheme();
  const label = `${verb} ${LABEL[provider]}`;
  const inactive = disabled || loading;

  // Apple : blanc en mode Nuit, noir en mode Jour. La pomme prend l'inverse du fond.
  const appleDark = scheme === 'day';
  const appleInk = appleDark ? '#FFFFFF' : '#000000';

  const logo =
    provider === 'google' ? <GoogleLogo size={20} /> : <AppleLogo size={20} color={appleInk} />;

  return (
    <Pressable
      testID={`auth-${provider}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-center rounded-control border',
        variant === 'full' ? 'h-12 gap-3 px-5' : 'h-10 flex-1',
        provider === 'apple'
          ? appleDark
            ? 'border-black bg-black'
            : 'border-white bg-white'
          : 'border-line bg-surface-muted',
        inactive && !loading && 'opacity-50',
      )}
    >
      {loading ? (
        <ActivityIndicator size="small" color={provider === 'apple' ? appleInk : colors.brand600} />
      ) : (
        logo
      )}
      {variant === 'full' ? (
        <AppText
          className={cn(
            'font-sans-semibold',
            provider === 'apple' ? (appleDark ? 'text-white' : 'text-black') : 'text-ink',
          )}
          style={{ fontSize: 15 }}
        >
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/**
 * La section « ou » des écrans de connexion : un séparateur, les boutons disponibles empilés, et la
 * mention légale. Rien du tout si aucun fournisseur n'est utilisable — pas de séparateur orphelin.
 */
export function SocialSection({
  onSelect,
  busy,
  verb,
  legal = false,
}: {
  onSelect: (provider: SocialProvider) => void;
  busy: SocialProvider | null;
  verb?: string;
  /** Rappeler que continuer vaut accepter les CGU (écran de connexion : pas de case à cocher). */
  legal?: boolean;
}) {
  const available = useSocialAvailability();
  if (!available.google && !available.apple) return null;

  return (
    <View testID="auth-social" className="gap-2.5">
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-line" />
        <AppText variant="caption" className="text-ink-muted">
          ou
        </AppText>
        <View className="h-px flex-1 bg-line" />
      </View>
      {available.google ? (
        <SocialButton
          provider="google"
          loading={busy === 'google'}
          disabled={busy !== null}
          onPress={() => onSelect('google')}
          {...(verb ? { verb } : {})}
        />
      ) : null}
      {available.apple ? (
        <SocialButton
          provider="apple"
          loading={busy === 'apple'}
          disabled={busy !== null}
          onPress={() => onSelect('apple')}
          {...(verb ? { verb } : {})}
        />
      ) : null}
      {legal ? (
        <AppText
          testID="auth-social-legal"
          variant="caption"
          className="text-center text-ink-faint"
          style={{ fontSize: 11 }}
        >
          En continuant, vous acceptez les CGU et la politique de confidentialité.
        </AppText>
      ) : null}
    </View>
  );
}
