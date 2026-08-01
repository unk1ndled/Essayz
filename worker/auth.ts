export interface AuthEnv {
  DB: D1Database;
  SESSION_DAYS: string;
  PBKDF2_ITERATIONS: string;
}

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
}

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
}

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function randomToken(byteLength = 32): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(byteLength)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toBase64(new Uint8Array(digest));
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function equalStrings(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function cookieValue(request: Request, name: string): string | null {
  const cookies = request.headers.get("Cookie") ?? "";
  for (const cookie of cookies.split(";")) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function hashInviteCode(value: string): Promise<string> {
  return sha256(`invite:${value}`);
}

export async function inviteCodeMatches(value: string, expected: string): Promise<boolean> {
  const [candidateHash, expectedHash] = await Promise.all([
    hashInviteCode(value),
    hashInviteCode(expected),
  ]);
  return equalStrings(candidateHash, expectedHash);
}

export async function passwordRecord(
  password: string,
  iterations: number,
): Promise<{ hash: string; salt: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  return {
    hash: await derivePassword(password, saltBytes, iterations),
    salt: toBase64(saltBytes),
  };
}

export async function verifyPassword(password: string, user: UserRow): Promise<boolean> {
  const candidate = await derivePassword(
    password,
    fromBase64(user.password_salt),
    user.password_iterations,
  );
  return equalStrings(candidate, user.password_hash);
}

export async function createSession(
  env: AuthEnv,
  userId: string,
  request: Request,
): Promise<string> {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const sessionDays = Math.max(1, Number(env.SESSION_DAYS) || 30);
  const expires = new Date(Date.now() + sessionDays * 86_400_000);
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(tokenHash, userId, expires.toISOString(), new Date().toISOString())
    .run();

  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `essayz_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionDays * 86400}${secure}`;
}

export async function destroySession(env: AuthEnv, request: Request): Promise<void> {
  const token = cookieValue(request, "essayz_session");
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(await sha256(token))
      .run();
  }
}

export function expiredSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `essayz_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export async function currentUser(env: AuthEnv, request: Request): Promise<SessionUser | null> {
  const token = cookieValue(request, "essayz_session");
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT users.id, users.username, users.display_name
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
  )
    .bind(await sha256(token), new Date().toISOString())
    .first<{ id: string; username: string; display_name: string }>();

  return row
    ? { id: row.id, username: row.username, displayName: row.display_name }
    : null;
}

export type { UserRow };
