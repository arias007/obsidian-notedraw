function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function placeFloatingTextEditor({
  anchorX,
  anchorY,
  width,
  height,
  viewportWidth,
  viewportHeight,
  viewportOffsetLeft = 0,
  viewportOffsetTop = 0,
  contentInsetX = 0,
  contentInsetY = 0,
  margin = 8,
  anchorVisible = true
} = {}) {
  const leftEdge = finite(viewportOffsetLeft) + Math.max(0, finite(margin, 8));
  const topEdge = finite(viewportOffsetTop) + Math.max(0, finite(margin, 8));
  const rightEdge = finite(viewportOffsetLeft) + Math.max(1, finite(viewportWidth, 1)) - Math.max(0, finite(margin, 8));
  const bottomEdge = finite(viewportOffsetTop) + Math.max(1, finite(viewportHeight, 1)) - Math.max(0, finite(margin, 8));
  const editorWidth = Math.min(Math.max(1, finite(width, 1)), Math.max(1, rightEdge - leftEdge));
  const editorHeight = Math.min(Math.max(1, finite(height, 1)), Math.max(1, bottomEdge - topEdge));
  const centered = !anchorVisible;
  const desiredLeft = centered
    ? leftEdge + (rightEdge - leftEdge - editorWidth) / 2
    : finite(anchorX) - Math.max(0, finite(contentInsetX));
  const desiredTop = centered
    ? topEdge + (bottomEdge - topEdge - editorHeight) / 2
    : finite(anchorY) - Math.max(0, finite(contentInsetY));

  return {
    left: clamp(desiredLeft, leftEdge, Math.max(leftEdge, rightEdge - editorWidth)),
    top: clamp(desiredTop, topEdge, Math.max(topEdge, bottomEdge - editorHeight)),
    width: editorWidth,
    height: editorHeight,
    centered
  };
}

function splitOverlongToken(token, maxWidth, measureText) {
  const chunks = [];
  let current = "";
  for (const character of Array.from(token)) {
    const candidate = current + character;
    if (current && measureText(candidate) > maxWidth) {
      chunks.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current || !chunks.length) {
    chunks.push(current);
  }
  return chunks;
}

export function wrapTextLines(text, maxWidth, measureText) {
  const width = Math.max(1, finite(maxWidth, 1));
  const measure = typeof measureText === "function" ? measureText : (value) => String(value || "").length;
  const output = [];

  for (const paragraph of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    if (!paragraph) {
      output.push("");
      continue;
    }
    if (measure(paragraph) <= width) {
      output.push(paragraph);
      continue;
    }

    const tokens = paragraph.match(/\s+|[^\s]+/gu) || [paragraph];
    let line = "";
    for (const token of tokens) {
      const candidate = line + token;
      if (line && measure(candidate) > width) {
        output.push(line.trimEnd());
        line = token.trimStart();
      } else {
        line = candidate;
      }
      if (measure(line) <= width) {
        continue;
      }
      const chunks = splitOverlongToken(line, width, measure);
      output.push(...chunks.slice(0, -1));
      line = chunks[chunks.length - 1];
    }
    output.push(line.trimEnd());
  }

  return output.length ? output : [""];
}

export function computeTextLayout({
  text,
  fontSize = 18,
  textWidth = null,
  maxWidth = Infinity,
  padded = false,
  measureText
} = {}) {
  const size = clamp(finite(fontSize, 18), 10, 72);
  const measure = typeof measureText === "function"
    ? (value) => Math.max(0, finite(measureText(String(value ?? "")), 0))
    : (value) => Array.from(String(value ?? "")).length * size * 0.62;
  const paragraphs = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  const naturalWidth = Math.max(size, ...paragraphs.map((line) => measure(line)));
  const availableWidth = Math.max(size, finite(maxWidth, naturalWidth));
  const requested = Number(textWidth);
  const hasRequestedWidth = Number.isFinite(requested) && requested > 0;
  const wrapWidth = clamp(hasRequestedWidth ? requested : naturalWidth, size, availableWidth);
  const lines = wrapTextLines(text, wrapWidth, measure);
  const measuredWidth = Math.max(size, ...lines.map((line) => measure(line)));
  const contentWidth = hasRequestedWidth ? wrapWidth : Math.min(wrapWidth, measuredWidth);
  const lineHeight = Math.max(size + 2, size * 1.28);
  const contentHeight = Math.max(lineHeight, lines.length * lineHeight);
  const paddingX = padded ? Math.max(8, size * 0.45) : 0;
  const paddingY = padded ? Math.max(4, size * 0.26) : 0;

  return {
    lines,
    fontSize: size,
    lineHeight,
    contentWidth,
    contentHeight,
    paddingX,
    paddingY,
    width: contentWidth + paddingX * 2,
    height: contentHeight + paddingY * 2
  };
}
