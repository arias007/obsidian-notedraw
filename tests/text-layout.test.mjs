import assert from "node:assert/strict";
import test from "node:test";

import {
  computeTextLayout,
  placeFloatingTextEditor,
  wrapTextLines
} from "../src/text-layout.mjs";

test("visible floating editors keep their text origin on the drawing anchor", () => {
  const placement = placeFloatingTextEditor({
    anchorX: 220,
    anchorY: 340,
    width: 180,
    height: 48,
    viewportWidth: 800,
    viewportHeight: 600,
    contentInsetX: 6,
    contentInsetY: 4,
    anchorVisible: true
  });

  assert.deepEqual(placement, {
    left: 214,
    top: 336,
    width: 180,
    height: 48,
    centered: false
  });
});

test("offscreen floating editors use the visible viewport center", () => {
  const placement = placeFloatingTextEditor({
    anchorX: 200,
    anchorY: -900,
    width: 200,
    height: 80,
    viewportWidth: 400,
    viewportHeight: 800,
    viewportOffsetTop: 20,
    anchorVisible: false
  });

  assert.equal(placement.left, 100);
  assert.equal(placement.top, 380);
  assert.equal(placement.centered, true);
});

test("text wrapping preserves explicit lines and contains long CJK text", () => {
  const lines = wrapTextLines("第一行很长文字\n第二行", 48, (value) => Array.from(value).length * 12);

  assert.deepEqual(lines, ["第一行很", "长文字", "第二行"]);
  assert.ok(lines.every((line) => Array.from(line).length * 12 <= 48));
});

test("multiline boxed text uses one shared layout for content and frame", () => {
  const layout = computeTextLayout({
    text: "Alpha beta gamma\n第二行文字",
    fontSize: 20,
    textWidth: 100,
    maxWidth: 140,
    padded: true,
    measureText: (value) => Array.from(value).length * 10
  });

  assert.ok(layout.lines.length >= 3);
  assert.equal(layout.contentWidth, 100);
  assert.ok(layout.contentHeight >= layout.lines.length * 25);
  assert.equal(layout.width, layout.contentWidth + layout.paddingX * 2);
  assert.equal(layout.height, layout.contentHeight + layout.paddingY * 2);
});
