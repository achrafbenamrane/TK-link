import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { endsAt, screeningDetails } from '../../lib/screening';
import type { Screening } from '../../model/schema';

type Props = {
  screening: Screening;
  testID?: string;
  /** Version détaillée, pour la fiche produit : ajoute l'heure de fin. */
  expanded?: boolean;
};

/**
 * LE FILM, sur la carte — parce que c'est lui le produit.
 *
 * « Place de cinéma · séance du soir » ne se vend pas : personne n'achète une
 * place, on achète *un film, à une heure*. Sans ces deux informations, l'offre
 * demande une confiance aveugle — et il ne reste qu'une heure pour décider.
 *
 * D'où un bandeau distinct plutôt qu'une ligne de légende : le titre du film
 * est en gras, l'heure de séance est à droite en chiffres lisibles, et le
 * détail (genre, durée, version, salle) passe en dessous, gris. C'est la même
 * hiérarchie que la grille d'un cinéma, celle que l'œil sait déjà lire.
 *
 * Aucune affiche n'est affichée : les visuels de distribution sont protégés.
 * Le titre est une information factuelle, un cinéma a le droit de dire ce
 * qu'il projette.
 */
export function ScreeningStrip({ screening, testID, expanded = false }: Props) {
  const end = expanded ? endsAt(screening) : null;

  return (
    <View
      testID={testID}
      className="flex-row items-center gap-3 rounded-control border border-line bg-surface-sunken px-3 py-2.5"
    >
      <Feather name="film" size={16} color={colors.inkMuted} />

      <View className="flex-1">
        <AppText className="font-sans-bold text-ink" style={{ fontSize: 14.5 }} numberOfLines={1}>
          {screening.film}
        </AppText>
        <AppText variant="caption" className="mt-0.5 text-ink-faint" numberOfLines={1}>
          {screeningDetails(screening)}
        </AppText>
      </View>

      <View className="items-end">
        <AppText className="font-display text-ink" style={{ fontSize: 17 }}>
          {screening.startsAt}
        </AppText>
        {end ? (
          <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 10.5 }}>
            fin ~ {end}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
