import Interactions from './interactions';
import AppShowcase from './app-showcase';

/**
 * Site vitrine TK LINK.
 *
 * ⚠️ RÉÉCRITE le 13/08/2026 sur arbitrage de la conduite de projet. La page
 * racontait le matériel — un lecteur en caisse, une carte sans contact, le
 * ticket dématérialisé — sur le modèle de la vidéo de marque. Deux problèmes :
 * **ce matériel ne sera pas réalisé**, et la page parlait d'abord aux
 * commerçants alors que l'application s'adresse d'abord aux clients.
 *
 * Le message tient désormais en une phrase, celle de la demande : l'app sert à
 * **obtenir des offres flash, des promotions importantes avec des dates
 * courtes**. Tout le reste — fidélité, jeux, factures — vient après, parce que
 * c'est après que ça se découvre.
 *
 * Ce qui subsiste du récit d'origine : la disparition du papier, qui reste
 * vraie sans matériel (une commande honorée produit son ticket dans l'app), et
 * la comptabilité, qui parle aux commerçants — donc placée en fin de page.
 *
 * Les chiffres du papier sont ceux du client — 30 Md de tickets par an en
 * France, 150 000 tonnes de papier, 1,8 M d'arbres, 75 Md de litres d'eau.
 */
export default function Page() {
  return (
    <>
      <Interactions />

      {/* ------------------------------------------------------------ nav */}
      <header id="hdr">
        <div className="wrap nav">
          <a className="logo" href="#hero">
            TK<span>LINK</span>
          </a>
          <nav className="nav-links" aria-label="Navigation principale">
            <a href="#fonctionnement">Comment ça marche</a>
            <a href="#publics">Pour qui</a>
            <a href="#commercants">Commerçants</a>
          </nav>
          <a className="btn btn-lime" href="#telecharger">
            Obtenir l’app
          </a>
        </div>
      </header>

      {/* ----------------------------------------------------------- hero */}
      <section className="hero" id="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">Les ventes flash de votre quartier</p>
            <h1>
              Des prix qui tombent, <em>et qui ne reviennent pas.</em>
            </h1>
            <p className="lead">
              Les commerçants près de chez vous bradent ce qui doit partir aujourd’hui : −30, −50,
              −70 %. Chaque offre a un compte à rebours et un stock qui fond. Vous la prenez, ou
              elle disparaît.
            </p>
            <div className="hero-cta">
              <a className="btn btn-lime" href="#telecharger">
                Obtenir l’app
              </a>
              <a className="btn btn-ghost" href="/pro">
                Espace professionnel
              </a>
            </div>
            <p className="hero-note">
              Gratuit · Sans engagement · Les commerces de votre quartier, à Toulouse d’abord
            </p>
          </div>

          <AppShowcase />
        </div>
      </section>

      {/* --------------------------------------------------- fonctionnement */}
      <section className="sec sec-dark" id="fonctionnement">
        <div className="wrap">
          <div className="sec-head r">
            <p className="eyebrow">Comment ça marche</p>
            <h2>Trois gestes, et c’est à vous.</h2>
            <p>
              Pas de carte à demander, pas de matériel à installer. Vous téléchargez, vous dites ce
              qui vous intéresse, et les bonnes affaires arrivent.
            </p>
          </div>

          <div className="steps r">
            <div className="step">
              <div className="n" />
              <h3>Dites ce qui vous intéresse</h3>
              <p>
                Restauration, high-tech, mode, beauté, sport… On ne vous montrera pas les promotions
                d’une boucherie si vous êtes venu pour du matériel informatique.
              </p>
            </div>
            <div className="step">
              <div className="n" />
              <h3>Attrapez avant que ça parte</h3>
              <p>
                Chaque offre affiche son compte à rebours et ce qu’il en reste. Un geste pour la
                réserver — le stock se met à jour pour tout le monde en même temps.
              </p>
            </div>
            <div className="step">
              <div className="n" />
              <h3>Récupérez ou faites livrer</h3>
              <p>
                Vous passez au comptoir, ou on vous l’apporte. Le ticket arrive dans l’application :
                plus de bout de papier froissé le jour de l’échange.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- publics */}
      <section className="sec sec-paper" id="publics">
        <div className="wrap">
          <div className="sec-head r">
            <p className="eyebrow">Pour qui</p>
            <h2>D’abord pour vous. Ensuite pour votre quartier.</h2>
          </div>

          <div className="cards r">
            <div className="card">
              <span className="tag">Vous</span>
              <h3>Payer moins, près de chez vous</h3>
              <p>
                Les invendus du jour, à l’heure où ils doivent partir. Ce que vous auriez acheté de
                toute façon, à moitié prix.
              </p>
              <ul>
                <li>Des offres triées selon ce qui vous intéresse</li>
                <li>Un compte à rebours et un stock réels, jamais gonflés</li>
                <li>À récupérer sur place ou à faire livrer</li>
              </ul>
            </div>

            <div className="card">
              <span className="tag">Votre commerçant</span>
              <h3>Vendre au lieu de jeter</h3>
              <p>
                Une vente flash se publie en deux minutes, depuis un ordinateur. Ce qui allait à la
                poubelle trouve preneur avant la fermeture.
              </p>
              <ul>
                <li>Cinq opérations gratuites pour commencer</li>
                <li>Les clients du quartier prévenus immédiatement</li>
                <li>Commandes et factures suivies au même endroit</li>
              </ul>
            </div>

            <div className="card">
              <span className="tag">Le quartier</span>
              <h3>Moins d’invendus, moins de papier</h3>
              <p>
                Chaque offre attrapée est un produit qui ne finit pas à la benne — et un ticket qui
                ne s’imprime pas.
              </p>
              <ul>
                <li>Des commerces indépendants, pas des enseignes</li>
                <li>Des tickets numériques, conservés deux ans</li>
                <li>Des points échangeables contre un arbre planté</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- compta */}
      <section className="sec sec-paper" id="commercants">
        <div className="wrap split">
          <div className="fields r">
            <div className="fi">
              <span className="k">Nom de l’organisation</span>
              <span className="v">Le Comptoir du Midi</span>
            </div>
            <div className="fi">
              <span className="k">Référence du document</span>
              <span className="v">LCM-2026-1004</span>
            </div>
            <div className="fi">
              <span className="k">Date du document</span>
              <span className="v">07/08/2026</span>
            </div>
            <div className="fi">
              <span className="k">Devise</span>
              <span className="v">EUR</span>
            </div>
            <div className="fi">
              <span className="k">Montant (HT)</span>
              <span className="v">31,58 €</span>
            </div>
            <div className="fi">
              <span className="k">Montant (TVA)</span>
              <span className="v">6,32 €</span>
            </div>
            <div className="fi">
              <span className="k">Montant (TTC)</span>
              <span className="v">37,90 €</span>
            </div>
            <div className="fi">
              <span className="k">Code fournisseur</span>
              <span className="v">F-0421</span>
            </div>
          </div>

          <div className="r">
            <p className="eyebrow">Vous êtes commerçant</p>
            <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', margin: '12px 0 14px' }}>
              Vendez l’invendu. La paperasse suit toute seule.
            </h2>
            <p style={{ color: 'var(--ink-muted)', marginBottom: 18 }}>
              Vous publiez une vente flash depuis votre navigateur : un prix, une quantité, une
              durée. Elle apparaît immédiatement chez les clients du quartier qui cherchent ce que
              vous vendez.
            </p>
            <p style={{ color: 'var(--ink-muted)', marginBottom: 18 }}>
              Chaque vente honorée produit son ticket, puis sa facture certifiée, classée et prête
              pour votre comptable. Sans ressaisie, et sans un mètre de papier thermique.
            </p>
            <a className="btn btn-primary" href="/pro">
              Ouvrir l’espace professionnel
            </a>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- le papier */}
      <section className="sec sec-dark" id="impact">
        <div className="wrap">
          <div className="sec-head r">
            <p className="eyebrow">Chaque année, en France</p>
            <h2>Un reçu qu’on jette coûte un arbre qu’on abat.</h2>
            <p>
              Le ticket de caisse est le document le plus imprimé — et le plus vite jeté. Chaque
              vente passée par TK LINK en supprime un.
            </p>
          </div>

          <div className="stats r">
            <div className="stat">
              <div className="v">30 Md</div>
              <div className="k">de tickets de caisse imprimés</div>
            </div>
            <div className="stat">
              <div className="v">150 000 t</div>
              <div className="k">de papier consommé</div>
            </div>
            <div className="stat">
              <div className="v">1,8 M</div>
              <div className="k">d’arbres abattus</div>
            </div>
            <div className="stat">
              <div className="v">75 Md L</div>
              <div className="k">d’eau utilisés</div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- CTA */}
      <section className="sec" id="telecharger">
        <div className="wrap">
          <div className="cta r">
            <h2>Les prochaines ventes flash sont déjà en ligne.</h2>
            <p>
              Gratuit, sans engagement. Les commerces de votre quartier, à Toulouse pour commencer.
            </p>
            <div className="cta-row">
              <a className="btn btn-lime" href="#telecharger">
                Télécharger l’application
              </a>
              <a className="btn btn-ghost" href="/pro">
                Je suis un commerçant
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- footer */}
      <footer>
        <div className="wrap">
          <div className="foot">
            <div className="foot-col">
              <div className="logo" style={{ color: '#f2f7f0', marginBottom: 10 }}>
                TK<span>LINK</span>
              </div>
              <p style={{ maxWidth: '34ch' }}>
                Les ventes flash de votre quartier. Des prix qui tombent, et qui ne reviennent pas.
              </p>
            </div>
            <div className="foot-col">
              <h4>Produit</h4>
              <a href="#fonctionnement">Comment ça marche</a>
              <a href="#publics">Pour qui</a>
              <a href="/pro">Espace professionnel</a>
            </div>
            <div className="foot-col">
              <h4>En savoir plus</h4>
              <a href="#commercants">Vous êtes commerçant</a>
              <a href="#impact">Notre impact</a>
              <a href="#telecharger">Obtenir l’app</a>
            </div>
          </div>
          <div className="foot-bot">
            © {new Date().getFullYear()} TK LINK — Tous droits réservés.
          </div>
        </div>
      </footer>
    </>
  );
}
