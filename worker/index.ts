import {
  createSession,
  currentUser,
  destroySession,
  expiredSessionCookie,
  hashInviteToken,
  PASSWORD_HASH_ITERATIONS,
  passwordRecord,
  randomToken,
  verifyPassword,
  type SessionUser,
  type UserRow,
} from "./auth";
import { weekForDate, weekForKey } from "./schedule";

interface EssayRow {
  id: string;
  user_id: string;
  week_key: string;
  title: string;
  markdown: string;
  status: "draft" | "submitted";
  submitted_at: string | null;
  updated_at: string;
  username?: string;
  display_name?: string;
  heart_count?: number;
  hearted_by_viewer?: number;
}

interface WeekRow extends Omit<EssayRow, "status" | "markdown"> {
  status: "draft" | "submitted" | "missing";
  markdown: string | null;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function body<T>(request: Request): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(415, "Expected a JSON request");
  }
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, "Invalid JSON");
  }
}

function sameOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ApiError(403, "Cross-site request rejected");
  }
}

async function requireUser(env: Env, request: Request): Promise<SessionUser> {
  const user = await currentUser(env, request);
  if (!user) throw new ApiError(401, "Please sign in");
  return user;
}

function appTimeZone(env: Env): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: env.APP_TIME_ZONE }).format();
    return env.APP_TIME_ZONE;
  } catch {
    return "Europe/Paris";
  }
}

function publicRules(env: Env) {
  return {
    timeZone: appTimeZone(env),
    unlockDay: "Sunday",
    unlockTime: "10:00",
  };
}

async function register(request: Request, env: Env): Promise<Response> {
  sameOrigin(request);
  const input = await body<{
    username?: string;
    displayName?: string;
    password?: string;
    inviteToken?: string;
  }>(request);
  const username = (input.username ?? "").trim().toLowerCase();
  const displayName = (input.displayName ?? "").trim();
  const password = input.password ?? "";

  if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(username)) {
    throw new ApiError(400, "Username must be 3–24 letters, numbers, _ or -");
  }
  if (displayName.length < 1 || displayName.length > 50) {
    throw new ApiError(400, "Display name must be 1–50 characters");
  }
  if (password.length < 10 || password.length > 200) {
    throw new ApiError(400, "Password must be at least 10 characters");
  }
  const inviteToken = input.inviteToken ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(inviteToken)) {
    throw new ApiError(403, "This invite link is invalid, expired, or already used");
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
    .bind(username)
    .first();
  if (existing) throw new ApiError(409, "That username is already taken");

  const iterations = PASSWORD_HASH_ITERATIONS;
  const passwordData = await passwordRecord(password, iterations);
  const user = { id: crypto.randomUUID(), username, displayName };
  const now = new Date().toISOString();
  const inviteHash = await hashInviteToken(inviteToken);
  const [created] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users
        (id, username, display_name, password_hash, password_salt, password_iterations, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM invitations
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
       )`,
    ).bind(
      user.id,
      user.username,
      user.displayName,
      passwordData.hash,
      passwordData.salt,
      iterations,
      now,
      inviteHash,
      now,
    ),
    env.DB.prepare(
      `UPDATE invitations SET used_at = ?, used_by = ?
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
    ).bind(now, user.id, inviteHash, now),
  ]);
  if (created.meta.changes !== 1) {
    throw new ApiError(403, "This invite link is invalid, expired, or already used");
  }

  const cookie = await createSession(env, user.id, request);
  return json({ user }, { status: 201, headers: { "Set-Cookie": cookie } });
}

