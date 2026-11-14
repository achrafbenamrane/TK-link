import './vitrine.css';

import LiveOffer from './_vitrine/live-offer';
import Motion from './_vitrine/motion';
import TagSpin from './_vitrine/tag-spin';

/**
 * Site vitrine TK LINK — refonte du 14/11/2026 : « l'étiquette, à l'heure de la fermeture ».
 *
 * L'objet signature est une vraie étiquette de prix en 3D (Blender, `landing/blender/etiquette.py`) :
 * rose fluo comme une étiquette de soldes — c'est aussi la couleur de la charte —, éclairée comme en
 * fin de journée, l'heure où les commerçants bradent ce qui doit partir. Elle pend dans le héros ;
 * dans « Comment ça marche », elle tourne sur sa ficelle au fil du défilement et finit par montrer
 * son dos : le QR du code de retrait, le geste réel au comptoir.
 *
 * Le message ne change pas (arbitrages de la conduite de projet, 13 et 18/08/2026) : des prix
 * imbattables, pour un temps limité — mot pour mot le premier écran de l'app —, et ce qu'on y gagne
 * se voit du premier coup d'œil : la remise sur l'étiquette, le compte à rebours qui tourne juste
 * dessous. Les chiffres du papier sont ceux du client. Les catégories sont celles de l'app
 * (`src/shared/lib/categories.ts`).
 *
 * Typographie : Manrope (celle de l'app) pour le texte ; Big Shoulders Display, une grotesque
 * étroite d'affiche, pour les titres et les prix — l'ardoise du marché, pas un gabarit.
 */

const CATEGORIES = [
  'Restauration & Alimentation',
  'High-Tech & Électronique',
  'Maison & Décoration',
  'Mode & Accessoires',
  'Beauté & Bien-être',
  'Sport & Loisirs',
  'Auto & Mobilité',
  'Services & Expériences',
];

const STEPS = [
  {
    title: 'Dites ce qui vous intéresse',
    text: 'Restauration, high-tech, mode, beauté, sport… On ne vous montrera pas les promotions d’une boucherie si vous êtes venu pour du matériel informatique.',
  },
  {
    title: 'Attrapez avant que ça parte',
    text: 'Chaque offre affiche son compte à rebours et ce qu’il en reste. Un geste pour la réserver — le stock se met à jour pour tout le monde en même temps.',
  },
  {
    title: 'Récupérez ou faites livrer',
    text: 'Vous passez au comptoir, ou on vous l’apporte. Au comptoir, votre code de retrait suffit ; le ticket arrive dans l’application : plus de bout de papier froissé le jour de l’échange.',
  },
];

const AUDIENCES = [
  {
    name: 'Vous',
    claim: 'Payer moins, près de chez vous',
    text: 'Les invendus du jour, à l’heure où ils doivent partir. Ce que vous auriez acheté de toute façon, à moitié prix.',
    points: [
      'Des offres triées selon ce qui vous intéresse',
      'Un compte à rebours et un stock réels, jamais gonflés',
      'À récupérer sur place ou à faire livrer',
    ],
  },
  {
    name: 'Votre commerçant',
    claim: 'Vendre au lieu de jeter',
    text: 'Une vente flash se publie en deux minutes, depuis un ordinateur. Ce qui allait à la poubelle trouve preneur avant la fermeture.',
    points: [
      'Cinq opérations gratuites pour commencer',
      'Les clients du quartier prévenus immédiatement',
      'Commandes et factures suivies au même endroit',
    ],
  },
  {
    name: 'Le quartier',
    claim: 'Moins d’invendus, moins de papier',
    text: 'Chaque offre attrapée est un produit qui ne finit pas à la benne — et un ticket qui ne s’imprime pas.',
    points: [
      'Des commerces indépendants, pas des enseignes',
      'Des tickets numériques, gardés dans l’application',
      'Des points de fidélité chez chacun de vos commerçants',
    ],
  },
];

// Les chiffres du client (13/08/2026). `count` est la partie qui s'anime ; le reste est l'unité.
const STATS = [
  { count: 30, decimals: 0, unit: 'Md', label: 'de tickets de caisse imprimés' },
  { count: 150000, decimals: 0, unit: 't', label: 'de papier consommé' },
  { count: 1.8, decimals: 1, unit: 'M', label: 'd’arbres abattus' },
  { count: 75, decimals: 0, unit: 'Md L', label: 'd’eau utilisés' },
];

const INVOICE = [
  ['Référence', 'LCM-2026-1004'],
  ['Date', '07/08/2026'],
  ['Code fournisseur', 'F-0421'],
  ['Devise', 'EUR'],
  ['Montant HT', '31,58 €'],
  ['TVA', '6,32 €'],
];

/**
 * L'APK Android de TEST (build EAS « preview »), en téléchargement direct — en attendant Google Play.
 * `null` : pas de bouton, le pointillé « Bientôt sur Google Play » reste. À remplacer par le lien
 * du store le jour de la publication.
 */
