import { useMemo, useState } from 'react';

import {
  discountAmountCents,
  formatDiscount,
  selectWallet,
  useCouponsStore,
} from '@/features/coupons';
import {
  CartScreen,
  selectCartSubtotal,
  useShopStore,
  type CartCouponOption,
} from '@/features/shop';

/**
 * Racine de composition du panier : c'est ICI que les coupons (feature à part)
 * rencontrent le panier (feature shop). Le `CartScreen` ne connaît pas les
 * coupons — il reçoit des options prêtes et signale sa sélection par callbacks.
 * On calcule la remise de chaque coupon pour le sous-total courant, et à la
 * commande on marque le coupon retenu comme consommé.
 */
export default function PanierRoute() {
  const subtotal = useShopStore(selectCartSubtotal);
  // Référence STABLE (`s.wallet`) : filtrer dans le sélecteur renverrait un
  // nouveau tableau à chaque rendu → boucle infinie sous Zustand 5. On filtre
  // (coupons non utilisés) dans le mémo ci-dessous.
  const wallet = useCouponsStore(selectWallet);
  // Aliasé : `useCoupon` déclenche à tort la règle des Hooks (préfixe « use »).
  const consumeCoupon = useCouponsStore((s) => s.useCoupon);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const subtotalCents = Math.round(subtotal * 100);
  const options = useMemo<CartCouponOption[]>(
    () =>
      wallet
        .filter((c) => c.usedAt === null)
        .map((c) => ({
          id: c.id,
          code: c.code,
          label: c.label,
          discountLabel: formatDiscount(c.discount),
          discountEur: discountAmountCents(c.discount, subtotalCents) / 100,
        })),
    [wallet, subtotalCents],
  );

  return (
    <CartScreen
      coupons={{
        options,
        selectedId,
        onSelect: setSelectedId,
        onApplied: (id) => {
          consumeCoupon(id);
          setSelectedId(null);
        },
      }}
    />
  );
}
