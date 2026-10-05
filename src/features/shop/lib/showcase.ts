import type { VideoSource } from 'expo-video';

/**
 * LES VITRINES D'EXEMPLE — pour montrer au client ce que voit un acheteur sur la fiche d'une
 * enseigne : la vidéo du magasin, le portfolio, la présentation.
 *
 * Seule l'enseigne de l'appareil a une vitrine réglée par son commerçant ; les autres viennent du
 * catalogue, sans vidéo ni photo. Pour la démonstration, « Techno Capitole » reçoit ici une
 * vitrine d'exemple (la maquette du client), marquée comme telle dans le code. Les vidéos sont
 * des diaporamas fabriqués par `scripts/make-demo-videos.mjs` : ce ne sont pas des vidéos de
 * commerçants, et un commerçant réel dépose la sienne depuis « Ma boutique ».
 */

/** Les vidéos du dépôt, par clé. Une vitrine y fait référence au lieu d'une adresse. */
const DEMO_VIDEOS: Record<string, number> = {
  'demo-techno': require('../../../../assets/videos/techno-capitole.mp4'),
  'demo-resto': require('../../../../assets/videos/petit-toulousain.mp4'),
};

/**
 * Ce que le lecteur doit jouer pour la référence stockée dans la vitrine : une clé d'exemple
 * (`demo-techno`, `demo-resto`, ou l'ancien `demo`), sinon l'adresse du fichier du commerçant.
 */
export function videoSource(ref: string): VideoSource {
  const demo = DEMO_VIDEOS[ref === 'demo' ? 'demo-resto' : ref];
  return demo ?? { uri: ref };
}

export type ShowcaseProfile = {
  presentation: string;
  photos: string[];
  videos: string[];
  status: string;
  zone: string;
};

const SHOWCASES: Record<string, { profile: ShowcaseProfile; phone: string }> = {
  m_techno: {
    profile: {
      presentation:
        'Spécialiste hi-tech au cœur de Toulouse : audio, tablettes et accessoires. Fins de série et reconditionnés garantis 12 mois.',
      // Le portfolio montre déjà les visuels des offres : pas de doublon ici.
      photos: [],
      videos: ['demo-techno'],
      status: 'Ouvert',
      zone: 'Toulouse Centre',
    },
    // Numéro de la plage réservée à la fiction (01 99 00 xx xx).
    phone: '01 99 00 55 55',
  },
};

export function demoShowcase(merchantId: string) {
  return SHOWCASES[merchantId];
}
