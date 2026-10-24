'use client';

import { useState } from 'react';

/**
 * LE PROGRAMME DE FIDÉLITÉ DU COMMERÇANT — CDC V1.1 (Commerçant > Points).
 *
 * ⚠️ MIROIR de `src/features/loyalty/` dans l'app (`lib/tiers.ts`, écran des paliers). Mêmes règles :
 *  - jusqu'à QUATRE paliers : un seuil en points et une récompense ;
 *  - les seuils croissent strictement (un palier coûte plus que le précédent) ;
 *  - l'UNITÉ de calcul (euros dépensés ou nombre d'achats) se choisit à la création du programme et
 *    N'EST PLUS MODIFIABLE une fois en ligne : changer l'unité d'un programme où des clients ont déjà
 *    des points rendrait leur solde incompréhensible.
 *
 * Les points sont propres à CE commerçant et circulent hors de Stripe : la fidélité n'affecte ni la
 * commission ni le reversement (CDC, circuit de l'argent). Seule une RÉCOMPENSE débloquée est
 * partageable ; les points bruts ne le sont jamais.
 */
export const MAX_TIERS = 4;

export const UNITS = [
  { id: 'euros', title: 'Euros dépensés', rule: '1 € dépensé = 1 point' },
  { id: 'achats', title: 'Nombre d’achats', rule: '1 achat = 1 point' },
];

/** Valeurs de départ d'une démonstration — le commerçant les réécrit. */
const START = [
  { cost: '20', reward: '' },
  { cost: '60', reward: '' },
  { cost: '150', reward: '' },
  { cost: '200', reward: '' },
];

/**
 * Valide les paliers : renvoie une erreur PAR LIGNE (un message global obligerait à deviner laquelle
 * des quatre corriger). Pure, donc testable.
 */
export function validateTiers(drafts) {
  const errors = [];
  let previous = 0;
  drafts.forEach((d, i) => {
    const cost = Number.parseInt(d.cost, 10);
    if (!/^\d+$/.test(String(d.cost).trim()) || !Number.isFinite(cost) || cost <= 0) {
      errors[i] = 'Indiquez un nombre de points';
    } else if (cost <= previous) {
      errors[i] = 'Doit être supérieur au palier précédent';
    } else if (!String(d.reward).trim()) {
      errors[i] = 'Indiquez l’avantage obtenu';
    }
    if (Number.isFinite(cost) && cost > previous) previous = cost;
  });
  return errors;
}

export default function LoyaltyPanel({ notify }) {
  const [unit, setUnit] = useState('euros');
  const [live, setLive] = useState(false);
  const [drafts, setDrafts] = useState(START);
  const [errors, setErrors] = useState([]);

  const set = (index, key) => (event) => {
    const value = event.target.value;
    setDrafts((list) => list.map((d, i) => (i === index ? { ...d, [key]: value } : d)));
    setErrors((list) => list.map((e, i) => (i === index ? undefined : e)));
  };

  const save = (event) => {
    event.preventDefault();
    const found = validateTiers(drafts);
    if (found.some(Boolean)) {
      setErrors(found);
      notify('Corrigez les paliers signalés.');
      return;
    }
    setErrors([]);
    setLive(true);
    notify('Programme enregistré — vos clients verront ce barème à leur prochaine visite.');
  };

  return (
    <>
      <div className="tkpro-head">
        <div>
          <h1>Fidélité</h1>
          <p>
            Vos clients cumulent des points chez vous, et chez vous seulement, puis débloquent des
            avantages par paliers.
          </p>
        </div>
        <span className={live ? 'tkpro-tag ticket' : 'tkpro-tag online'}>
          {live ? 'En ligne' : 'Pas encore en ligne'}
        </span>
      </div>

      <form onSubmit={save} noValidate data-testid="loyalty-form">
        <section className="tkpro-card" style={{ marginBottom: 18 }}>
          <div className="tkpro-card-head">
            <h2>Unité de calcul</h2>
          </div>
          <div className="tkpro-units" role="radiogroup" aria-label="Unité de calcul des points">
            {UNITS.map((u) => (
              <button
                key={u.id}
                type="button"
                role="radio"
                aria-checked={unit === u.id}
                disabled={live && unit !== u.id}
                className={unit === u.id ? 'tkpro-chip on' : 'tkpro-chip'}
                onClick={() => setUnit(u.id)}
                data-testid={`loyalty-unit-${u.id}`}
              >
                <b>{u.title}</b>
                <span>{u.rule}</span>
              </button>
            ))}
          </div>
          <p className="tkpro-note" style={{ margin: '0 18px 18px' }}>
            {live
              ? 'Le programme est en ligne : son unité ne peut plus être modifiée.'
              : 'Ce choix se fait une seule fois : une fois le programme en ligne, l’unité est figée.'}
          </p>
        </section>

        <section className="tkpro-card" style={{ marginBottom: 18 }}>
          <div className="tkpro-card-head">
            <h2>Paliers</h2>
            <span className="tkpro-note-inline">
              Jusqu’à {MAX_TIERS} paliers, de plus en plus exigeants
            </span>
          </div>
          <div className="tkpro-tiers">
            {drafts.map((d, i) => (
              <div className="tkpro-tier" key={i}>
                <b className="rank">
                  {i + 1}/{drafts.length}
                </b>
                <label className="tkpro-input">
                  <span>Seuil (en points)</span>
                  <input
                    inputMode="numeric"
                    value={d.cost}
                    onChange={set(i, 'cost')}
                    aria-invalid={errors[i] ? 'true' : undefined}
                    data-testid={`loyalty-cost-${i + 1}`}
                  />
                </label>
                <label className="tkpro-input">
                  <span>Récompense</span>
                  <input
                    value={d.reward}
                    maxLength={40}
                    onChange={set(i, 'reward')}
                    placeholder="Ex. Un café offert"
                    aria-invalid={errors[i] ? 'true' : undefined}
                    data-testid={`loyalty-reward-${i + 1}`}
                  />
                </label>
                {errors[i] ? (
                  <span className="tkpro-error" role="alert">
                    {errors[i]}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <div className="tkpro-profile-foot">
          <button type="submit" className="tkpro-btn primary" data-testid="loyalty-save">
            {live ? 'Enregistrer les paliers' : 'Enregistrer et mettre en ligne'}
          </button>
          <span className="tkpro-note-inline">
            Démonstration : rien n’est encore transmis à un serveur.
          </span>
        </div>
      </form>

      <p className="tkpro-note">
        Les points ne sont ni convertibles, ni remboursables, ni revendables. Seule une récompense
        débloquée peut être partagée entre comptes — jamais les points eux-mêmes.
      </p>
    </>
  );
}
