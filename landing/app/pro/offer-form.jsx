'use client';

import { useMemo, useState } from 'react';

import {
  CATEGORIES,
  COMMISSION_PCT,
  DURATIONS,
  commissionCents,
  durationLabel,
  formatCents,
  netCents,
  parseEurosToCents,
  validateDraft,
} from './billing';

const EMPTY = {
  title: '',
  category: 'restauration',
  oldPrice: '',
  price: '',
  stock: '',
  duration: 60,
  description: '',
};

/**
 * PUBLIER UNE VENTE FLASH — CDC §9, version web.
 *
 * Le formulaire ne demande QUE ce que la fiche client affiche (CDC §8). Il
 * montre en direct ce que la vente rapportera commission déduite : découvrir
 * les 5 % du §21 sur le relevé du mois suivant est la meilleure façon de perdre
 * un commerçant.
 *
 * Mêmes règles que l'app mobile, au centime près — voir `billing.js`.
 */
export default function OfferForm({ onPublish, onCancel }) {
  const [draft, setDraft] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const set = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    // L'erreur part dès qu'on retouche le champ : la laisser affichée pendant
    // la correction donne l'impression que la saisie ne sert à rien.
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const potential = useMemo(() => {
    const cents = parseEurosToCents(draft.price) ?? 0;
    const qty = Number.parseInt(draft.stock, 10) || 0;
    return cents * qty;
  }, [draft.price, draft.stock]);

  const submit = (event) => {
    event.preventDefault();
    const result = validateDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onPublish({
      title: draft.title.trim(),
      category: draft.category,
      priceCents: result.priceCents,
      oldPriceCents: result.oldPriceCents,
      stock: result.stock,
      durationMinutes: draft.duration,
      description: draft.description.trim(),
    });
    setDraft(EMPTY);
  };

  return (
    <form className="tkpro-form" onSubmit={submit} noValidate>
      <div className="tkpro-form-grid">
        <label className="tkpro-input wide">
          <span>Ce que vous vendez</span>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Ex. Plateau de viennoiseries"
            maxLength={60}
            aria-invalid={Boolean(errors.title)}
          />
          {errors.title ? <em>{errors.title}</em> : null}
        </label>

        <label className="tkpro-input">
          <span>Prix initial (€)</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.oldPrice}
            onChange={(e) => set('oldPrice', e.target.value)}
            placeholder="34,90"
            aria-invalid={Boolean(errors.oldPrice)}
          />
          {errors.oldPrice ? <em>{errors.oldPrice}</em> : null}
        </label>

        <label className="tkpro-input">
          <span>Prix flash (€)</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.price}
            onChange={(e) => set('price', e.target.value)}
            placeholder="24,90"
            aria-invalid={Boolean(errors.price)}
          />
          {errors.price ? <em>{errors.price}</em> : null}
        </label>

        <label className="tkpro-input">
          <span>Quantité</span>
          <input
            type="text"
            inputMode="numeric"
            value={draft.stock}
            onChange={(e) => set('stock', e.target.value)}
            placeholder="8"
            aria-invalid={Boolean(errors.stock)}
          />
          {errors.stock ? <em>{errors.stock}</em> : null}
        </label>

        <label className="tkpro-input">
          <span>Catégorie</span>
          <select value={draft.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="tkpro-input wide">
          <span>Précision (facultatif)</span>
          <input
            type="text"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Ex. À retirer avant 19 h"
            maxLength={240}
          />
        </label>
      </div>

      <fieldset className="tkpro-durations">
        <legend>Durée de la vente</legend>
        {DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            className={draft.duration === m ? 'tkpro-chip on' : 'tkpro-chip'}
            aria-pressed={draft.duration === m}
            onClick={() => set('duration', m)}
          >
            {durationLabel(m)}
          </button>
        ))}
      </fieldset>

      {/* Ce que ça rapporte vraiment — CDC §21 */}
      <div className="tkpro-payout">
        <div>
          <b>Si tout part</b>
          <span>
            {formatCents(potential)} — commission {COMMISSION_PCT}&nbsp;% :{' '}
            {formatCents(commissionCents(potential))}
          </span>
        </div>
        <div className="net">
          <span>Vous touchez</span>
          <b>{formatCents(netCents(potential))}</b>
        </div>
      </div>

      <div className="tkpro-form-actions">
        <button type="submit" className="tkpro-btn primary">
          Publier la vente flash
        </button>
        <button type="button" className="tkpro-btn" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
