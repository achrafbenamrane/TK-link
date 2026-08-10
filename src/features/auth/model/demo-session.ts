import type { Session } from '@supabase/supabase-js';

/**
 * LE MODE DÉMONSTRATION — ce qui remplace l'authentification quand aucun
 * back-end n'est branché.
 *
 * ⚠️ CE N'EST PAS UNE AUTHENTIFICATION. Rien n'est vérifié, rien n'est envoyé
 * nulle part, et aucun mot de passe n'est conservé — ni en clair, ni haché :
 * un condensat rangé sur le téléphone sans serveur en face ne protège personne
 * et ne fait qu'ajouter un secret à voler. On garde l'e-mail, c'est tout.
 *
 * Ce mode n'existe que tant que `EXPO_PUBLIC_SUPABASE_URL` et
 * `EXPO_PUBLIC_SUPABASE_ANON_KEY` ne sont pas renseignés. Dès qu'ils le sont,
 * l'app repasse sur le vrai serveur sans qu'une ligne ne change — et les
 * écrans arrêtent d'afficher le bandeau qui prévient l'utilisateur.
 */

/** Marque reconnaissable dans le jeton : personne ne doit la prendre au sérieux. */
export const DEMO_TOKEN = 'demo-session-no-backend';

/**
 * Fabrique une session de démonstration à la forme de celle de Supabase.
 *
 * Le cast est assumé : `Session` décrit ce que renvoie un vrai serveur (jetons
 * signés, métadonnées d'app, fournisseur d'identité). En reproduire la totalité
 * n'apporterait rien — seuls `user.email` et l'existence de la session sont lus
 * par l'app.
 */
export function makeDemoSession(email: string, nowMs: number = Date.now()): Session {
  const seconds = Math.floor(nowMs / 1000);
  return {
    access_token: DEMO_TOKEN,
    refresh_token: DEMO_TOKEN,
    token_type: 'bearer',
    // Une heure : assez pour une démonstration, trop peu pour être confondu
    // avec une vraie session.
    expires_in: 3600,
    expires_at: seconds + 3600,
    user: {
      id: `demo-${seconds}`,
      email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'demo', providers: ['demo'] },
      user_metadata: { demo: true },
      created_at: new Date(nowMs).toISOString(),
    },
    // why: `Session` exige des champs qu'un serveur seul peut produire ; la
    // démonstration n'en lit aucun. Le cast reste confiné à cette fabrique.
  } as unknown as Session;
}

/** Cette session vient-elle du mode démonstration ? */
export function isDemoSession(session: Session | null): boolean {
  return session?.access_token === DEMO_TOKEN;
}
