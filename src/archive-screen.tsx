import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { formatDate } from "./format";
import { Avatar, EmptyState, Loading } from "./shared-ui";
import type { ArchiveEntry } from "./types";

export function ArchiveScreen({ onRead, onReadBatch }: { onRead: (id: string) => void; onReadBatch: (ids: string[]) => void }) {
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
              <div className="archive-week-header">
                <button
                  className="archive-week-toggle"
                  aria-expanded={openWeek === key}
                  onClick={() => setOpenWeek((current) => current === key ? null : key)}
                >
                  <span className="roadmap-dot" aria-hidden="true" />
                  <span>
                    <span className="archive-week-title">
                      <strong>Week of {formatDate(key, { month: "long", day: "numeric", year: "numeric" })}</strong>
                      {items.length === items[0]?.memberCount && (
                        <span
                          className="archive-complete-check"
                          role="img"
                          aria-label="Good job — everyone did their part"
                          title="Good job — everyone did their part"
                        >✓</span>
                      )}
                    </span>
                    <small>{items.length} {items.length === 1 ? "submission" : "submissions"}</small>
                  </span>
                  <span aria-hidden="true">{openWeek === key ? "−" : "+"}</span>
                </button>
                <button className="text-button archive-batch-button" onClick={() => onReadBatch(items.map((entry) => entry.id))}>
                  <span className="archive-batch-label">Read submissions</span><span className="archive-batch-label-mobile">Read all</span> →
                </button>
              </div>
              {openWeek === key && (
                <div className="archive-week-entries">
                  {items.map((entry) => (
                    <button className="archive-row" key={entry.id} onClick={() => onRead(entry.id)}>
                      <span className="archive-row-main">
                        <Avatar user={entry.author} />
                        <span className="archive-row-copy"><strong>{entry.title}</strong><small>Submitted by {entry.author.displayName}</small></span>
                      </span>
                      <span>Read ↗</span>
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
