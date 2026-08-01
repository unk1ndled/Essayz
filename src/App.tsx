import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, ApiFailure } from "./api";
import { Markdown } from "./Markdown";
import type { ArchiveEntry, FullEssay, Rules, User, WeekEntry, WeekInfo } from "./types";

type Screen = "week" | "archive" | "profile";
type AuthMode = "login" | "register";

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options ?? { month: "short", day: "numeric" }).format(
    new Date(value.length === 10 ? `${value}T12:00:00Z` : value),
  );
}

function weekLabel(week: WeekInfo) {
  return `${formatDate(week.startsOn)} – ${formatDate(week.endsOn, { month: "short", day: "numeric", year: "numeric" })}`;
}

function relativeUnlock(unlockAt: string, now: number) {
  const remaining = new Date(unlockAt).getTime() - now;
  if (remaining <= 0) return "Unlocked now";
  const totalMinutes = Math.ceil(remaining / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h until the reveal`;
  if (hours > 0) return `${hours}h ${minutes}m until the reveal`;
  return `${minutes}m until the reveal`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function wordCount(markdown: string) {
  const clean = markdown.replace(/[#>*_`\[\]()!-]/g, " ").trim();
  return clean ? clean.split(/\s+/).length : 0;
}

function Notice({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="notice" role="status">
      <span>{message}</span>
      <button className="icon-button" onClick={onClose} aria-label="Dismiss">×</button>
    </div>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ username: "", displayName: "", password: "", inviteCode: "" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = mode === "login"
        ? await api.login(form.username, form.password)
        : await api.register(form);
      onAuthenticated(result.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div className="brand-mark" aria-hidden="true">E<span>.</span></div>
        <p className="eyebrow">A private writing circle</p>
        <h1>Write alone.<br />Read together.</h1>
        <p className="auth-copy">
          One essay each week. Everything stays sealed until Sunday morning.
        </p>
        <div className="rule-line"><span>01</span><p>Write in Markdown, at your own pace.</p></div>
        <div className="rule-line"><span>02</span><p>Submit before the Sunday reveal.</p></div>
        <div className="rule-line"><span>03</span><p>Read every voice at the same time.</p></div>
      </section>

      <section className="auth-panel">
        <div className="auth-tabs" role="tablist">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Join the circle</button>
        </div>
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Your name
              <input required maxLength={50} autoComplete="name" placeholder="Ada Lovelace" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
            </label>
          )}
          <label>
            Username
            <input required minLength={3} maxLength={24} autoCapitalize="none" autoComplete="username" placeholder="ada" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </label>
          <label>
            Password
            <input required minLength={10} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 10 characters" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          {mode === "register" && (
            <label>
              Invite code
              <input required type="password" autoComplete="off" placeholder="From your writing circle" value={form.inviteCode} onChange={(event) => setForm({ ...form, inviteCode: event.target.value })} />
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button wide" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Enter Essayz" : "Create my account"}</button>
        </form>
      </section>
    </main>
  );
}

function EntryCard({ entry, unlocked, onOpen, onEdit }: { entry: WeekEntry; unlocked: boolean; onOpen: () => void; onEdit: () => void }) {
  const readable = entry.isMine || (unlocked && entry.status === "submitted");
  const label = entry.status === "submitted" ? "Submitted" : entry.status === "draft" ? "Draft" : "Not started";
  return (
    <button className={`entry-card ${readable ? "readable" : "sealed"}`} onClick={entry.isMine && !unlocked ? onEdit : readable && entry.id ? onOpen : undefined} disabled={!readable && !entry.isMine}>
      <span className="avatar">{initials(entry.author.displayName ?? entry.author.username)}</span>
      <span className="entry-main">
        <span className="entry-author">{entry.author.displayName}{entry.isMine && <em>You</em>}</span>
        <span className="entry-title">
          {entry.title || (entry.status === "submitted" && !unlocked ? "Sealed until Sunday" : label)}
        </span>
      </span>
      <span className={`status-dot ${entry.status}`} aria-label={label} />
      <span className="entry-arrow" aria-hidden="true">{readable ? "↗" : "⌁"}</span>
    </button>
  );
}

function WeekScreen({ onEdit, onRead, refreshKey }: { onEdit: (entry: WeekEntry | undefined) => void; onRead: (id: string) => void; refreshKey: number }) {
  const [data, setData] = useState<{ week: WeekInfo; entries: WeekEntry[] } | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api.currentWeek().then(setData).catch((cause) => setError(cause.message));
  }, [refreshKey]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  if (error) return <EmptyState title="Couldn’t load this week" copy={error} />;
  if (!data) return <Loading />;
  const mine = data.entries.find((entry) => entry.isMine);
  const submitted = data.entries.filter((entry) => entry.status === "submitted").length;

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">This week</p><h1>{weekLabel(data.week)}</h1></div>
        <div className={`seal ${data.week.isUnlocked ? "open" : ""}`} aria-hidden="true">{data.week.isUnlocked ? "◌" : "⌁"}</div>
      </header>

      <section className={`reveal-card ${data.week.isUnlocked ? "unlocked" : ""}`}>
        <div>
          <p className="eyebrow">{data.week.isUnlocked ? "The reading room is open" : "The reading room is sealed"}</p>
          <h2>{relativeUnlock(data.week.unlockAt, now)}</h2>
          <p>{submitted} of {data.entries.length} {data.entries.length === 1 ? "writer has" : "writers have"} submitted.</p>
        </div>
        {!data.week.isUnlocked && (
          <button className="primary-button" onClick={() => onEdit(mine)}>{mine?.status === "missing" || !mine ? "Start writing" : "Continue writing"}</button>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading"><h2>The circle</h2><span>{data.entries.length} writers</span></div>
        <div className="entry-list">
          {data.entries.map((entry) => (
            <EntryCard key={entry.author.id} entry={entry} unlocked={data.week.isUnlocked} onEdit={() => onEdit(entry)} onOpen={() => entry.id && onRead(entry.id)} />
          ))}
        </div>
      </section>
    </>
  );
}

