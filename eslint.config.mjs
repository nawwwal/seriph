import next from 'eslint-config-next';

const config = [
  // Global ignores (replaces .eslintignore, unsupported under flat config)
  {
    ignores: [
      '.next/**',
      'functions/**',
      'dist/**',
      'public/**',
      'docs/**',
      'scripts/**',
      '.vercel/**',
      'coverage/**',
      'node_modules/**',
      'next.config.ts',
      'tailwind.config.ts',
      'postcss.config.mjs',
      'eslint.config.mjs',
      '**/*.d.ts',
    ],
  },
  // Next.js (core-web-vitals + typescript) flat presets
  ...next,
  // Project rule overrides (mirrors the previous .eslintrc.cjs)
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      // New React 19 hook rules surfaced by eslint-config-next 16; keep as
      // guidance (warnings) rather than hard failures — many flagged sites are
      // intentional SSR-hydration / init-from-storage patterns.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
];

export default config;