async function createInvitation(request: Request, env: Env): Promise<Response> {
  sameOrigin(request);
  const user = await requireUser(env, request);
  const token = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  await env.DB.prepare(
    `INSERT INTO invitations (id, token_hash, created_by, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      await hashInviteToken(token),
      user.id,
      now.toISOString(),
      expiresAt,
    )
    .run();

  const inviteUrl = new URL(request.url);
  inviteUrl.pathname = "/";
  inviteUrl.search = "";
  inviteUrl.hash = "";
  inviteUrl.searchParams.set("invite", token);
  return json({ inviteUrl: inviteUrl.toString(), expiresAt }, { status: 201 });
}

async function login(request: Request, env: Env): Promise<Response> {
  sameOrigin(request);
  const input = await body<{ username?: string; password?: string }>(request);
  const username = (input.username ?? "").trim().toLowerCase();
  const user = await env.DB.prepare(
    `SELECT id, username, display_name, password_hash, password_salt, password_iterations
     FROM users WHERE username = ?`,
  )
    .bind(username)
    .first<UserRow>();

  if (!user || !(await verifyPassword(input.password ?? "", user))) {
    throw new ApiError(401, "Username or password is incorrect");
  }
  const cookie = await createSession(env, user.id, request);
  return json(
    { user: { id: user.id, username: user.username, displayName: user.display_name } },
    { headers: { "Set-Cookie": cookie } },
  );
}

async function session(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(env, request);
  const week = weekForDate(new Date(), appTimeZone(env));
  return json({ user, rules: publicRules(env), week });
}

function readableEssay(row: EssayRow | WeekRow, viewerId: string, isUnlocked: boolean) {
  const isMine = row.user_id === viewerId;
  const canRead = isMine || (isUnlocked && row.status === "submitted");
  return {
    id: canRead ? row.id : null,
    author: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
    },
    isMine,
    status: row.status,
    title: canRead ? row.title : null,
    markdown: canRead ? row.markdown : null,
    submittedAt: row.status === "submitted" ? row.submitted_at : null,
    updatedAt: isMine ? row.updated_at : null,
  };
}

async function currentWeek(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(env, request);
  const week = weekForDate(new Date(), appTimeZone(env));
  const results = await env.DB.prepare(
    `SELECT users.id AS user_id, users.username, users.display_name,
            essays.id, essays.week_key, essays.title,
            CASE WHEN users.id = ? THEN essays.markdown ELSE NULL END AS markdown,
            COALESCE(essays.status, 'missing') AS status,
            essays.submitted_at, essays.updated_at
     FROM users
     LEFT JOIN essays ON essays.user_id = users.id AND essays.week_key = ?
     ORDER BY users.created_at ASC`,
  )
    .bind(user.id, week.key)
    .all<WeekRow>();

  const entries = results.results.map((row) => {
    if (row.status === "missing") {
      return {
        id: null,
        author: {
          id: row.user_id,
          username: row.username,
          displayName: row.display_name,
        },
        isMine: row.user_id === user.id,
        status: "missing",
        title: null,
        markdown: null,
        submittedAt: null,
        updatedAt: null,
      };
    }
    return readableEssay(row, user.id, week.isUnlocked);
  });

  return json({ week, entries });
}

async function saveCurrentEssay(request: Request, env: Env): Promise<Response> {
  sameOrigin(request);
  const user = await requireUser(env, request);
  const week = weekForDate(new Date(), appTimeZone(env));
  if (!week.isOpen) throw new ApiError(409, "This writing week is closed");

  const input = await body<{ title?: string; markdown?: string; status?: string }>(request);
  const title = (input.title ?? "").trim();
  const markdown = input.markdown ?? "";
  const status = input.status === "submitted" ? "submitted" : "draft";
  if (title.length > 160) throw new ApiError(400, "Title must be 160 characters or fewer");
  if (markdown.length > 100_000) throw new ApiError(400, "Essay must be 100,000 characters or fewer");
  if (status === "submitted" && (!title || !markdown.trim())) {
    throw new ApiError(400, "Add a title and some writing before submitting");
  }

  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    "SELECT id, created_at FROM essays WHERE user_id = ? AND week_key = ?",
  )
    .bind(user.id, week.key)
    .first<{ id: string; created_at: string }>();
  const essayId = existing?.id ?? crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO essays
      (id, user_id, week_key, title, markdown, status, submitted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, week_key) DO UPDATE SET
       title = excluded.title,
       markdown = excluded.markdown,
       status = excluded.status,
       submitted_at = excluded.submitted_at,
       updated_at = excluded.updated_at`,
  )
    .bind(
      essayId,
      user.id,
      week.key,
      title,
      markdown,
      status,
      status === "submitted" ? now : null,
      existing?.created_at ?? now,
      now,
    )
    .run();

  return json({ id: essayId, title, markdown, status, updatedAt: now });
}

async function archive(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(env, request);
  const now = new Date();
  const current = weekForDate(now, appTimeZone(env));
  const currentClause = current.isUnlocked ? "OR essays.week_key = ?" : "";
  const query = `SELECT essays.id, essays.user_id, essays.week_key, essays.title,
                        essays.submitted_at, essays.updated_at,
                        users.username, users.display_name
                 FROM essays JOIN users ON users.id = essays.user_id
                 WHERE essays.status = 'submitted'
                   AND (essays.week_key < ? ${currentClause})
                 ORDER BY essays.week_key DESC, essays.submitted_at ASC`;
  const statement = env.DB.prepare(query);
  const rows = current.isUnlocked
    ? await statement.bind(current.key, current.key).all<EssayRow>()
    : await statement.bind(current.key).all<EssayRow>();

  return json({
    entries: rows.results.map((row) => ({
      id: row.id,
      weekKey: row.week_key,
      title: row.title,
      author: {
        id: row.user_id,
        username: row.username,
        displayName: row.display_name,
      },
      isMine: row.user_id === user.id,
      submittedAt: row.submitted_at,
    })),
  });
}

