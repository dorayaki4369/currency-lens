import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([".output/*", "node_modules/*", "dist/*", "build/*", ".turbo/*"]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
]);
