'use client';

import { useEffect, useState } from 'react';

/**
 * L'offre du héros, sous l'étiquette : ce que la conduite de projet voulait voir « du premier coup
 * d'œil » (18/08/2026) — la grosse remise ET le temps court. La remise est sur l'étiquette 3D ; le
 * temps, ici, et il tourne vraiment : c'est le seul argument de la vente flash, une image fixe ne
 * peut pas le porter. Les valeurs sont celles du catalogue de l'app (`d_viennoiseries`).
 */
const OFFRE = {
  photo: '/offre/d_viennoiseries.jpg',
  commerce: 'Boulangerie Saint-Cyprien',
  distance: 'à 600 m',
  titre: 'Panier viennoiseries',
  unite: 'le panier de 6',
  prix: '4,50 €',
  prixInitial: '11,00 €',
  restant: 4,
  total: 15,
};

/** Durée affichée, en secondes. Elle reboucle : une vitrine qui affiche 00:00 annonce une offre
 * expirée à quiconque arrive trop tard. */
const DEPART = 15 * 60 - 8;

const two = (n) => String(n).padStart(2, '0');

export default function LiveOffer() {
  const [left, setLeft] = useState(DEPART);
  const [photoKo, setPhotoKo] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setLeft((v) => (v <= 1 ? DEPART : v - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const parts = [
    [two(Math.floor(left / 3600)), 'h'],
    [two(Math.floor((left % 3600) / 60)), 'min'],
    [two(left % 60), 's'],
  ];
  const gone = Math.round(((OFFRE.total - OFFRE.restant) / OFFRE.total) * 100);

  return (
    <article className="v-offer" aria-label="Exemple d’offre tiré de l’application">
      <p className="v-offer__label">
        <span className="v-offer__live" aria-hidden="true" />
        Exemple tiré de l’application
      </p>
      <div className="v-offer__photo">
        {photoKo ? null : (
          <img
            src={OFFRE.photo}
            alt={`${OFFRE.titre}, ${OFFRE.commerce}`}
            width="160"
            height="160"
            loading="lazy"
            onError={() => setPhotoKo(true)}
          />
        )}
      </div>
      <div className="v-offer__what">
        <p className="v-offer__shop">
          {OFFRE.commerce} · {OFFRE.distance}
        </p>
        <p className="v-offer__title">{OFFRE.titre}</p>
        <p className="v-offer__unit">{OFFRE.unite}</p>
      </div>
      <p className="v-offer__price">
        <strong>{OFFRE.prix}</strong>
        <s>
          <span className="v-sr">au lieu de </span>
          {OFFRE.prixInitial}
        </s>
      </p>
      <div className="v-offer__time" role="timer" aria-live="off" aria-label="Temps restant">
        {parts.map(([value, unit], i) => (
          <span className="v-offer__cell" key={unit}>
            <b>{value}</b>
            <small>{unit}</small>
            {i < 2 ? <i aria-hidden="true">:</i> : null}
          </span>
        ))}
      </div>
      <div className="v-offer__stock">
        <p>
          Plus que <strong>{OFFRE.restant}</strong> sur {OFFRE.total}
        </p>
        <span className="v-offer__gauge" aria-hidden="true">
          <span style={{ width: `${gone}%` }} />
        </span>
      </div>
    </article>
  );
}
