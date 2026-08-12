/**
 * La serrure du back-office — `/pro` et `/admin`.
 *
 * Ces deux espaces montrent des inscrits, des SIRET, des commandes et des
 * revenus. Les chiffres sont simulés aujourd'hui, mais les écrans ont l'air
 * vrais : mis en ligne sur une URL devinable, ils passeraient pour une fuite de
 * données auprès de n'importe qui tombant dessus — et pour un back-office
 * ouvert auprès d'un client.
 *
 * Le mot de passe vit dans une variable d'environnement, JAMAIS dans le code :
 * un secret commité est un secret public. Si `TKLINK_PRO_PASSWORD` n'est pas
 * défini — développement local, prévisualisation — la porte reste ouverte,
 * pour que personne n'ait à saisir un mot de passe pour travailler.
 *
 * ⚠️ HTTP Basic sur HTTPS : suffisant pour protéger une démonstration des
 * regards de passage, pas pour un back-office de production. Le jour où de
 * vraies données arrivent, c'est une authentification Supabase avec des rôles
 * qui prend le relais — voir `docs/security/checklist.md`.
 */

const PROTECTED = ['/pro', '/admin'];

export function middleware(request) {
  const password = process.env.TKLINK_PRO_PASSWORD;
  if (!password) return;

  const { pathname } = request.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;

  const header = request.headers.get('authorization');
  if (header) {
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      // atob est disponible sur le runtime Edge ; Buffer ne l'est pas.
      const [, given] = atob(encoded).split(':');
      if (given === password) return;
    }
  }

  return new Response('Accès réservé', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="TK LINK — espace professionnel"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export const config = {
  // On ne fait tourner le middleware que sur les chemins concernés : la vitrine
  // publique n'a aucune raison de payer ce détour à chaque visite.
  matcher: ['/pro/:path*', '/admin/:path*'],
};
