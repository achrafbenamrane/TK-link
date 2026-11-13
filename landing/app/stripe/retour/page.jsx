/**
 * Retour de l'inscription Stripe d'un commerçant (Stripe Connect, fonction Edge `stripe-connect`).
 *
 * Stripe exige une adresse https pour revenir : c'est celle-ci (secret
 * `STRIPE_CONNECT_RETURN_URL`). Revenir ici ne prouve PAS que l'inscription est complète — seul le
 * webhook `account.updated` le dit à TK LINK. La page invite donc à revenir dans l'app, qui affiche
 * l'état réel.
 */
export const metadata = {
  title: 'Paiements TK LINK — retour dans l’application',
  robots: { index: false },
};

export default function StripeRetour() {
  return (
    <main className="legal">
      <div className="wrap legal-wrap">
        <a className="logo" href="/">
          TK<span>LINK</span>
        </a>
        <h1>Merci, c’est noté</h1>
        <p>
          Vos informations ont été transmises à Stripe, notre prestataire de paiement. Revenez dans
          l’application TK LINK : votre espace indique quand vous pouvez encaisser vos ventes.
        </p>
        <p>
          C’est souvent immédiat. Si Stripe demande un justificatif, la vérification peut prendre
          jusqu’à un jour ouvré ; l’application vous le dira.
        </p>
        <p>
          <a href="tklink://">Ouvrir TK LINK</a>
        </p>
      </div>
    </main>
  );
}
