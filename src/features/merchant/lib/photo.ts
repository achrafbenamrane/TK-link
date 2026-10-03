import * as ImagePicker from 'expo-image-picker';

/**
 * La photo d'un Flash — étape 1 de la création (CDC V1.1, Commerçant > Process :
 * « photo, titre, prix de référence… »).
 *
 * `expo-image-picker` est isolé ici, comme `expo-location` l'est dans la
 * boutique : le formulaire reste testable sans module natif, et la permission
 * se demande au moment du geste, jamais au lancement.
 *
 * Renvoie `null` — jamais une erreur — si la personne refuse ou annule : poser
 * une photo est un plus, pas un passage obligé.
 *
 * L'adresse rendue est LOCALE (le cache de l'appareil). Sans serveur, rien ne
 * l'envoie nulle part : elle illustre l'offre sur ce téléphone, et se perdrait
 * avec un nettoyage du cache. Le jour où le back-end existe, c'est ici qu'on
 * téléverse.
 */
export type PhotoSource = 'galerie' | 'camera';

export async function pickFlashPhoto(source: PhotoSource): Promise<string | null> {
  try {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      // La carte Flash montre le produit en 4:3 : on recadre à la prise.
      aspect: [4, 3],
      quality: 0.7,
    };

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return null;
      const result = await ImagePicker.launchCameraAsync(options);
      return result.canceled ? null : (result.assets[0]?.uri ?? null);
    }

    const result = await ImagePicker.launchImageLibraryAsync(options);
    return result.canceled ? null : (result.assets[0]?.uri ?? null);
  } catch {
    return null;
  }
}
