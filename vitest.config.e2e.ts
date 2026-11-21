import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      JWT_SECRET: 'e2e-only-fake-jwt-secret-not-for-real-use',
      S3_ENDPOINT: 'https://storage.example.com',
      S3_REGION: 'eu-central-1',
      S3_BUCKET: 'e2e-only-fake-bucket',
      S3_ACCESS_KEY_ID: 'e2e-only-fake-access-key-id',
      S3_SECRET_ACCESS_KEY: 'e2e-only-fake-secret-access-key',
    },
  },
});
