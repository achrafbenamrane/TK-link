'use client';

import { useEffect, useState } from 'react';

/**
 * L'APPLICATION, dans un vrai téléphone.
 *
 * Une capture posée à plat se regarde comme une image ; la même capture dans un
 * appareil se regarde comme un produit. D'où ce châssis dessiné en CSS plutôt
 * qu'une image de cadre : il reste net à tout agrandissement, s'adapte à la
 * largeur, et pèse zéro octet.
 *
 * Les écrans défilent seuls. Le défilement automatique n'est pas décoratif :
 * personne ne clique sur une flèche pour découvrir un produit qu'il ne connaît
 * pas encore. Chaque écran porte sa légende — sans elle, on voit une jolie
 * interface sans comprendre ce qu'elle fait.
 */

const SCREENS = [
  {
    src: '/screens/accueil.jpg',
    title: 'Ça part maintenant',
    line: 'Les ventes flash près de chez vous, triées selon ce qui vous intéresse.',
  },
  {
    src: '/screens/chasse.jpg',
    title: 'La Chasse',
    line: 'Coffre du jour, missions, trophées : de quoi revenir sans y être poussé.',
  },
  {
    src: '/screens/favoris.jpg',
    title: 'Vos coups de cœur',
    line: 'Gardés à l’œil, avec leur compte à rebours — avant qu’ils ne s’envolent.',
  },
  {
    src: '/screens/panier.jpg',
    title: 'Touch & Collect',
    line: 'Retrait en boutique ou livraison, coupons appliqués, points crédités.',
  },
  {
    src: '/screens/commande.jpg',
    title: 'Votre commande, suivie',
    line: 'Du paiement au retrait, avec la facture en QR code à présenter.',
  },
  {
    src: '/screens/profil.jpg',
    title: 'Vos points',
    line: 'Échangeables contre des bons d’achat — ou un arbre planté.',
  },
];

/** Durée d'affichage d'un écran. Assez long pour lire la légende, pas plus. */
const DWELL = 3400;

export default function AppShowcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  /**
   * Les captures qui n'ont pas pu être chargées.
   *
   * Tant qu'elles ne sont pas déposées, un `<img>` cassé afficherait l'icône
   * grise du navigateur au milieu du téléphone — pire que rien. On montre à la
   * place un panneau aux couleurs de la marque, portant le nom de l'écran :
   * la démonstration reste lisible, et l'absence se voit sans faire accident.
   */
  const [missing, setMissing] = useState(() => new Set());

  useEffect(() => {
    if (paused) return undefined;
    // Le défilement s'arrête si l'utilisateur a demandé moins d'animations :
    // un carrousel qui tourne malgré la préférence système est une nuisance,
    // pas un effet.
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;

    const id = setInterval(() => setIndex((i) => (i + 1) % SCREENS.length), DWELL);
    return () => clearInterval(id);
  }, [paused]);

  const current = SCREENS[index];

  return (
    <div className="showcase">
      <div
        className="iphone"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Le châssis : rail de titane, puis la dalle. */}
        <div className="iphone-rail" aria-hidden="true" />
        <span className="iphone-btn iphone-action" aria-hidden="true" />
        <span className="iphone-btn iphone-vol-up" aria-hidden="true" />
        <span className="iphone-btn iphone-vol-down" aria-hidden="true" />
        <span className="iphone-btn iphone-power" aria-hidden="true" />

        <div className="iphone-screen">
          {SCREENS.map((s, i) =>
            missing.has(s.src) ? (
              <div
                key={s.src}
                className={
                  i === index ? 'iphone-shot iphone-hold is-on' : 'iphone-shot iphone-hold'
                }
                aria-hidden="true"
              >
                <span>{s.title}</span>
              </div>
            ) : (
              <img
                key={s.src}
                src={s.src}
                alt={i === index ? `${s.title} — ${s.line}` : ''}
                className={i === index ? 'iphone-shot is-on' : 'iphone-shot'}
                aria-hidden={i === index ? undefined : 'true'}
                loading={i === 0 ? 'eager' : 'lazy'}
                draggable="false"
                onError={() =>
                  setMissing((current) => {
                    const next = new Set(current);
                    next.add(s.src);
                    return next;
                  })
                }
              />
            ),
          )}

          {/* L'îlot dynamique, par-dessus la capture : les captures Android
              n'en ont pas, et c'est lui qui fait lire « iPhone ». */}
          <span className="iphone-island" aria-hidden="true" />
          {/* Un reflet oblique, très faible. Sans lui la dalle paraît peinte. */}
          <span className="iphone-gloss" aria-hidden="true" />
        </div>
      </div>

      <div className="showcase-caption">
        <p className="showcase-title" key={current.title}>
          {current.title}
        </p>
        <p className="showcase-line">{current.line}</p>

        <div className="showcase-dots" role="tablist" aria-label="Écrans de l’application">
          {SCREENS.map((s, i) => (
            <button
              key={s.src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={s.title}
              className={i === index ? 'is-on' : undefined}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
