import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, ApiFailure } from "./api";
import { Confetti, type CelebrationKind } from "./Confetti";
import { Markdown } from "./Markdown";
import { MarkdownEditor } from "./MarkdownEditor";
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
      <div className="auth-page">
        <header className="auth-intro">
          <h1>Essayz</h1>
          <p>A private weekly writing circle.</p>
        </header>
        <section className="auth-panel">
          <h2>{mode === "login" ? "Sign in" : "Join the circle"}</h2>
          <p className="auth-copy">
            Write privately through the week. Submitted essays open for everyone on Sunday at 10:00.
          </p>
        <div className="auth-tabs" role="tablist">
          <button aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
          <button aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button>
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
            <input required minLength={3} maxLength={24} pattern="[A-Za-z0-9_-]{3,24}" title="3–24 letters, numbers, underscores, or hyphens" autoCapitalize="none" autoComplete="username" placeholder="ada" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
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
          <p className="auth-note">Sunday submissions stay in the current week until midnight.</p>
        </section>
      </div>
    </main>
  );
}

function EntryCard({ entry, unlocked, onOpen, onEdit }: { entry: WeekEntry; unlocked: boolean; onOpen: () => void; onEdit: () => void }) {
  const readable = entry.isMine || (unlocked && entry.status === "submitted");
  const label = entry.status === "submitted" ? "Submitted" : entry.status === "draft" ? "Draft" : "Not started";
  const action = entry.isMine ? "edit" : readable ? "read" : "sealed";
  return (
    <button className={`entry-card ${readable ? "readable" : "sealed"}`} onClick={entry.isMine ? onEdit : readable && entry.id ? onOpen : undefined} disabled={!readable && !entry.isMine}>
      <span className="entry-main">
        <span className="entry-title">
          {entry.title || (entry.status === "submitted" && !unlocked ? "Sealed until Sunday" : label)}
        </span>
        <span className="entry-author">{entry.author.displayName} · {label}{entry.isMine && <em>you</em>}</span>
      </span>
      <span className="entry-action" aria-hidden="true">{action}</span>
    </button>
  );
}

function WeekScreen({ onEdit, onRead, onReadBatch, refreshKey }: { onEdit: (entry: WeekEntry | undefined) => void; onRead: (id: string) => void; onReadBatch: (ids: string[]) => void; refreshKey: number }) {
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
  const batchIds = data.week.isUnlocked
    ? data.entries.flatMap((entry) => entry.status === "submitted" && entry.id ? [entry.id] : [])
    : [];

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">This week</p><h1>{weekLabel(data.week)}</h1></div>
      </header>

      <section className={`reveal-card ${data.week.isUnlocked ? "unlocked" : ""}`}>
        <div>
          <p className="eyebrow">{data.week.isUnlocked ? "Reading room open" : "Reading room sealed"}</p>
          <h2>{relativeUnlock(data.week.unlockAt, now)}</h2>
          <p>{submitted} of {data.entries.length} {data.entries.length === 1 ? "writer has" : "writers have"} submitted. {data.week.isUnlocked ? "Sunday entries are still welcome until midnight." : "Entries open together on Sunday at 10:00."}</p>
        </div>
        <div className="reveal-actions">
          {batchIds.length > 0 && (
            <button className="secondary-button" onClick={() => onReadBatch(batchIds)}>Read this week’s batch</button>
          )}
          {data.week.isOpen && (
            <button className="primary-button" onClick={() => onEdit(mine)}>{mine?.status === "missing" || !mine ? "Start writing" : "Continue writing"}</button>
          )}
        </div>
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

function Editor({ entry, week, onClose, onSaved, onCelebrate }: { entry?: WeekEntry; week: WeekInfo; onClose: () => void; onSaved: () => void; onCelebrate: (kind: CelebrationKind) => void }) {
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
      onCelebrate(status === "submitted" ? "submit" : "draft");
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
        <div className="editor-header-actions">
          <button className="text-button" onClick={() => save("draft")} disabled={saving}>Save draft</button>
          <button
            className="primary-button header-submit"
            aria-label={entry?.status === "submitted" ? "Update submission" : "Submit this week"}
            onClick={() => save("submitted")}
            disabled={saving}
          >
            {saving ? "Saving…" : entry?.status === "submitted" ? "Update" : "Submit"}
          </button>
        </div>
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
            <MarkdownEditor textareaRef={textarea} value={markdown} onChange={setMarkdown} />
          </>
        ) : markdown ? <Markdown source={markdown} /> : <EmptyState title="Nothing to preview yet" copy="Return to Write and begin your essay." />}
        {error && <p className="form-error" role="alert">{error}</p>}
      </main>
    </div>
  );
}

