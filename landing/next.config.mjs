import { fileURLToPath } from 'url';
import { dirname } from 'path';

const rootDir = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This project lives inside the Expo repo; pin the tracing root to this folder
  // so Next doesn't pick up the parent lockfile.
  outputFileTracingRoot: rootDir,
  // Linting is run separately, not during the build.
  eslint: { ignoreDuringBuilds: true },
  // Permet de vérifier un build de production SANS écraser le cache du serveur
  // de dev : `NEXT_DIST_DIR=.next-verify npx next build`. Mélanger les deux
  // artefacts casse `next dev` (« __webpack_modules__[moduleId] is not a
  // function »).
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
