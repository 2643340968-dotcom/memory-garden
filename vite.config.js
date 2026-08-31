import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  appType: "mpa",
  build: {
    rolldownOptions: {
      input: {
        index: resolve(projectRoot, "index.html"),
        model: resolve(projectRoot, "model.html"),
        png: resolve(projectRoot, "png.html"),
      },
    },
  },
});
