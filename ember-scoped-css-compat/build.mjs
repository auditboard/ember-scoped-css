/* eslint-disable  */
import * as esbuild from "esbuild";
import { vitestCleaner } from "esbuild-plugin-vitest-cleaner";
import { createRequire as topLevelCreateRequire } from "module";

const require = topLevelCreateRequire(import.meta.url);

const buildFiles = ["node/ember-classic-support.mjs"];

const external = [
  "ember-scoped-css",
  ...Object.keys(require("./package.json").dependencies),
];

// Node, CJS
await esbuild.build({
  entryPoints: buildFiles,
  bundle: true,
  outdir: "dist/cjs",
  format: "cjs",
  platform: "node",
  sourcemap: "inline",
  outExtension: { ".js": ".cjs" },
  external,
  plugins: [vitestCleaner()],
});

// Runtime
await esbuild.build({
  entryPoints: ["src/runtime/test-support.ts", "src/runtime/index.ts"],
  sourcemap: true,
  format: "esm",
  bundle: true,
  external,
  plugins: [vitestCleaner()],
  outdir: "dist/runtime",
});
