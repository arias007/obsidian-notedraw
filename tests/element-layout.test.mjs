import test from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENT_LAYOUT_BASIS,
  captureElementRelations,
  createElementLayout,
  normalizeElementLayout,
  projectElementLayout,
  projectElementPoints,
  scaleElementMetrics,
  stabilizeElementRelations
} from "../src/element-layout.mjs";

function makeLayout(id, x, y, width, height) {
  return createElementLayout({
    id,
    bounds: { minX: x, minY: y, maxX: x + width, maxY: y + height },
    canvasWidth: 500,
    canvasHeight: 2000,
    viewportHeight: 800,
    frame: { left: 40, width: 420 },
    sourcePath: "Notes/example.md"
  });
}

test("floating elements reproject into a narrower editing surface without clipping", () => {
  const layout = makeLayout("image-1", 320, 600, 140, 100);
  const projected = projectElementLayout(layout, {
    canvasWidth: 360,
    canvasHeight: 2400,
    viewportHeight: 720,
    frame: { left: 28, width: 304 }
  });

  assert.ok(projected);
  assert.ok(projected.x >= 0);
  assert.ok(projected.x + projected.width <= 360.001);
  assert.ok(projected.y >= 0 && projected.y + projected.height <= 2400.001);
  assert.ok(projected.width >= 80, "the element stays inspectable instead of collapsing");
});

test("stroke points stay inside the projected floating element box", () => {
  const layout = makeLayout("text-1", 100, 300, 240, 160);
  const projected = projectElementLayout(layout, {
    canvasWidth: 720,
    canvasHeight: 1800,
    viewportHeight: 900,
    frame: { left: 72, width: 576 }
  });
  const points = projectElementPoints([
    { x: 0.2, y: 0.15 },
    { x: 0.68, y: 0.23 }
  ], layout, projected, { canvasWidth: 720, canvasHeight: 1800 });

  assert.equal(points.length, 2);
  for (const point of points) {
    const x = point.x * 720;
    const y = point.y * 1800;
    assert.ok(x >= projected.x - 0.01 && x <= projected.x + projected.width + 0.01);
    assert.ok(y >= projected.y - 0.01 && y <= projected.y + projected.height + 0.01);
  }
});

test("nearby floating elements preserve their relationship after reprojection", () => {
  const first = makeLayout("first", 100, 400, 160, 100);
  const second = makeLayout("second", 270, 410, 150, 90);
  const relations = captureElementRelations([
    { id: "first", bounds: { x: 100, y: 400, width: 160, height: 100 } },
    { id: "second", bounds: { x: 270, y: 410, width: 150, height: 90 } }
  ]);
  first.relations = relations.get("first");
  second.relations = relations.get("second");
  const target = { canvasWidth: 390, canvasHeight: 2200, viewportHeight: 760, frame: { left: 30, width: 330 } };
  const projected = [projectElementLayout(first, target), projectElementLayout(second, target)];
  const stabilized = stabilizeElementRelations(projected, new Map([["first", first], ["second", second]]));

  assert.equal(stabilized.length, 2);
  const horizontalGap = Math.abs(stabilized[1].x - stabilized[0].x);
  assert.ok(horizontalGap > 40 && horizontalGap < 220);
  assert.ok(Math.abs(stabilized[1].y - stabilized[0].y) < 80);
});

test("relations captured in a scaled pane are stored in source-frame units", () => {
  const relations = captureElementRelations([
    { id: "a", scale: 0.5, bounds: { minX: 50, minY: 50, maxX: 110, maxY: 110 } },
    { id: "b", scale: 0.5, bounds: { minX: 90, minY: 75, maxX: 150, maxY: 135 } }
  ]);

  assert.equal(relations.get("a")[0].dx, 80);
  assert.equal(relations.get("a")[0].dy, 50);
});

