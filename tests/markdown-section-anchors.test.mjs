import test from "node:test";
import assert from "node:assert/strict";
import { buildVirtualMarkdownSectionAnchors } from "../src/markdown-section-anchors.mjs";

test("virtualized reading sections retain Markdown line positions below a tall embed", () => {
  const anchors = buildVirtualMarkdownSectionAnchors([
    { startLine: 0, endLine: 0, height: 50, measuredTop: 32, excluded: true },
    { startLine: 0, endLine: 0, height: 38, measuredTop: 82 },
    { startLine: 1, endLine: 1, height: 1669, measuredTop: 120 },
    { startLine: 3, endLine: 3, height: 29, measuredTop: 1789 },
    { startLine: 4, endLine: 4, height: 38 },
    { startLine: 5, endLine: 5, height: 80 },
    { startLine: 6, endLine: 6, height: 38 },
    { startLine: 7, endLine: 7, height: 58 }
  ], {
    baseTop: 0,
    left: 32,
    right: 473,
    path: "Notes/example.md"
  });

  const lineFive = anchors.find((anchor) => anchor.start === 5);
  const lineSeven = anchors.find((anchor) => anchor.start === 7);
  assert.equal(lineFive.top, 1856);
  assert.equal(lineSeven.top, 1974);
  assert.equal(lineSeven.bottom, 2032);
  assert.equal(lineSeven.path, "Notes/example.md");
  assert.equal(lineSeven.virtual, true);
});

test("later measured sections recalibrate virtual cumulative height", () => {
  const anchors = buildVirtualMarkdownSectionAnchors([
    { startLine: 0, endLine: 0, height: 40 },
    { startLine: 1, endLine: 1, height: 60, measuredTop: 100 },
    { startLine: 2, endLine: 2, height: 30 }
  ], { baseTop: 10, path: "Notes/example.md" });

  assert.equal(anchors[0].top, 70);
  assert.equal(anchors[1].top, 110);
  assert.equal(anchors[2].top, 170);
});
