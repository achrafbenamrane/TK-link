import { pickImage, type PhotoSource } from '@/shared/lib/image-picker';

/**
 * La photo d'un Flash — étape 1 de la création (CDC V1.1, Commerçant > Process :
 * « photo, titre, prix de référence… »). Facultative : `null` si la personne
 * refuse ou annule. Le module natif vit dans `shared/lib/image-picker`.
 *
 * La carte Flash montre le produit en 4:3 : on recadre à la prise. L'adresse
 * rendue est LOCALE ; le jour où le back-end existe, c'est ici qu'on téléverse.
 */
export type { PhotoSource };

export function pickFlashPhoto(source: PhotoSource): Promise<string | null> {
  return pickImage(source, { aspect: [4, 3] });
}
