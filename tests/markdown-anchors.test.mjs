import test from "node:test";
import assert from "node:assert/strict";
import { matchRenderedTextToMarkdown } from "../src/markdown-anchors.mjs";

test("rendered embed text matches a single Markdown line expanded by br tags", () => {
  const source = "第一段<br><br>第二段<br>第三段";
  const match = matchRenderedTextToMarkdown(source, "第一段\n第二段\n第三段");

  assert.deepEqual(match, { lineStart: 0, lineEnd: 0, confidence: 1 });
});

test("rendered headings and list items map to their Markdown source lines", () => {
  const source = [
    "# 标题",
    "",
    "- 第一项",
    "- 第二项"
  ].join("\n");

  assert.deepEqual(matchRenderedTextToMarkdown(source, "标题"), {
    lineStart: 0,
    lineEnd: 0,
    confidence: 1
  });
  assert.deepEqual(matchRenderedTextToMarkdown(source, "第二项"), {
    lineStart: 3,
    lineEnd: 3,
    confidence: 1
  });
});

test("a rendered multi-line block keeps the full source line range", () => {
  const source = "第一行\n第二行\n第三行";
  const match = matchRenderedTextToMarkdown(source, "第一行\n第二行\n第三行");

  assert.deepEqual(match, { lineStart: 0, lineEnd: 2, confidence: 1 });
});

test("unrelated rendered text does not create a false Markdown anchor", () => {
  assert.equal(matchRenderedTextToMarkdown("原始内容", "完全无关的内容"), null);
});
