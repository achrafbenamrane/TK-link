import * as ImagePicker from 'expo-image-picker';

/**
 * Prendre ou choisir une photo — partagé par la création d'un Flash (commerçant)
 * et les justificatifs du livreur : une feature n'importe pas sa voisine, et le
 * module natif reste isolé en un seul endroit.
 *
 * Renvoie `null` — jamais une erreur — si la personne refuse ou annule. La
 * permission se demande au moment du geste, jamais au lancement. L'adresse rendue
 * est LOCALE (cache de l'appareil) : sans serveur, rien ne l'envoie nulle part.
 */
export type PhotoSource = 'galerie' | 'camera';

export async function pickImage(
  source: PhotoSource,
  options: { aspect?: [number, number]; front?: boolean } = {},
): Promise<string | null> {
  try {
    const base: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: options.aspect ?? [4, 3],
      quality: 0.7,
    };

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return null;
      const result = await ImagePicker.launchCameraAsync({
        ...base,
        ...(options.front ? { cameraType: ImagePicker.CameraType.front } : {}),
      });
      return result.canceled ? null : (result.assets[0]?.uri ?? null);
    }

    const result = await ImagePicker.launchImageLibraryAsync(base);
    return result.canceled ? null : (result.assets[0]?.uri ?? null);
  } catch {
    return null;
  }
}
