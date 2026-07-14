import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/notedraw-plugin.js", import.meta.url);
const stylesUrl = new URL("../styles.css", import.meta.url);

test("canvas layers stay hidden until their backing stores are initialized", async () => {
  const [source, styles] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(stylesUrl, "utf8")
  ]);

  assert.match(styles, /\.notedraw-static-canvas,\s*\.notedraw-canvas\s*\{[^}]*display:\s*none;/s);
  assert.match(styles, /\.notedraw-shell\.has-notedraw-canvas \.notedraw-static-canvas,[^}]*\.is-drawing-active \.notedraw-canvas\s*\{[^}]*display:\s*block;/s);
  assert.match(source, /this\.previewEl\.addClass\("has-notedraw-canvas"\)/);
  assert.match(source, /resetCanvasSurface\(\)\s*\{[^}]*removeClass\("has-notedraw-canvas"\)/s);
  assert.match(source, /this\.staticCanvas\.width = 1;\s*this\.staticCanvas\.height = 1;/s);
  assert.match(source, /this\.canvas\.width = 1;\s*this\.canvas\.height = 1;/s);
});

test("source mode releases cached reading controllers", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /if \(isSourceMode\(view\)\) \{\s*previewController\?\.destroy\(\);\s*continue;/s);
  assert.match(source, /previewController\.file\?\.path !== view\.file\?\.path/s);
  assert.match(source, /previewController = this\.resolveLivePreviewController\(view\)/);
});
