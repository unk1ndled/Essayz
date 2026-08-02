# Repository Guidelines

## Project Structure & Module Organization

Essayz is a React 19 single-page application backed by a Cloudflare Worker and D1. Keep browser code in `src/`: `App.tsx` coordinates screens, `api.ts` owns HTTP calls, and Markdown-related components live beside their helpers. Global presentation is in `src/styles.css`; static install assets belong in `public/`. Worker routes and domain logic live in `worker/`, while ordered D1 schema changes live in `migrations/`. Vitest suites are under `tests/` and mirror the behavior they exercise, such as `tests/auth.test.ts`.

## Build, Test, and Development Commands

Use Bun as the package manager and task runner.

- `bun install` installs the locked dependencies from `bun.lock`.
- `bun run db:migrate:local` applies D1 migrations to local `.wrangler/` data.
- `bun run dev` starts Vite with the Worker integration.
- `bun test` runs all Vitest suites once.
- `bun run typecheck` checks the app, Worker, and tests with strict TypeScript.
- `bun run build` type-checks and creates the production bundle.
- `just deploy` runs the verified install, test, build, migration, and Cloudflare deployment workflow.

## Coding Style & Naming Conventions

Write strict TypeScript with two-space indentation, double quotes, semicolons, and trailing commas in multiline constructs. Use `PascalCase` for React components and exported types, `camelCase` for functions and variables, and descriptive lowercase filenames for non-component helpers. Keep API boundaries typed and avoid leaking Worker-specific types into UI modules. No formatter or linter is configured, so match surrounding code and rely on `bun run typecheck` before submitting.

## Testing Guidelines

Use Vitest (`describe`, `it`, and `expect`). Name suites `*.test.ts` and place them in `tests/`. Add focused tests for authentication, scheduling/timezone boundaries, Markdown transformations, and other server-enforced product rules. There is no numeric coverage threshold; every behavior change should include a regression test where practical. Run `bun test` and `bun run build` before opening a pull request.

## Database & Configuration

Add schema changes as new sequential SQL files such as `migrations/0005_feature_name.sql`; never rewrite an applied migration. Non-secret runtime settings belong in `wrangler.jsonc`. Do not commit credentials, session material, or generated `.wrangler/` data.

## Commit & Pull Request Guidelines

Follow the existing history's short, lowercase, feature-oriented subjects (for example, `invite links`). Keep commits narrowly scoped. Pull requests should explain the user-visible change, call out migrations or configuration updates, list verification commands, and link related issues. Include screenshots for UI or responsive-layout changes.
