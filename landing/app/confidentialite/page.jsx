/**
 * Politique de confidentialité de l'application TK LINK.
 *
 * Exigée en ligne par Google (publication de l'écran de connexion Google), l'App Store et Google
 * Play. Elle décrit ce que l'app fait AUJOURD'HUI (voir le code de `src/` et
 * `docs/security/authentication.md`) : la changer quand l'app collecte autre chose.
 *
 * ⚠️ BROUILLON, à faire valider par le client : la raison sociale, l'adresse et l'e-mail de
 * contact ci-dessous sont provisoires (compte de test, 26/10/2026).
 */
export const metadata = {
  title: 'Politique de confidentialité — TK LINK',
  description: 'Les données que l’application TK LINK utilise, pourquoi, et vos droits.',
};

const CONTACT_EMAIL = 'vfounders5@gmail.com';
const UPDATED = '13 novembre 2026';

export default function Confidentialite() {
  return (
    <main className="legal">
      <div className="wrap legal-wrap">
        <a className="logo" href="/">
          TK<span>LINK</span>
        </a>

        <h1>Politique de confidentialité</h1>
        <p className="legal-date">Dernière mise à jour : {UPDATED}</p>

        <p>
          TK LINK est une application de ventes flash entre commerçants de quartier, clients et
          grossistes. Cette page explique quelles données l’application utilise, pourquoi, où elles
          sont conservées et comment exercer vos droits.
        </p>

        <h2>Responsable du traitement</h2>
        <p>
          TK LINK. Pour toute question sur vos données :{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>Les données que nous utilisons</h2>
        <ul>
          <li>
            <strong>Votre compte</strong> : prénom, nom, adresse e-mail, numéro de téléphone, type
            de compte (client, commerçant ou grossiste) et mot de passe — ce dernier n’est jamais
            stocké en clair.
          </li>
          <li>
            <strong>Connexion avec Google ou Apple</strong> : si vous choisissez ce mode, nous
            recevons de Google ou d’Apple votre nom et votre adresse e-mail, rien d’autre. Nous
            n’avons pas accès à votre mot de passe Google ou Apple.
          </li>
          <li>
            <strong>Vos centres d’intérêt</strong>, choisis à l’inscription, pour vous montrer les
            offres qui vous concernent.
          </li>
          <li>
            <strong>Professionnels</strong> : nom du commerce, catégorie, adresse, numéro SIRET et
            modes de remise, pour vérifier et présenter votre activité.
          </li>
          <li>
            <strong>Votre position</strong>, seulement pendant que vous utilisez l’application et si
            vous l’autorisez : elle sert à afficher les commerces autour de vous et à calculer le
            trajet. Elle n’est pas conservée sur nos serveurs.
          </li>
          <li>
            <strong>Appareil photo et photos</strong>, seulement si vous l’autorisez : pour
            illustrer une vente flash, ou scanner le QR code d’un client qui retire sa commande
            (commerçants).
          </li>
          <li>
            <strong>Vos commandes</strong> : les articles, le montant, le mode de remise et, pour
            une livraison, l’adresse et le numéro de téléphone à transmettre au coursier.
          </li>
          <li>
            <strong>Empreinte ou visage</strong> : le déverrouillage biométrique est vérifié par
            votre téléphone ; aucune donnée biométrique ne nous est transmise.
          </li>
        </ul>

        <h2>Ce que nous ne faisons pas</h2>
        <ul>
          <li>Nous ne vendons pas vos données et ne les louons à personne.</li>
          <li>
            Nous n’utilisons aucun outil de publicité ni de pistage, et ne vous suivons pas d’une
            application à l’autre.
          </li>
        </ul>

        <h2>Nos prestataires</h2>
        <ul>
          <li>
            <strong>Supabase</strong> héberge les comptes et les données, dans l’Union européenne
            (Irlande).
          </li>
          <li>
            <strong>Google</strong> et <strong>Apple</strong>, si vous vous connectez avec eux.
          </li>
          <li>
            <strong>Mapbox</strong> affiche la carte et calcule les trajets à partir de votre
            position.
          </li>
          <li>
            <strong>Stripe</strong> traite les paiements. Vos données de carte sont saisies chez
            Stripe et ne passent jamais par TK LINK. Les commerçants transmettent à Stripe les
            informations exigées pour être payés (identité, compte bancaire).
          </li>
          <li>
            <strong>Uber Direct</strong> assure les livraisons : il reçoit, pour chaque commande
            livrée, l’adresse de retrait, l’adresse et le prénom du destinataire, son numéro de
            téléphone et la liste des articles.
          </li>
          <li>Un service d’envoi d’e-mails, pour les codes de vérification et de mot de passe.</li>
        </ul>

        <h2>Durée de conservation</h2>
        <p>
          Vos données sont conservées tant que votre compte existe. Quand vous le supprimez, elles
          sont effacées de nos serveurs.
        </p>

        <h2>Supprimer votre compte</h2>
        <p>
          Dans l’application : <strong>Profil → Mon compte → Supprimer mon compte</strong>. Vous
          pouvez aussi le demander par e-mail à{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>Vos droits</h2>
        <p>
          Conformément au RGPD, vous pouvez accéder à vos données, les rectifier, les effacer, vous
          opposer à leur traitement ou en demander la portabilité, en écrivant à{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Vous pouvez aussi adresser une
          réclamation à la CNIL (<a href="https://www.cnil.fr">cnil.fr</a>).
        </p>
      </div>
    </main>
  );
}
