/**
 * La scène d'accroche : une vente flash qui expire sous les yeux.
 *
 * Elle remplace la scène « passage de carte sur le lecteur ». Ce matériel ne
 * sera pas réalisé, et la page entière racontait donc une promesse qui
 * n'existera pas — arbitrage de la conduite de projet du 13/08/2026 : « tu as
 * axé le message sur son système de carte TK LINK qu'on va même pas réaliser ;
 * ça doit s'adresser aux clients en priorité ».
 *
 * Ce qu'il faut montrer à la place tient en une phrase de la même personne :
 * « des offres flash, des promotions importantes avec des dates courtes ».
 * D'où cette carte — la vraie, celle de l'application : le compte à rebours en
 * haut, la remise en gros, le stock qui fond, le prix barré à côté du prix
 * rouge. Quelqu'un qui la regarde trois secondes a compris le produit.
 *
 * Tout est en CSS : rien à télécharger, net sur écran Retina, et l'animation
 * tourne sur le compositeur. Elle se fige si l'on a demandé moins d'animations.
 */
export default function FlashScene() {
  return (
    <div
      className="flash-scene"
      role="img"
      aria-label="Une vente flash dans l’application : côte de bœuf à 24,90 € au lieu de 34,90 €, il reste 4 pièces et 12 minutes."
    >
      <div className="fs-phone">
        <div className="fs-head">
          <span className="fs-brand">TK LINK</span>
          <span className="fs-live">
            <i /> 12 ventes flash près de vous
          </span>
        </div>

        {/* La carte principale — celle de l'app, au détail près. */}
        <article className="fs-card">
          <div className="fs-visual">
            <span className="fs-timer">
              <i className="fs-clock" />
              <b className="fs-count">11:58</b>
            </span>
            <span className="fs-off">−29%</span>
            <span className="fs-stock">4 restants</span>
          </div>

          <div className="fs-body">
            <span className="fs-merchant">Maison Hammamet · Empalot</span>
            <h3 className="fs-title">Côte de bœuf maturée</h3>
            <div className="fs-bar">
              <i style={{ width: '18%' }} />
            </div>
            <div className="fs-prices">
              <b className="fs-now">24,90 €</b>
              <s className="fs-was">34,90 €</s>
              <span className="fs-grab">Attraper</span>
            </div>
          </div>
        </article>

        {/* Une seconde carte qui dépasse : il y en a d'autres, tout de suite. */}
        <article className="fs-card fs-card-peek">
          <div className="fs-visual fs-visual-alt">
            <span className="fs-timer fs-timer-hot">
              <i className="fs-clock" />
              <b>04:17</b>
            </span>
            <span className="fs-off">−57%</span>
          </div>
          <div className="fs-body">
            <span className="fs-merchant">Cinéma Le Lumière · Jean Jaurès</span>
            <h3 className="fs-title">Séance de 22 h 30</h3>
            <div className="fs-prices">
              <b className="fs-now">4,90 €</b>
              <s className="fs-was">11,50 €</s>
            </div>
          </div>
        </article>
      </div>

      <p className="scene-caption">
        <span className="dot" /> Ça part maintenant — ou ça ne part plus
      </p>
    </div>
  );
}
