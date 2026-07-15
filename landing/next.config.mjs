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
};

export default nextConfig;
