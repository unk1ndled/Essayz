import type { User } from "./types";
import { initials } from "./format";

export function Avatar({ user }: { user: User }) {
  return (
    <span className="avatar" aria-hidden="true">
      <span>{initials(user.displayName)}</span>
      {user.avatarUrl && (
        <img
          key={user.avatarUrl}
          src={user.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
      )}
    </span>
  );
}

export function Notice({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="notice" role="status">
      <span>{message}</span>
      <button className="icon-button" onClick={onClose} aria-label="Dismiss">×</button>
    </div>
  );
}

export function Loading() {
  return <div className="loading"><span /><p>Opening the pages…</p></div>;
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="empty-state"><span>¶</span><h2>{title}</h2><p>{copy}</p></div>;
}
