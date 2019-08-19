module.exports = {
  env: {
    node: true,
    commonjs: true,
    es6: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 2018
  },
  rules: {
    'prefer-const': 'error',
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never'
    }]
  }
}
