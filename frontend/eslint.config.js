import js from "@eslint/js";
import lit from "eslint-plugin-lit";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", ".preview", "../custom_components"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  lit.configs["flat/recommended"],
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.js", "scripts/*.mjs"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    files: ["eslint.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["scripts/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
  },
);
