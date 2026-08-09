import { HomeScreen } from '@/features/shop';

/**
 * PARCOURIR — la recherche par la carte : on ouvre directement sur les
 * commerces autour de soi, comme dans la maquette du client.
 */
export default function ParcourirRoute() {
  return <HomeScreen initialView="carte" />;
}
