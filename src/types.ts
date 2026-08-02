export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface PetitMot {
  body: string;
  createdAt: string;
  updatedAt: string;
  author: User;
  isMine: boolean;
}

export interface WeekInfo {
  key: string;
  startsOn: string;
  endsOn: string;
  unlockAt: string;
  closesAt: string;
  isUnlocked: boolean;
  isOpen: boolean;
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
  memberCount: number;
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
  heartCount: number;
  heartedByMe: boolean;
  petitMots: PetitMot[];
}
