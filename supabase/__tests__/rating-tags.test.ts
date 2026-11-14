import { readFileSync } from 'fs';
import { join } from 'path';

import { RATING_TAGS } from '../../src/features/shop/lib/rating';

/**
 * Les tags de la note du commerçant existent deux fois : dans l'app (les puces proposées) et dans la
 * base (la liste fermée que `order_ratings` accepte, migration 0025). Une puce ajoutée d'un seul côté
 * serait refusée par le serveur à chaque note : les deux listes doivent rester identiques, mot pour
 * mot (apostrophe typographique comprise).
 */
it('la liste de l’app est celle que le serveur accepte (0025), mot pour mot', () => {
  const sql = readFileSync(join(__dirname, '..', 'migrations', '0025_order_ratings.sql'), 'utf8');
  const block = sql.slice(sql.indexOf('tags <@ array['), sql.indexOf(']::text[]'));
  const serverTags = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  expect(serverTags).toEqual([...RATING_TAGS]);
});
