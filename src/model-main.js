import "./styles.css";
import { mountFlowerField } from "./app/createFlowerFieldApp.js";
import { createModelFlowerRenderer } from "./flowers/renderers/ModelFlowerRenderer.js";

mountFlowerField({
  version: "model",
  createFlowerRenderer: createModelFlowerRenderer,
});
