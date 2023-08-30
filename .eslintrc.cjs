module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'unused-imports'],
  extends: [
    // 'eslint:recommended',
    // 'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 1,
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksVoidReturn: false,
      },
    ],
    'unused-imports/no-unused-imports-ts': 1,
    'no-shadow': 1,
    'no-dupe-else-if': 1,
    'no-dupe-keys': 1,
    'no-duplicate-imports': 1,
    'no-self-compare': 1,
    'no-self-assign': 1,
    'no-unreachable': 1,
  },
};
