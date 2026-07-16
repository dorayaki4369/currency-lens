import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));

export default {
  base: "./",
  build: {
    emptyOutDir: true,
    outDir: ".output",
    rollupOptions: {
      input: {
        conversion: resolve(root, "conversion.html"),
        popup: resolve(root, "popup.html"),
      },
    },
  },
  envDir: false,
  root,
};
