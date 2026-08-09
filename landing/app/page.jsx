import Interactions from './interactions';

/**
 * Site vitrine TK LINK.
 *
 * L'ordre suit celui de la vidéo de marque, parce qu'il fonctionne : on pose
 * d'abord le problème (le papier), puis la solution (la dématérialisation),
 * puis le fonctionnement, et seulement ensuite ce que chacun y gagne.
 *
 * Les chiffres sont ceux du client — 30 Md de tickets par an en France, 150 000
 * tonnes de papier, 1,8 M d'arbres, 75 Md de litres d'eau.
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
            <a href="#probleme">Le problème</a>
            <a href="#fonctionnement">Comment ça marche</a>
            <a href="#publics">Pour qui</a>
            <a href="#compta">Comptabilité</a>
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
            <p className="eyebrow">Dématérialisation du ticket de caisse</p>
            <h1>
              Le ticket papier <em>a fait son temps.</em>
            </h1>
            <p className="lead">
              En caisse, l’imprimante est remplacée par un lecteur TK LINK. Vous présentez votre
              carte : le ticket arrive directement dans l’application, devient une facture, et ses
              données partent déjà classées vers votre comptable.
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
              Pour les particuliers et les professionnels · Déploiement partout en France
            </p>
          </div>

          <div>
            <div className="card3d" aria-hidden="true">
              <div>
                <div className="logo" style={{ color: 'var(--forest)' }}>
                  TK<span style={{ opacity: 0.6 }}>LINK</span>
                </div>
              </div>
              <div className="cn">7014 2299</div>
              <div className="tree">🌳</div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- problème */}
      <section className="sec sec-dark" id="probleme">
        <div className="wrap">
          <div className="sec-head r">
            <p className="eyebrow">Chaque année, en France</p>
            <h2>Un reçu qu’on jette coûte un arbre qu’on abat.</h2>
            <p>
              Le ticket de caisse est le document le plus imprimé — et le plus vite jeté. Mis bout à
              bout, voilà ce qu’il représente.
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

          <p className="stats-note r">
            Les tickets et factures papier doivent disparaître. C’est exactement ce que fait TK
            LINK.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------- fonctionnement */}
      <section className="sec" id="fonctionnement">
        <div className="wrap">
          <div className="sec-head r">
            <p className="eyebrow">Comment ça marche</p>
            <h2>Quatre gestes, et plus rien à imprimer.</h2>
            <p>
              Le commerçant garde sa caisse. On y branche un lecteur, et l’imprimante papier n’a
              plus lieu d’être.
            </p>
          </div>

          <div className="steps r">
            <div className="step">
              <div className="n" />
              <h3>Un lecteur en caisse</h3>
              <p>
                Le lecteur TK LINK se relie à la caisse enregistreuse et remplace l’imprimante par
                une imprimante virtuelle.
              </p>
            </div>
            <div className="step">
              <div className="n" />
              <h3>Une carte, ou une pastille</h3>
              <p>
                Le client reçoit une carte TK LINK — ou colle une pastille sans contact sur sa
                propre carte bancaire.
              </p>
            </div>
            <div className="step">
              <div className="n" />
              <h3>Le ticket arrive</h3>
              <p>
                Il présente sa carte après l’achat : le reçu est numérisé et s’affiche
                instantanément dans l’application sécurisée.
              </p>
            </div>
            <div className="step">
              <div className="n" />
              <h3>La facture suit</h3>
              <p>
                Le ticket devient une facture certifiée, transmise au commerçant et à son comptable.
                Sans ressaisie.
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
            <h2>Trois usages, une seule carte.</h2>
          </div>

          <div className="cards r">
            <div className="card">
              <span className="tag">Commerçant</span>
              <h3>Plus de rouleaux à changer</h3>
              <p>Un lecteur relié à votre caisse, et le papier sort du budget.</p>
              <ul>
                <li>Installation guidée de l’imprimante virtuelle</li>
                <li>Vos offres visibles dans l’app de vos clients</li>
                <li>Vos factures classées, prêtes pour la compta</li>
              </ul>
            </div>

            <div className="card">
              <span className="tag">Particulier</span>
              <h3>Tous vos reçus au même endroit</h3>
              <p>Fini le ticket froissé au fond de la poche le jour de l’échange.</p>
              <ul>
                <li>Vos tickets classés, cherchables, jamais perdus</li>
                <li>Des points sur chaque achat</li>
                <li>Promos, catalogue et cadeaux réservés aux porteurs</li>
              </ul>
            </div>

            <div className="card">
              <span className="tag">Professionnel</span>
              <h3>La note de frais se remplit seule</h3>
              <p>Votre comptable vous remet votre carte : le reste est automatique.</p>
              <ul>
                <li>Ticket transformé en facture certifiée</li>
                <li>Achats en magasin comme en ligne</li>
                <li>Export compatible avec votre logiciel comptable</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- app */}
      <section className="sec" id="app">
        <div className="wrap split">
          <div className="r">
            <p className="eyebrow">L’application</p>
            <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', margin: '12px 0 14px' }}>
              Vos achats vous rapportent.
            </h2>
            <p style={{ color: 'var(--ink-muted)', marginBottom: 22 }}>
              Chaque passage de carte crédite des points. Ils s’échangent contre des réductions, des
              produits offerts — ou un arbre planté. Et parce qu’attendre en caisse n’a rien
              d’amusant, l’app propose aussi des jeux qui rapportent.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a className="btn btn-primary" href="#telecharger">
                Obtenir l’app
              </a>
              <a className="btn btn-outline" href="/pro">
                Voir l’espace pro
              </a>
            </div>
          </div>

          <div className="phone r" aria-hidden="true">
            <div className="ph-logo">TK LINK</div>
            <ul className="menu">
              <li>CARTE FIDÉLITÉ</li>
              <li>PROMO</li>
              <li>CATALOGUE</li>
              <li>BONUS POINT</li>
              <li>CADEAUX</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- compta */}
      <section className="sec sec-paper" id="compta">
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
            <p className="eyebrow">Comptabilité</p>
            <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', margin: '12px 0 14px' }}>
              La saisie est déjà faite.
            </h2>
            <p style={{ color: 'var(--ink-muted)', marginBottom: 18 }}>
              Notre IA lit les documents collectés, en extrait les données, effectue la saisie des
              écritures et les classe par code fournisseur. Le comptable n’a plus qu’à les
              télécharger.
            </p>
            <p style={{ color: 'var(--ink-muted)' }}>
              L’export est compatible avec tous les logiciels comptables du marché — aucune
              migration à prévoir.
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- CTA */}
      <section className="sec" id="telecharger">
        <div className="wrap">
          <div className="cta r">
            <h2>Passez au ticket qui ne se perd pas.</h2>
            <p>
              Rejoignez les commerces qui ont éteint leur imprimante. Déploiement partout en France.
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
                La dématérialisation du ticket de caisse. Moins de papier, plus de services.
              </p>
            </div>
            <div className="foot-col">
              <h4>Produit</h4>
              <a href="#fonctionnement">Comment ça marche</a>
              <a href="#publics">Pour qui</a>
              <a href="#compta">Comptabilité</a>
              <a href="/pro">Espace professionnel</a>
            </div>
            <div className="foot-col">
              <h4>En savoir plus</h4>
              <a href="#probleme">Notre impact</a>
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
