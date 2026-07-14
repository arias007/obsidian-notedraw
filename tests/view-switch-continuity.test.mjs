import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("../src/notedraw-plugin.js", import.meta.url);
const stylesUrl = new URL("../styles.css", import.meta.url);

test("magic wand state follows the stable leaf across Markdown surfaces", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /this\.viewDrawingActive\s*=\s*\/\* @__PURE__ \*\/ new WeakMap\(\)/);
  assert.match(source, /this\.viewToolbarState\s*=\s*\/\* @__PURE__ \*\/ new WeakMap\(\)/);
  assert.match(source, /controllerStateKey\(controller\)\s*\{\s*const view = controller\?\.view;\s*return view\?\.leaf \|\| findOwningLeaf\(this\.app, view\?\.containerEl \|\| controller\?\.previewEl\) \|\| view \|\| controller\?\.previewEl/s);
  assert.match(source, /this\.plugin\.setControllerActivation\(this, nextActive\)/);
  assert.match(source, /candidate\.applySharedToolbarState\(next\)/);
  assert.doesNotMatch(source, /Failed to close source NoteDraw controller/);
});

test("only the active visible surface exposes body-portal controls", async () => {
  const [source, styles] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(stylesUrl, "utf8")
  ]);

  assert.match(source, /controlsShouldBeVisible\(\)/);
  assert.match(source, /activeLeaf && ownerLeaf && activeLeaf !== ownerLeaf/);
  assert.match(source, /element\?\.toggleClass\("is-notedraw-controls-visible", visible\)/);
  assert.match(styles, /\.notedraw-body-control:not\(\.is-notedraw-controls-visible\)\s*\{\s*display:\s*none !important;/s);
  assert.match(styles, /\.notedraw-body-control\.notedraw-toolbar\.is-drawing-active\.is-notedraw-controls-visible/);
});

test("toolbar mode, brush, visibility, panels, and text preset are shared", async () => {
  const source = await readFile(sourceUrl, "utf8");

  for (const field of ["brushMode", "toolMode", "drawingsVisible", "paletteOpen", "textPanelOpen", "textPreset"]) {
    assert.match(source, new RegExp(`${field}: this\\.${field}`));
  }
  assert.match(source, /brushSettings:\s*\{\s*\[BRUSH_PEN\]: \{ \.\.\.this\.brushSettings\[BRUSH_PEN\] \}/s);
  assert.match(source, /applySharedToolbarState\(state\)/);
  assert.match(source, /this\.toolMode = state\.toolMode \|\| this\.toolMode/);
  assert.doesNotMatch(source, /this\.surfaceType === "source"\) \{\s*return false;/);
});

test("magic wand short press restores drawings while long press only toggles visibility", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const nextActive = !this\.active;\s*if \(nextActive && !this\.drawingsVisible\) \{\s*this\.setDrawingsVisible\(true\)/);
  assert.match(source, /this\.buttonLongPressed = true;\s*this\.toggleDrawingsVisible\(\)/);
  assert.match(source, /toggleDrawingsVisible\(\) \{\s*this\.setDrawingsVisible\(!this\.drawingsVisible\)/);
});

test("element migration waits for a stable note lane instead of transition geometry", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /needsElementLayoutMigration\(this\.drawingData\?\.strokes\) && !isStableResponsiveCaptureFrame/);
  assert.match(source, /width >= 180 && contentWidth >= 140 && contentWidth \/ width >= 0\.42/);
});
