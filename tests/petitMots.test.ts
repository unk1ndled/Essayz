import { describe, expect, it } from "vitest";
import {
  countWords,
  PETIT_MOT_MAX_CHARACTERS,
  validatePetitMot,
} from "../worker/petitMots";

describe("petit mot validation", () => {
  it("counts words separated by any whitespace", () => {
    expect(countWords("  one\ttwo\nthree  ")).toBe(3);
    expect(countWords("   ")).toBe(0);
  });

  it("accepts exactly 100 words and trims the note", () => {
    const note = Array.from({ length: 100 }, () => "kind").join(" ");
    expect(validatePetitMot(`  ${note}  `)).toBe(note);
  });

  it("rejects overlong notes", () => {
    const tooManyWords = Array.from({ length: 101 }, () => "word").join(" ");
    expect(() => validatePetitMot(tooManyWords)).toThrow("100 words or fewer");
    expect(() => validatePetitMot("a".repeat(PETIT_MOT_MAX_CHARACTERS + 1))).toThrow("characters or fewer");
  });
});
