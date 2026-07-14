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

function normalizeLineConfidence(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, 0, 1) : null;
}

function isEndClampedLine(line) {
  if (!Number.isFinite(line)) {
    return false;
  }
  return line - Math.floor(line) >= 0.985;
}

function canTrustCornerLine(corner) {
  if (!corner || corner.line === null) {
    return false;
  }
  if (corner.lineConfidence !== null) {
    return corner.lineConfidence >= 0.75;
  }
  return !isEndClampedLine(corner.line);
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
    line: normalizeLine(corner.line),
    lineConfidence: normalizeLineConfidence(corner.lineConfidence)
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
  const sourceU = Number(relation.sourceU);
  const sourceV = Number(relation.sourceV);
  const targetU = Number(relation.targetU);
  const targetV = Number(relation.targetV);
  return {
    targetId: relation.targetId,
    kind,
    sourceCorner: CORNER_NAMES.includes(relation.sourceCorner) ? relation.sourceCorner : "topLeft",
    targetCorner: CORNER_NAMES.includes(relation.targetCorner) ? relation.targetCorner : "topLeft",
    ...(Number.isFinite(sourceU) ? { sourceU: clamp(sourceU, 0, 1) } : {}),
    ...(Number.isFinite(sourceV) ? { sourceV: clamp(sourceV, 0, 1) } : {}),
    ...(Number.isFinite(targetU) ? { targetU: clamp(targetU, 0, 1) } : {}),
    ...(Number.isFinite(targetV) ? { targetV: clamp(targetV, 0, 1) } : {}),
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
      line: normalizeLine(location.line),
      lineConfidence: normalizeLineConfidence(location.lineConfidence ?? location.confidence)
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
  const firstLineIsPlausible = corner.line === null || corner.line >= 1 || corner.y <= 0.15;
  const lineIsReliable = canTrustCornerLine(corner);
  const maxLineShift = Math.max(96, Math.min(frame.documentHeight * 0.18, frame.viewportHeight * 0.45));
  const lineShiftIsPlausible = corner.line !== null && corner.line >= 1
    ? true
    : Math.abs(lineY - fallbackY) <= maxLineShift;
  const canUseLine = Number.isFinite(lineY) && firstLineIsPlausible && lineIsReliable && lineShiftIsPlausible;
  return {
    x: frame.contentLeft + corner.x * frame.contentWidth,
    y: canUseLine ? lineY : fallbackY,
    fallbackY,
    lineAnchored: canUseLine
  };
}

export function elementLayoutNeedsRepair(layoutInput) {
  const layout = normalizeElementLayout(layoutInput);
  if (!layout) {
    return true;
  }
  const frame = layout.sourceFrame;
  if (frame.surfaceWidth < 180 || frame.contentWidth < 140 || frame.contentWidth / frame.surfaceWidth < 0.42) {
    return true;
  }
  const verticalSpan = layout.box.height / Math.max(1, frame.documentHeight);
  const corners = Object.values(layout.corners).filter(Boolean);
  if (corners.some((corner) => corner.line !== null && corner.lineConfidence === null && isEndClampedLine(corner.line) && corner.y > 0.08)) {
    return true;
  }
  const topLine = layout.corners.topLeft?.line;
  const bottomLine = layout.corners.bottomLeft?.line;
  if (Number.isFinite(topLine) && Number.isFinite(bottomLine) && Math.floor(topLine) === Math.floor(bottomLine) && verticalSpan > 0.08) {
    return true;
  }
  return false;
}

export function calculateElementScale(sourceFrameInput, targetFrameInput, boxInput = {}) {
  const axes = calculateElementScales(sourceFrameInput, targetFrameInput, boxInput);
  return axes.scale;
}

function clampAxisRatio(scales, { maxXOverY = 1.65, maxYOverX = 1.9 } = {}) {
  let xScale = finite(scales.xScale, finite(scales.scale, 1));
  let yScale = finite(scales.yScale, finite(scales.scale, 1));
  if (xScale > yScale * maxXOverY) {
    xScale = yScale * maxXOverY;
  }
  if (yScale > xScale * maxYOverX) {
    yScale = xScale * maxYOverX;
  }
  const scale = calculateVisualScale(xScale, yScale, scales.scale);
  return {
    xScale,
    yScale,
    scale
  };
}

function blendScale(base, candidate, weight) {
  if (!Number.isFinite(candidate) || candidate <= 0) {
    return base;
  }
  return Math.exp(Math.log(Math.max(0.001, base)) * (1 - weight) + Math.log(Math.max(0.001, candidate)) * weight);
}

function calculateVisualScale(xScaleInput, yScaleInput, baseScaleInput = 1) {
  const xScale = Math.max(0.001, finite(xScaleInput, 1));
  const yScale = Math.max(0.001, finite(yScaleInput, 1));
  const geometric = Math.sqrt(xScale * yScale);
  const baseScale = clamp(finite(baseScaleInput, geometric), 0.42, 2.4);
  const widthProtected = blendScale(xScale, geometric, xScale < geometric ? 0.46 : 0.22);
  const baseProtected = blendScale(widthProtected, baseScale, 0.34);
  const sameWidthFloor = xScale >= 0.82 ? Math.min(xScale, baseScale) * 0.94 : 0.42;
  return clamp(Math.max(geometric, baseProtected, sameWidthFloor), 0.42, 2.4);
}

export function calculateElementScales(sourceFrameInput, targetFrameInput, boxInput = {}) {
  const source = normalizeFrame(sourceFrameInput);
  const target = normalizeFrame(targetFrameInput);
  const box = normalizeBox(boxInput);
  const widthScale = clamp(target.contentWidth / source.contentWidth, 0.2, 5);
  const documentScale = clamp(target.documentHeight / source.documentHeight, 0.28, 3.6);
  const viewportScale = clamp(target.viewportHeight / source.viewportHeight, 0.25, 4);
  const aspectChange = target.aspectRatio / Math.max(0.01, source.aspectRatio);
  const widthWeight = aspectChange < 0.9 ? 0.8 : aspectChange > 1.35 ? 0.62 : 0.7;
  let scale = Math.exp(
    Math.log(widthScale) * widthWeight +
    Math.log(viewportScale) * (1 - widthWeight)
  );
  scale = clamp(scale, Math.max(0.42, widthScale * 0.58), Math.min(2.4, widthScale * 1.55));
  const fitScale = target.contentWidth * 0.98 / Math.max(1, box.width);
  scale = clamp(Math.min(scale, fitScale), 0.42, 2.4);
  const portraitTarget = target.aspectRatio < 0.62 || target.contentWidth < 430 && target.viewportHeight > target.contentWidth * 1.2;
  const wideTarget = target.aspectRatio > 1.05;
  const sameContentLane = widthScale >= 0.82 && widthScale <= 1.2;
  let xScale = blendScale(widthScale, scale, portraitTarget ? 0.12 : 0.24);
  let yScale = Math.exp(
    Math.log(documentScale) * (portraitTarget ? 0.58 : wideTarget ? 0.38 : 0.46) +
    Math.log(viewportScale) * (portraitTarget ? 0.24 : wideTarget ? 0.34 : 0.3) +
    Math.log(widthScale) * (portraitTarget ? 0.18 : wideTarget ? 0.28 : 0.24)
  );
  yScale = blendScale(yScale, scale, portraitTarget ? 0.1 : 0.22);
  xScale = clamp(Math.min(xScale, fitScale), 0.34, 2.8);
  yScale = clamp(yScale, 0.34, 2.8);
  if (sameContentLane) {
    xScale = clamp(blendScale(xScale, widthScale, 0.72), widthScale * 0.9, widthScale * 1.1);
    yScale = clamp(blendScale(yScale, widthScale, 0.82), widthScale * 0.9, widthScale * 1.12);
    scale = calculateVisualScale(xScale, yScale, widthScale);
  }
  if (portraitTarget) {
    return clampAxisRatio({ xScale, yScale, scale }, { maxXOverY: 1.25, maxYOverX: 2.15 });
  }
  if (wideTarget) {
    return clampAxisRatio({ xScale, yScale, scale }, { maxXOverY: 1.75, maxYOverX: 1.45 });
  }
  return clampAxisRatio({ xScale, yScale, scale }, { maxXOverY: 1.55, maxYOverX: 1.65 });
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
  let { xScale, yScale, scale } = calculateElementScales(layout.sourceFrame, targetFrame, layout.box);
  const projectedRight = projectCorner(layout.corners.topRight, targetFrame, lineToCanvasY);
  const projectedBottom = projectCorner(layout.corners.bottomLeft, targetFrame, lineToCanvasY);
  const projectedBottomRight = projectCorner(layout.corners.bottomRight, targetFrame, lineToCanvasY);
  const cornerXScales = [];
  const cornerYScales = [];
  if (projectedRight && layout.box.width > 0.01) {
    cornerXScales.push(Math.abs(projectedRight.x - primary.x) / layout.box.width);
  }
  if (projectedBottomRight && projectedBottom && layout.box.width > 0.01) {
    cornerXScales.push(Math.abs(projectedBottomRight.x - projectedBottom.x) / layout.box.width);
  }
  if (projectedBottom && layout.box.height > 0.01) {
    cornerYScales.push(Math.abs(projectedBottom.y - primary.y) / layout.box.height);
  }
  if (projectedBottomRight && projectedRight && layout.box.height > 0.01) {
    cornerYScales.push(Math.abs(projectedBottomRight.y - projectedRight.y) / layout.box.height);
  }
  const reliableXScales = cornerXScales.filter((value) => Number.isFinite(value) && value >= xScale * 0.42 && value <= xScale * 2.35);
  const reliableYScales = cornerYScales.filter((value) => Number.isFinite(value) && value >= yScale * 0.36 && value <= yScale * 2.6);
  if (reliableXScales.length) {
    const cornerScale = reliableXScales.reduce((sum, value) => sum + value, 0) / reliableXScales.length;
    xScale = clamp(blendScale(xScale, cornerScale, 0.46), xScale * 0.62, xScale * 1.42);
  }
  if (reliableYScales.length) {
    const cornerScale = reliableYScales.reduce((sum, value) => sum + value, 0) / reliableYScales.length;
    yScale = clamp(blendScale(yScale, cornerScale, 0.5), yScale * 0.56, yScale * 1.55);
  }
  const targetIsPortrait = targetFrame.aspectRatio < 0.62 || targetFrame.contentWidth < 430 && targetFrame.viewportHeight > targetFrame.contentWidth * 1.2;
  const targetIsWide = targetFrame.aspectRatio > 1.05;
  const contentWidthScale = targetFrame.contentWidth / layout.sourceFrame.contentWidth;
  const sameContentLane = contentWidthScale >= 0.82 && contentWidthScale <= 1.2;
  ({ xScale, yScale, scale } = clampAxisRatio({ xScale, yScale, scale }, targetIsPortrait
    ? { maxXOverY: 1.25, maxYOverX: 2.15 }
    : targetIsWide ? { maxXOverY: 1.75, maxYOverX: 1.45 } : { maxXOverY: 1.55, maxYOverX: 1.65 }));
  if (sameContentLane) {
    xScale = clamp(blendScale(xScale, contentWidthScale, 0.5), contentWidthScale * 0.88, contentWidthScale * 1.12);
    yScale = clamp(blendScale(yScale, contentWidthScale, 0.62), contentWidthScale * 0.96, contentWidthScale * 1.08);
    scale = calculateVisualScale(xScale, yScale, contentWidthScale);
  }
  const fitXScale = targetFrame.contentWidth * 0.98 / Math.max(1, layout.box.width);
  if (xScale > fitXScale) {
    xScale = fitXScale;
    scale = calculateVisualScale(xScale, yScale, scale);
  }
  let x = primary.x;
  if (projectedBottom && Number.isFinite(projectedBottom.x) && Math.abs(projectedBottom.x - primary.x) <= Math.max(24, layout.box.width * scale * 0.25)) {
    x = (primary.x + projectedBottom.x) / 2;
  }
  const y = primary.y;
  const width = Math.max(0.01, layout.box.width * xScale);
  const height = Math.max(0.01, layout.box.height * yScale);
  const maxX = Math.max(0, targetFrame.surfaceWidth - width);
  const maxY = Math.max(0, targetFrame.documentHeight - height);
  const clampedX = clamp(x, 0, maxX);
  const clampedY = clamp(y, 0, maxY);
  return {
    id: layout.id,
    x: clampedX,
    y: clampedY,
    width,
    height,
    scale,
    xScale,
    yScale,
    anchorX: clampedX,
    anchorY: clampedY,
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

function overlapCenter(a, b) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) {
    return null;
  }
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2
  };
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

function normalizeBoxAnchor(box, point) {
  return {
    u: clamp((point.x - box.x) / Math.max(0.01, box.width), 0, 1),
    v: clamp((point.y - box.y) / Math.max(0.01, box.height), 0, 1)
  };
}

function relationBoxPoint(box, relation, prefix) {
  const u = finite(relation?.[`${prefix}U`], NaN);
  const v = finite(relation?.[`${prefix}V`], NaN);
  if (Number.isFinite(u) && Number.isFinite(v)) {
    return {
      x: box.x + clamp(u, 0, 1) * box.width,
      y: box.y + clamp(v, 0, 1) * box.height
    };
  }
  return boxCorner(box, relation?.[`${prefix}Corner`]);
}

export function captureElementRelations(items, { nearDistance = 80, maxRelations = 3 } = {}) {
  const normalized = (Array.isArray(items) ? items : []).map((item) => ({
    id: typeof item?.id === "string" ? item.id : "",
    scale: clamp(finite(item?.scale, 1), 0.05, 20),
    xScale: clamp(finite(item?.xScale, item?.scale ?? 1), 0.05, 20),
    yScale: clamp(finite(item?.yScale, item?.scale ?? 1), 0.05, 20),
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
      const relationScaleX = Math.max(0.05, (source.xScale + target.xScale) / 2);
      const relationScaleY = Math.max(0.05, (source.yScale + target.yScale) / 2);
      const cornerPair = nearestCornerPair(source.bounds, target.bounds);
      const intersectionCenter = kind === "intersection" ? overlapCenter(source.bounds, target.bounds) : null;
      const sourceAnchor = intersectionCenter ? normalizeBoxAnchor(source.bounds, intersectionCenter) : null;
      const targetAnchor = intersectionCenter ? normalizeBoxAnchor(target.bounds, intersectionCenter) : null;
      const sourceCornerPoint = intersectionCenter || boxCorner(source.bounds, cornerPair.sourceCorner);
      const targetCornerPoint = intersectionCenter || boxCorner(target.bounds, cornerPair.targetCorner);
      candidates.push({
        targetId: target.id,
        kind,
        sourceCorner: cornerPair.sourceCorner,
        targetCorner: cornerPair.targetCorner,
        ...(sourceAnchor ? { sourceU: sourceAnchor.u, sourceV: sourceAnchor.v } : {}),
        ...(targetAnchor ? { targetU: targetAnchor.u, targetV: targetAnchor.v } : {}),
        dx: (targetCornerPoint.x - sourceCornerPoint.x) / relationScaleX,
        dy: (targetCornerPoint.y - sourceCornerPoint.y) / relationScaleY,
        weight: kind === "intersection" ? 0.32 : 0.14,
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
  const visitedPairs = new Set();
  const addCorrection = (id, x, y, strength) => {
    const current = corrections.get(id) || { x: 0, y: 0, weight: 0 };
    current.x += x * strength;
    current.y += y * strength;
    current.weight += strength;
    corrections.set(id, current);
  };
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
      const pairKey = source.id < target.id ? `${source.id}\u0000${target.id}` : `${target.id}\u0000${source.id}`;
      if (visitedPairs.has(pairKey)) {
        continue;
      }
      visitedPairs.add(pairKey);
      const relationScaleX = (finite(source.xScale, source.scale) + finite(target.xScale, target.scale)) / 2;
      const relationScaleY = (finite(source.yScale, source.scale) + finite(target.yScale, target.scale)) / 2;
      const sourcePoint = relationBoxPoint(source, relation, "source");
      const targetPoint = relationBoxPoint(target, relation, "target");
      const errorX = targetPoint.x - sourcePoint.x - relation.dx * relationScaleX;
      const errorY = targetPoint.y - sourcePoint.y - relation.dy * relationScaleY;
      const limitX = relation.kind === "near"
        ? Math.min(72, Math.max(24, Math.min(source.width, target.width) * 0.35))
        : Math.min(96, Math.max(32, Math.min(source.width, target.width) * 0.5));
      const limitY = relation.kind === "near"
        ? Math.min(72, Math.max(24, Math.min(source.height, target.height) * 0.35))
        : Math.min(96, Math.max(32, Math.min(source.height, target.height) * 0.5));
      const strength = relation.kind === "near"
        ? clamp(relation.weight * 1.7, 0.16, 0.34)
        : clamp(relation.weight * 1.7, 0.32, 0.62);
      const sourceMobility = source.primaryAnchoredToLine ? 0.55 : 1;
      const targetMobility = target.primaryAnchoredToLine ? 0.55 : 1;
      const mobility = Math.max(0.01, sourceMobility + targetMobility);
      const sourceShare = sourceMobility / mobility;
      const targetShare = targetMobility / mobility;
      const clampedErrorX = clamp(errorX, -limitX, limitX);
      const clampedErrorY = clamp(errorY, -limitY, limitY);
      addCorrection(source.id, clampedErrorX * sourceShare, clampedErrorY * sourceShare, strength);
      addCorrection(target.id, -clampedErrorX * targetShare, -clampedErrorY * targetShare, strength);
    }
  }
  return projected.map((item) => {
    const correction = corrections.get(item.id);
    if (!correction) {
      return item;
    }
    const divisor = Math.max(0.001, correction.weight);
    const blend = Math.min(item.primaryAnchoredToLine ? 0.58 : 0.78, correction.weight);
    const nextX = item.x + (correction.x / divisor) * blend;
    const nextY = item.y + (correction.y / divisor) * blend;
    const anchorFenceX = Math.max(36, Math.min(120, item.width * (item.primaryAnchoredToLine ? 0.7 : 1.2)));
    const anchorFenceY = Math.max(36, Math.min(140, item.height * (item.primaryAnchoredToLine ? 0.8 : 1.5)));
    return {
      ...item,
      x: Number.isFinite(item.anchorX) ? clamp(nextX, item.anchorX - anchorFenceX, item.anchorX + anchorFenceX) : nextX,
      y: Number.isFinite(item.anchorY) ? clamp(nextY, item.anchorY - anchorFenceY, item.anchorY + anchorFenceY) : nextY
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
  const scaleBox = typeof scaleInput === "object" && scaleInput ? scaleInput : null;
  const scale = clamp(finite(scaleBox?.scale, finite(scaleInput, 1)), 0.42, 2.4);
  const xScale = clamp(finite(scaleBox?.xScale, scale), 0.34, 2.8);
  const yScale = clamp(finite(scaleBox?.yScale, scale), 0.34, 2.8);
  return {
    width: metrics.width ? clamp(metrics.width * scale, 0.5, 80) : undefined,
    fontSize: metrics.fontSize ? clamp(metrics.fontSize * scale, 10, 72) : undefined,
    textWidth: metrics.textWidth ? clamp(metrics.textWidth * xScale, 24, 900) : undefined,
    previewWidth: metrics.previewWidth ? clamp(metrics.previewWidth * xScale, 80, 900) : undefined,
    previewHeight: metrics.previewHeight ? clamp(metrics.previewHeight * yScale, 40, 700) : undefined
  };
}
