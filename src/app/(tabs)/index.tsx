import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { useGameStore } from '@/features/gamification';
import {
  AvatarView,
  selectAvatar,
  selectFirstName,
  selectInterests,
  useOnboardingStore,
} from '@/features/onboarding';
import { HomeScreen } from '@/features/shop';
import { AppText } from '@/shared/ui';

/**
 * ACCUEIL — les ventes flash, triées par ce qui va disparaître en premier.
 *
 * La progression (rang, missions, série) n'est PLUS ici : elle vit dans
 * l'onglet « La Chasse ». L'accueil retrouve son seul métier — montrer ce qui
 * se déstocke maintenant. La visite du jour, elle, continue d'être comptée :
 * c'est bien l'ouverture de l'app qu'elle mesure, pas l'affichage du bandeau.
 */
export default function AccueilRoute() {
  const router = useRouter();
  const markVisit = useGameStore((s) => s.markVisit);
  const avatar = useOnboardingStore(selectAvatar);
  const firstName = useOnboardingStore(selectFirstName);
  const interests = useOnboardingStore(selectInterests);

  const onVisit = useCallback(() => markVisit(), [markVisit]);

  const renderIdentity = useCallback(
    () => (
      <Pressable
        testID="home-identity"
        accessibilityRole="button"
        accessibilityLabel={firstName ? `Profil de ${firstName}` : 'Votre profil'}
        onPress={() => router.push('/profil')}
      >
        <View className="h-11 w-11 overflow-hidden rounded-pill">
          <AvatarView avatar={avatar} size={44} />
        </View>
        {firstName ? (
          <AppText
            variant="caption"
            className="mt-0.5 text-center text-ink-faint"
            style={{ fontSize: 10 }}
            numberOfLines={1}
          >
            {firstName}
          </AppText>
        ) : null}
      </Pressable>
    ),
    [avatar, firstName, router],
  );

  return <HomeScreen onVisit={onVisit} interests={interests} renderIdentity={renderIdentity} />;
}
