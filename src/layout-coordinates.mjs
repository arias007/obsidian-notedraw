export const RESPONSIVE_POINT_BASIS = "note-content-v1";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeLinePosition(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const line = Number(value);
  return Number.isFinite(line) && line >= 0 ? line : null;
}

export function normalizeContentFrame({ surfaceWidth, contentLeft = 0, contentWidth } = {}) {
  const width = Math.max(1, finite(surfaceWidth, 1));
  const left = clamp(finite(contentLeft, 0), -width, width * 2);
  const available = Math.max(1, width - Math.max(0, left));
  const frameWidth = clamp(finite(contentWidth, available), 1, width * 2);
  return { left, width: frameWidth, surfaceWidth: width };
}

export function normalizeResponsiveAnchor(anchor) {
  if (!anchor || anchor.basis !== RESPONSIVE_POINT_BASIS) {
    return null;
  }
  return {
    v: 1,
    basis: RESPONSIVE_POINT_BASIS,
    x: clamp(finite(anchor.x, 0), -1, 2),
    y: clamp(finite(anchor.y, 0), 0, 1),
    path: typeof anchor.path === "string" ? anchor.path : "",
    line: normalizeLinePosition(anchor.line)
  };
}

export function createResponsivePoint({
  canvasX,
  canvasY,
  canvasWidth,
  canvasHeight,
  frame,
  sourcePath = "",
  linePosition = null,
  time = Date.now()
}) {
  const width = Math.max(1, finite(canvasWidth, 1));
  const height = Math.max(1, finite(canvasHeight, 1));
  const normalizedFrame = normalizeContentFrame({
    surfaceWidth: width,
    contentLeft: frame?.left,
    contentWidth: frame?.width
  });
  const x = clamp(finite(canvasX, 0) / width, 0, 1);
  const y = clamp(finite(canvasY, 0) / height, 0, 1);
  return {
    x,
    y,
    t: Number.isFinite(Number(time)) ? Number(time) : Date.now(),
    anchor: {
      v: 1,
      basis: RESPONSIVE_POINT_BASIS,
      x: clamp((finite(canvasX, 0) - normalizedFrame.left) / normalizedFrame.width, -1, 2),
      y,
      path: typeof sourcePath === "string" ? sourcePath : "",
      line: normalizeLinePosition(linePosition)
    }
  };
}

export function projectResponsivePoint(point, {
  canvasWidth,
  canvasHeight,
  frame,
  lineToCanvasY
} = {}) {
  const width = Math.max(1, finite(canvasWidth, 1));
  const height = Math.max(1, finite(canvasHeight, 1));
  const anchor = normalizeResponsiveAnchor(point?.anchor);
  if (!anchor) {
    return {
      ...point,
      x: clamp(finite(point?.x, 0), 0, 1),
      y: clamp(finite(point?.y, 0), 0, 1)
    };
  }
  const normalizedFrame = normalizeContentFrame({
    surfaceWidth: width,
    contentLeft: frame?.left,
    contentWidth: frame?.width
  });
  const anchoredY = anchor.line !== null && typeof lineToCanvasY === "function"
    ? Number(lineToCanvasY(anchor.path, anchor.line))
    : NaN;
  const canvasX = normalizedFrame.left + anchor.x * normalizedFrame.width;
  const fallbackCanvasY = anchor.y * height;
  // Versions 3.1.38-3.1.39 serialized a missing line as 0. Reject implausible
  // line-zero jumps while preserving real anchors created near the first line.
  const canUseLineAnchor = Number.isFinite(anchoredY) && (
    anchor.line !== 0 || (
      anchor.y <= 0.12 &&
      Math.abs(anchoredY - fallbackCanvasY) <= Math.max(96, height * 0.08)
    )
  );
  const canvasY = canUseLineAnchor ? anchoredY : fallbackCanvasY;
  return {
    ...point,
    x: clamp(canvasX / width, 0, 1),
    y: clamp(canvasY / height, 0, 1),
    anchor
  };
}
