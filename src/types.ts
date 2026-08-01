export interface User {
  id: string;
  username: string;
  displayName: string;
}

export interface WeekInfo {
  key: string;
  startsOn: string;
  endsOn: string;
  unlockAt: string;
  isUnlocked: boolean;
}

export interface Rules {
  timeZone: string;
  unlockDay: string;
  unlockTime: string;
}

export interface WeekEntry {
  id: string | null;
  author: User;
  isMine: boolean;
  status: "missing" | "draft" | "submitted";
  title: string | null;
  markdown: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
}

export interface ArchiveEntry {
  id: string;
  weekKey: string;
  title: string;
  author: User;
  isMine: boolean;
  submittedAt: string;
}

export interface FullEssay {
  id: string;
  weekKey: string;
  title: string;
  markdown: string;
  status: "draft" | "submitted";
  submittedAt: string | null;
  author: User;
  isMine: boolean;
}
