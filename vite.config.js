import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  appType: "mpa",
  // This repository is published as https://<owner>.github.io/memory-garden/.
  // Vite rewrites generated JS/CSS URLs against this project-site base.
  base: "/memory-garden/",
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
