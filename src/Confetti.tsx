import { useEffect, useRef, type CSSProperties } from "react";

export type CelebrationKind = "heart" | "submit" | "draft";

type PieceStyle = CSSProperties & {
  "--confetti-left": string;
  "--confetti-delay": string;
  "--confetti-duration": string;
  "--confetti-drift": string;
  "--confetti-turn": string;
};

const pieces: PieceStyle[] = Array.from({ length: 36 }, (_, index) => ({
  "--confetti-left": `${(index * 37 + 11) % 100}%`,
  "--confetti-delay": `${(index % 9) * 0.045}s`,
  "--confetti-duration": `${1.05 + (index % 5) * 0.08}s`,
  "--confetti-drift": `${((index * 19) % 31) - 15}vw`,
  "--confetti-turn": `${360 + (index % 4) * 180}deg`,
}));

export function Confetti({ kind, onComplete }: { kind: CelebrationKind; onComplete: () => void }) {
  const completion = useRef(onComplete);
  completion.current = onComplete;

  useEffect(() => {
    const timeout = window.setTimeout(() => completion.current(), 1_700);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div className={`confetti confetti-${kind}`} aria-hidden="true">
      {pieces.map((style, index) => {
        const isHeart = kind === "heart" && index % 3 === 0;
        return <span className={isHeart ? "confetti-piece heart" : "confetti-piece"} key={index} style={style}>{isHeart ? "♥" : ""}</span>;
      })}
    </div>
  );
}
