set shell := ["zsh", "-cu"]

# Verify, migrate, and deploy the application to Cloudflare.
deploy:
	bun install --frozen-lockfile
	bun test
	bun run build
	bun run db:migrate:remote
	bunx wrangler deploy
