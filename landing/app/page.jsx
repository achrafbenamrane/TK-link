import Interactions from './interactions';

export default function Home() {
  return (
    <>
      <header id="hdr">
        <div className="nav">
          <a href="#" className="logo">
            Freedoo<span className="d">.</span>
          </a>
          <nav className="nav-mid">
            <a href="#concept">Concept</a>
            <a href="#features">Fonctionnalités</a>
            <a href="#commercants">Commerçants</a>
            <a href="#telecharger">Télécharger</a>
          </nav>
          <a href="#telecharger" className="nav-btn">
            Obtenir l’app
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="hero" id="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow up" style={{ animationDelay: '.05s' }}>
                Ventes flash · Livraison de quartier
              </span>
              <h1>
                <span className="rl">
                  <span style={{ animationDelay: '.12s' }}>Les bons plans</span>
                </span>
                <span className="rl">
                  <span style={{ animationDelay: '.20s' }}>du quartier,</span>
                </span>
                <span className="rl">
                  <span style={{ animationDelay: '.28s' }}>livrés avant qu’ils</span>
                </span>
                <span className="rl">
                  <span style={{ animationDelay: '.34s' }}>
                    ne <em>s’envolent.</em>
                  </span>
                </span>
              </h1>
              <p className="deck up" style={{ animationDelay: '.42s' }}>
                Freedoo transforme les coups de cœur et les invendus de vos commerçants de proximité —
                boucher, resto, artisan — en ventes flash. Gratuit pour vous. Sécurisé pour tous.
              </p>
              <div className="hero-actions up" style={{ animationDelay: '.52s' }}>
                <a href="#telecharger" className="btn btn-red">
                  Obtenir l’app
                </a>
                <a href="#concept" className="btn btn-link">
                  Voir comment ça marche <span className="arw">→</span>
                </a>
              </div>
              <p className="hero-note up" style={{ animationDelay: '.6s' }}>
                <b>100 % gratuit</b> pour l’utilisateur — Livraison vérifiée par empreinte — Sans
                terminal de carte — Lancé à Toulouse.
              </p>
            </div>

            <div className="hero-visual up" style={{ animationDelay: '.3s' }}>
              <span className="tagpin">
                <span className="live"></span> En direct à Toulouse
              </span>
              <div className="phone">
                <div className="screen">
                  <div className="app-top">
                    <span>
                      Bonjour · <b>Toulouse</b>
                    </span>
                    <span>Panier</span>
                  </div>
                  <div className="app-cats">
                    <span className="cm on">Tous</span>
                    <span className="cm">Restos</span>
                    <span className="cm">Artisans</span>
                    <span className="cm">Courses</span>
                    <span className="cm">Shopping</span>
                  </div>
                  <div className="product">
                    <div className="p-scene">
                      <div className="p-emoji">🥩</div>
                      <div className="p-timer">
                        ⏱ <span id="cardTimer">00:04:45</span>
                      </div>
                      <div className="p-stock">
                        Reste <span id="cardStock">25</span>
                      </div>
                      <div className="p-flag">🇫🇷</div>
                      <div className="p-badge">
                        <b>−50%</b>
                        <span>SUR LE 2ᵉ</span>
                      </div>
                    </div>
                    <div className="p-info">
                      <div className="m">
                        <span className="star">★</span> 5,0 · Maison Hammamet · Halal
                      </div>
                      <h4>Gigot d’agneau entier</h4>
                      <div className="d">Pièce de 2,2 à 3,4 kg · viande origine France</div>
                      <div className="p-bar">
                        <i id="cardBar"></i>
                      </div>
                      <button className="p-add">Ajouter au panier</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Figures */}
      <div className="figures">
        <div className="wrap" style={{ padding: 0 }}>
          <div className="row">
            <div className="figure r">
              <div className="n">
                0<small>€</small>
              </div>
              <div className="k">pour l’utilisateur</div>
            </div>
            <div className="figure r" data-d="1">
              <div className="n">
                &lt;30<small>min</small>
              </div>
              <div className="k">livraison de proximité</div>
            </div>
            <div className="figure r" data-d="2">
              <div className="n">2&nbsp;à&nbsp;3</div>
              <div className="k">ventes flash offertes / commerçant</div>
            </div>
            <div className="figure r" data-d="3">
              <div className="n">
                1<small>ville</small>
              </div>
              <div className="k">Toulouse, puis la région</div>
            </div>
          </div>
        </div>
      </div>

      {/* Manifesto */}
      <div className="manifesto">
        <div className="wrap">
          <blockquote className="r">
            On préfère <span className="hl">réussir un quartier</span> plutôt que rater un pays. Faire
            de l’argent en aidant les commerçants — pas en les pressant.
          </blockquote>
          <cite className="r" data-d="1">
            La philosophie Freedoo — issue des ateliers avec Farid
          </cite>
        </div>
      </div>

      {/* Concept */}
      <section id="concept">
        <div className="wrap">
          <div className="sec-head">
            <div className="lead r">
              <span className="eyebrow">Comment ça marche</span>
              <h2>
                Du comptoir à votre porte,
                <br />
                en trois gestes.
              </h2>
            </div>
            <span className="sec-index r" data-d="1">
              01 — Le concept
            </span>
          </div>
          <div className="steps">
            <div className="step r">
              <span className="sn">01</span>
              <h3>Le commerçant lance sa vente flash</h3>
              <p>
                Photo, prix, durée. En quelques secondes, son offre part en direct auprès du quartier —
                sans matériel, sans friction.
              </p>
            </div>
            <div className="step r">
              <span className="sn">02</span>
              <h3>Vous attrapez le bon plan</h3>
              <p>
                Compte à rebours et stock en temps réel. Un geste et c’est réservé : le bon coup, sans
                stress ni file d’attente.
              </p>
            </div>
            <div className="step r">
              <span className="sn">03</span>
              <h3>Livraison rapide et sécurisée</h3>
              <p>
                Un livreur identifié par empreinte digitale dépose votre commande. Vous recevez une
                facture QR certifiée et traçable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ paddingTop: '20px' }}>
        <div className="wrap">
          <div className="sec-head">
            <div className="lead r">
              <span className="eyebrow">Ce que Freedoo fait bien</span>
              <h2>
                Une base solide,
                <br />
                pensée pour durer.
              </h2>
              <p>Pas d’effets gratuits. Chaque fonction sert la vitesse, la confiance ou le commerçant.</p>
            </div>
            <span className="sec-index r" data-d="1">
              02 — Le produit
            </span>
          </div>
          <div className="feat-grid">
            <div className="feat r">
              <div className="fi">
                <svg viewBox="0 0 24 24">
                  <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z" />
                </svg>
              </div>
              <h3>Ventes flash en direct</h3>
              <p>Compte à rebours et stock qui fondent en temps réel. L’urgence, mais maîtrisée.</p>
            </div>
            <div className="feat r" data-d="1">
              <div className="fi">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <h3>Livraison sécurisée</h3>
              <p>Livreurs vérifiés par empreinte et pièce d’identité. Fini les comptes revendus.</p>
            </div>
            <div className="feat r" data-d="2">
              <div className="fi">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="6" width="18" height="12" rx="2" />
                  <path d="M3 10h18" />
                </svg>
              </div>
              <h3>Zéro frais caché</h3>
              <p>Commission légère, moins chère qu’un TPE. Livraison offerte au client.</p>
            </div>
            <div className="feat r">
              <div className="fi">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="8" width="18" height="13" rx="2" />
                  <path d="M3 8l3-4h12l3 4M12 8v13" />
                </svg>
              </div>
              <h3>Fidélité partagée</h3>
              <p>Des points à cumuler — et à offrir à vos proches, comme un cadeau.</p>
            </div>
            <div className="feat r" data-d="1">
              <div className="fi">
                <svg viewBox="0 0 24 24">
                  <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
                  <path d="M9 8h6M9 12h6" />
                </svg>
              </div>
              <h3>Facture QR certifiée</h3>
              <p>Chaque ticket devient une facture traçable, en un seul scan.</p>
            </div>
            <div className="feat r" data-d="2">
              <div className="fi">
                <svg viewBox="0 0 24 24">
                  <path d="M3 21V9l6-3 6 3 6-3v15" />
                  <path d="M9 21V11M15 21V12" />
                </svg>
              </div>
              <h3>Espace B2B grossistes</h3>
              <p>Catalogues pros et réassort en temps réel pour les commerçants.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Red button */}
      <section className="press">
        <div className="wrap">
          <span className="eyebrow r">Un dernier geste</span>
          <h2 className="r" data-d="1">
            Appuyez.
          </h2>
          <p className="r" data-d="1">
            Oui, il s’enfonce pour de vrai. Il vous emmène droit vers l’app.
          </p>
          <div className="press-stage r" data-d="2">
            <button className="pushbtn" id="pushBtn" aria-label="Obtenir l’application Freedoo">
              <span className="pushbtn__base"></span>
              <span className="pushbtn__cap">
                <span className="pushbtn__face">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 5v14M19 12l-7 7-7-7" />
                  </svg>
                  <span className="t1">OBTENIR</span>
                  <span className="t2">L’APP</span>
                </span>
              </span>
            </button>
          </div>
          <p className="press-hint r" data-d="2">
            Appuyez sur le bouton — <b>il se compresse</b>
          </p>
        </div>
      </section>

      {/* Merchants */}
      <section id="commercants">
        <div className="wrap">
          <div className="merchant">
            <div className="r">
              <span className="eyebrow">Vous êtes commerçant ?</span>
              <h2>
                Écoulez votre stock.
                <br />
                Sans matériel, sans engagement.
              </h2>
              <p className="deck">
                Freedoo vous branche directement sur les clients de votre quartier. Vous gardez la main
                sur vos prix, vos offres et vos marges.
              </p>
              <a href="#telecharger" className="btn btn-red cta">
                Devenir commerçant pilote
              </a>
            </div>
            <div className="terms r" data-d="1">
              <div className="term">
                <span className="k">Frais d’inscription</span>
                <span className="v red">0 €</span>
              </div>
              <div className="term">
                <span className="k">Ventes flash offertes</span>
                <span className="v">2 à 3</span>
              </div>
              <div className="term">
                <span className="k">Commission par transaction</span>
                <span className="v">Légère</span>
              </div>
              <div className="term">
                <span className="k">Livraison pour le client</span>
                <span className="v red">Gratuite</span>
              </div>
              <div className="term">
                <span className="k">Terminal de paiement (TPE)</span>
                <span className="v">Inutile</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Download */}
      <section id="telecharger" className="download">
        <div className="wrap">
          <span className="eyebrow r">Lancement à Toulouse</span>
          <h2 className="r" data-d="1">
            Rejoignez les premiers quartiers.
          </h2>
          <p className="r" data-d="1">
            Bientôt disponible sur iOS et Android. Les commerçants pilotes peuvent déjà se pré-inscrire.
          </p>
          <div className="store-row r" data-d="2">
            <a className="store-btn">
              <svg viewBox="0 0 24 24" fill="#f6f2ea">
                <path d="M16.5 12.3c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.9-3-.9c-1.5 0-2.9.9-3.7 2.3-1.6 2.8-.4 6.9 1.1 9.2.8 1.1 1.6 2.3 2.8 2.3 1.1 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.7-2.2c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.6-3.9zM14.3 5.3c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-1 2.7 1 .1 2-.4 2.7-1.1z" />
              </svg>
              <span className="st">
                <small>Bientôt sur</small>
                <b>App Store</b>
              </span>
            </a>
            <a className="store-btn">
              <svg viewBox="0 0 24 24" fill="#f6f2ea">
                <path d="M3.6 2.3c-.2.2-.3.5-.3.9v17.6c0 .4.1.7.3.9l9.9-9.8v-.2zM17 15.3l-3.3-3.3 3.3-3.3 4 2.3c1.1.6 1.1 1.7 0 2.3zM13.7 11.8L3.6 21.9c.4.4 1 .4 1.7.1l11.8-6.8zM5.3 1.9l11.4 6.6-3.4 3.4L3.6 1.8c.7-.3 1.3-.3 1.7.1z" />
              </svg>
              <span className="st">
                <small>Bientôt sur</small>
                <b>Google Play</b>
              </span>
            </a>
            <div className="qr" title="Scannez pour la démo">
              <svg viewBox="0 0 100 100" id="qrSvg"></svg>
            </div>
          </div>
          <p className="dl-note r" data-d="2">
            Toulouse → région toulousaine → Île-de-France
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <div className="foot">
            <div className="foot-brand">
              <a href="#" className="logo">
                Freedoo<span className="d">.</span>
              </a>
              <p>Les ventes flash de proximité, livrées avant qu’elles ne s’envolent.</p>
            </div>
            <div className="foot-cols">
              <div className="foot-col">
                <h5>Produit</h5>
                <a href="#concept">Concept</a>
                <a href="#features">Fonctionnalités</a>
                <a href="#telecharger">Télécharger</a>
              </div>
              <div className="foot-col">
                <h5>Commerçants</h5>
                <a href="#commercants">Devenir pilote</a>
                <a href="#commercants">Espace B2B</a>
                <a href="#commercants">Tarifs</a>
              </div>
              <div className="foot-col">
                <h5>Société</h5>
                <a href="#">Toulouse, France</a>
                <a href="#">Contact</a>
                <a href="#">Confidentialité</a>
              </div>
            </div>
          </div>
          <div className="foot-btm">
            <span>© 2026 Freedoo. Tous droits réservés.</span>
            <span>
              Conçu par <b>PROGIX</b>
            </span>
          </div>
        </div>
      </footer>

      <Interactions />
    </>
  );
}
