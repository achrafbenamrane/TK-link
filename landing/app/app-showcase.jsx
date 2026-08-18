'use client';

import { useEffect, useState } from 'react';

/**
 * L'ILLUSTRATION DU HÉROS : une offre flash, en grand, dans un téléphone.
 *
 * Version précédente : un carrousel de six captures d'écran. Retour de la
 * conduite de projet le 18/08 — « mets plutôt un téléphone avec une offre flash
 * en gros, faut mettre l'accent sur les grosses promotions et le temps court,
 * du premier coup d'œil ». Elle a raison sur le fond : une capture d'app
 * entière réduite à la taille d'un téléphone de héros n'est lisible par
 * personne. On y devine une interface, on n'y lit ni le prix ni la remise.
 *
 * D'où une offre DESSINÉE, pas photographiée. Trois avantages qu'une capture
 * n'a pas : la remise et le compte à rebours restent lisibles à toute taille,
 * le décompte tourne vraiment — c'est le seul argument de la vente flash, et
 * une image fixe ne peut pas le porter — et l'ensemble reste net sur un écran
 * à haute densité.
 *
 * Le châssis reste dessiné en CSS : net à tout agrandissement, adaptable, zéro
 * octet à télécharger.
 */

/** L'offre montrée. Les vraies valeurs du catalogue (`d_viennoiseries`). */
const OFFRE = {
  photo: '/offre/d_viennoiseries.jpg',
  commerce: 'Boulangerie Saint-Cyprien',
  titre: 'Panier viennoiseries',
  unite: 'le panier de 6',
  prix: '4,50 €',
  prixInitial: '11,00 €',
  remise: '-59 %',
  restant: 4,
  total: 15,
  distance: 'à 600 m',
};

/** Durée du compte à rebours affiché, en secondes. */
const DEPART = 15 * 60;

function deuxChiffres(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

export default function AppShowcase() {
  const [reste, setReste] = useState(DEPART);
  const [photoKo, setPhotoKo] = useState(false);

  useEffect(() => {
    // Il reboucle plutôt que d'atteindre zéro : une vitrine qui affiche
    // « 00:00:00 » annonce une offre expirée à tout visiteur arrivé trop tard.
    const id = setInterval(() => setReste((v) => (v <= 1 ? DEPART : v - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const h = deuxChiffres(Math.floor(reste / 3600));
  const m = deuxChiffres(Math.floor((reste % 3600) / 60));
  const s = deuxChiffres(reste % 60);
  const partis = Math.round(((OFFRE.total - OFFRE.restant) / OFFRE.total) * 100);

  return (
    <div className="showcase">
      {/* Le châssis reste celui qui existait : dessiné en CSS, net à tout
          agrandissement, dimensionné par la hauteur pour ne pas étirer
          l'accroche. Seul son CONTENU change. */}
      <div className="iphone">
        <div className="iphone-rail" />
        <div className="iphone-screen">
          <div className="offre">
            <div className="offre-photo">
              {photoKo ? (
                <div className="offre-photo-repli" aria-hidden="true">
                  🥐
                </div>
              ) : (
                // Une balise <img> nue plutôt que next/image : la photo est
                // décorative, servie depuis /public, et n'a pas besoin de la
                // chaîne d'optimisation. La règle Next qui l'interdit n'est pas
                // chargée par la configuration ESLint de ce dépôt.
                <img
                  src={OFFRE.photo}
                  alt={`${OFFRE.titre} — ${OFFRE.commerce}`}
                  onError={() => setPhotoKo(true)}
                />
              )}
              <span className="offre-remise">{OFFRE.remise}</span>
              <span className="offre-stock">
                {OFFRE.restant} / {OFFRE.total}
              </span>
            </div>

            {/* LE TEMPS QUI RESTE — l'élément le plus gros après la photo, avec
                ses unités écrites dessous. Sans elles, « 00:14:52 » se lit
                aussi bien quinze minutes que quinze heures, et l'urgence se
                perd exactement là où elle doit porter. */}
            <div className="offre-chrono" role="timer" aria-live="off">
              {[
                [h, 'H'],
                [m, 'MIN'],
                [s, 'SEC'],
              ].map(([valeur, unite], i) => (
                <div className="chrono-bloc" key={unite}>
                  <div className="chrono-paire">
                    <span className="chrono-valeur">{valeur}</span>
                    <span className="chrono-unite">{unite}</span>
                  </div>
                  {i < 2 ? <span className="chrono-sep">:</span> : null}
                </div>
              ))}
            </div>

            <div className="offre-corps">
              <p className="offre-commerce">
                {OFFRE.commerce} · {OFFRE.distance}
              </p>
              <h3 className="offre-titre">{OFFRE.titre}</h3>
              <p className="offre-unite">{OFFRE.unite}</p>

              <div className="offre-prix">
                <span className="prix-flash">{OFFRE.prix}</span>
                <span className="prix-initial">{OFFRE.prixInitial}</span>
              </div>

              <div className="offre-jauge" aria-hidden="true">
                <span style={{ width: `${partis}%` }} />
              </div>
              <p className="offre-restant">Plus que {OFFRE.restant} paniers</p>

              <div className="offre-cta">J’EN PROFITE</div>
            </div>
          </div>
        </div>
      </div>

      <p className="showcase-legende">
        Une vraie offre de l’application : un prix cassé, un stock qui fond, et un compte à rebours
        qui ne s’arrête pas.
      </p>
    </div>
  );
}
