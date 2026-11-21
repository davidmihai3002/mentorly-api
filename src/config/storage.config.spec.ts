import { getStorageConfig } from './storage.config.js';

const storageVariables = {
  S3_ENDPOINT: 'https://storage.example.com',
  S3_REGION: 'eu-central-1',
  S3_BUCKET: 'mentorly-uploads',
  S3_ACCESS_KEY_ID: 'unit-test-only-fake-access-key-id',
  S3_SECRET_ACCESS_KEY: 'unit-test-only-fake-secret-access-key',
};

describe('getStorageConfig', () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(storageVariables)) {
      vi.stubEnv(name, value);
    }
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each(Object.keys(storageVariables))(
    'fails naming %s when it is missing',
    (missingVariable) => {
      vi.stubEnv(missingVariable, undefined);

      expect(() => getStorageConfig()).toThrow(missingVariable);
    },
  );

  it('fails naming a variable that is set but empty', () => {
    vi.stubEnv('S3_BUCKET', '');

    expect(() => getStorageConfig()).toThrow('S3_BUCKET');
  });

  it('returns all five storage variables', () => {
    expect(getStorageConfig()).toStrictEqual({
      endpoint: 'https://storage.example.com',
      region: 'eu-central-1',
      bucket: 'mentorly-uploads',
      accessKeyId: 'unit-test-only-fake-access-key-id',
      secretAccessKey: 'unit-test-only-fake-secret-access-key',
    });
  });
});
