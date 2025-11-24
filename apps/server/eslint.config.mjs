import defaultConfig from "@cl/eslint-config/eslint.config.base.mjs";
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    ...defaultConfig,
    globalIgnores(['.wrangler/*', 'worker-configuration.d.ts']),
]);