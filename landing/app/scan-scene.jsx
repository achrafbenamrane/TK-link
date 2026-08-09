/**
 * La scène « on passe la carte sur le lecteur ».
 *
 * C'est le geste du produit : sans lui, TK LINK reste une idée abstraite. La
 * carte s'approche, touche le lecteur, les ondes partent, et le ticket sort —
 * en numérique.
 *
 * Tout est en CSS 3D + SVG : aucune dépendance, rien à télécharger, net sur
 * écran Retina, et l'animation tourne sur le compositeur (transform/opacity)
 * donc sans à-coups. L'ensemble se fige proprement si l'utilisateur a demandé
 * moins d'animations (voir `prefers-reduced-motion` dans globals.css).
 *
 * Composant serveur : il n'a aucun état, l'animation étant entièrement décrite
 * en CSS.
 */

/**
 * Le sigle : « TK » en noir, les ondes du sans-contact en vert, « LINK » en
 * dessous. Sur l'appareil il est posé en bas à gauche, l'arbre occupant la
 * droite — les deux sont donc dessinés séparément.
 */
function TkMark({ width = 96, tone = '#14170f', wave = '#6ea82f' }) {
  return (
    <svg
      width={width}
      viewBox="0 0 148 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <text
        x="0"
        y="54"
        fontFamily="Unbounded, sans-serif"
        fontWeight="800"
        fontSize="54"
        letterSpacing="-3"
        fill={tone}
      >
        TK
      </text>

      {/* Les trois ondes, après le K */}
      <g stroke={wave} strokeWidth="7" strokeLinecap="round" fill="none">
        <path d="M92 24a24 24 0 0 1 0 26" />
        <path d="M104 15a40 40 0 0 1 0 44" opacity="0.75" />
        <path d="M116 6a56 56 0 0 1 0 62" opacity="0.45" />
      </g>

      <text
        x="3"
        y="84"
        fontFamily="Manrope, sans-serif"
        fontWeight="500"
        fontSize="21"
        letterSpacing="9"
        fill={tone}
      >
        LINK
      </text>
    </svg>
  );
}

/**
 * L'arbre imprimé sur la droite du boîtier, relié au sigle par un trait
 * façon signal — c'est ce qui figure sur l'appareil réel.
 */
function TkTree({ width = 84, leaf = '#6ea82f' }) {
  return (
    <svg
      width={width}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Le trait de signal qui arrive de la gauche */}
      <path
        d="M0 96h22l7-11 6 20 7-24 6 15h10"
        stroke={leaf}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      {/* Tronc et branches */}
      <path
        d="M66 100V52M66 66l-13-13M66 74l13-13M66 58l-8-9M66 62l9-10"
        stroke={leaf}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Feuillage — des touches plutôt qu'une masse pleine */}
      <g fill={leaf}>
        <ellipse cx="66" cy="30" rx="15" ry="12" opacity="0.9" />
        <ellipse cx="48" cy="44" rx="12" ry="9" opacity="0.75" />
        <ellipse cx="85" cy="44" rx="12" ry="9" opacity="0.75" />
        <ellipse cx="56" cy="20" rx="9" ry="7" opacity="0.6" />
        <ellipse cx="78" cy="19" rx="9" ry="7" opacity="0.6" />
        <ellipse cx="38" cy="33" rx="6" ry="5" opacity="0.45" />
        <ellipse cx="95" cy="32" rx="6" ry="5" opacity="0.45" />
      </g>
    </svg>
  );
}

/**
 * Tranches d'extrusion du boîtier — 0 = le dessus.
 * Les six premières forment la coque blanche, la septième la ligne de joint,
 * les suivantes le socle gris, comme sur l'appareil.
 */
const EDGE_SLICES = Array.from({ length: 14 }, (_, i) => i);

export default function ScanScene() {
  return (
    <div
      className="scene"
      role="img"
      aria-label="Une carte TK LINK est présentée au lecteur : le ticket arrive dans l’application."
    >
      <div className="scene-stage">
        {/* ------------------------------------------------------- lecteur */}
        <div className="reader">
          {/*
           * Épaisseur du boîtier : on empile des tranches en profondeur plutôt
           * que de poser une seule face. C'est ce qui donne un vrai volume —
           * les deux premières sont légèrement rentrées pour former le chanfrein
           * du dessus, comme sur l'appareil réel.
           */}
          {EDGE_SLICES.map((i) => (
            <span key={i} className="reader-slice" style={{ '--i': i }} />
          ))}

          <div className="reader-face">
            <span className="reader-sheen" />
            {/* Sigle en bas à gauche, arbre à droite — comme sur l'appareil */}
            <span className="reader-mark">
              <TkMark width={98} />
            </span>
            <span className="reader-tree">
              <TkTree width={86} />
            </span>
            {/* Témoin lumineux : vert au repos, citron au passage de la carte */}
            <span className="reader-led" />
          </div>

          {/* La face avant : le socle gris et son port USB-C */}
          <div className="reader-front">
            <span className="reader-port" />
          </div>

          {/* Ombre portée sur le comptoir */}
          <span className="reader-cast" />

          {/* Ondes émises au moment du passage */}
          <span className="ping ping-1" />
          <span className="ping ping-2" />
          <span className="ping ping-3" />
        </div>

        {/* --------------------------------------------------------- carte */}
        <div className="tkcard">
          <div className="tkcard-face">
            <TkMark width={78} />
            <div className="tkcard-no">7014 2299</div>
          </div>
        </div>

        {/* ---------------------------------------- le ticket dématérialisé */}
        <div className="eticket">
          <div className="eticket-bar" />
          <div className="eticket-bar short" />
          <div className="eticket-bar" />
          <div className="eticket-bar short" />
          <div className="eticket-check">✓</div>
        </div>
      </div>

      <p className="scene-caption">
        <span className="dot" /> Ticket reçu — zéro papier
      </p>
    </div>
  );
}
