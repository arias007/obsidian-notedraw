# NoteDraw

NoteDraw is a plugin for editing rendered note text and drawing directly on notes.

It is built as a surface layer: the same drawing and text-edit logic works on Obsidian reading view, source view, embedded note previews, and supported webview surfaces.

## Features

- Magic-wand header button for entering NoteDraw mode.
- In-place text editing in reading view.
- Source/edit view overlay using the same command entry.
- Pen and watercolor brushes with separate default color, width, and opacity.
- Stroke selection, multi-select, movement, resize handles, and delete.
- Floating text, button-style text boxes, rectangles, straight lines, and arrows.
- Text style toggles for bold, italic, underline, and boxed text.
- Text, title, code, file, style, and shape tools are grouped under the Text panel instead of being spread across the main toolbar.
- Text and shape tools can select existing drawing elements before creating new ones.
- Text elements can be double-clicked to edit again, and text-panel style buttons apply to active rendered Markdown text when possible.
- Circular toolbar buttons sized for quick touch or mouse use.
- Palette button is disabled while select mode is active.
- Active pen and watercolor buttons use their current brush color as the button background.
- The palette has common color swatches plus an advanced color picker entry.
- Toolbar positioning stays below the Obsidian view header while scrolling.
- Lazy drawing-data loading to reduce note-open lag.
- Viewport-windowed canvas rendering with mobile pixel budgets for stable long-note performance.
- Inactive canvases stay out of the compositor, and stale view controllers are released on mode or file changes.
- Click-to-caret behavior inside active text blocks.
- Drawing data stored outside Markdown so notes stay clean.
- Public API for scripts, other plugins, and AI agents.
- Drawings made inside embedded note previews are stored against the embedded note path, so opening that note shows the same layer.
- Webview surfaces get independent drawing files, so annotations do not bleed between pages.
- Imported images, videos, files, Markdown, and HTML can be placed as floating NoteDraw elements.

## Storage

New drawing files are stored here:

```text
<vault>/.obsidian/plugins/notedraw/drawings/
```

Each note gets a JSON file derived from its vault path. NoteDraw keeps drawing data separate from Markdown text, so Markdown sync and normal editing remain predictable.

## Migration

Version `0.2.0` is the full NoteDraw rename and uses plugin id:

```text
notedraw
```

If an older local prototype folder exists, NoteDraw can read its previous drawing JSON files and copy them into the new `notedraw/drawings` folder on first access. The old files are not deleted.

## Manual Install

Copy these files into:

```text
<vault>/.obsidian/plugins/notedraw/
```

Required files:

```text
main.js
manifest.json
styles.css
```

Then enable:

```text
Settings -> Community plugins -> Installed plugins -> NoteDraw
```

## Source Build

NoteDraw now keeps source code under `src/` and builds the Obsidian runtime file at the repository root.

```bash
npm install
npm run build
```

Build output:

```text
main.js
```

The release package still uses the standard Obsidian plugin layout:

```text
main.js
manifest.json
styles.css
```

The source tree keeps `extras/` for support-code images used at build time. Release builds embed those images into `main.js`, so the installed plugin does not require separate image files.

## Settings

The settings page currently includes:

- Default pen color, width, opacity.
- Default watercolor color, width, opacity.
- UI language.
- Toolbar top offset.
- Long-press delay, tap tolerance, selection hit padding, and selected-element opacity.
- Stroke smoothing, input sampling, save compaction, and auto-save delay.
- Reset buttons for brush defaults and layout/interaction defaults.
- Debug log toggle for troubleshooting text targeting.
- Two fixed support QR codes shown from bundled assets with embedded fallback.

## Extension API

NoteDraw exposes a small API from the plugin instance:

```js
const api = app.plugins.plugins.notedraw.api;
```

For convenience, it is also exposed while the plugin is loaded:

```js
const api = window.NoteDraw;
```

Current API:

```js
api.version;
api.getActiveController();
await api.readDrawings(file);
await api.writeDrawings(file, drawingData);
api.getStoragePaths(file);
await api.replaceSelectionText(file, originalText, editedText);
await api.insertStroke(file, stroke);
```

Example: read current note drawings.

```js
const file = app.workspace.getActiveFile();
const drawings = await app.plugins.plugins.notedraw.api.readDrawings(file);
console.log(drawings.strokes.length);
```

Example: insert a stroke.

```js
const file = app.workspace.getActiveFile();
await app.plugins.plugins.notedraw.api.insertStroke(file, {
  brush: "pen",
  color: "#e53935",
  width: 3,
  opacity: 1,
  points: [
    { x: 0.2, y: 0.2 },
    { x: 0.5, y: 0.35 },
    { x: 0.7, y: 0.6 }
  ]
});
```

Example: AI-assisted text replacement.

```js
const file = app.workspace.getActiveFile();
await app.plugins.plugins.notedraw.api.replaceSelectionText(
  file,
  "old rendered text",
  "edited Markdown text"
);
```

## AI Editing

The API is intentionally plain JSON and string based so local AI agents can:

- Read drawing layers.
- Insert generated marks, highlights, or review strokes.
- Replace selected or matched text.
- Build higher-level commands such as summarize, rewrite, annotate, or highlight.

For safety, AI tools should read first, prepare a small patch, then write only the target note or drawing file.

## Web Surface Direction

NoteDraw is structured around controllers bound to visible note surfaces. That makes future support practical for:

- Obsidian reading view.
- Obsidian source/edit view.
- Obsidian Publish or web-like rendered note pages.
- External AI or browser automation that talks through the public API.

The current package focuses on the local Obsidian plugin runtime. The API and DOM controller split are the extension points for broader web support.

## Version

Current version: `3.1.37`.
