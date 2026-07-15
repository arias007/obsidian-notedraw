import test from "node:test";
import assert from "node:assert/strict";
import {
  SELECTED_DRAW_GESTURE_DRAW_OR_DESELECT,
  SELECTED_DRAW_GESTURE_MANIPULATE,
  resolveSelectedDrawGesture
} from "../src/selection-draw-gesture.mjs";

test("a blank gesture with a selected element defers to draw-or-deselect", () => {
  assert.equal(resolveSelectedDrawGesture({
    toolMode: "draw",
    hasSelection: true,
    hitStrokeIndex: -1,
    insideSelectionFrame: false
  }), SELECTED_DRAW_GESTURE_DRAW_OR_DESELECT);
});

test("a gesture on an element manipulates while draw mode already has a selection", () => {
  assert.equal(resolveSelectedDrawGesture({
    toolMode: "draw",
    hasSelection: true,
    hitStrokeIndex: 4,
    insideSelectionFrame: false
  }), SELECTED_DRAW_GESTURE_MANIPULATE);
  assert.equal(resolveSelectedDrawGesture({
    toolMode: "draw",
    hasSelection: true,
    hitStrokeIndex: -1,
    insideSelectionFrame: true
  }), SELECTED_DRAW_GESTURE_MANIPULATE);
});

test("selection-lasso mode and ordinary drawing keep their existing gestures", () => {
  assert.equal(resolveSelectedDrawGesture({
    toolMode: "select",
    hasSelection: true,
    hitStrokeIndex: -1
  }), null);
  assert.equal(resolveSelectedDrawGesture({
    toolMode: "draw",
    hasSelection: false,
    hitStrokeIndex: 2
  }), null);
});
