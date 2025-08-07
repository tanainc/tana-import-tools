import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  // Base JS recommended rules
  js.configs.recommended,
  // TypeScript rules for source files
  {
    files: ['src/**/*.ts'],
    ignores: ['dist/**', 'node_modules/**'],
    languageOptions: {
      parser: tsParser,
      sourceType: 'module',
      ecmaVersion: 'latest',
      // Node globals for ESM TypeScript sources
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      curly: ['error', 'all'],
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      // Use the TS-aware rule and allow underscore-prefixed ignores
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // Rely on TypeScript for undefined checks in TS files
      'no-undef': 'off',
      'prefer-const': [
        'error',
        { destructuring: 'any', ignoreReadBeforeAssign: false },
      ],
    },
  },
  // Test-specific overrides
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
