import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Isolated in-memory DB + mock LLM so tests are fast and deterministic.
    // Shared-cache so the migrator and queries see the same in-memory tables.
    env: { DATABASE_URL: 'file::memory:?cache=shared', LLM_PROVIDER: 'mock' },
  },
});
