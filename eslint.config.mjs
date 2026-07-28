import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // Ignore build output, dependencies, static assets and config files.
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'packages/client/public/**',
      '**/*.config.js',
      '**/*.config.cjs',
      '**/*.config.mjs',
      '**/*.config.ts',
    ],
  },

  // Base recommended rule sets (non type-checked variant).
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Shared rule tuning across all TypeScript sources.
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Allow intentional unused values when explicitly prefixed with `_`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Browser environment + React Hooks rules for the client app.
  {
    files: ['packages/client/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // Node environment for the server package.
  {
    files: ['packages/server/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // GitHub Action runner uses Node's CommonJS module format.
  {
    files: ['action/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
