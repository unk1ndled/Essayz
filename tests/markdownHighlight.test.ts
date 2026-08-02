import { describe, expect, it } from "vitest";
import { highlightMarkdown } from "../src/markdownHighlight";

describe("Markdown editor highlighting", () => {
  it("distinguishes quoted strings and both inline-code delimiter forms", () => {
    const tokens = highlightMarkdown('A "quoted string", `code`, and ``code with a ` tick``.');

    expect(tokens.filter((token) => token.kind === "string").map((token) => token.value)).toEqual([
      '"quoted string"',
    ]);
    expect(tokens.filter((token) => token.kind === "code").map((token) => token.value)).toEqual([
      "`code`",
      "``code with a ` tick``",
    ]);
  });

  it("keeps quotes inside code under the code style", () => {
    const tokens = highlightMarkdown('`say "hello"` then "hello"');

    expect(tokens).toEqual([
      { kind: "code", value: '`say "hello"`' },
      { kind: "plain", value: " then " },
      { kind: "string", value: '"hello"' },
    ]);
  });
});
