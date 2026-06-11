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
- Version 0.1.12 keeps the 0.1.9 drawing path and prevents duplicate magic-wand buttons when multiple notes or embedded previews render.
- Version 0.1.13 shows the header button only in reading view, refreshes the canvas after layout settles, moves the toolbar under the header button, enlarges toolbar icons, adds multi-select mode, and replaces the inline color control with a palette panel for color, width, opacity, and pen count.
- Version 0.1.14 adds separate pen and watercolor brush buttons with isolated palette settings, enlarges toolbar icons without changing button size, and lets a tap inside a multi-selection frame switch back to a single selected stroke.
- Version 0.1.15 keeps the toolbar right-aligned under the header action and enlarges toolbar icons again while keeping the button boxes at the same size.
- Version 0.1.17 keeps the 0.1.15 toolbar/icon baseline and restores the 0.1.12 magic-wand display/binding logic to avoid the header action disappearing.
- Version 0.1.18 keeps the toolbar right-aligned, reduces toolbar icons to 26px, places the text-edit caret near the tap position, and adds a source/edit view doodle overlay behind the same magic-wand action.
- Version 0.1.19 adds corner handles for resizing selected doodles, anchors the toolbar to the right side of the current note view when the magic-wand header position is unstable, and throttles drawing redraws to reduce lag on large doodle files.
- Version 0.1.20 pins the toolbar to the current note view's right edge, softens toolbar icon strokes, makes the watercolor active state clearer, and changes watercolor rendering to centered translucent layers instead of offset multi-pen strokes.
- Version 0.1.21 keeps one stable magic-wand header button per note view across reading/source switches, adds a static doodle render cache for smoother drawing, and restyles the toolbar as a lighter Obsidian-style icon strip.
- Version 0.1.22 adds the same two packaged support QR codes used by the user's other plugins to the plugin settings page.

## Manual install

Copy this folder to:

```text
<your-vault>/.obsidian/plugins/note-doodle-preview/
```

Then enable it in Obsidian:

```text
Settings -> Community plugins -> Installed plugins -> Note Doodle Preview
```
