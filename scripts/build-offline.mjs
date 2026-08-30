import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const temporaryBuildDirectory = path.join(projectRoot, ".offline-build");
const offlineHtmlPath = path.join(projectRoot, "紫金草花田-离线版.html");
const flowerModelPath = path.join(
  projectRoot,
  "public",
  "assets",
  "flowers",
  "zijincao.glb",
);
const flowerModelUrl = "/assets/flowers/zijincao.glb";

function resolveBuildAsset(assetUrl) {
  const relativeAssetPath = decodeURIComponent(assetUrl).replace(/^\.\//, "");
  const resolvedAssetPath = path.resolve(temporaryBuildDirectory, relativeAssetPath);
  const buildRoot = `${path.resolve(temporaryBuildDirectory)}${path.sep}`;

  if (!resolvedAssetPath.startsWith(buildRoot)) {
    throw new Error(`Refusing to read an asset outside the offline build: ${assetUrl}`);
  }

  return resolvedAssetPath;
}

function protectInlineClosingTags(source, tagName) {
  return source.replace(
    new RegExp(`</${tagName}`, "gi"),
    `<\\/${tagName}`,
  );
}

async function createOfflineHtml() {
  await build({
    root: projectRoot,
    configFile: false,
    base: "./",
    build: {
      outDir: temporaryBuildDirectory,
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: 100_000_000,
    },
  });

  const builtIndexPath = path.join(temporaryBuildDirectory, "index.html");
  let html = await readFile(builtIndexPath, "utf8");
  const moduleScriptPattern =
    /<script\b[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/i;
  const moduleScriptMatch = html.match(moduleScriptPattern);

  if (!moduleScriptMatch) {
    throw new Error("The Vite build did not emit a module script to inline.");
  }

  let bundledJavaScript = protectInlineClosingTags(
    await readFile(resolveBuildAsset(moduleScriptMatch[1]), "utf8"),
    "script",
  );
  if (!bundledJavaScript.includes(flowerModelUrl)) {
    throw new Error("The flower model URL was not found in the generated bundle.");
  }
  const embeddedFlowerModel = `data:model/gltf-binary;base64,${(
    await readFile(flowerModelPath)
  ).toString("base64")}`;
  bundledJavaScript = bundledJavaScript.replaceAll(
    flowerModelUrl,
    embeddedFlowerModel,
  );
  // The offline page uses a classic inline script so file:// does not trigger
  // module-origin restrictions. Compile it without executing to verify that
  // the generated bundle is valid in that delivery model.
  new Function(bundledJavaScript);
  html = html.replace(moduleScriptPattern, `<script>${bundledJavaScript}</script>`);

  const stylesheetPattern =
    /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/gi;
  const stylesheetMatches = [...html.matchAll(stylesheetPattern)];

  for (const stylesheetMatch of stylesheetMatches) {
    const bundledCss = protectInlineClosingTags(
      await readFile(resolveBuildAsset(stylesheetMatch[1]), "utf8"),
      "style",
    );
    html = html.replace(stylesheetMatch[0], `<style>${bundledCss}</style>`);
  }

  html = html.replace(
    "</head>",
    "  <!-- 单文件离线版：可以直接双击打开，不需要本地服务器。 -->\n  </head>",
  );

  const forbiddenExternalReferences = [
    /<script\b[^>]*\bsrc=/i,
    /<link\b[^>]*\brel="stylesheet"/i,
    /<img\b[^>]*\bsrc=/i,
    /\btype="module"/i,
    /\bimport\.meta\b/i,
  ];

  if (forbiddenExternalReferences.some((pattern) => pattern.test(html))) {
    throw new Error("The generated offline page still contains an external dependency.");
  }

  await writeFile(offlineHtmlPath, html, "utf8");
}

try {
  await createOfflineHtml();
  console.log(`Offline HTML created: ${offlineHtmlPath}`);
} finally {
  const resolvedTemporaryDirectory = path.resolve(temporaryBuildDirectory);
  const projectRootPrefix = `${path.resolve(projectRoot)}${path.sep}`;

  if (!resolvedTemporaryDirectory.startsWith(projectRootPrefix)) {
    throw new Error("Refusing to remove a temporary directory outside the project.");
  }

  await rm(resolvedTemporaryDirectory, { recursive: true, force: true });
}
