export type MarkdownHighlightKind = "plain" | "code" | "string" | "link" | "syntax";

export type MarkdownHighlightToken = {
  kind: MarkdownHighlightKind;
  value: string;
};

// This is intentionally a highlighter, not a second Markdown parser. Marked remains
// the source of truth for previews; these tokens only make the writing view easier
// to scan while preserving the behaviour of a native textarea.
const HIGHLIGHT_PATTERN = /(^[ \t]{0,3}```[^\n]*\n[\s\S]*?^[ \t]{0,3}```[ \t]*$)|(`{2,}[^\n]*?`{2,}|`[^`\n]*`)|(\[[^\]\n]+\]\([^\n)]+\))|("(?:\\.|[^"\\\n])*")|(“[^”\n]*”)|(^[ \t]{0,3}#{1,6}(?=\s)|^[ \t]{0,3}>\s?|^[ \t]{0,3}(?:[-+*]|\d+[.)])(?=\s)|\*\*|__|~~|\*|_)/gm;

export function highlightMarkdown(source: string): MarkdownHighlightToken[] {
  const tokens: MarkdownHighlightToken[] = [];
  let cursor = 0;

  for (const match of source.matchAll(HIGHLIGHT_PATTERN)) {
    const index = match.index;
    if (index > cursor) tokens.push({ kind: "plain", value: source.slice(cursor, index) });

    const kind: MarkdownHighlightKind = match[1] || match[2]
      ? "code"
      : match[3]
        ? "link"
        : match[4] || match[5]
          ? "string"
          : "syntax";

    tokens.push({ kind, value: match[0] });
    cursor = index + match[0].length;
  }

  if (cursor < source.length) tokens.push({ kind: "plain", value: source.slice(cursor) });
  return tokens;
}
