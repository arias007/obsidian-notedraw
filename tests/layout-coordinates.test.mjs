import assert from "node:assert/strict";
import test from "node:test";

import {
  RESPONSIVE_POINT_BASIS,
  createResponsivePoint,
  normalizeResponsiveAnchor,
  projectResponsivePoint
} from "../src/layout-coordinates.mjs";

test("content-relative x follows the Markdown lane from desktop to mobile", () => {
  const point = createResponsivePoint({
    canvasX: 540,
    canvasY: 600,
    canvasWidth: 1440,
    canvasHeight: 2400,
    frame: { left: 360, width: 720 },
    sourcePath: "Notes/example.md"
  });

  assert.equal(point.anchor.basis, RESPONSIVE_POINT_BASIS);
  assert.equal(point.anchor.x, 0.25);

  const projected = projectResponsivePoint(point, {
    canvasWidth: 392,
    canvasHeight: 1800,
    frame: { left: 16, width: 360 }
  });

  assert.ok(Math.abs(projected.x * 392 - 106) < 0.001);
  assert.ok(Math.abs(projected.y - 0.25) < 0.001);
});

test("Markdown line anchors override incompatible reading and source heights", () => {
  const point = createResponsivePoint({
    canvasX: 200,
    canvasY: 1200,
    canvasWidth: 800,
    canvasHeight: 4000,
    frame: { left: 100, width: 600 },
    sourcePath: "Notes/example.md",
    linePosition: 18.5
  });

  const projected = projectResponsivePoint(point, {
    canvasWidth: 700,
    canvasHeight: 2200,
    frame: { left: 50, width: 600 },
    lineToCanvasY: (path, line) => path === "Notes/example.md" && line === 18.5 ? 480 : NaN
  });

  assert.ok(Math.abs(projected.y * 2200 - 480) < 0.001);
});

test("legacy points remain valid when no responsive anchor exists", () => {
  const projected = projectResponsivePoint({ x: 0.4, y: 0.6, t: 1 }, {
    canvasWidth: 400,
    canvasHeight: 800,
    frame: { left: 20, width: 360 }
  });

  assert.deepEqual(projected, { x: 0.4, y: 0.6, t: 1 });
});

test("malformed anchors are normalized without escaping the supported lane", () => {
  assert.deepEqual(normalizeResponsiveAnchor({
    basis: RESPONSIVE_POINT_BASIS,
    x: 9,
    y: -2,
    path: 12,
    line: -1
  }), {
    v: 1,
    basis: RESPONSIVE_POINT_BASIS,
    x: 2,
    y: 0,
    path: "",
    line: null
  });
});

test("missing line anchors remain null instead of becoming line zero", () => {
  const point = createResponsivePoint({
    canvasX: 200,
    canvasY: 600,
    canvasWidth: 400,
    canvasHeight: 1000,
    frame: { left: 20, width: 360 },
    sourcePath: "Notes/example.md",
    linePosition: null
  });

  assert.equal(point.anchor.line, null);
  assert.equal(normalizeResponsiveAnchor(point.anchor).line, null);

  const projected = projectResponsivePoint(point, {
    canvasWidth: 400,
    canvasHeight: 1000,
    frame: { left: 20, width: 360 },
    lineToCanvasY: () => 20
  });

  assert.equal(projected.y, 0.6);
});

test("legacy false line-zero anchors do not jump from the middle to the top", () => {
  const projected = projectResponsivePoint({
    x: 0.5,
    y: 0.6,
    anchor: {
      basis: RESPONSIVE_POINT_BASIS,
      x: 0.5,
      y: 0.6,
      path: "Notes/example.md",
      line: 0
    }
  }, {
    canvasWidth: 400,
    canvasHeight: 1000,
    frame: { left: 20, width: 360 },
    lineToCanvasY: () => 20
  });

  assert.equal(projected.y, 0.6);
});

test("legacy false line-zero anchors stay relative even when a short view makes line zero look nearby", () => {
  const projected = projectResponsivePoint({
    x: 0.5,
    y: 0.18,
    anchor: {
      basis: RESPONSIVE_POINT_BASIS,
      x: 0.5,
      y: 0.18,
      path: "Notes/example.md",
      line: 0
    }
  }, {
    canvasWidth: 400,
    canvasHeight: 1000,
    frame: { left: 20, width: 360 },
    lineToCanvasY: () => 175
  });

  assert.equal(projected.y, 0.18);
});

test("real first-line anchors still follow the first rendered line", () => {
  const projected = projectResponsivePoint({
    x: 0.5,
    y: 0.03,
    anchor: {
      basis: RESPONSIVE_POINT_BASIS,
      x: 0.5,
      y: 0.03,
      path: "Notes/example.md",
      line: 0
    }
  }, {
    canvasWidth: 400,
    canvasHeight: 1000,
    frame: { left: 20, width: 360 },
    lineToCanvasY: () => 20
  });

  assert.equal(projected.y, 0.02);
});

test("legacy fractional first-line anchors cannot pull middle-page elements together", () => {
  const projected = projectResponsivePoint({
    x: 0.5,
    y: 0.45,
    anchor: {
      basis: RESPONSIVE_POINT_BASIS,
      x: 0.5,
      y: 0.45,
      path: "Notes/example.md",
      line: 0.999999
    }
  }, {
    canvasWidth: 400,
    canvasHeight: 3000,
    frame: { left: 20, width: 360 },
    lineToCanvasY: () => 1700
  });

  assert.equal(projected.y, 0.45);
});
