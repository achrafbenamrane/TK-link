/* eslint-disable @typescript-eslint/no-require-imports -- why: le site (landing/) est du JS hors tsconfig */
import { CATEGORIES } from '../../src/shared/lib/categories';

/**
 * Les dossiers des professionnels dans `/admin` (table `shops`, migration 0010) : la carte d’une
 * demande, les décisions déjà prises, et le motif obligatoire d’un refus.
 */
const apps = require('../app/admin/applications') as {
  CATEGORY_LABEL: Record<string, string>;
  toApplication: (
    shop: Record<string, unknown>,
    profile?: Record<string, unknown>,
    email?: string,
  ) => Record<string, unknown>;
  decisionsOf: (shops: Record<string, unknown>[]) => Record<string, unknown>;
  validNote: (note: unknown) => string | null;
};

const shop = {
  id: 's-1',
  owner_id: 'u-1',
  kind: 'commercant',
  name: 'Le Petit Toulousain',
  category: 'restauration',
  siret: '44306184100047',
  address: '8 rue des Carmes, 31000 Toulouse',
  status: 'en_verification',
  review_note: null,
  submitted_at: '2026-11-13T09:00:00Z',
};

it('MIROIR : les catégories du back-office sont celles de l’app', () => {
  expect(Object.keys(apps.CATEGORY_LABEL).sort()).toEqual([...CATEGORIES].sort());
});

it('une ligne du serveur devient la carte d’une demande', () => {
  expect(
    apps.toApplication(
      shop,
      { first_name: 'Sofia', last_name: 'Martin', contact_phone: '+33612345678' },
      'sofia@exemple.fr',
    ),
  ).toMatchObject({
    id: 's-1',
    shop: 'Le Petit Toulousain',
    contact: 'Sofia Martin',
    email: 'sofia@exemple.fr',
    phone: '+33612345678',
    role: 'commercant',
    activity: 'Restauration',
    siret: '44306184100047',
    document: null,
  });
  // Sans profil ni e-mail : des tirets, pas « undefined ».
  expect(apps.toApplication(shop)).toMatchObject({ contact: '—', email: '—', phone: '—' });
});

it('le statut du serveur fait foi : validé, refusé avec son motif, ou à trancher', () => {
  expect(
    apps.decisionsOf([
      { ...shop, id: 'a', status: 'valide' },
      { ...shop, id: 'b', status: 'refuse', review_note: 'SIRET inconnu' },
      { ...shop, id: 'c' },
    ]),
  ).toEqual({
    a: { decision: 'accepted' },
    b: { decision: 'refused', reason: 'SIRET inconnu' },
  });
});

it('un refus porte un motif lisible : 3 à 300 caractères', () => {
  expect(apps.validNote('  SIRET inconnu  ')).toBe('SIRET inconnu');
  expect(apps.validNote('ok')).toBeNull();
  expect(apps.validNote('x'.repeat(301))).toBeNull();
  expect(apps.validNote(null)).toBeNull();
});
