import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { SignInScreen } from '@/features/auth';

/**
 * Routes stay THIN — wire the URL to the feature screen. The root layout's
 * `useProtectedRoute` redirects here when there is no session.
 */
export default function SignInRoute() {
  const router = useRouter();
  const onCreateAccount = useCallback(() => router.push('/sign-up'), [router]);
  return <SignInScreen onCreateAccount={onCreateAccount} />;
}
