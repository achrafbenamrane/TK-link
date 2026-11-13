/**
 * Lien d'inscription Stripe expiré ou déjà utilisé (secret `STRIPE_CONNECT_REFRESH_URL`).
 *
 * Un lien d'inscription Stripe ne sert qu'une fois et expire vite. On ne peut pas en recréer un ici
 * (il faut la session du commerçant) : la page renvoie dans l'app, qui en demande un nouveau.
 */
export const metadata = {
  title: 'Paiements TK LINK — lien expiré',
  robots: { index: false },
};

export default function StripeRelancer() {
  return (
    <main className="legal">
      <div className="wrap legal-wrap">
        <a className="logo" href="/">
          TK<span>LINK</span>
        </a>
        <h1>Ce lien a expiré</h1>
        <p>
          Pour votre sécurité, un lien d’inscription aux paiements ne sert qu’une fois. Revenez dans
          l’application TK LINK et touchez à nouveau « Recevoir mes paiements » : un nouveau lien
          s’ouvrira, là où vous vous étiez arrêté.
        </p>
        <p>
          <a href="tklink://">Ouvrir TK LINK</a>
        </p>
      </div>
    </main>
  );
}
