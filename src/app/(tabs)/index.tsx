import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { HunterBar, useGameStore } from '@/features/gamification';
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
 * C'est ici que la boutique, le profil et la progression se rencontrent :
 * `shop` laisse trois places (identité, bandeau, intérêts) et les features
 * `onboarding` et `gamification` les remplissent. Aucune ne dépend des autres.
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

  return (
    <HomeScreen
      onVisit={onVisit}
      interests={interests}
      renderIdentity={renderIdentity}
      renderBanner={(criticalCount) => <HunterBar criticalCount={criticalCount} />}
    />
  );
}
