import { defineConfig, globalIgnores } from "eslint/config";
import defaultConfig from "@cl/eslint-config/eslint.config.base.mjs";

export default defineConfig([
    ...defaultConfig,
    globalIgnores(['.wxt/*']),
]);