import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Root app tests only; the functions package has its own vitest config
    // and is exercised via `npm test --prefix functions`.
    include: ['tests/**/*.test.ts'],
    exclude: ['functions/**', 'node_modules/**', '.next/**'],
  },
  resolve: {
    alias: {
      // Mirrors tsconfig "@/*" -> "./*" (project root)
      '@': path.resolve(__dirname),
    },
  },
});
