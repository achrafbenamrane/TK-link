/**
 * Retour de la page de paiement Stripe Checkout d'une commande (fonction Edge `stripe-payment`,
 * secret `STRIPE_PAYMENT_RETURN_URL`).
 *
 * Stripe exige une adresse https : on y revient, puis on renvoie aussitôt vers l'app
 * (`tklink://commande/<id>`) ; le navigateur sécurisé ouvert par l'app se referme sur cette
 * adresse. Revenir ici ne prouve PAS que le paiement a réussi : seul le webhook Stripe le dit au
 * serveur, et l'app relit la commande.
 */
export const metadata = {
  title: 'Paiement TK LINK',
  robots: { index: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StripePaiement({ searchParams }) {
  const params = (await searchParams) ?? {};
  const commande =
    typeof params.commande === 'string' && UUID.test(params.commande) ? params.commande : null;
  const paid = params.etat === 'ok';
  const appUrl = commande
    ? `tklink://commande/${commande}?paiement=${paid ? 'ok' : 'annule'}`
    : 'tklink://';

  return (
    <main className="legal">
      {/* Retour immédiat dans l'app ; le lien ci-dessous reste si le navigateur ne suit pas. */}
      <meta httpEquiv="refresh" content={`0;url=${appUrl}`} />
      <div className="wrap legal-wrap">
        <a className="logo" href="/">
          TK<span>LINK</span>
        </a>
        <h1>{paid ? 'Paiement transmis' : 'Paiement interrompu'}</h1>
        <p>
          {paid
            ? 'Merci ! Revenez dans l’application TK LINK : votre commande s’y affiche dès que le paiement est confirmé.'
            : 'Rien n’a été débité. Revenez dans l’application TK LINK pour réessayer tant que votre commande est réservée.'}
        </p>
        <p>
          <a href={appUrl}>Revenir dans TK LINK</a>
        </p>
      </div>
    </main>
  );
}
