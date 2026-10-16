export type Screen = "week" | "archive" | "profile";

export function BottomNav({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <button className={screen === "week" ? "active" : ""} onClick={() => onChange("week")}>This week</button>
      <button className={screen === "archive" ? "active" : ""} onClick={() => onChange("archive")}>Archive</button>
      <button className={screen === "profile" ? "active" : ""} onClick={() => onChange("profile")}>Profile</button>
    </nav>
  );
}
