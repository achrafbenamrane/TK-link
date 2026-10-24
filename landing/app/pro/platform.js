/**
 * LES RÉGLAGES DE LA PLATEFORME — CDC V1.0 §12.3, mis à jour par la V1.1.
 *
 * ⚠️ MIROIR de `src/shared/lib/platform-settings.ts` dans l'app. Même liste, mêmes valeurs par
 * défaut, mêmes « absentes » : toute modification ici se reporte là-bas, et réciproquement.
 *
 * Règle du CDC (§14) : « un paramètre non finalisé doit être prévu dans l'architecture, mais pas
 * inventé ». Ce qui vaut `null` ci-dessous n'est pas un oubli, c'est un point que le client a laissé
 * ouvert : l'écran dit « à définir » plutôt que d'afficher un chiffre plausible.
 *
 * Le Super Admin les édite ; l'espace pro les relit. Pas de serveur : ils voyagent par le
 * stockage du navigateur, ce qui suffit à montrer le geste (« le nombre 5 est un paramètre Super
 * Admin », §6.2). Le jour où l'API existe, `readSettings` lit le serveur et rien d'autre ne bouge.
 */

export const DEFAULT_SETTINGS = {
  freeOperations: 5,
  commissionB2cPct: 5,
  commissionB2bPct: 5,
  referralRewardEur: 5,
  pointsPerEuro: 1,
  deliveryFeeEur: 0,
  courierBaseFeeEur: 3,
  courierPerKmEur: 0.8,
  courierBaseZoneKm: null,
  importantParcelMinEur: null,
  cartHoldSeconds: null,
};

/**
 * Ce que l'administrateur peut régler, groupé comme il le cherche.
 *
 * `unit` : suffixe affiché. `min`/`max` : bornes de saisie (jamais une règle métier cachée : ce
 * sont des garde-fous contre une faute de frappe). `nullable` : un champ qu'on peut laisser vide
 * pour dire « non arrêté ». `integer` : refuse les décimales.
 */
export const SETTING_GROUPS = [
  {
    title: 'Opérations Flash',
    fields: [
      {
        key: 'freeOperations',
        label: 'Opérations Flash offertes',
        unit: 'opérations',
        min: 0,
        max: 1000,
        integer: true,
        source: 'CDC §6.2 — « un paramètre Super Admin, jamais codé en dur »',
      },
    ],
  },
  {
    title: 'Commissions',
    fields: [
      {
        key: 'commissionB2cPct',
        label: 'Commission B2C',
        unit: '%',
        min: 0,
        max: 30,
        source: 'CDC V1.1 — 5 %, configurable',
      },
      {
        key: 'commissionB2bPct',
        label: 'Commission B2B',
        unit: '%',
        min: 0,
        max: 30,
        source: 'CDC V1.1 — 5 %, alignée sur le B2C (arbitrage du 31/08/2026)',
      },
    ],
  },
  {
    title: 'Livraison',
    fields: [
      {
        key: 'deliveryFeeEur',
        label: 'Frais de livraison payés par le client',
        unit: '€',
        min: 0,
        max: 50,
        source: 'Non chiffré par le CDC : 0 € (offerte) tant que le client ne l’a pas arrêté',
      },
      {
        key: 'courierBaseFeeEur',
        label: 'Rémunération du livreur, par commande',
        unit: '€',
        min: 0,
        max: 50,
        source: 'CDC V1.1 — 3,00 € par commande',
      },
      {
        key: 'courierPerKmEur',
        label: 'Rémunération du livreur, par km',
        unit: '€/km',
        min: 0,
        max: 10,
        source: 'CDC V1.1 — 0,80 €/km au-delà de la zone de base',
      },
      {
        key: 'courierBaseZoneKm',
        label: 'Zone de base du livreur',
        unit: 'km',
        min: 0,
        max: 100,
        nullable: true,
        source: 'Le CDC parle d’une « zone de base » sans la chiffrer',
      },
      {
        key: 'importantParcelMinEur',
        label: 'Valeur d’un « colis important »',
        unit: '€',
        min: 0,
        max: 100000,
        nullable: true,
        source: 'Au-delà, la remise exige la biométrie du livreur — non chiffré par le CDC',
      },
    ],
  },
  {
    title: 'Fidélité et parrainage',
    fields: [
      {
        key: 'pointsPerEuro',
        label: 'Points par euro dépensé',
        unit: 'point / €',
        min: 0,
        max: 100,
        source: 'CDC §8.1 — 1 € TTC dépensé en produits = 1 point',
      },
      {
        key: 'referralRewardEur',
        label: 'Récompense de parrainage (à chacun des deux)',
        unit: '€',
        min: 0,
        max: 100,
        source: 'CDC V1.1 — 5 € crédités au parrain et au filleul, financés par TK LINK',
      },
    ],
  },
  {
    title: 'Panier',
    fields: [
      {
        key: 'cartHoldSeconds',
        label: 'Durée de réservation du stock au panier',
        unit: 's',
        min: 0,
        max: 86400,
        integer: true,
        nullable: true,
        source: 'CDC §4.4 — « analyse en cours », à rendre configurable mais pas à inventer',
      },
    ],
  },
];

