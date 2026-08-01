import type { ArchiveEntry, FullEssay, Rules, User, WeekEntry, WeekInfo } from "./types";

export class ApiFailure extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const result = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ApiFailure(result.error ?? "Request failed", response.status);
  return result;
}

export const api = {
  session: () => request<{ user: User | null; rules: Rules; week: WeekInfo }>("/api/session"),
  login: (username: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (details: {
    username: string;
    displayName: string;
    password: string;
    inviteCode: string;
  }) =>
    request<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(details),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  currentWeek: () =>
    request<{ week: WeekInfo; entries: WeekEntry[] }>("/api/week/current"),
  saveEssay: (essay: { title: string; markdown: string; status: "draft" | "submitted" }) =>
    request<{ id: string; updatedAt: string }>("/api/essays/current", {
      method: "PUT",
      body: JSON.stringify(essay),
    }),
  archive: () => request<{ entries: ArchiveEntry[] }>("/api/archive"),
  essay: (id: string) => request<{ essay: FullEssay; week: WeekInfo }>(`/api/essays/${id}`),
};
