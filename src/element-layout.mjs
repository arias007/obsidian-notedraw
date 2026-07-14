export const ELEMENT_LAYOUT_BASIS = "note-element-frame-v1";
export const ELEMENT_LAYOUT_VERSION = 1;

const CORNER_NAMES = ["topLeft", "topRight", "bottomRight", "bottomLeft"];

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeLine(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeFrame(frame = {}) {
  const surfaceWidth = Math.max(1, finite(frame.surfaceWidth, frame.width || 1));
  const contentLeft = clamp(finite(frame.contentLeft, frame.left || 0), -surfaceWidth, surfaceWidth * 2);
  const contentWidth = clamp(finite(frame.contentWidth, frame.width || surfaceWidth), 1, surfaceWidth * 2);
  const viewportHeight = Math.max(1, finite(frame.viewportHeight, frame.documentHeight || 1));
  const documentHeight = Math.max(1, finite(frame.documentHeight, viewportHeight));
  return {
    surfaceWidth,
    contentLeft,
    contentWidth,
    viewportHeight,
    documentHeight,
    aspectRatio: contentWidth / viewportHeight
  };
}

function normalizeCorner(corner) {
  if (!corner) {
    return null;
  }
  return {
    x: clamp(finite(corner.x, 0), -2, 3),
    y: clamp(finite(corner.y, 0), 0, 1),
    path: typeof corner.path === "string" ? corner.path : "",
    line: normalizeLine(corner.line)
  };
}

function normalizeBox(box = {}) {
  return {
    x: finite(box.x, 0),
    y: finite(box.y, 0),
    width: Math.max(0.01, finite(box.width, 0.01)),
    height: Math.max(0.01, finite(box.height, 0.01))
  };
}

function normalizeMetrics(metrics = {}) {
  const result = {};
  for (const key of ["width", "fontSize", "textWidth", "previewWidth", "previewHeight"]) {
    const value = Number(metrics[key]);
    if (Number.isFinite(value) && value > 0) {
      result[key] = value;
    }
  }
  return result;
}

function normalizeRelation(relation) {
  if (!relation || typeof relation.targetId !== "string" || !relation.targetId) {
    return null;
  }
  const kind = ["intersection", "overlap", "near"].includes(relation.kind) ? relation.kind : "near";
  return {
    targetId: relation.targetId,
    kind,
    sourceCorner: CORNER_NAMES.includes(relation.sourceCorner) ? relation.sourceCorner : "topLeft",
    targetCorner: CORNER_NAMES.includes(relation.targetCorner) ? relation.targetCorner : "topLeft",
    dx: finite(relation.dx, 0),
    dy: finite(relation.dy, 0),
    weight: clamp(finite(relation.weight, kind === "near" ? 0.14 : 0.26), 0.05, 0.4)
  };
}

export function normalizeElementLayout(layout) {
  if (!layout || layout.basis !== ELEMENT_LAYOUT_BASIS || !layout.sourceFrame || !layout.box) {
    return null;
  }
  const corners = {};
  for (const name of CORNER_NAMES) {
    corners[name] = normalizeCorner(layout.corners?.[name]);
  }
  if (!corners.topLeft) {
    return null;
  }
  return {
    v: ELEMENT_LAYOUT_VERSION,
    id: typeof layout.id === "string" && layout.id ? layout.id : "",
    basis: ELEMENT_LAYOUT_BASIS,
    primary: "topLeft",
    corners,
    sourceFrame: normalizeFrame(layout.sourceFrame),
    box: normalizeBox(layout.box),
    metrics: normalizeMetrics(layout.metrics),
    relations: (Array.isArray(layout.relations) ? layout.relations : [])
      .map(normalizeRelation)
      .filter(Boolean)
      .slice(0, 4)
  };
}

export function createElementLayout({
  id,
  bounds,
  canvasWidth,
  canvasHeight,
  frame,
  viewportHeight,
  sourcePath = "",
  cornerLocations = {},
  metrics = {},
  relations = []
} = {}) {
  const surfaceWidth = Math.max(1, finite(canvasWidth, 1));
  const documentHeight = Math.max(1, finite(canvasHeight, 1));
  const sourceFrame = normalizeFrame({
    surfaceWidth,
    contentLeft: frame?.left,
    contentWidth: frame?.width,
    viewportHeight: viewportHeight || documentHeight,
    documentHeight
  });
  const box = normalizeBox({
    x: bounds?.minX,
    y: bounds?.minY,
    width: finite(bounds?.maxX, 0) - finite(bounds?.minX, 0),
    height: finite(bounds?.maxY, 0) - finite(bounds?.minY, 0)
  });
  const positions = {
    topLeft: { x: box.x, y: box.y },
    topRight: { x: box.x + box.width, y: box.y },
    bottomRight: { x: box.x + box.width, y: box.y + box.height },
    bottomLeft: { x: box.x, y: box.y + box.height }
  };
  const corners = {};
  for (const name of CORNER_NAMES) {
    const location = cornerLocations[name] || {};
    corners[name] = {
      x: clamp((positions[name].x - sourceFrame.contentLeft) / sourceFrame.contentWidth, -2, 3),
      y: clamp(positions[name].y / documentHeight, 0, 1),
      path: typeof location.path === "string" && location.path ? location.path : sourcePath,
      line: normalizeLine(location.line)
    };
  }
  return normalizeElementLayout({
    v: ELEMENT_LAYOUT_VERSION,
    id,
    basis: ELEMENT_LAYOUT_BASIS,
    primary: "topLeft",
    corners,
    sourceFrame,
    box,
    metrics,
    relations
  });
}

function projectCorner(corner, target, lineToCanvasY) {
  if (!corner) {
    return null;
  }
  const frame = normalizeFrame(target);
  const fallbackY = corner.y * frame.documentHeight;
  const lineY = corner.line !== null && typeof lineToCanvasY === "function"
    ? Number(lineToCanvasY(corner.path, corner.line))
    : NaN;
  const canUseLine = Number.isFinite(lineY) && (
    corner.line !== 0 || (corner.y <= 0.12 && Math.abs(lineY - fallbackY) <= Math.max(96, frame.documentHeight * 0.08))
  );
  return {
    x: frame.contentLeft + corner.x * frame.contentWidth,
    y: canUseLine ? lineY : fallbackY,
    lineAnchored: canUseLine
  };
}

export function calculateElementScale(sourceFrameInput, targetFrameInput, boxInput = {}) {
  const source = normalizeFrame(sourceFrameInput);
  const target = normalizeFrame(targetFrameInput);
  const box = normalizeBox(boxInput);
  const widthScale = clamp(target.contentWidth / source.contentWidth, 0.2, 5);
  const viewportScale = clamp(target.viewportHeight / source.viewportHeight, 0.25, 4);
  const aspectChange = target.aspectRatio / Math.max(0.01, source.aspectRatio);
  const widthWeight = aspectChange < 0.9 ? 0.8 : aspectChange > 1.35 ? 0.62 : 0.7;
  let scale = Math.exp(
    Math.log(widthScale) * widthWeight +
    Math.log(viewportScale) * (1 - widthWeight)
  );
  scale = clamp(scale, Math.max(0.42, widthScale * 0.58), Math.min(2.4, widthScale * 1.55));
  const fitScale = target.contentWidth * 0.98 / Math.max(1, box.width);
  return clamp(Math.min(scale, fitScale), 0.42, 2.4);
}

export function projectElementLayout(layoutInput, {
  canvasWidth,
  canvasHeight,
  frame,
  viewportHeight,
  lineToCanvasY
} = {}) {
  const layout = normalizeElementLayout(layoutInput);
  if (!layout) {
    return null;
  }
  const targetFrame = normalizeFrame({
    surfaceWidth: canvasWidth,
    contentLeft: frame?.left,
    contentWidth: frame?.width,
    viewportHeight: viewportHeight || canvasHeight,
    documentHeight: canvasHeight
  });
  const primary = projectCorner(layout.corners.topLeft, targetFrame, lineToCanvasY);
  if (!primary) {
    return null;
  }
  let scale = calculateElementScale(layout.sourceFrame, targetFrame, layout.box);
  const projectedRight = projectCorner(layout.corners.topRight, targetFrame, lineToCanvasY);
  const projectedBottom = projectCorner(layout.corners.bottomLeft, targetFrame, lineToCanvasY);
  const cornerScales = [];
  if (projectedRight && layout.box.width > 0.01) {
    cornerScales.push(Math.abs(projectedRight.x - primary.x) / layout.box.width);
  }
  if (projectedBottom?.lineAnchored && primary.lineAnchored && layout.box.height > 0.01) {
    cornerScales.push(Math.abs(projectedBottom.y - primary.y) / layout.box.height);
  }
  const reliableCornerScales = cornerScales.filter((value) => Number.isFinite(value) && value >= scale * 0.45 && value <= scale * 2.2);
  if (reliableCornerScales.length) {
    const cornerScale = reliableCornerScales.reduce((sum, value) => sum + value, 0) / reliableCornerScales.length;
    scale = clamp(scale * 0.72 + cornerScale * 0.28, scale * 0.72, scale * 1.28);
  }
  const width = Math.max(0.01, layout.box.width * scale);
  const height = Math.max(0.01, layout.box.height * scale);
  const maxX = Math.max(0, targetFrame.surfaceWidth - width);
  const maxY = Math.max(0, targetFrame.documentHeight - height);
  return {
    id: layout.id,
    x: clamp(primary.x, 0, maxX),
    y: clamp(primary.y, 0, maxY),
    width,
    height,
    scale,
    primaryAnchoredToLine: primary.lineAnchored
  };
}

function rectGap(a, b) {
  const dx = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
  const dy = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
  return Math.hypot(dx, dy);
}

function overlapArea(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function boxCorner(box, name) {
  return {
    x: box.x + (name === "topRight" || name === "bottomRight" ? box.width : 0),
    y: box.y + (name === "bottomLeft" || name === "bottomRight" ? box.height : 0)
  };
}

function nearestCornerPair(source, target) {
  let best = { sourceCorner: "topLeft", targetCorner: "topLeft", distance: Number.POSITIVE_INFINITY };
  for (const sourceCorner of CORNER_NAMES) {
    const sourcePoint = boxCorner(source, sourceCorner);
    for (const targetCorner of CORNER_NAMES) {
      const targetPoint = boxCorner(target, targetCorner);
      const distance = Math.hypot(targetPoint.x - sourcePoint.x, targetPoint.y - sourcePoint.y);
      if (distance < best.distance) {
        best = { sourceCorner, targetCorner, distance };
      }
    }
  }
  return best;
}

export function captureElementRelations(items, { nearDistance = 80, maxRelations = 3 } = {}) {
  const normalized = (Array.isArray(items) ? items : []).map((item) => ({
    id: typeof item?.id === "string" ? item.id : "",
    scale: clamp(finite(item?.scale, 1), 0.05, 20),
    bounds: normalizeBox({
      x: item?.bounds?.minX ?? item?.bounds?.x,
      y: item?.bounds?.minY ?? item?.bounds?.y,
      width: item?.bounds?.width ?? finite(item?.bounds?.maxX, 0) - finite(item?.bounds?.minX, 0),
      height: item?.bounds?.height ?? finite(item?.bounds?.maxY, 0) - finite(item?.bounds?.minY, 0)
    })
  })).filter((item) => item.id);
  const cellSize = Math.max(16, finite(nearDistance, 80));
  const buckets = new Map();
  const cellRange = (bounds, padding = 0) => ({
    minX: Math.floor((bounds.x - padding) / cellSize),
    maxX: Math.floor((bounds.x + bounds.width + padding) / cellSize),
    minY: Math.floor((bounds.y - padding) / cellSize),
    maxY: Math.floor((bounds.y + bounds.height + padding) / cellSize)
  });
  for (const item of normalized) {
    const range = cellRange(item.bounds);
    for (let x = range.minX; x <= range.maxX; x += 1) {
      for (let y = range.minY; y <= range.maxY; y += 1) {
        const key = `${x}:${y}`;
        const bucket = buckets.get(key) || [];
        bucket.push(item);
        buckets.set(key, bucket);
      }
    }
  }
  const relations = new Map();
  for (const source of normalized) {
    const candidates = [];
    const nearby = new Set();
    const range = cellRange(source.bounds, nearDistance);
    for (let x = range.minX; x <= range.maxX; x += 1) {
      for (let y = range.minY; y <= range.maxY; y += 1) {
        for (const item of buckets.get(`${x}:${y}`) || []) {
          nearby.add(item);
        }
      }
    }
    for (const target of nearby) {
      if (target === source) {
        continue;
      }
      const overlap = overlapArea(source.bounds, target.bounds);
      const gap = rectGap(source.bounds, target.bounds);
      if (overlap <= 0 && gap > nearDistance) {
        continue;
      }
      const kind = overlap > 0 ? "intersection" : "near";
      const relationScale = Math.max(0.05, (source.scale + target.scale) / 2);
      const cornerPair = kind === "intersection"
        ? { sourceCorner: "topLeft", targetCorner: "topLeft" }
        : nearestCornerPair(source.bounds, target.bounds);
      const sourceCornerPoint = boxCorner(source.bounds, cornerPair.sourceCorner);
      const targetCornerPoint = boxCorner(target.bounds, cornerPair.targetCorner);
      candidates.push({
        targetId: target.id,
        kind,
        sourceCorner: cornerPair.sourceCorner,
        targetCorner: cornerPair.targetCorner,
        dx: (targetCornerPoint.x - sourceCornerPoint.x) / relationScale,
        dy: (targetCornerPoint.y - sourceCornerPoint.y) / relationScale,
        weight: kind === "intersection" ? 0.28 : 0.14,
        score: kind === "intersection" ? -overlap - 1 : gap
      });
    }
    candidates.sort((a, b) => a.score - b.score || a.targetId.localeCompare(b.targetId));
    relations.set(source.id, candidates.slice(0, maxRelations).map(({ score, ...relation }) => relation));
  }
  return relations;
}

export function stabilizeElementRelations(projectedItems, layouts) {
  const projected = (Array.isArray(projectedItems) ? projectedItems : []).map((item) => ({ ...item }));
  const byId = new Map(projected.map((item) => [item.id, item]));
  const layoutsById = layouts instanceof Map
    ? layouts
    : new Map((Array.isArray(layouts) ? layouts : []).map((layout) => [layout?.id, layout]));
  const corrections = new Map();
  for (const source of projected) {
    const layout = normalizeElementLayout(layoutsById.get(source.id));
    if (!layout) {
      continue;
    }
    for (const relation of layout.relations) {
      const target = byId.get(relation.targetId);
      if (!target) {
        continue;
      }
      const relationScale = (finite(source.scale, 1) + finite(target.scale, 1)) / 2;
      const sourceOffset = boxCorner({ x: 0, y: 0, width: source.width, height: source.height }, relation.sourceCorner);
      const targetCorner = boxCorner(target, relation.targetCorner);
      const expectedX = targetCorner.x - relation.dx * relationScale - sourceOffset.x;
      const expectedY = targetCorner.y - relation.dy * relationScale - sourceOffset.y;
      const limit = Math.min(28, Math.max(8, Math.min(source.width, source.height) * 0.18));
      const current = corrections.get(source.id) || { x: 0, y: 0, weight: 0 };
      current.x += clamp(expectedX - source.x, -limit, limit) * relation.weight;
      current.y += clamp(expectedY - source.y, -limit, limit) * relation.weight;
      current.weight += relation.weight;
      corrections.set(source.id, current);
    }
  }
  return projected.map((item) => {
    const correction = corrections.get(item.id);
    if (!correction) {
      return item;
    }
    const divisor = Math.max(1, correction.weight);
    return {
      ...item,
      x: item.x + correction.x / divisor,
      y: item.y + correction.y / divisor
    };
  });
}

export function projectElementPoints(points, layoutInput, projectedBox, { canvasWidth, canvasHeight } = {}) {
  const layout = normalizeElementLayout(layoutInput);
  if (!layout || !projectedBox) {
    return Array.isArray(points) ? points.map((point) => ({ ...point })) : [];
  }
  const targetWidth = Math.max(1, finite(canvasWidth, 1));
  const targetHeight = Math.max(1, finite(canvasHeight, 1));
  const source = layout.sourceFrame;
  return (Array.isArray(points) ? points : []).map((point) => {
    const anchor = point?.anchor;
    const sourceX = anchor && Number.isFinite(Number(anchor.x))
      ? source.contentLeft + Number(anchor.x) * source.contentWidth
      : clamp(finite(point?.x, 0), 0, 1) * source.surfaceWidth;
    const sourceY = anchor && Number.isFinite(Number(anchor.y))
      ? Number(anchor.y) * source.documentHeight
      : clamp(finite(point?.y, 0), 0, 1) * source.documentHeight;
    const localX = (sourceX - layout.box.x) / layout.box.width;
    const localY = (sourceY - layout.box.y) / layout.box.height;
    return {
      ...point,
      x: clamp((projectedBox.x + localX * projectedBox.width) / targetWidth, 0, 1),
      y: clamp((projectedBox.y + localY * projectedBox.height) / targetHeight, 0, 1)
    };
  });
}

export function scaleElementMetrics(metricsInput, scaleInput) {
  const metrics = normalizeMetrics(metricsInput);
  const scale = clamp(finite(scaleInput, 1), 0.42, 2.4);
  return {
    width: metrics.width ? clamp(metrics.width * scale, 0.5, 80) : undefined,
    fontSize: metrics.fontSize ? clamp(metrics.fontSize * scale, 10, 72) : undefined,
    textWidth: metrics.textWidth ? clamp(metrics.textWidth * scale, 24, 900) : undefined,
    previewWidth: metrics.previewWidth ? clamp(metrics.previewWidth * scale, 80, 900) : undefined,
    previewHeight: metrics.previewHeight ? clamp(metrics.previewHeight * scale, 40, 700) : undefined
  };
}