async function essayById(request: Request, env: Env, essayId: string): Promise<Response> {
  const user = await requireUser(env, request);
  const row = await env.DB.prepare(
    `SELECT essays.*, users.username, users.display_name,
            (SELECT COUNT(*) FROM essay_hearts WHERE essay_id = essays.id) AS heart_count,
            EXISTS(
              SELECT 1 FROM essay_hearts
              WHERE essay_id = essays.id AND user_id = ?
            ) AS hearted_by_viewer
     FROM essays JOIN users ON users.id = essays.user_id
     WHERE essays.id = ?`,
  )
    .bind(user.id, essayId)
    .first<EssayRow>();
  if (!row) throw new ApiError(404, "Essay not found");

  const isMine = row.user_id === user.id;
  const week = weekForKey(row.week_key, new Date(), appTimeZone(env));
  if (!isMine && (!week.isUnlocked || row.status !== "submitted")) {
    throw new ApiError(404, "Essay not found");
  }

  return json({
    essay: {
      id: row.id,
      weekKey: row.week_key,
      title: row.title,
      markdown: row.markdown,
      status: row.status,
      submittedAt: row.submitted_at,
      author: {
        id: row.user_id,
        username: row.username,
        displayName: row.display_name,
      },
      isMine,
      heartCount: row.heart_count ?? 0,
      heartedByMe: Boolean(row.hearted_by_viewer),
    },
    week,
  });
}

async function setEssayHeart(request: Request, env: Env, essayId: string): Promise<Response> {
  sameOrigin(request);
  const user = await requireUser(env, request);
  const input = await body<{ hearted?: unknown }>(request);
  if (typeof input.hearted !== "boolean") throw new ApiError(400, "Hearted must be a boolean");

  const database = env.DB.withSession("first-primary");
  const essay = await database.prepare(
    "SELECT user_id, week_key, status FROM essays WHERE id = ?",
  )
    .bind(essayId)
    .first<Pick<EssayRow, "user_id" | "week_key" | "status">>();
  if (!essay) throw new ApiError(404, "Essay not found");

  const week = weekForKey(essay.week_key, new Date(), appTimeZone(env));
  if (!week.isUnlocked || essay.status !== "submitted") {
    throw new ApiError(404, "Essay not found");
  }
  if (essay.user_id === user.id) throw new ApiError(400, "You cannot heart your own essay");

  if (input.hearted) {
    await database.prepare(
      `INSERT INTO essay_hearts (essay_id, user_id, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(essay_id, user_id) DO NOTHING`,
    )
      .bind(essayId, user.id, new Date().toISOString())
      .run();
  } else {
    await database.prepare("DELETE FROM essay_hearts WHERE essay_id = ? AND user_id = ?")
      .bind(essayId, user.id)
      .run();
  }

  const heartCount = await database.prepare(
    "SELECT COUNT(*) AS count FROM essay_hearts WHERE essay_id = ?",
  )
    .bind(essayId)
    .first<number>("count");

  return json({ hearted: input.hearted, heartCount: heartCount ?? 0 });
}

async function api(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === "GET" && pathname === "/api/health") {
    return json({ ok: true });
  }
  if (request.method === "GET" && pathname === "/api/session") return session(request, env);
  if (request.method === "POST" && pathname === "/api/auth/register") return register(request, env);
  if (request.method === "POST" && pathname === "/api/auth/login") return login(request, env);
  if (request.method === "POST" && pathname === "/api/auth/logout") {
    sameOrigin(request);
    await destroySession(env, request);
    return json({ ok: true }, { headers: { "Set-Cookie": expiredSessionCookie(request) } });
  }
  if (request.method === "POST" && pathname === "/api/invitations") {
    return createInvitation(request, env);
  }
  if (request.method === "GET" && pathname === "/api/week/current") {
    return currentWeek(request, env);
  }
  if (request.method === "PUT" && pathname === "/api/essays/current") {
    return saveCurrentEssay(request, env);
  }
  if (request.method === "GET" && pathname === "/api/archive") return archive(request, env);
  const heartMatch = pathname.match(/^\/api\/essays\/([a-f0-9-]+)\/heart$/i);
  if (request.method === "PUT" && heartMatch) {
    return setEssayHeart(request, env, heartMatch[1]);
  }
  const essayMatch = pathname.match(/^\/api\/essays\/([a-f0-9-]+)$/i);
  if (request.method === "GET" && essayMatch) {
    return essayById(request, env, essayMatch[1]);
  }
  throw new ApiError(404, "Not found");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await api(request, env);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, { status: error.status });
      console.error(JSON.stringify({
        message: "Unhandled API error",
        error: error instanceof Error ? error.message : String(error),
        path: new URL(request.url).pathname,
      }));
      return json({ error: "Something went wrong" }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