function Editor({ entry, week, onClose, onSaved }: { entry?: WeekEntry; week: WeekInfo; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [markdown, setMarkdown] = useState(entry?.markdown ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  function insert(before: string, after = before, fallback = "text") {
    const field = textarea.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = markdown.slice(start, end) || fallback;
    const next = `${markdown.slice(0, start)}${before}${selected}${after}${markdown.slice(end)}`;
    setMarkdown(next);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  async function save(status: "draft" | "submitted") {
    setSaving(true);
    setError("");
    try {
      await api.saveEssay({ title, markdown, status });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your essay");
    } finally {
      setSaving(false);
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".md") && !file.name.toLowerCase().endsWith(".markdown")) {
      setError("Choose a .md or .markdown file");
      return;
    }
    if (file.size > 100_000) {
      setError("That file is larger than 100 KB");
      return;
    }
    const contents = await file.text();
    setMarkdown(contents);
    if (!title) setTitle(file.name.replace(/\.(md|markdown)$/i, "").replaceAll("-", " "));
  }

  return (
    <div className="overlay-page">
      <header className="overlay-header">
        <button className="text-button" onClick={onClose}>← Back</button>
        <p>{formatDate(week.endsOn, { weekday: "long", month: "short", day: "numeric" })} reveal</p>
        <button className="text-button" onClick={() => save("draft")} disabled={saving}>Save draft</button>
      </header>
      <main className="editor-shell">
        <input className="title-input" aria-label="Essay title" maxLength={160} placeholder="Give this week a title…" value={title} onChange={(event) => setTitle(event.target.value)} />
        <div className="editor-meta"><span>{wordCount(markdown)} words</span><span>Markdown</span></div>
        <div className="editor-tabs">
          <button className={tab === "write" ? "active" : ""} onClick={() => setTab("write")}>Write</button>
          <button className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>Preview</button>
          <button className="import-button" onClick={() => fileInput.current?.click()}>Import .md</button>
          <input ref={fileInput} hidden type="file" accept=".md,.markdown,text/markdown" onChange={(event) => importFile(event.target.files?.[0])} />
        </div>
        {tab === "write" ? (
          <>
            <div className="format-bar" aria-label="Markdown formatting">
              <button onClick={() => insert("**", "**", "bold")}>B</button>
              <button onClick={() => insert("_", "_", "italic")}><i>I</i></button>
              <button onClick={() => insert("## ", "", "Heading")}>H</button>
              <button onClick={() => insert("> ", "", "Quote")}>❞</button>
              <button onClick={() => insert("[", "](https://)", "link")}>↗</button>
            </div>
            <textarea ref={textarea} className="markdown-input" aria-label="Essay in Markdown" placeholder="Begin wherever you are…" value={markdown} onChange={(event) => setMarkdown(event.target.value)} />
          </>
        ) : markdown ? <Markdown source={markdown} /> : <EmptyState title="Nothing to preview yet" copy="Return to Write and begin your essay." />}
        {error && <p className="form-error" role="alert">{error}</p>}
      </main>
      <footer className="editor-footer">
        <p>{entry?.status === "submitted" ? "Already submitted — saving a draft will unsubmit it." : "You can keep editing after submitting, until the reveal."}</p>
        <button className="primary-button" onClick={() => save("submitted")} disabled={saving}>{saving ? "Saving…" : entry?.status === "submitted" ? "Update submission" : "Submit for Sunday"}</button>
      </footer>
    </div>
  );
}

function Reader({ essayId, onClose }: { essayId: string; onClose: () => void }) {
  const [essay, setEssay] = useState<FullEssay | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.essay(essayId).then((result) => setEssay(result.essay)).catch((cause) => setError(cause.message));
  }, [essayId]);

  function download() {
    if (!essay) return;
    const blob = new Blob([essay.markdown], { type: "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${essay.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "essay"}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="overlay-page reader-page">
      <header className="overlay-header">
        <button className="text-button" onClick={onClose}>← Back</button>
        <p>Reading room</p>
        <button className="text-button" onClick={download} disabled={!essay}>↓ .md</button>
      </header>
      {error ? <EmptyState title="Couldn’t open this essay" copy={error} /> : !essay ? <Loading /> : (
        <main className="reader-shell">
          <p className="eyebrow">{formatDate(essay.weekKey, { month: "long", day: "numeric", year: "numeric" })}</p>
          <h1>{essay.title}</h1>
          <div className="byline"><span className="avatar">{initials(essay.author.displayName)}</span><span>By {essay.author.displayName}<small>{wordCount(essay.markdown)} words</small></span></div>
          <Markdown source={essay.markdown} />
        </main>
      )}
    </div>
  );
}

function ArchiveScreen({ onRead }: { onRead: (id: string) => void }) {
  const [entries, setEntries] = useState<ArchiveEntry[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api.archive().then((data) => setEntries(data.entries)).catch((cause) => setError(cause.message)); }, []);
  const grouped = useMemo(() => {
    const groups = new Map<string, ArchiveEntry[]>();
    entries?.forEach((entry) => groups.set(entry.weekKey, [...(groups.get(entry.weekKey) ?? []), entry]));
    return groups;
  }, [entries]);
  if (error) return <EmptyState title="Couldn’t load the archive" copy={error} />;
  if (!entries) return <Loading />;
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">The library</p><h1>Past essays</h1></div><span className="archive-count">{entries.length}</span></header>
      {entries.length === 0 ? <EmptyState title="The shelves are quiet" copy="Submitted essays appear here after their first Sunday reveal." /> : (
        <div className="archive-groups">
          {[...grouped.entries()].map(([key, items]) => (
            <section className="archive-group" key={key}>
              <p className="archive-date">Week of {formatDate(key, { month: "long", day: "numeric", year: "numeric" })}</p>
              {items.map((entry) => (
                <button className="archive-row" key={entry.id} onClick={() => onRead(entry.id)}>
                  <span><strong>{entry.title}</strong><small>{entry.author.displayName}</small></span><span>Read ↗</span>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function ProfileScreen({ user, rules, onLogout }: { user: User; rules: Rules; onLogout: () => void }) {
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">Your corner</p><h1>Profile</h1></div></header>
      <section className="profile-card"><span className="avatar large">{initials(user.displayName)}</span><div><h2>{user.displayName}</h2><p>@{user.username}</p></div></section>
      <section className="settings-card">
        <h2>Circle rules</h2>
        <div><span>Reveal</span><strong>{rules.unlockDay} at {rules.unlockTime}</strong></div>
        <div><span>Timezone</span><strong>{rules.timeZone}</strong></div>
        <div><span>Format</span><strong>Markdown · .md</strong></div>
      </section>
      <button className="secondary-button danger" onClick={onLogout}>Sign out</button>
    </>
  );
}

function BottomNav({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <button className={screen === "week" ? "active" : ""} onClick={() => onChange("week")}><span>◫</span>This week</button>
      <button className={screen === "archive" ? "active" : ""} onClick={() => onChange("archive")}><span>▤</span>Archive</button>
      <button className={screen === "profile" ? "active" : ""} onClick={() => onChange("profile")}><span>○</span>Profile</button>
    </nav>
  );
}

function Loading() { return <div className="loading"><span /><p>Opening the pages…</p></div>; }
function EmptyState({ title, copy }: { title: string; copy: string }) { return <div className="empty-state"><span>¶</span><h2>{title}</h2><p>{copy}</p></div>; }

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [rules, setRules] = useState<Rules>({ timeZone: "Europe/Paris", unlockDay: "Sunday", unlockTime: "10:00" });
  const [currentWeek, setCurrentWeek] = useState<WeekInfo | null>(null);
  const [screen, setScreen] = useState<Screen>("week");
  const [editing, setEditing] = useState<WeekEntry | undefined | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api.session()
      .then((data) => { setUser(data.user); setRules(data.rules); setCurrentWeek(data.week); })
      .catch((cause) => {
        if (!(cause instanceof ApiFailure && cause.status === 401)) setNotice(cause.message);
      })
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    try { await api.logout(); } finally { setUser(null); setScreen("week"); }
  }

  if (loading) return <Loading />;
  if (!user) return <AuthScreen onAuthenticated={(nextUser) => { setUser(nextUser); setRefreshKey((key) => key + 1); }} />;

  return (
    <div className="app-shell">
      <div className="top-brand"><strong>Essayz<span>.</span></strong><small>Private circle</small></div>
      <main className="content-shell">
        {screen === "week" && <WeekScreen refreshKey={refreshKey} onEdit={(entry) => setEditing(entry ?? undefined)} onRead={setReading} />}
        {screen === "archive" && <ArchiveScreen onRead={setReading} />}
        {screen === "profile" && <ProfileScreen user={user} rules={rules} onLogout={logout} />}
      </main>
      <BottomNav screen={screen} onChange={setScreen} />
      {editing !== null && currentWeek && <Editor entry={editing} week={currentWeek} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRefreshKey((key) => key + 1); setNotice("Your essay is safely saved."); }} />}
      {reading && <Reader essayId={reading} onClose={() => setReading(null)} />}
      {notice && <Notice message={notice} onClose={() => setNotice("")} />}
    </div>
  );
}
