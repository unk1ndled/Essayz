import { lazy, Suspense, useDeferredValue, useRef, useState } from "react";
import { api } from "./api";
import type { CelebrationKind } from "./Confetti";
import { formatDate, wordCount } from "./format";
import { EmptyState, Loading } from "./shared-ui";
import type { WeekEntry, WeekInfo } from "./types";

const Markdown = lazy(() => import("./Markdown").then((module) => ({ default: module.Markdown })));
const MarkdownEditor = lazy(() => import("./MarkdownEditor").then((module) => ({ default: module.MarkdownEditor })));

interface EditorProps {
  entry?: WeekEntry;
  week: WeekInfo;
  onClose: () => void;
  onSaved: () => void;
  onCelebrate: (kind: CelebrationKind) => void;
}

export function Editor({ entry, week, onClose, onSaved, onCelebrate }: EditorProps) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [markdown, setMarkdown] = useState(entry?.markdown ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const deferredMarkdown = useDeferredValue(markdown);

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
        <div className="editor-meta"><span>{wordCount(deferredMarkdown)} words</span><span>Markdown</span></div>
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
            <Suspense fallback={<Loading />}>
              <MarkdownEditor textareaRef={textarea} value={markdown} onChange={setMarkdown} />
            </Suspense>
          </>
        ) : markdown ? (
          <Suspense fallback={<Loading />}><Markdown source={markdown} /></Suspense>
        ) : <EmptyState title="Nothing to preview yet" copy="Return to Write and begin your essay." />}
        {error && <p className="form-error" role="alert">{error}</p>}
      </main>
    </div>
  );
}
