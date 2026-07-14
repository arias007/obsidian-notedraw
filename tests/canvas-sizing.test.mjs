import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCanvasBackingStore,
  calculateCanvasWindow,
  calculateQualityWindowLimit
} from "../src/canvas-sizing.mjs";

test("small documents use a single full-height canvas window", () => {
  assert.deepEqual(calculateCanvasWindow({
    documentHeight: 800,
    viewportHeight: 600
  }), {
    top: 0,
    height: 800,
    changed: true
  });
});

test("large documents render a bounded window around the viewport", () => {
  assert.deepEqual(calculateCanvasWindow({
    documentHeight: 100_000,
    viewportTop: 50_000,
    viewportHeight: 800
  }), {
    top: 49_200,
    height: 2_400,
    changed: true
  });
});

test("scrolling inside the safe buffer reuses the existing canvas", () => {
  assert.deepEqual(calculateCanvasWindow({
    documentHeight: 100_000,
    viewportTop: 50_100,
    viewportHeight: 800,
    previousTop: 49_200,
    previousHeight: 2_400
  }), {
    top: 49_200,
    height: 2_400,
    changed: false
  });
});

test("scrolling near the buffer edge recenters the canvas", () => {
  const result = calculateCanvasWindow({
    documentHeight: 100_000,
    viewportTop: 50_700,
    viewportHeight: 800,
    previousTop: 49_200,
    previousHeight: 2_400
  });

  assert.equal(result.top, 49_900);
  assert.equal(result.height, 2_400);
  assert.equal(result.changed, true);
});

test("backing stores honor DPR when they are below the budget", () => {
  assert.deepEqual(calculateCanvasBackingStore({
    cssWidth: 400,
    cssHeight: 800,
    devicePixelRatio: 3,
    maxDevicePixelRatio: 1.5,
    maxDimension: 8192,
    maxPixels: 4 * 1024 * 1024
  }), {
    width: 600,
    height: 1200,
    scale: 1.5,
    limited: true
  });
});

test("backing stores stay within the dimension and pixel limits", () => {
  const result = calculateCanvasBackingStore({
    cssWidth: 2000,
    cssHeight: 10_000,
    devicePixelRatio: 3,
    maxDevicePixelRatio: 2,
    maxDimension: 8192,
    maxPixels: 4 * 1024 * 1024
  });

  assert.ok(result.width <= 8192);
  assert.ok(result.height <= 8192);
  assert.ok(result.width * result.height <= 4 * 1024 * 1024);
  assert.equal(result.limited, true);
});

test("fractional scales never map beyond the allocated bitmap", () => {
  const cssWidth = 1234;
  const cssHeight = 4321;
  const result = calculateCanvasBackingStore({
    cssWidth,
    cssHeight,
    devicePixelRatio: 2.75,
    maxDevicePixelRatio: 2,
    maxDimension: 4096,
    maxPixels: 2 * 1024 * 1024
  });

  assert.ok(cssWidth * result.scale <= result.width);
  assert.ok(cssHeight * result.scale <= result.height);
  assert.ok(result.width * result.height <= 2 * 1024 * 1024);
});

test("window height respects a quality-driven limit below the default minimum", () => {
  const result = calculateCanvasWindow({
    documentHeight: 100_000,
    viewportTop: 50_000,
    viewportHeight: 800,
    minWindowHeight: 1024,
    maxWindowHeight: 900
  });

  assert.equal(result.height, 900);
});

test("quality window sizing preserves native mobile DPR within budget", () => {
  const cssWidth = 412;
  const viewportHeight = 915;
  const maxPixels = 6 * 1024 * 1024;
  const maxWindowHeight = calculateQualityWindowLimit({
    cssWidth,
    viewportHeight,
    devicePixelRatio: 3,
    maxDevicePixelRatio: 4,
    maxPixels
  });
  const windowed = calculateCanvasWindow({
    documentHeight: 100_000,
    viewportTop: 50_000,
    viewportHeight,
    maxWindowHeight
  });
  const backing = calculateCanvasBackingStore({
    cssWidth,
    cssHeight: windowed.height,
    devicePixelRatio: 3,
    maxDevicePixelRatio: 4,
    maxDimension: 8192,
    maxPixels
  });

  assert.equal(backing.scale, 3);
  assert.ok(backing.width * backing.height <= maxPixels);
  assert.ok(windowed.height >= viewportHeight);
});
