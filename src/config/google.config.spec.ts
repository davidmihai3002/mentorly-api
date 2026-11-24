import { getGoogleClientId } from './google.config.js';

describe('getGoogleClientId', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('fails when GOOGLE_CLIENT_ID is missing', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', undefined);

    expect(() => getGoogleClientId()).toThrow('GOOGLE_CLIENT_ID');
  });

  it('returns GOOGLE_CLIENT_ID when it is set', () => {
    const clientId = 'unit-test-only.apps.googleusercontent.com';
    vi.stubEnv('GOOGLE_CLIENT_ID', clientId);

    expect(getGoogleClientId()).toBe(clientId);
  });
});
