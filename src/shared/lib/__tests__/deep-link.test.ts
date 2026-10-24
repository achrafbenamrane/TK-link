import {
  resolveDeepLinkPath,
  isAllowedExternalUrl,
  isAuthCallback,
  SAFE_FALLBACK_ROUTE,
} from '@/shared/lib/deep-link';

describe('resolveDeepLinkPath', () => {
  it('allows a known route', () => {
    expect(resolveDeepLinkPath('/')).toBe('/');
  });

  it('strips a custom scheme and host', () => {
    expect(resolveDeepLinkPath('skeleton:///')).toBe('/');
  });

  it('ignores query params and never trusts them for routing', () => {
    expect(resolveDeepLinkPath('/?next=https://evil.example/steal')).toBe('/');
  });

  it('sends unknown routes to the safe fallback', () => {
    expect(resolveDeepLinkPath('/admin/secret')).toBe(SAFE_FALLBACK_ROUTE);
  });

  it('degrades safely on null / empty / malformed input', () => {
    expect(resolveDeepLinkPath(null)).toBe(SAFE_FALLBACK_ROUTE);
    expect(resolveDeepLinkPath('')).toBe(SAFE_FALLBACK_ROUTE);
    expect(resolveDeepLinkPath('::::not a url::::')).toBe(SAFE_FALLBACK_ROUTE);
  });
});

/**
 * The Apple sign-in return on Android (`tklink://auth/callback?code=…`) is handed to the sign-in in
 * progress: the router must NOT navigate to it. Only the app's own callback qualifies.
 */
describe('isAuthCallback', () => {
  it('recognises the callback as a full link or as a bare path, whatever follows it', () => {
    expect(isAuthCallback('tklink://auth/callback?code=x')).toBe(true);
    expect(isAuthCallback('/auth/callback')).toBe(true);
    expect(isAuthCallback('auth/callback#a')).toBe(true);
  });

  it('rejects empty input and ordinary routes', () => {
    expect(isAuthCallback(null)).toBe(false);
    expect(isAuthCallback(undefined)).toBe(false);
    expect(isAuthCallback('')).toBe(false);
    expect(isAuthCallback('/')).toBe(false);
  });

  it('rejects another host, a web URL, or a deeper path', () => {
    expect(isAuthCallback('tklink://evil/auth/callback')).toBe(false);
    expect(isAuthCallback('https://x.com/auth/callback')).toBe(false);
    expect(isAuthCallback('/auth/callback/extra')).toBe(false);
  });
});

describe('isAllowedExternalUrl', () => {
  const hosts = ['yourcompany.com'];

  it('allows https on an allowlisted host', () => {
    expect(isAllowedExternalUrl('https://yourcompany.com/help', hosts)).toBe(true);
  });

  it('rejects non-https schemes (no open redirect / injection)', () => {
    expect(isAllowedExternalUrl('http://yourcompany.com', hosts)).toBe(false);
    expect(isAllowedExternalUrl('javascript:alert(1)', hosts)).toBe(false);
  });

  it('rejects hosts that are not on the allowlist', () => {
    expect(isAllowedExternalUrl('https://evil.example', hosts)).toBe(false);
  });
});
