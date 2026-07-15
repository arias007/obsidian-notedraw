function normalizeRenderedText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeMarkdownText(value) {
  let text = String(value || "");
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "$1")
    .replace(/<\/?(span|u|mark|kbd|sup|sub|small|strong|b|em|i|code)[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return normalizeRenderedText(text);
}

function collectCandidates(source) {
  const rawLines = String(source || "").replace(/\r\n/g, "\n").split("\n");
  const candidates = [];
  for (let line = 0; line < rawLines.length; line += 1) {
    const text = normalizeMarkdownText(rawLines[line]);
    if (text) {
      candidates.push({ lineStart: line, lineEnd: line, text, kind: "line" });
    }
  }
  let blockStart = -1;
  let blockLines = [];
  const flushBlock = (endLine) => {
    if (blockStart < 0) {
      return;
    }
    const text = normalizeMarkdownText(blockLines.join("\n"));
    if (text) {
      candidates.push({ lineStart: blockStart, lineEnd: endLine, text, kind: "block" });
    }
    blockStart = -1;
    blockLines = [];
  };
  for (let line = 0; line < rawLines.length; line += 1) {
    if (!rawLines[line].trim()) {
      flushBlock(line - 1);
      continue;
    }
    if (blockStart < 0) {
      blockStart = line;
    }
    blockLines.push(rawLines[line]);
  }
  flushBlock(rawLines.length - 1);
  return candidates;
}

export function matchRenderedTextToMarkdown(source, renderedText) {
  const rendered = normalizeRenderedText(renderedText);
  if (!rendered) {
    return null;
  }
  const candidates = collectCandidates(source);
  const exact = candidates
    .filter((candidate) => candidate.text === rendered)
    .sort((a, b) => (a.lineEnd - a.lineStart) - (b.lineEnd - b.lineStart) || (a.kind === "line" ? -1 : 1))[0];
  if (exact) {
    return { lineStart: exact.lineStart, lineEnd: exact.lineEnd, confidence: 1 };
  }
  const partial = candidates.map((candidate) => {
    const contains = candidate.text.includes(rendered) || rendered.includes(candidate.text);
    const overlap = contains ? Math.min(candidate.text.length, rendered.length) / Math.max(candidate.text.length, rendered.length) : 0;
    return { candidate, overlap };
  }).filter(({ overlap }) => overlap >= 0.55)
    .sort((a, b) => b.overlap - a.overlap || (a.candidate.lineEnd - a.candidate.lineStart) - (b.candidate.lineEnd - b.candidate.lineStart))[0];
  if (!partial) {
    return null;
  }
  return {
    lineStart: partial.candidate.lineStart,
    lineEnd: partial.candidate.lineEnd,
    confidence: Math.min(0.92, Math.max(0.75, partial.overlap))
  };
}
