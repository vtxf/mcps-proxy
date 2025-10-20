module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
    },
    plugins: ["@typescript-eslint"],
    extends: [
        "eslint:recommended",
        "@typescript-eslint/recommended",
        "prettier",
    ],
    rules: {
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-non-null-assertion": "warn",
        "@typescript-eslint/prefer-nullish-coalescing": "error",
        "@typescript-eslint/prefer-optional-chain": "error",
        "prefer-const": "error",
        "no-var": "error",
    },
    env: {
        node: true,
        es2022: true,
    },
    ignorePatterns: ["dist/", "node_modules/", "*.js"],
};