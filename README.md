# NoteDraw

NoteDraw is an Obsidian plugin for editing rendered note text and drawing directly on notes.

It is built as a note-surface layer: the same drawing and text-edit logic can be reused on Obsidian reading view, source view, and future Obsidian web surfaces.

## Features

- Magic-wand header button for entering NoteDraw mode.
- In-place text editing in reading view.
- Source/edit view overlay using the same command entry.
- Pen and watercolor brushes with separate default color, width, and opacity.
- Stroke selection, multi-select, movement, resize handles, and delete.
- Circular toolbar buttons sized for quick touch or mouse use.
- Palette button is disabled while select mode is active.
- Lazy drawing-data loading to reduce note-open lag.
- Click-to-caret behavior inside active text blocks.
- Drawing data stored outside Markdown so notes stay clean.
- Public API for scripts, other plugins, and AI agents.

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
README.md
extras/
```

Then enable:

```text
Settings -> Community plugins -> Installed plugins -> NoteDraw
```

## Settings

The settings page currently includes:

- Default pen color, width, opacity.
- Default watercolor color, width, opacity.
- Toolbar top offset.
- Debug log toggle for troubleshooting text targeting.

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

Current version: `0.2.0`.
