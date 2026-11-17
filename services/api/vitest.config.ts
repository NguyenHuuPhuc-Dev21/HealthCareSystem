import { defineConfig } from 'vitest/config';

// Vitest defaults, plus test/setup-env.ts (loads DATABASE_URL from services/api/.env when it is not set).
export default defineConfig({
  test: {
    setupFiles: ['./test/setup-env.ts'],
  },
});
