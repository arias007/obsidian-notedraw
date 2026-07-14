import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/notedraw-plugin.js", import.meta.url);
const manifestUrl = new URL("../manifest.json", import.meta.url);
const stylesUrl = new URL("../styles.css", import.meta.url);

test("embedded Markdown edits resolve and save against the referenced file", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /resolveRenderedSourcePath\(this\.app, el, ctx\.sourcePath\)/);
  assert.match(source, /element\.dataset\.noteDrawSourcePath = normalizeVaultPath\(sourcePath\)/);
  assert.match(source, /const editsEmbeddedFile = Boolean\(editableFile\?\.path && editableFile\.path !== this\.file\?\.path\)/);
  assert.match(source, /prepareTextEditState\(this\.currentEditorFile, element\.innerText, element\)/);
  assert.match(source, /scheduleTextSaveNow\(this\.currentEditorFile \|\| this\.file/);
});

test("the stable v1 API exposes Cancip-friendly capabilities and events", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /apiVersion: "1\.0"/);
  assert.match(source, /embeddedMarkdownEditing: true/);
  assert.match(source, /responsiveCoordinates: RESPONSIVE_POINT_BASIS/);
  assert.match(source, /responsiveElements: ELEMENT_LAYOUT_BASIS/);
  assert.match(source, /replaceText: async \(options\) => this\.replaceTextApi\(options\)/);
  assert.match(source, /on: \(eventName, listener\) => this\.onApiEvent\(eventName, listener\)/);
});

test("3.1.45 projects version-three element frames behind a layout signature", async () => {
  const [source, manifestText] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(manifestUrl, "utf8")
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.version, "3.1.45");
  assert.match(source, /version: "3\.1\.45"/);
  assert.match(source, /if \(!this\.responsivePointsInitialized \|\| signature !== this\.responsiveLayoutSignature\)/);
  assert.match(source, /migratedDrawingData\.version = Math\.max\(3/);
  assert.match(source, /captureElementLayoutForStroke/);
  assert.match(source, /projectElementPoints\(stroke\.points, layout, box/);
  assert.match(source, /stabilizeElementRelations\(projected, layoutsById\)/);
  assert.match(source, /elementLayoutNeedsRepair\(existingLayout\)/);
  assert.match(source, /normalizeDrawingDataForStorage\(this\.drawingData, this\.file\)/);
  assert.match(source, /scheduleDrawingSave\(this\.file, migratedDrawingData, \{ excludeData: this\.drawingData \}\)/);
  assert.match(source, /for \(const controller of this\.liveControllers\) \{\s*controller\.syncFloatingControlClasses\(\);\s*controller\.scheduleLayoutRefresh\(\)/);
  assert.match(source, /generation === this\.layoutRefreshGeneration/);
});

test("reading and source controllers share the latest in-memory drawing state", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const cached = this\.drawingStateCache\.get\(path\);\s*if \(cached\) \{\s*return normalizeDrawingData\(cached, file\)/);
  assert.match(source, /const canonical = normalizeDrawingDataForStorage\(data, file\);\s*this\.drawingStateCache\.set\(path, canonical\);\s*this\.pendingDrawingSaves\.set\(path, file\);\s*this\.refreshControllersForFile\(file, canonical, \{ excludeData: options\.excludeData \|\| data \}\)/);
  assert.match(source, /writeDrawings\(file, compacted, \{ refresh: false, updateCache: false \}\)/);
  assert.match(source, /this\.plugin\.setControllerActivation\(this, nextActive\)/);
  assert.match(source, /this\.textPanel = createNoteDrawControlElement\(this\.floatingControlsHost, "notedraw-text-panel"\)/);
  assert.doesNotMatch(source, /if \(this\.surfaceType !== "source"\) \{\s*this\.textButton/);
});

test("body-level controls are hidden outside the active note surface and behind settings", async () => {
  const [source, styles] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(stylesUrl, "utf8")
  ]);

  assert.match(source, /controlsShouldBeVisible\(\)/);
  assert.match(source, /isBlockingObsidianOverlayOpen\(activeDocument\)/);
  assert.match(source, /activeLeaf && ownerLeaf && activeLeaf !== ownerLeaf/);
  assert.match(source, /element\?\.toggleClass\("is-notedraw-controls-visible", visible\)/);
  assert.match(styles, /notedraw-body-control\.notedraw-toolbar\.is-drawing-active\.is-notedraw-controls-visible/);
  assert.match(styles, /notedraw-body-control\.notedraw-format-toolbar\.is-notedraw-controls-visible\.is-visible/);
});

test("declared minimum Obsidian version uses compatible APIs and CSS", async () => {
  const [source, styles, manifestText] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
    readFile(manifestUrl, "utf8")
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.minAppVersion, "1.5.0");
  assert.doesNotMatch(source, /getFileByPath/);
  assert.doesNotMatch(source, /globalThis/);
  assert.match(source, /getAbstractFileByPath/);
  assert.doesNotMatch(styles, /scrollbar-width/);
  assert.doesNotMatch(styles, /::-webkit-scrollbar/);
});

test("floating text editing keeps one anchor and survives multiline IME input", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const editorDocument = this\.canvas\?\.ownerDocument/);
  assert.match(source, /editorDocument\.body\.createEl\("textarea"/);
  assert.match(source, /editorWindow\.visualViewport\?\.addEventListener\("resize", resize\)/);
  assert.match(source, /isRichTextStroke\(preset\) && Number\(preset\.previewWidth\) > 0/);
  assert.match(source, /this\.openFloatingTextInput\(stroke\.points\[0\], index\)/);
  assert.match(source, /textarea\.addEventListener\("compositionstart"/);
  assert.match(source, /textarea\.addEventListener\("compositionend"/);
  assert.match(source, /stroke\.textWidth = this\.floatingTextContentWidth/);
  assert.match(source, /layout\.lines\.forEach/);
});