function Reader({ essayIds, onClose, onCelebrate }: { essayIds: string[]; onClose: () => void; onCelebrate: (kind: CelebrationKind) => void }) {
  const [index, setIndex] = useState(0);
  const [essay, setEssay] = useState<FullEssay | null>(null);
  const [error, setError] = useState("");
  const [heartError, setHeartError] = useState("");
  const [heartBusy, setHeartBusy] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const essayId = essayIds[index];

  useEffect(() => {
    let active = true;
    setEssay(null);
    setError("");
    setHeartError("");
    page.current?.scrollTo({ top: 0 });
    api.essay(essayId)
      .then((result) => { if (active) setEssay(result.essay); })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [essayId]);

  useEffect(() => {
    function navigate(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && index > 0) setIndex((current) => current - 1);
      if (event.key === "ArrowRight" && index < essayIds.length - 1) setIndex((current) => current + 1);
    }
    window.addEventListener("keydown", navigate);
    return () => window.removeEventListener("keydown", navigate);
  }, [essayIds.length, index]);

  async function toggleHeart() {
    if (!essay || essay.isMine || heartBusy) return;
    const next = !essay.heartedByMe;
    setHeartBusy(true);
    setHeartError("");
    try {
      const result = await api.setEssayHeart(essay.id, next);
      setEssay((current) => current && current.id === essay.id
        ? { ...current, heartedByMe: result.hearted, heartCount: result.heartCount }
        : current);
      if (result.hearted) onCelebrate("heart");
    } catch (cause) {
      setHeartError(cause instanceof Error ? cause.message : "Could not save your heart");
    } finally {
      setHeartBusy(false);
    }
  }

  function next() {
    if (index === essayIds.length - 1) onClose();
    else setIndex((current) => current + 1);
  }

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
    <div className="overlay-page reader-page" ref={page}>
      <header className="overlay-header">
        <button className="text-button" onClick={onClose}>← Back</button>
        <p>{essayIds.length > 1 ? `${index + 1} of ${essayIds.length}` : "Reading room"}</p>
        <button className="text-button" onClick={download} disabled={!essay}>↓ .md</button>
      </header>
      {error ? <EmptyState title="Couldn’t open this essay" copy={error} /> : !essay ? <Loading /> : (
        <main className="reader-shell">
          <p className="eyebrow">{formatDate(essay.weekKey, { month: "long", day: "numeric", year: "numeric" })}</p>
          <h1>{essay.title}</h1>
          <div className="byline"><span className="avatar">{initials(essay.author.displayName)}</span><span>By {essay.author.displayName}<small>{wordCount(essay.markdown)} words</small></span></div>
          <Markdown source={essay.markdown} />
          <section className="reader-response" aria-label="Essay response">
            <button
              className={`heart-button ${essay.heartedByMe ? "hearted" : ""}`}
              aria-pressed={essay.heartedByMe}
              disabled={essay.isMine || heartBusy}
              onClick={toggleHeart}
            >
              <span aria-hidden="true">{essay.heartedByMe ? "♥" : "♡"}</span>
              {essay.isMine ? "Your essay" : essay.heartedByMe ? "Loved" : "Show some love"}
              {essay.heartCount > 0 && <small>{essay.heartCount}</small>}
            </button>
            {heartError && <p className="reader-response-error" role="alert">{heartError}</p>}
          </section>
          {essayIds.length > 1 && (
            <nav className="reader-batch-nav" aria-label="Weekly essay batch">
              <button className="text-button" disabled={index === 0} onClick={() => setIndex((current) => current - 1)}>← Previous</button>
              <span>Essay {index + 1} of {essayIds.length}</span>
              <button className="primary-button" onClick={next}>{index === essayIds.length - 1 ? "Finish batch" : "Next essay →"}</button>
            </nav>
          )}
        </main>
      )}
    </div>
  );
}

