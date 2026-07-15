import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';

import { AppText, Button, EmptyState, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { getDeal } from '../model/catalog';
import type { Deal } from '../model/schema';
import { selectFavorites, useShopStore } from '../model/store';
import { FlashCard } from './components/flash-card';

export function FavoritesScreen() {
  const router = useRouter();
  const favIds = useShopStore(selectFavorites);
  const deals = favIds.map(getDeal).filter((d): d is Deal => Boolean(d));

  return (
    <Screen padded={false} testID="favorites-screen">
      <View className="px-5 pb-3 pt-2">
        <AppText variant="display">Favoris</AppText>
        <AppText variant="caption">Vos coups de cœur, à saisir avant qu’ils s’envolent</AppText>
      </View>

      <FlatList
        data={deals}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <View className="px-5">
            <FlashCard deal={item} />
          </View>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-28 pt-1"
        ListEmptyComponent={
          <EmptyState
            testID="favorites-empty"
            title="Aucun favori pour l’instant"
            description="Touchez le cœur d’une offre pour la retrouver ici."
            icon={<Feather name="heart" size={30} color={colors.inkFaint} />}
            action={<Button label="Parcourir les offres" onPress={() => router.replace('/')} />}
          />
        }
      />
    </Screen>
  );
}
