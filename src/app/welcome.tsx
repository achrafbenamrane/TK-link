import { useWelcomeStore, WelcomeScreen } from '@/features/welcome';

/**
 * L'OUVERTURE : le logo s'anime, puis dit qu'il a fini. La suite — le choix du profil, la
 * connexion, l'accueil — c'est la porte du layout qui la décide (`decideEntry`) : elle seule sait
 * si une session existe. Si la session n'est pas encore relue, le logo reste affiché le temps qu'elle
 * le soit.
 */
export default function WelcomeRoute() {
  const markSplashDone = useWelcomeStore((s) => s.markSplashDone);
  return <WelcomeScreen onDone={markSplashDone} />;
}
