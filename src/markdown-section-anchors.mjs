function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function buildVirtualMarkdownSectionAnchors(sections, {
  baseTop = 0,
  left = 0,
  right = 1,
  path = "",
  confidence = 0.96
} = {}) {
  const normalized = (Array.isArray(sections) ? sections : []).map((section) => ({
    start: Number(section?.startLine),
    end: Number(section?.endLine),
    height: Math.max(1, finite(section?.height, 1)),
    measuredTop: Number.isFinite(Number(section?.measuredTop)) ? Number(section.measuredTop) : null,
    excluded: Boolean(section?.excluded)
  }));
  let precedingHeight = 0;
  let inferredBase = finite(baseTop, 0);
  for (const section of normalized) {
    if (section.measuredTop !== null) {
      inferredBase = finite(baseTop, 0) + section.measuredTop - precedingHeight;
      break;
    }
    precedingHeight += section.height;
  }
  const anchors = [];
  let top = inferredBase;
  for (const section of normalized) {
    const sectionTop = section.measuredTop === null
      ? top
      : finite(baseTop, 0) + section.measuredTop;
    if (!section.excluded && Number.isInteger(section.start) && Number.isInteger(section.end) && section.start >= 0 && section.end >= 0) {
      anchors.push({
        path,
        start: Math.min(section.start, section.end),
        end: Math.max(section.start, section.end),
        left,
        right,
        top: sectionTop,
        bottom: sectionTop + section.height,
        height: section.height,
        area: Math.max(1, right - left) * section.height,
        confidence,
        virtual: true
      });
    }
    top = sectionTop + section.height;
  }
  return anchors;
}
