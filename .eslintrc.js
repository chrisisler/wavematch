export default {
  parser: '@typescript-eslint/parser',
  extends: [
    'plugin:@typescript-eslint/recommended' // Uses the recommended rules from the @typescript-eslint/eslint-plugin
  ],
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module' // Allows for the use of imports
  },
  rules: {
    // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
    // e.g. "@typescript-eslint/explicit-function-return-type": "off",
  }
}
