export const PETIT_MOT_MAX_WORDS = 100;
export const PETIT_MOT_MAX_CHARACTERS = 2_000;

export function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

export function validatePetitMot(value: string): string {
  const text = value.trim();
  if (!text) throw new Error("Write a few words before sharing your petit mot");
  if (text.length > PETIT_MOT_MAX_CHARACTERS) {
    throw new Error(`Petit mot must be ${PETIT_MOT_MAX_CHARACTERS.toLocaleString("en")} characters or fewer`);
  }
  if (countWords(text) > PETIT_MOT_MAX_WORDS) {
    throw new Error(`Petit mot must be ${PETIT_MOT_MAX_WORDS} words or fewer`);
  }
  return text;
}
