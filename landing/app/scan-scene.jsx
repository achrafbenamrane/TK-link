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

/** Le sigle TK LINK : les lettres, les ondes du sans-contact, et l'arbre. */
function TkMark({ width = 96, tone = '#123a22', leaf = '#7fbf3f' }) {
  return (
    <svg
      width={width}
      viewBox="0 0 200 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* TK */}
      <text
        x="0"
        y="52"
        fontFamily="Unbounded, sans-serif"
        fontWeight="800"
        fontSize="52"
        letterSpacing="-2"
        fill={tone}
      >
        TK
      </text>

      {/* Les trois ondes du sans-contact, après le K */}
      <g stroke={tone} strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M92 22a26 26 0 0 1 0 30" opacity="0.95" />
        <path d="M104 14a40 40 0 0 1 0 46" opacity="0.6" />
        <path d="M116 6a54 54 0 0 1 0 62" opacity="0.3" />
      </g>

      {/* LINK */}
      <text
        x="2"
        y="82"
        fontFamily="Manrope, sans-serif"
        fontWeight="500"
        fontSize="22"
        letterSpacing="7"
        fill={tone}
      >
        LINK
      </text>

      {/* L'arbre — le symbole écologique de la marque */}
      <g transform="translate(150 14)">
        <path
          d="M20 44V26M20 30l-9-8M20 34l9-8"
          stroke={leaf}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="20" cy="14" r="11" fill={leaf} opacity="0.85" />
        <circle cx="9" cy="21" r="7" fill={leaf} opacity="0.65" />
        <circle cx="31" cy="21" r="7" fill={leaf} opacity="0.65" />
      </g>
    </svg>
  );
}

/** Tranches d'extrusion du boîtier — 0 = le dessus, 11 = le dessous. */
const EDGE_SLICES = Array.from({ length: 12 }, (_, i) => i);

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
            {/* La zone de contact, légèrement creusée */}
            <span className="reader-zone" />
            <span className="reader-mark">
              <TkMark width={104} />
            </span>
            {/* Témoin lumineux : vert au repos, citron au passage de la carte */}
            <span className="reader-led" />
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