test("near relations use the closest pair of element corners", () => {
  const relations = captureElementRelations([
    { id: "a", bounds: { minX: 0, minY: 0, maxX: 50, maxY: 50 } },
    { id: "b", bounds: { minX: 70, minY: 0, maxX: 120, maxY: 50 } }
  ], { nearDistance: 40 });
  const relation = relations.get("a")[0];

  assert.equal(relation.kind, "near");
  assert.equal(relation.sourceCorner, "topRight");
  assert.equal(relation.targetCorner, "topLeft");
  assert.equal(relation.dx, 20);
  assert.equal(relation.dy, 0);
});

test("all four corners retain Markdown anchors while top-left remains primary", () => {
  const layout = createElementLayout({
    id: "anchored",
    bounds: { minX: 120, minY: 400, maxX: 320, maxY: 520 },
    canvasWidth: 600,
    canvasHeight: 2000,
    viewportHeight: 700,
    frame: { left: 60, width: 480 },
    sourcePath: "Notes/example.md",
    cornerLocations: {
      topLeft: { path: "Notes/example.md", line: 8.1 },
      topRight: { path: "Notes/example.md", line: 8.2 },
      bottomRight: { path: "Notes/example.md", line: 11.4 },
      bottomLeft: { path: "Notes/example.md", line: 11.3 }
    },
    metrics: { width: 4, fontSize: 20, textWidth: 180, previewWidth: 320, previewHeight: 200 }
  });

  assert.equal(layout.basis, ELEMENT_LAYOUT_BASIS);
  assert.equal(layout.primary, "topLeft");
  assert.deepEqual(Object.keys(layout.corners), ["topLeft", "topRight", "bottomRight", "bottomLeft"]);
  assert.equal(layout.corners.bottomLeft.line, 11.3);
  const projected = projectElementLayout(layout, {
    canvasWidth: 420,
    canvasHeight: 3000,
    viewportHeight: 820,
    frame: { left: 20, width: 380 },
    lineToCanvasY: (path, line) => path === "Notes/example.md" ? 360 + (line - 8.1) * 22 : NaN
  });
  assert.equal(projected.y, 360);
  assert.equal(projected.primaryAnchoredToLine, true);
});

test("uniform element projection preserves freehand and media proportions", () => {
  const layout = createElementLayout({
    id: "freehand",
    bounds: { minX: 100, minY: 200, maxX: 300, maxY: 300 },
    canvasWidth: 600,
    canvasHeight: 1200,
    viewportHeight: 600,
    frame: { left: 60, width: 480 },
    metrics: { fontSize: 20, textWidth: 180, previewWidth: 320, previewHeight: 200 }
  });
  const projectedBox = projectElementLayout(layout, {
    canvasWidth: 360,
    canvasHeight: 2200,
    viewportHeight: 780,
    frame: { left: 20, width: 320 }
  });
  const projectedPoints = projectElementPoints([
    { x: 100 / 600, y: 200 / 1200, anchor: { x: 40 / 480, y: 200 / 1200 } },
    { x: 300 / 600, y: 300 / 1200, anchor: { x: 240 / 480, y: 300 / 1200 } }
  ], layout, projectedBox, { canvasWidth: 360, canvasHeight: 2200 });
  const dx = (projectedPoints[1].x - projectedPoints[0].x) * 360;
  const dy = (projectedPoints[1].y - projectedPoints[0].y) * 2200;
  const metrics = scaleElementMetrics(layout.metrics, projectedBox.scale);

  assert.ok(Math.abs(dx / 200 - dy / 100) < 1e-9);
  assert.ok(Math.abs(metrics.previewWidth / metrics.previewHeight - 1.6) < 1e-9);
  assert.ok(projectedBox.scale >= 0.42 && projectedBox.scale <= 2.4);
});

