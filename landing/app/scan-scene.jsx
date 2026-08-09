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
 * Le lecteur, dessiné en un seul SVG.
 *
 * Première tentative : un empilement de « tranches » en CSS 3D. Résultat, des
 * bandes visibles sur la tranche et un socle qui se décrochait du corps. La
 * 3D CSS ne sait pas arrondir un volume.
 *
 * Ici, la géométrie est peinte : le dessus est un trapèze (la perspective
 * réduit l'arête arrière), le corps descend sous l'arête avant. Ce sont les
 * DÉGRADÉS qui font le volume — c'est la technique des visuels produit, et
 * elle donne une matière que la 3D CSS n'atteint pas.
 */
function Reader() {
  // Sommets du dessus : arrière resserré, avant élargi.
  const TOP =
    'M132,72 L308,72 Q328,72 336.2,90.2 L373.8,173.8 Q382,192 362,192 ' +
    'L78,192 Q58,192 66.2,173.8 L103.8,90.2 Q112,72 132,72 Z';
  // Silhouette complète : le dessus, prolongé de 34 px sous l'arête avant.
  const BODY =
    'M132,72 L308,72 Q328,72 336.2,90.2 L373.8,173.8 Q382,192 382,206 ' +
    'L382,210 Q382,226 366,226 L74,226 Q58,226 58,210 L58,206 ' +
    'Q58,192 66.2,173.8 L103.8,90.2 Q112,72 132,72 Z';

  return (
    <svg viewBox="0 0 440 300" className="reader-svg" aria-hidden="true">
      <defs>
        {/* Coque : lumière rasante venue du haut-gauche. */}
        <linearGradient id="tkTop" x1="0.1" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#f8faf5" />
          <stop offset="1" stopColor="#e4e8dd" />
        </linearGradient>
        {/* Socle : plus sombre en descendant, avec un rebond de lumière en bas. */}
        <linearGradient id="tkBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9ece2" />
          <stop offset="0.42" stopColor="#c2c8b9" />
          <stop offset="0.86" stopColor="#98a08e" />
          <stop offset="1" stopColor="#aab19f" />
        </linearGradient>
        {/* Reflet doux sur le dessus. */}
        <linearGradient id="tkGloss" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tkPort" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#15180f" />
          <stop offset="1" stopColor="#3b4034" />
        </linearGradient>
        {/* Ombre au sol. */}
        <radialGradient id="tkShadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#04180b" stopOpacity="0.5" />
          <stop offset="0.6" stopColor="#04180b" stopOpacity="0.22" />
          <stop offset="1" stopColor="#04180b" stopOpacity="0" />
        </radialGradient>
        {/* Occlusion : le contact assombrit le sol juste sous l'appareil. */}
        <filter id="tkBlur" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <clipPath id="tkTopClip">
          <path d={TOP} />
        </clipPath>
      </defs>

      {/* Ombre portée */}
      <ellipse cx="222" cy="236" rx="185" ry="34" fill="url(#tkShadow)" />
      <ellipse
        cx="222"
        cy="228"
        rx="150"
        ry="15"
        fill="#04180b"
        opacity="0.3"
        filter="url(#tkBlur)"
      />

      {/* Corps */}
      <path d={BODY} fill="url(#tkBody)" />
      {/* Arête vive entre le socle et la coque */}
      <path
        d="M66.2,173.8 Q58,192 58,206 L58,210 Q58,226 74,226 L366,226 Q382,226 382,210 L382,206 Q382,192 373.8,173.8"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.28"
        strokeWidth="1.2"
      />

      {/* Port USB-C, centré sur la face avant */}
      <rect x="200" y="203" width="44" height="13" rx="6.5" fill="url(#tkPort)" />
      <rect x="200" y="203" width="44" height="2" rx="1" fill="#ffffff" opacity="0.22" />

      {/* Dessus */}
      <path d={TOP} fill="url(#tkTop)" />
      {/* Liseré clair sur l'arête haute : ce qui « allume » le bord */}
      <path
        d="M132,72 L308,72 Q328,72 336.2,90.2"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeOpacity="0.9"
      />

      <g clipPath="url(#tkTopClip)">
        {/* Reflet en écharpe */}
        <path d="M40,60 L240,60 L120,210 L-10,210 Z" fill="url(#tkGloss)" />
        {/* Sigle et arbre, aplatis pour suivre le plan du dessus */}
        <g transform="translate(96,120) scale(1,0.66)">
          <TkMark width={126} />
        </g>
        <g transform="translate(258,74) scale(1,0.66)">
          <TkTree width={104} />
        </g>
      </g>

      {/* Témoin lumineux */}
      <circle className="reader-led-dot" cx="102" cy="112" r="5" />
    </svg>
  );
}

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
          <Reader />
          {/* Ondes émises au moment du passage, au-dessus du dessus */}
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