const ANDROID_APK_URL =
  'https://expo.dev/artifacts/eas/ZbLftN9TbUn0bjpI3273DDgE5fLRUkhyw9IjVue7_sI.apk';

function formatStat(n, decimals) {
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function Arrow() {
  return (
    <svg className="v-arrow" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M4 10h11M11 5.5 15.5 10 11 14.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Page() {
  return (
    <div className="v">
      {/* Avant le premier affichage : sans cette ligne, le titre s'afficherait, disparaîtrait à
          l'hydratation, puis remonterait (un clignotement). */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.documentElement.classList.add(matchMedia('(prefers-reduced-motion: reduce)').matches?'v-still':'v-play')",
        }}
      />
      <Motion />

      {/* ─────────────────────────────────────────────────────────── en-tête */}
      <header className="v-head" id="hdr">
        <div className="v-wrap v-head__in">
          <a className="v-logo" href="#hero" aria-label="TK LINK, haut de page">
            TK<span>LINK</span>
          </a>
          <nav className="v-nav" aria-label="Navigation principale">
            <a href="#fonctionnement">Comment ça marche</a>
            <a href="#publics">Pour qui</a>
            <a href="#commercants">Commerçants</a>
          </nav>
          <a className="v-head__cta" href="#telecharger">
            Obtenir l’app
          </a>
        </div>
      </header>

      <main>
        {/* ─────────────────────────────────────────────────────────── héros */}
        <section className="v-hero" id="hero">
          <div className="v-hero__light" aria-hidden="true" />
          <div className="v-wrap v-hero__grid">
            <div className="v-hero__copy">
              <p className="v-kicker">
                <span className="v-kicker__dot" aria-hidden="true" />
                Toulouse · Les ventes flash de votre quartier
              </p>
              {/* Mot pour mot le premier écran de l'app (conduite de projet, 18/08). */}
              <h1 className="v-hero__title">
                <span className="v-line">
                  <span>Des prix</span>
                </span>
                <span className="v-line">
                  <span>imbattables,</span>
                </span>
                <span className="v-line v-pink">
                  <span>pour un temps</span>
                </span>
                <span className="v-line v-pink">
                  <span>limité.</span>
                </span>
              </h1>
              <p className="v-hero__lead">
                Les commerçants près de chez vous bradent ce qui doit partir aujourd’hui. Chaque
                offre a un compte à rebours et un stock qui fond. Vous la prenez, ou elle disparaît.
              </p>
              <div className="v-hero__cta">
                <a className="v-btn-tag" href="#telecharger">
                  Obtenir l’app <Arrow />
                </a>
                <a className="v-link" href="/pro">
                  Je suis commerçant <Arrow />
                </a>
              </div>
              <p className="v-hero__note">Gratuit · Sans engagement · À Toulouse d’abord</p>
            </div>

            <div className="v-hero__stage" aria-hidden="true">
              <div className="v-hero__swing" data-parallax>
                {/* Rendue dans Blender (landing/blender/etiquette.py) : 1000 × 1500, fond transparent. */}
                <img
                  className="v-hero__tag"
                  src="/3d/etiquette.webp"
                  width="1000"
                  height="1500"
                  alt=""
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
            </div>

            <div className="v-hero__offer">
              <LiveOffer />
            </div>
          </div>
        </section>

        {/* ──────────────────────────────────────────────────── les catégories */}
        <div className="v-band" aria-label="Les catégories de l’application">
          <ul className="v-sr">
            {CATEGORIES.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="v-band__track" aria-hidden="true">
            {[0, 1].map((copy) => (
              <div className="v-band__row" key={copy}>
                {CATEGORIES.map((c) => (
                  <span key={c}>
                    {c}
                    <i className="v-band__hole" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ──────────────────────────────────────────────── comment ça marche */}
        <section className="v-how" id="fonctionnement">
          <div className="v-wrap v-how__head rv">
            <p className="v-eyebrow">Comment ça marche</p>
            <h2 className="v-h2">Trois gestes, et c’est à vous.</h2>
            <p className="v-how__intro">
              Pas de carte à demander, pas de matériel à installer. Vous téléchargez, vous dites ce
              qui vous intéresse, et les bonnes affaires arrivent.
            </p>
          </div>
          <TagSpin steps={STEPS} />
        </section>

        {/* ─────────────────────────────────────────────────────────── pour qui */}
        <section className="v-who" id="publics">
          <div className="v-wrap">
            <div className="v-who__head rv">
              <p className="v-eyebrow">Pour qui</p>
              <h2 className="v-h2">D’abord pour vous. Ensuite pour votre quartier.</h2>
            </div>
            <div className="v-who__rows">
              {AUDIENCES.map((a, i) => (
                <article className="v-who__row rv" key={a.name}>
                  <p className="v-who__idx">{String(i + 1).padStart(2, '0')}</p>
                  <h3 className="v-who__name">{a.name}</h3>
                  <div className="v-who__body">
                    <p className="v-who__claim">{a.claim}</p>
                    <p className="v-who__text">{a.text}</p>
                    <ul className="v-who__points">
                      {a.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ───────────────────────────────────────────────────────── commerçants */}
        <section className="v-pro" id="commercants">
          <div className="v-wrap v-pro__grid">
            <div className="v-pro__copy rv">
              <p className="v-eyebrow">Vous êtes commerçant</p>
              <h2 className="v-h2">Vendez l’invendu. La paperasse suit toute seule.</h2>
              <p>
                Vous publiez une vente flash depuis votre navigateur : un prix, une quantité, une
                durée. Elle apparaît immédiatement chez les clients du quartier qui cherchent ce que
                vous vendez.
              </p>
              <p>
                Chaque vente honorée produit son ticket, puis sa facture certifiée, classée et prête
                pour votre comptable. Sans ressaisie, et sans un mètre de papier thermique.
              </p>
              <a className="v-btn-dark" href="/pro">
                Ouvrir l’espace professionnel <Arrow />
              </a>
            </div>

            <figure className="v-receipt rv" aria-label="Exemple de facture produite par une vente">
              <div className="v-receipt__paper">
                <p className="v-receipt__shop">Le Comptoir du Midi</p>
                <p className="v-receipt__kind">Facture · vente flash</p>
                <dl className="v-receipt__lines">
                  {INVOICE.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="v-receipt__total">
                  <span>Total TTC</span>
                  <strong>37,90 €</strong>
                </div>
                <span className="v-receipt__stamp" aria-hidden="true">
                  Certifiée
                </span>
                <p className="v-receipt__foot">Classée automatiquement · prête pour le comptable</p>
              </div>
            </figure>
          </div>
        </section>

        {/* ───────────────────────────────────────────────────────── le papier */}
        <section className="v-impact" id="impact">
          <div className="v-wrap">
            <div className="v-impact__head rv">
              <p className="v-eyebrow v-eyebrow--night">Chaque année, en France</p>
              <h2 className="v-h2">Un reçu qu’on jette coûte un arbre qu’on abat.</h2>
              <p>
                Le ticket de caisse est le document le plus imprimé — et le plus vite jeté. Chaque
                vente passée par TK LINK en supprime un.
              </p>
            </div>
            <dl className="v-impact__stats">
              {STATS.map((s) => (
                <div className="v-stat rv" key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>
                    <span data-count={s.count} data-decimals={s.decimals}>
                      {formatStat(s.count, s.decimals)}
                    </span>
                    <small>{s.unit}</small>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ──────────────────────────────────────────────────────────── appel */}
        <section className="v-cta" id="telecharger">
          <div className="v-wrap v-cta__in rv">
            <h2 className="v-cta__title">
              Les prochaines ventes flash arrivent sur votre téléphone.
            </h2>
            <p>
              {ANDROID_APK_URL
                ? 'Gratuit, sans engagement. Sur Android dès maintenant, en version de test ; bientôt sur iPhone — les commerces de votre quartier, à Toulouse pour commencer.'
                : 'Gratuit, sans engagement. Bientôt sur iPhone et Android — les commerces de votre quartier, à Toulouse pour commencer.'}
            </p>
            <div className="v-cta__row">
              {ANDROID_APK_URL ? (
                <a className="v-btn-dark" href={ANDROID_APK_URL} rel="noopener">
                  Télécharger pour Android <Arrow />
                </a>
              ) : (
                <span className="v-store">Bientôt sur Google Play</span>
              )}
              <span className="v-store">Bientôt sur l’App Store</span>
              <a className="v-btn-light" href="/pro">
                Je suis un commerçant <Arrow />
              </a>
            </div>
            {ANDROID_APK_URL ? (
              <p className="v-cta__note">
                Version de test (fichier APK). Si Android le demande, autorisez l’installation
                depuis votre navigateur.
              </p>
            ) : null}
          </div>
        </section>
      </main>

      {/* ──────────────────────────────────────────────────────────── pied */}
      <footer className="v-foot">
        <div className="v-wrap">
          <div className="v-foot__cols">
            <p className="v-foot__pitch">
              Les ventes flash de votre quartier. Des prix imbattables, pour un temps limité.
            </p>
            <nav aria-label="Produit">
              <h4>Produit</h4>
              <a href="#fonctionnement">Comment ça marche</a>
              <a href="#publics">Pour qui</a>
              <a href="/pro">Espace commerçant</a>
              <a href="/grossiste">Espace grossiste</a>
            </nav>
            <nav aria-label="En savoir plus">
              <h4>En savoir plus</h4>
              <a href="#commercants">Vous êtes commerçant</a>
              <a href="#impact">Notre impact</a>
              <a href="#telecharger">Obtenir l’app</a>
              <a href="/confidentialite">Confidentialité</a>
            </nav>
          </div>
          <p className="v-foot__mark" aria-hidden="true">
            TK LINK
          </p>
          <p className="v-foot__legal">
            © {new Date().getFullYear()} TK LINK — Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