test("reciprocal relation cycles reduce drift without diverging", () => {
  const first = makeLayout("first-cycle", 100, 100, 140, 120);
  const second = makeLayout("second-cycle", 180, 150, 120, 110);
  first.relations = [{ targetId: "second-cycle", kind: "intersection", sourceCorner: "topLeft", targetCorner: "topLeft", dx: 80, dy: 50, weight: 0.28 }];
  second.relations = [{ targetId: "first-cycle", kind: "intersection", sourceCorner: "topLeft", targetCorner: "topLeft", dx: -80, dy: -50, weight: 0.28 }];
  const before = [
    { id: "first-cycle", x: 100, y: 100, width: 140, height: 120, scale: 1 },
    { id: "second-cycle", x: 210, y: 175, width: 120, height: 110, scale: 1 }
  ];
  const after = stabilizeElementRelations(before, new Map([[first.id, first], [second.id, second]]));
  const beforeError = Math.hypot(before[1].x - before[0].x - 80, before[1].y - before[0].y - 50);
  const afterError = Math.hypot(after[1].x - after[0].x - 80, after[1].y - after[0].y - 50);

  assert.ok(afterError < beforeError);
  assert.equal(normalizeElementLayout({ basis: "legacy" }), null);
});

test("implausible first-line anchors fall back to document-relative height", () => {
  const layout = createElementLayout({
    id: "legacy-false-line",
    bounds: { minX: 120, minY: 300, maxX: 240, maxY: 380 },
    canvasWidth: 500,
    canvasHeight: 1200,
    viewportHeight: 800,
    frame: { left: 40, width: 420 },
    sourcePath: "Notes/example.md",
    cornerLocations: {
      topLeft: { path: "Notes/example.md", line: 0.999999 },
      topRight: { path: "Notes/example.md", line: 0.999999 }
    }
  });
  const projected = projectElementLayout(layout, {
    canvasWidth: 500,
    canvasHeight: 3000,
    viewportHeight: 850,
    frame: { left: 40, width: 420 },
    lineToCanvasY: () => 1700
  });

  assert.equal(projected.y, 750);
  assert.equal(projected.primaryAnchoredToLine, false);
});

test("real Markdown line anchors beat document-ratio drift for element frames", () => {
  const layout = createElementLayout({
    id: "real-line-anchor",
    bounds: { minX: 120, minY: 500, maxX: 260, maxY: 620 },
    canvasWidth: 500,
    canvasHeight: 2000,
    viewportHeight: 800,
    frame: { left: 40, width: 420 },
    sourcePath: "Notes/example.md",
    cornerLocations: {
      topLeft: { path: "Notes/example.md", line: 48.5 },
      topRight: { path: "Notes/example.md", line: 48.5 }
    }
  });
  const projected = projectElementLayout(layout, {
    canvasWidth: 500,
    canvasHeight: 3600,
    viewportHeight: 850,
    frame: { left: 40, width: 420 },
    lineToCanvasY: () => 2200
  });

  assert.equal(projected.y, 2200);
  assert.equal(projected.primaryAnchoredToLine, true);
});

test("relation stabilization pulls elements together while respecting note anchors", () => {
  const first = makeLayout("relation-anchor-a", 100, 100, 120, 100);
  const second = makeLayout("relation-anchor-b", 200, 100, 120, 100);
  first.relations = [{ targetId: "relation-anchor-b", kind: "near", sourceCorner: "topRight", targetCorner: "topLeft", dx: 20, dy: 0, weight: 0.14 }];
  const before = [
    { id: "relation-anchor-a", x: 100, y: 100, width: 120, height: 100, scale: 1, anchorX: 100, anchorY: 100, primaryAnchoredToLine: true },
    { id: "relation-anchor-b", x: 360, y: 100, width: 120, height: 100, scale: 1, anchorX: 360, anchorY: 100, primaryAnchoredToLine: true }
  ];
  const after = stabilizeElementRelations(before, new Map([[first.id, first], [second.id, second]]));

  assert.ok(after[0].x > before[0].x + 20);
  assert.ok(after[0].x <= before[0].anchorX + 84);
});
