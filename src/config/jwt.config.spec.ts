import { getJwtSecret } from './jwt.config.js';

describe('getJwtSecret', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ['missing', undefined],
    ['shorter than 32 characters', 'a'.repeat(31)],
  ])('fails when JWT_SECRET is %s', (_problem, jwtSecret) => {
    vi.stubEnv('JWT_SECRET', jwtSecret);

    expect(() => getJwtSecret()).toThrow('JWT_SECRET');
  });

  it('returns JWT_SECRET when it has at least 32 characters', () => {
    const validSecret = 'a'.repeat(32);
    vi.stubEnv('JWT_SECRET', validSecret);

    expect(getJwtSecret()).toBe(validSecret);
  });
});
