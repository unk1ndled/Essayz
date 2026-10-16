import { useEffect, useState } from "react";
import { api } from "./api";
import { relativeUnlock, weekLabel } from "./format";
import { Avatar, EmptyState, Loading } from "./shared-ui";
import type { WeekEntry, WeekInfo } from "./types";

function EntryCard({ entry, unlocked, onOpen, onEdit }: { entry: WeekEntry; unlocked: boolean; onOpen: () => void; onEdit: () => void }) {
  const readable = entry.isMine || (unlocked && entry.status === "submitted");
  const label = entry.status === "submitted" ? "Submitted" : entry.status === "draft" ? "Draft" : "Not started";
  const action = entry.isMine ? "edit" : readable ? "read" : "sealed";
  return (
    <button className={`entry-card ${readable ? "readable" : "sealed"}`} onClick={entry.isMine ? onEdit : readable && entry.id ? onOpen : undefined} disabled={!readable && !entry.isMine}>
      <span className="entry-main">
        <Avatar user={entry.author} />
        <span className="entry-copy">
          <span className="entry-title">
            {entry.title || (entry.status === "submitted" && !unlocked ? "Sealed until Sunday" : label)}
          </span>
          <span className="entry-author">{entry.author.displayName} · {label}{entry.isMine && <em>you</em>}</span>
        </span>
      </span>
      <span className="entry-action" aria-hidden="true">{action}</span>
    </button>
  );
}

interface WeekScreenProps {
  onEdit: (entry: WeekEntry | undefined) => void;
  onRead: (id: string) => void;
  onReadBatch: (ids: string[]) => void;
  refreshKey: number;
}

export function WeekScreen({ onEdit, onRead, onReadBatch, refreshKey }: WeekScreenProps) {
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
