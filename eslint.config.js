// ESLint 9 flat config (CR-GC-512). Lints the TypeScript sources with the
// typescript-eslint recommended rule set; build output is excluded.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // The codebase's own convention for a deliberately unused name: a leading
      // underscore (a signature parameter the implementation does not need, or a
      // key dropped from an object via rest destructuring). Everything else that
      // is unused is dead code and stays an error.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
);
