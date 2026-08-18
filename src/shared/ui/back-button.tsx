import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { colors } from '@/shared/theme/colors';

export type BackButtonProps = {
  /**
   * Où aller si la pile est vide.
   *
   * Un écran ouvert par lien profond, ou après un `replace`, n'a rien derrière
   * lui : `router.back()` n'y ferait rien du tout. Le bouton serait alors une
   * promesse morte — pire qu'un bouton absent, parce qu'on le presse.
   */
  fallbackHref?: string;
  testID?: string;
};

/**
 * LE RETOUR, PARTOUT — demande de la conduite de projet du 18/08/2026 :
 * « ajoute toujours un bouton retour en arrière ».
 *
 * Neuf écrans empilés n'en avaient aucun : Adresses, Aide, Coupons, Factures,
 * Tickets, Préférences, Compte, Empreinte, Espace commerçant. On y entrait sans
 * pouvoir en sortir autrement que par le geste système — que tout le monde ne
 * connaît pas, et qui n'existe pas de la même façon sur chaque téléphone.
 *
 * Composant partagé plutôt que neuf copies : c'est la seule façon qu'un
 * dixième écran l'hérite sans qu'on ait à y penser.
 */
export function BackButton({ fallbackHref = '/', testID = 'back' }: BackButtonProps) {
  const router = useRouter();

  return (
    <View className="mb-3 flex-row">
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel="Revenir en arrière"
        hitSlop={10}
        onPress={() => {
          // `canGoBack` évite le bouton qui ne fait rien : sans pile, on
          // retombe sur une destination explicite plutôt que sur un écran mort.
          if (router.canGoBack()) router.back();
          else router.replace(fallbackHref);
        }}
        className="h-10 w-10 items-center justify-center rounded-pill border border-line bg-surface active:opacity-70"
      >
        <Feather name="chevron-left" size={20} color={colors.ink} />
      </Pressable>
    </View>
  );
}