function ArchiveScreen({ onRead }: { onRead: (id: string) => void }) {
  const [entries, setEntries] = useState<ArchiveEntry[] | null>(null);
  const [error, setError] = useState("");
  const [openWeek, setOpenWeek] = useState<string | null>(null);
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
        <div className="archive-roadmap">
          {[...grouped.entries()].map(([key, items]) => (
            <section className={`archive-week ${openWeek === key ? "open" : ""}`} key={key}>
              <button
                className="archive-week-toggle"
                aria-expanded={openWeek === key}
                onClick={() => setOpenWeek((current) => current === key ? null : key)}
              >
                <span className="roadmap-dot" aria-hidden="true" />
                <span>
                  <strong>Week of {formatDate(key, { month: "long", day: "numeric", year: "numeric" })}</strong>
                  <small>{items.length} {items.length === 1 ? "submission" : "submissions"}</small>
                </span>
                <span aria-hidden="true">{openWeek === key ? "−" : "+"}</span>
              </button>
              {openWeek === key && (
                <div className="archive-week-entries">
                  {items.map((entry) => (
                    <button className="archive-row" key={entry.id} onClick={() => onRead(entry.id)}>
                      <span><strong>{entry.title}</strong><small>Submitted by {entry.author.displayName}</small></span><span>Read ↗</span>
                    </button>
                  ))}
                </div>
              )}
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
      <section className="profile-card"><div><h2>{user.displayName}</h2><p>@{user.username}</p></div></section>
      <section className="settings-card">
        <h2>Circle rules</h2>
        <div><span>Reveal</span><strong>{rules.unlockDay} at {rules.unlockTime}</strong></div>
        <div><span>Submissions</span><strong>Until Sunday ends</strong></div>
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
      <button className={screen === "week" ? "active" : ""} onClick={() => onChange("week")}>This week</button>
      <button className={screen === "archive" ? "active" : ""} onClick={() => onChange("archive")}>Archive</button>
      <button className={screen === "profile" ? "active" : ""} onClick={() => onChange("profile")}>Profile</button>
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
  const [reading, setReading] = useState<string[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [celebration, setCelebration] = useState<{ id: number; kind: CelebrationKind } | null>(null);
  const celebrationId = useRef(0);

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

  function celebrate(kind: CelebrationKind) {
    celebrationId.current += 1;
    setCelebration({ id: celebrationId.current, kind });
  }

  if (loading) return <Loading />;
  if (!user) return <AuthScreen onAuthenticated={(nextUser) => { setUser(nextUser); setRefreshKey((key) => key + 1); }} />;

  return (
    <div className="app-shell">
      <header className="top-brand"><strong>Essayz</strong><BottomNav screen={screen} onChange={setScreen} /></header>
      <main className="content-shell">
        {screen === "week" && <WeekScreen refreshKey={refreshKey} onEdit={(entry) => setEditing(entry ?? undefined)} onRead={(id) => setReading([id])} onReadBatch={setReading} />}
        {screen === "archive" && <ArchiveScreen onRead={(id) => setReading([id])} />}
        {screen === "profile" && <ProfileScreen user={user} rules={rules} onLogout={logout} />}
      </main>
      <footer className="site-footer">A private place to write together.</footer>
      {editing !== null && currentWeek && <Editor entry={editing} week={currentWeek} onClose={() => setEditing(null)} onCelebrate={celebrate} onSaved={() => { setEditing(null); setRefreshKey((key) => key + 1); setNotice("Your essay is safely saved."); }} />}
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
