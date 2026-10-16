import { useEffect, useRef, useState } from "react";
import { api, ApiFailure } from "./api";
import { ArchiveScreen } from "./archive-screen";
import { AuthScreen } from "./auth-screen";
import { Confetti, type CelebrationKind } from "./Confetti";
import { Editor } from "./editor";
import { BottomNav, type Screen } from "./navigation";
import { ProfileScreen } from "./profile-screen";
import { Reader } from "./reader";
import { Loading, Notice } from "./shared-ui";
import type { Rules, User, WeekEntry, WeekInfo } from "./types";
import { WeekScreen } from "./week-screen";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [rules, setRules] = useState<Rules>({ timeZone: "Europe/Paris", unlockDay: "Sunday", unlockTime: "10:00" });
  const [currentWeek, setCurrentWeek] = useState<WeekInfo | null>(null);
  const [screen, setScreen] = useState<Screen>("week");
  const [editing, setEditing] = useState<WeekEntry | undefined | null>(null);
  const [reading, setReading] = useState<string[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [randomEssayBusy, setRandomEssayBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [celebration, setCelebration] = useState<{ id: number; kind: CelebrationKind } | null>(null);
  const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(window.location.search).get("invite")?.trim() ?? "");
  const celebrationId = useRef(0);

  function clearInvitation() {
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setInviteToken("");
  }

  useEffect(() => {
    api.session()
      .then((data) => {
        setUser(data.user);
        setRules(data.rules);
        setCurrentWeek(data.week);
        if (data.user && inviteToken) clearInvitation();
      })
      .catch((cause) => {
        if (!(cause instanceof ApiFailure && cause.status === 401)) setNotice(cause.message);
      })
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setScreen("week");
    }
  }

  function celebrate(kind: CelebrationKind) {
    celebrationId.current += 1;
    setCelebration({ id: celebrationId.current, kind });
  }

  async function openRandomEssay() {
    if (randomEssayBusy) return;
    setRandomEssayBusy(true);
    try {
      const { entries } = await api.archive();
      if (entries.length === 0) {
        setNotice("The archive does not have any essays yet.");
        return;
      }
      const entry = entries[Math.floor(Math.random() * entries.length)];
      setReading([entry.id]);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not open a random essay");
    } finally {
      setRandomEssayBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!user) {
    return (
      <AuthScreen
        inviteToken={inviteToken}
        onAuthenticated={(nextUser) => {
          clearInvitation();
          setUser(nextUser);
          setRefreshKey((key) => key + 1);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="top-brand">
        <button className="brand-button" onClick={openRandomEssay} disabled={randomEssayBusy} title="Open a random essay">Essayz</button>
        <BottomNav screen={screen} onChange={setScreen} />
      </header>
      <main className="content-shell">
        {screen === "week" && <WeekScreen refreshKey={refreshKey} onEdit={(entry) => setEditing(entry ?? undefined)} onRead={(id) => setReading([id])} onReadBatch={setReading} />}
        {screen === "archive" && <ArchiveScreen onRead={(id) => setReading([id])} onReadBatch={setReading} />}
        {screen === "profile" && <ProfileScreen user={user} rules={rules} onLogout={logout} onUserUpdated={setUser} />}
      </main>
      <footer className="site-footer">A private place to write together.</footer>
      {editing !== null && currentWeek && (
        <Editor
          entry={editing}
          week={currentWeek}
          onClose={() => setEditing(null)}
          onCelebrate={celebrate}
          onSaved={() => {
            setEditing(null);
            setRefreshKey((key) => key + 1);
            setNotice("Your essay is safely saved.");
          }}
        />
      )}
      {reading && <Reader essayIds={reading} onClose={() => setReading(null)} onCelebrate={celebrate} />}
      {notice && <Notice message={notice} onClose={() => setNotice("")} />}
      {celebration && (
        <Confetti
          key={celebration.id}
          kind={celebration.kind}
          onComplete={() => setCelebration((current) => current?.id === celebration.id ? null : current)}
        />
      )}
    </div>
  );
}
