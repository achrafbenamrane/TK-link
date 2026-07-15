import * as Location from 'expo-location';

import type { Coord } from '../model/schema';

/**
 * Position de l'utilisateur, une seule fois.
 *
 * `expo-location` est isolé ici (et pas dans le store) pour que le modèle reste
 * testable sans mocker un module natif. Renvoie `null` — jamais une erreur — si
 * la permission est refusée ou le GPS indisponible : l'app doit continuer à
 * fonctionner sans position, seulement avec moins d'informations.
 */
export async function getUserCoord(): Promise<Coord | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
