module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: ['@typescript-eslint', '@typescript-eslint/tslint'],
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module', // Allows for the use of imports
    project: './tsconfig.json',
  },
  rules: {
    'implicit-arrow-linebreak': 'error',
    // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
    // e.g. "@typescript-eslint/explicit-function-return-type": "off",
    '@typescript-eslint/tslint/config': [
      'error',
      {
        lintFile: './tslint.json', // path to tslint.json of your project
      },
    ],
  },
}
