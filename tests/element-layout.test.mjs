import test from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENT_LAYOUT_BASIS,
  captureElementRelations,
  createElementLayout,
  elementLayoutNeedsRepair,
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

test("intersection relations use the overlap center as a cross-element anchor", () => {
  const relations = captureElementRelations([
    { id: "a", scale: 0.5, bounds: { minX: 50, minY: 50, maxX: 110, maxY: 110 } },
    { id: "b", scale: 0.5, bounds: { minX: 90, minY: 75, maxX: 150, maxY: 135 } }
  ]);
  const relation = relations.get("a")[0];

  assert.equal(relation.kind, "intersection");
  assert.equal(relation.dx, 0);
  assert.equal(relation.dy, 0);
  assert.ok(relation.sourceU > 0.8 && relation.sourceU < 0.85);
  assert.ok(relation.sourceV > 0.7 && relation.sourceV < 0.72);
  assert.ok(relation.targetU > 0.16 && relation.targetU < 0.17);
  assert.ok(relation.targetV > 0.29 && relation.targetV < 0.3);
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

test("adaptive element projection reshapes boxes for portrait and wide screens", () => {
  const layout = createElementLayout({
    id: "freehand",
    bounds: { minX: 100, minY: 200, maxX: 300, maxY: 300 },
    canvasWidth: 600,
    canvasHeight: 1200,
    viewportHeight: 600,
    frame: { left: 60, width: 480 },
    metrics: { fontSize: 20, textWidth: 180, previewWidth: 320, previewHeight: 200 }
  });
  const portraitBox = projectElementLayout(layout, {
    canvasWidth: 360,
    canvasHeight: 2200,
    viewportHeight: 780,
    frame: { left: 20, width: 320 }
  });
  const portraitPoints = projectElementPoints([
    { x: 100 / 600, y: 200 / 1200, anchor: { x: 40 / 480, y: 200 / 1200 } },
    { x: 300 / 600, y: 300 / 1200, anchor: { x: 240 / 480, y: 300 / 1200 } }
  ], layout, portraitBox, { canvasWidth: 360, canvasHeight: 2200 });
  const portraitDx = (portraitPoints[1].x - portraitPoints[0].x) * 360;
  const portraitDy = (portraitPoints[1].y - portraitPoints[0].y) * 2200;
  const portraitMetrics = scaleElementMetrics(layout.metrics, portraitBox);

  assert.ok(portraitBox.yScale > portraitBox.xScale, "phone portrait favors a taller, narrower element");
  assert.ok(Math.abs(portraitDx - portraitBox.width) < 1e-9);
  assert.ok(Math.abs(portraitDy - portraitBox.height) < 1e-9);
  assert.ok(portraitMetrics.previewHeight > 200);
  assert.ok(portraitMetrics.previewWidth < 320);

  const wideBox = projectElementLayout(layout, {
    canvasWidth: 1200,
    canvasHeight: 900,
    viewportHeight: 720,
    frame: { left: 80, width: 960 }
  });
  const wideMetrics = scaleElementMetrics(layout.metrics, wideBox);

  assert.ok(wideBox.xScale > wideBox.yScale, "wide desktop panes favor a flatter element");
  assert.ok(wideBox.width > layout.box.width);
  assert.ok(wideBox.height < layout.box.height);
  assert.ok(wideMetrics.previewWidth > 320);
  assert.ok(wideMetrics.previewHeight < 200);
  assert.ok(wideBox.scale >= 0.42 && wideBox.scale <= 2.4);
});

test("reading and editing surfaces with similar content width keep visual text size stable", () => {
  const layout = createElementLayout({
    id: "same-width-reader",
    bounds: { minX: 100, minY: 240, maxX: 300, maxY: 340 },
    canvasWidth: 600,
    canvasHeight: 2200,
    viewportHeight: 800,
    frame: { left: 60, width: 480 },
    metrics: { width: 4, fontSize: 20, textWidth: 220 }
  });
  const projected = projectElementLayout(layout, {
    canvasWidth: 600,
    canvasHeight: 1150,
    viewportHeight: 720,
    frame: { left: 60, width: 480 }
  });
  const metrics = scaleElementMetrics(layout.metrics, projected);

  assert.equal(projected.xScale, 1);
  assert.equal(projected.yScale, 1, "view-only document-height differences cannot reshape an element");
  assert.equal(projected.scale, 1, "visual scale stays identical across the same Markdown lane");
  assert.equal(metrics.fontSize, 20);
  assert.equal(metrics.textWidth, 220);
});

test("same-width view changes do not let different Markdown line heights shrink elements", () => {
  const layout = createElementLayout({
    id: "same-lane-lines",
    bounds: { minX: 100, minY: 240, maxX: 300, maxY: 340 },
    canvasWidth: 600,
    canvasHeight: 2200,
    viewportHeight: 800,
    frame: { left: 60, width: 480 },
    sourcePath: "Notes/example.md",
    cornerLocations: {
      topLeft: { path: "Notes/example.md", line: 10, lineConfidence: 1 },
      topRight: { path: "Notes/example.md", line: 10, lineConfidence: 1 },
      bottomLeft: { path: "Notes/example.md", line: 20, lineConfidence: 1 },
      bottomRight: { path: "Notes/example.md", line: 20, lineConfidence: 1 }
    }
  });
  const projected = projectElementLayout(layout, {
    canvasWidth: 600,
    canvasHeight: 1150,
    viewportHeight: 720,
    frame: { left: 60, width: 480 },
    lineToCanvasY: (path, line) => path === "Notes/example.md" ? 300 + (line - 10) * 5 : NaN
  });

  assert.equal(projected.y, 300);
  assert.ok(projected.yScale >= 0.96);
  assert.ok(projected.height >= 96);
});

test("desktop reading and editing heights do not shift an unanchored element as a whole", () => {
  const layout = createElementLayout({
    id: "desktop-view-parity",
    bounds: { minX: 100, minY: 700, maxX: 220, maxY: 800 },
    canvasWidth: 500,
    canvasHeight: 2000,
    viewportHeight: 800,
    frame: { left: 40, width: 420 }
  });
  const editing = projectElementLayout(layout, {
    canvasWidth: 500,
    canvasHeight: 1800,
    viewportHeight: 800,
    frame: { left: 40, width: 420 },
    preferDocumentFlow: false
  });
  const reading = projectElementLayout(layout, {
    canvasWidth: 500,
    canvasHeight: 3000,
    viewportHeight: 800,
    frame: { left: 40, width: 420 },
    preferDocumentFlow: false
  });
  const mobile = projectElementLayout(layout, {
    canvasWidth: 360,
    canvasHeight: 3600,
    viewportHeight: 800,
    frame: { left: 20, width: 320 },
    preferDocumentFlow: true
  });

  assert.ok(Math.abs(reading.y - editing.y) < 16, "desktop mode differences stay nearly neutral");
  assert.ok(mobile.y > reading.y * 1.2, "a narrower mobile lane still lengthens the note coordinate");
});

test("same Markdown lane ignores view height and software keyboard changes", () => {
  const layout = createElementLayout({
    id: "same-lane-viewport-parity",
    bounds: { minX: 97, minY: 441, maxX: 277, maxY: 464 },
    canvasWidth: 360,
    canvasHeight: 3006,
    viewportHeight: 462,
    frame: { left: 24, width: 301 }
  });
  const editing = projectElementLayout(layout, {
    canvasWidth: 360,
    canvasHeight: 3006,
    viewportHeight: 462,
    frame: { left: 24, width: 301 },
    preferDocumentFlow: false
  });
  const reading = projectElementLayout(layout, {
    canvasWidth: 360,
    canvasHeight: 1455,
    viewportHeight: 789,
    frame: { left: 24, width: 301 },
    preferDocumentFlow: false
  });
  const mobileReading = projectElementLayout(layout, {
    canvasWidth: 360,
    canvasHeight: 1455,
    viewportHeight: 789,
    frame: { left: 24, width: 301 },
    preferDocumentFlow: true
  });

  assert.equal(editing.y, 441);
  assert.equal(reading.y, editing.y);
  assert.equal(mobileReading.y, editing.y);
});

test("mixed capture frames retain absolute and relative positions across view modes", () => {
  const first = createElementLayout({
    id: "mixed-frame-a",
    bounds: { minX: 90, minY: 420, maxX: 210, maxY: 500 },
    canvasWidth: 360,
    canvasHeight: 1455,
    viewportHeight: 789,
    frame: { left: 24, width: 301 }
  });
  const second = createElementLayout({
    id: "mixed-frame-b",
    bounds: { minX: 220, minY: 430, maxX: 330, maxY: 505 },
    canvasWidth: 360,
    canvasHeight: 3006,
    viewportHeight: 462,
    frame: { left: 24, width: 301 }
  });
  const relations = captureElementRelations([
    { id: first.id, bounds: { minX: 90, minY: 420, maxX: 210, maxY: 500 } },
    { id: second.id, bounds: { minX: 220, minY: 430, maxX: 330, maxY: 505 } }
  ]);
  first.relations = relations.get(first.id);
  second.relations = relations.get(second.id);
  const layouts = new Map([[first.id, first], [second.id, second]]);
  const project = (canvasHeight, viewportHeight) => stabilizeElementRelations([
    projectElementLayout(first, {
      canvasWidth: 360,
      canvasHeight,
      viewportHeight,
      frame: { left: 24, width: 301 },
      preferDocumentFlow: false
    }),
    projectElementLayout(second, {
      canvasWidth: 360,
      canvasHeight,
      viewportHeight,
      frame: { left: 24, width: 301 },
      preferDocumentFlow: false
    })
  ], layouts);
  const editing = project(3006, 462);
  const reading = project(1455, 789);

  assert.ok(Math.abs(reading[0].y - editing[0].y) < 0.001);
  assert.ok(Math.abs(reading[1].y - editing[1].y) < 0.001);
  assert.ok(Math.abs((reading[1].y - reading[0].y) - (editing[1].y - editing[0].y)) < 0.001);
});

test("element relations cannot override a strong note-lane anchor", () => {
  const first = makeLayout("strong-anchor-a", 100, 100, 120, 100);
  const second = makeLayout("strong-anchor-b", 240, 100, 120, 100);
  first.relations = [{ targetId: second.id, kind: "near", sourceCorner: "topRight", targetCorner: "topLeft", dx: 500, dy: 500, weight: 0.4 }];
  const before = [
    { id: first.id, x: 100, y: 100, width: 120, height: 100, scale: 1, xScale: 1, yScale: 1, anchorX: 100, anchorY: 100, anchorStrength: 0.94 },
    { id: second.id, x: 240, y: 100, width: 120, height: 100, scale: 1, xScale: 1, yScale: 1, anchorX: 240, anchorY: 100, anchorStrength: 0.94 }
  ];
  const after = stabilizeElementRelations(before, new Map([[first.id, first], [second.id, second]]));

  for (let index = 0; index < after.length; index += 1) {
    assert.ok(Math.abs(after[index].x - before[index].x) <= 36);
    assert.ok(Math.abs(after[index].y - before[index].y) <= 40);
  }
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
  const beforeError = Math.abs((before[1].x - (before[0].x + before[0].width)) - 20);
  const afterError = Math.abs((after[1].x - (after[0].x + after[0].width)) - 20);

  assert.ok(afterError < beforeError);
  assert.ok(after[0].x > before[0].x && after[0].x < before[0].x + 20);
  assert.ok(after[1].x < before[1].x && after[1].x > before[1].x - 20);
  assert.ok(Math.abs((after[0].x - before[0].x) + (after[1].x - before[1].x)) < 1e-9);
});

test("intersection anchors reduce cross-point drift without swapping element order", () => {
  const first = makeLayout("cross-a", 100, 100, 120, 100);
  const second = makeLayout("cross-b", 180, 130, 120, 100);
  const relations = captureElementRelations([
    { id: first.id, bounds: { minX: 100, minY: 100, maxX: 220, maxY: 200 } },
    { id: second.id, bounds: { minX: 180, minY: 130, maxX: 300, maxY: 230 } }
  ]);
  first.relations = relations.get(first.id);
  second.relations = relations.get(second.id);
  const before = [
    { id: first.id, x: 100, y: 100, width: 120, height: 100, scale: 1, xScale: 1, yScale: 1 },
    { id: second.id, x: 230, y: 170, width: 120, height: 100, scale: 1, xScale: 1, yScale: 1 }
  ];
  const relation = first.relations[0];
  const crossError = (items) => {
    const source = items[0];
    const target = items[1];
    const sourceX = source.x + relation.sourceU * source.width;
    const sourceY = source.y + relation.sourceV * source.height;
    const targetX = target.x + relation.targetU * target.width;
    const targetY = target.y + relation.targetV * target.height;
    return Math.hypot(targetX - sourceX, targetY - sourceY);
  };
  const after = stabilizeElementRelations(before, new Map([[first.id, first], [second.id, second]]));

  assert.ok(crossError(after) < crossError(before));
  assert.ok(after[0].x < after[1].x);
  assert.ok(Math.abs(after[0].x - before[0].x) < 30);
  assert.ok(Math.abs(after[1].x - before[1].x) < 30);
});

test("unstable transition frames are repaired instead of trusted as source layouts", () => {
  const layout = createElementLayout({
    id: "unstable-frame",
    bounds: { minX: 60, minY: 1314, maxX: 78, maxY: 1324 },
    canvasWidth: 123,
    canvasHeight: 2738,
    viewportHeight: 760,
    frame: { left: 76, width: 47.833 },
    sourcePath: "Notes/example.md",
    cornerLocations: {
      topLeft: { path: "Notes/example.md", line: 0.999999 },
      bottomLeft: { path: "Notes/example.md", line: 0.999999 }
    }
  });

  assert.equal(elementLayoutNeedsRepair(layout), true);
});

test("large elements with all corners clamped to the same legacy line are repaired", () => {
  const layout = createElementLayout({
    id: "same-line-large-span",
    bounds: { minX: 40, minY: 162, maxX: 238, maxY: 444 },
    canvasWidth: 516,
    canvasHeight: 1628,
    viewportHeight: 760,
    frame: { left: 31, width: 441 },
    sourcePath: "Notes/example.md",
    cornerLocations: {
      topLeft: { path: "Notes/example.md", line: 1.999999 },
      topRight: { path: "Notes/example.md", line: 1.999999 },
      bottomRight: { path: "Notes/example.md", line: 1.999999 },
      bottomLeft: { path: "Notes/example.md", line: 1.999999 }
    }
  });

  assert.equal(elementLayoutNeedsRepair(layout), true);
});

test("a capped Markdown lane remains stable on an ultra-wide desktop surface", () => {
  const layout = createElementLayout({
    id: "ultra-wide-lane",
    bounds: { minX: 80, minY: 220, maxX: 280, maxY: 340 },
    canvasWidth: 2560,
    canvasHeight: 2200,
    viewportHeight: 900,
    frame: { left: 40, width: 860 },
    sourcePath: "Notes/example.md"
  });

  assert.equal(elementLayoutNeedsRepair(layout), false);
});
