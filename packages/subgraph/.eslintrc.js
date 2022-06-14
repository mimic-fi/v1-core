module.exports = {
  parser: "@typescript-eslint/parser",
  rules: {
    "semi": "off",
    "max-len": ["error", { code: 120 }],
    "no-unused-vars": ["error"],
    "comma-spacing": ["error", { before: false, after: true }]
  },
};
