import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { selectCartCount, useShopStore } from '../../model/store';

/**
 * Accès au panier, avec le nombre d'articles.
 *
 * Extrait de l'accueil pour être posé sur les autres écrans : le panier doit
 * rester à portée partout où l'on ajoute quelque chose, sinon on ajoute sans
 * jamais voir où ça atterrit.
 */
export function CartButton({ testID = 'cart-button' }: { testID?: string }) {
  const router = useRouter();
  const count = useShopStore(selectCartCount);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? `Voir le panier, ${count} article${count > 1 ? 's' : ''}` : 'Voir le panier'
      }
      onPress={() => router.push('/panier')}
      className="h-10 w-10 items-center justify-center rounded-pill bg-surface-muted"
    >
      <Feather name="shopping-bag" size={19} color={colors.ink} />
      {count > 0 ? (
        <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-pill bg-brand-500 px-1">
          <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 10 }}>
            {count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