/** Les réglages qui ne se changent pas ici : la loi ou le CDC les fixe. */
export const FIXED_SETTINGS = [
  { label: 'Durée d’un Flash', value: '15 min à 2 h', source: 'CDC V1.1 — VALIDÉ' },
  { label: 'Conservation des pièces comptables', value: '10 ans', source: 'CDC §9.6' },
  { label: 'Programmation d’une offre', value: 'Jusqu’à la veille', source: 'CDC V1.1 — VALIDÉ' },
];

export const FIELDS = SETTING_GROUPS.flatMap((g) => g.fields);

const STORAGE_KEY = 'tklink-platform-settings-v1';

/**
 * Les réglages enregistrés, complétés par les valeurs par défaut.
 *
 * Tolérant par construction : une clé absente, un type inattendu ou un JSON cassé retombent sur
 * la valeur par défaut au lieu de faire échouer la page (le stockage d'un navigateur se vide, se
 * bloque en navigation privée, ou garde le format d'une version antérieure).
 */
export function readSettings() {
  const out = { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return out;
    const saved = JSON.parse(raw);
    for (const f of FIELDS) {
      const v = saved?.[f.key];
      if (typeof v === 'number' && Number.isFinite(v)) out[f.key] = v;
      else if (v === null && f.nullable) out[f.key] = null;
    }
  } catch {
    // Stockage indisponible : les valeurs par défaut sont déjà en place.
  }
  return out;
}

export function writeSettings(values) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    return true;
  } catch {
    return false;
  }
}

export function resetSettings() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien à faire : il n'y avait rien d'enregistré.
  }
  return { ...DEFAULT_SETTINGS };
}

/** Une valeur à afficher dans un champ de saisie : « 0,8 » plutôt que « 0.8 », vide pour `null`. */
export function toInput(value) {
  return value === null || value === undefined ? '' : String(value).replace('.', ',');
}

/**
 * Valide une saisie complète. Renvoie les erreurs PAR CHAMP (un bandeau global obligerait à deviner
 * lequel des onze corriger) et les valeurs converties, prêtes à enregistrer.
 */
export function validateSettings(inputs) {
  const errors = {};
  const values = {};
  for (const f of FIELDS) {
    const raw = String(inputs[f.key] ?? '')
      .trim()
      .replace(',', '.');
    if (raw === '') {
      if (f.nullable) values[f.key] = null;
      else errors[f.key] = 'Indiquez une valeur';
      continue;
    }
    if (!/^\d+(\.\d+)?$/.test(raw)) {
      errors[f.key] = 'Un nombre, sans signe ni texte';
      continue;
    }
    const n = Number(raw);
    if (f.integer && !Number.isInteger(n)) errors[f.key] = 'Un nombre entier';
    else if (n < f.min || n > f.max) errors[f.key] = `Entre ${f.min} et ${f.max}`;
    else values[f.key] = n;
  }
  return { errors, values, ok: Object.keys(errors).length === 0 };
}
