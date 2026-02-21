import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

export default defineConfig([
  globalIgnores([".output/*", "node_modules/*", "dist/*", "build/*", ".turbo/*"]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    rules: {
      "sonarjs/cognitive-complexity": ["error", 7],
    },
  },
]);
