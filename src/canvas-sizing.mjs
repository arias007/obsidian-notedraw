const DEFAULT_MIN_WINDOW_HEIGHT = 1024;
const DEFAULT_MAX_WINDOW_HEIGHT = 4096;

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function calculateCanvasWindow({
  documentHeight,
  viewportTop = 0,
  viewportHeight,
  previousTop = null,
  previousHeight = 0,
  overscanScreens = 1,
  minWindowHeight = DEFAULT_MIN_WINDOW_HEIGHT,
  maxWindowHeight = DEFAULT_MAX_WINDOW_HEIGHT
}) {
  const height = Math.max(1, finitePositive(documentHeight, 1));
  const visibleHeight = Math.min(height, finitePositive(viewportHeight, height));
  const maxTop = Math.max(0, height - visibleHeight);
  const visibleTop = clamp(Number(viewportTop) || 0, 0, maxTop);
  const overscan = Math.max(0, Number(overscanScreens) || 0);
  const maximum = Math.max(visibleHeight, finitePositive(maxWindowHeight, DEFAULT_MAX_WINDOW_HEIGHT));
  const minimum = Math.min(maximum, Math.max(visibleHeight, finitePositive(minWindowHeight, DEFAULT_MIN_WINDOW_HEIGHT)));
  const targetHeight = Math.min(height, Math.max(minimum, Math.min(maximum, visibleHeight * (1 + overscan * 2))));
  const priorTop = Number(previousTop);
  const priorHeight = Number(previousHeight);
  const canReusePrevious = Number.isFinite(priorTop) && priorTop >= 0 && Number.isFinite(priorHeight) && Math.abs(priorHeight - targetHeight) < 1;

  if (canReusePrevious) {
    const priorBottom = priorTop + priorHeight;
    const guard = Math.max(0, Math.min(visibleHeight * 0.35, (priorHeight - visibleHeight) / 2));
    const safeTop = priorTop <= 0 ? 0 : priorTop + guard;
    const safeBottom = priorBottom >= height ? height : priorBottom - guard;
    if (visibleTop >= safeTop && visibleTop + visibleHeight <= safeBottom) {
      return { top: priorTop, height: priorHeight, changed: false };
    }
  }

  const centeredTop = visibleTop - (targetHeight - visibleHeight) / 2;
  const top = clamp(Math.round(centeredTop), 0, Math.max(0, height - targetHeight));
  return {
    top,
    height: targetHeight,
    changed: !canReusePrevious || Math.abs(top - priorTop) >= 1
  };
}

export function calculateQualityWindowLimit({
  cssWidth,
  viewportHeight,
  devicePixelRatio = 1,
  maxDevicePixelRatio = 4,
  maxPixels = 6 * 1024 * 1024,
  maxWindowHeight = DEFAULT_MAX_WINDOW_HEIGHT
}) {
  const width = Math.max(1, finitePositive(cssWidth, 1));
  const visibleHeight = Math.max(1, finitePositive(viewportHeight, 1));
  const scale = Math.min(
    finitePositive(devicePixelRatio, 1),
    finitePositive(maxDevicePixelRatio, 4)
  );
  const pixelLimit = finitePositive(maxPixels, 6 * 1024 * 1024);
  const heightAtNativeScale = Math.floor(pixelLimit / (width * scale * scale));
  return Math.max(
    visibleHeight,
    Math.min(finitePositive(maxWindowHeight, DEFAULT_MAX_WINDOW_HEIGHT), heightAtNativeScale)
  );
}

export function calculateCanvasBackingStore({
  cssWidth,
  cssHeight,
  devicePixelRatio = 1,
  maxDevicePixelRatio = 2,
  maxDimension = 8192,
  maxPixels = 8 * 1024 * 1024
}) {
  const width = Math.max(1, finitePositive(cssWidth, 1));
  const height = Math.max(1, finitePositive(cssHeight, 1));
  const deviceScale = finitePositive(devicePixelRatio, 1);
  const requestedScale = Math.min(
    deviceScale,
    finitePositive(maxDevicePixelRatio, 2)
  );
  const dimensionLimit = finitePositive(maxDimension, 8192);
  const pixelLimit = finitePositive(maxPixels, 8 * 1024 * 1024);
  const scale = Math.max(0.01, Math.min(
    requestedScale,
    dimensionLimit / width,
    dimensionLimit / height,
    Math.sqrt(pixelLimit / (width * height))
  ));

  const backingWidth = Math.max(1, Math.floor(width * scale));
  const backingHeight = Math.max(1, Math.floor(height * scale));
  const effectiveScale = Math.min(backingWidth / width, backingHeight / height);
  return {
    width: backingWidth,
    height: backingHeight,
    scale: effectiveScale,
    limited: effectiveScale + 1e-6 < deviceScale
  };
}
