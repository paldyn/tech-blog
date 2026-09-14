import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['.astro/**', 'dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['src/**/*.{astro,ts}'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // TypeScript resolves names and types more accurately than ESLint's base rule.
      'no-undef': 'off',
    },
  },
  {
    files: ['*.{js,mjs}', 'scripts/**/*.{js,mjs}', 'src/**/*.test.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    // Existing inline scripts intentionally use ES5 syntax for early boot and broad
    // browser compatibility. Keep that legacy style scoped to those virtual files.
    files: [
      'src/components/Header.astro',
      'src/components/ScrollTopButton.astro',
      'src/components/ThemeToggle.astro',
      'src/layouts/BaseLayout.astro',
      'src/components/Header.astro/*.ts',
      'src/components/ScrollTopButton.astro/*.ts',
      'src/components/ThemeToggle.astro/*.ts',
      'src/layouts/BaseLayout.astro/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': 'off',
      'no-var': 'off',
    },
  },
  {
    // Pre-existing audit helpers retain dormant checks used during content reviews.
    files: [
      'scripts/audit-svgs.mjs',
      'scripts/validate-posts.mjs',
      'src/components/FeaturedPost.astro',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
