module.exports = {
  parser: "@typescript-eslint/parser",
  rules: {
    "semi": ["error", "never"],
    "max-len": ["error", { code: 120 }],
    "no-unused-vars": ["error"],
    "no-unexpected-multiline": "error",
    "comma-spacing": ["error", { before: false, after: true }]
  },
};
