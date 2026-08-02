set shell := ["zsh", "-cu"]

# Verify, migrate, and deploy the application to Cloudflare.
deploy:
	#!/usr/bin/env zsh
	set -euo pipefail

	bun install --frozen-lockfile
	bun test
	bun run build

	integer migration_attempt=1
	integer migration_attempts=3
	until bun run db:migrate:remote; do
		if (( migration_attempt >= migration_attempts )); then
			print -u2 -- "Remote D1 migration failed after ${migration_attempts} attempts. Deployment stopped."
			exit 1
		fi

		integer retry_delay=$((migration_attempt * 3))
		print -u2 -- "Remote D1 migration attempt ${migration_attempt} failed; retrying in ${retry_delay}s…"
		sleep ${retry_delay}
		(( migration_attempt += 1 ))
	done

	bunx wrangler deploy
