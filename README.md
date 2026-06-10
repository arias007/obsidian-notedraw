# Note Doodle Preview

Obsidian prototype plugin for editing rendered text and drawing directly in reading preview.

## What it does

- Adds a magic-wand button to the Obsidian view header beside the official view controls.
- Click the button to enter preview edit/doodle mode.
- Tap rendered text blocks to edit them in place.
- Text edits are saved back to the current Markdown file with a short debounce.
- Drag in preview space, including over text, to draw a continuous doodle stroke.
- Tap an existing doodle stroke to select it; selected strokes render semi-transparent and can be deleted.
- Drag inside the selected stroke frame to move that doodle instead of drawing a new stroke.
- Two-finger scroll still scrolls the note while doodle mode is active.
- Doodles are stored under this plugin folder:

```text
.obsidian/plugins/note-doodle-preview/doodles/
```

## Prototype limits

- Text editing is intentionally conservative. It supports common rendered blocks such as headings, paragraphs, list items, blockquotes, table cells, and callout content.
- It skips code blocks, embeds, images, links, canvases, and plugin UI.
- Text replacement uses the rendered block text and searches for the closest matching Markdown source block. This is good for a prototype, but a production plugin should use stronger source-position mapping.
- Doodle coordinates are stored as normalized page coordinates so they can roughly scale with the preview container.
- Doodle drawing is an overlay. It does not become part of the Markdown body.
- Version 0.1.6 smooths doodle strokes by using coalesced pointer samples, inserting intermediate points, and treating tap-on-text as edit while drag-on-text remains drawing.
- Version 0.1.7 makes selected doodles semi-transparent and forwards two-finger scrolling to the preview.
- Version 0.1.8 makes drags from the selected frame move the selected doodle instead of creating a new stroke.
- Version 0.1.9 moves the mode button into the Obsidian view header and changes it to a magic-wand icon.

## Manual install

Copy this folder to:

```text
<your-vault>/.obsidian/plugins/note-doodle-preview/
```

Then enable it in Obsidian:

```text
Settings -> Community plugins -> Installed plugins -> Note Doodle Preview
```
