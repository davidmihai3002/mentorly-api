import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: { JWT_SECRET: 'e2e-only-fake-jwt-secret-not-for-real-use' },
  },
});
