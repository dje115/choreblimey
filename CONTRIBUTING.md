# Contributing to ChoreBlimey!

Thanks for helping make chores more fun 🎉  
This repo is a Dockerized monorepo with **TypeScript** across API, Web, and Worker.

## Stack
- **Backend**: Node 24, Fastify 5, Prisma 6, PostgreSQL 18, Redis 8, MinIO
- **Frontend**: React 18, Vite 5, Tailwind
- **Worker**: ts-node/esm (placeholder heartbeat)
- **Compose Project Name**: `choreblimey` (containers named `choreblimey_*`)

## Quick Start (Dev)
```bash
# From repo root
docker compose -f docker/docker-compose.yml --env-file docker/dev.env up --build

# In another terminal
docker compose -f docker/docker-compose.yml exec api npx prisma migrate dev --name init
docker compose -f docker/docker-compose.yml exec api npm run seed
```

## Service URLs
- **Web**: http://localhost:1500
- **API**: http://localhost:1501/v1/health  
- **MailHog**: http://localhost:1506
- **MinIO**: http://localhost:1505

## Development Guidelines

### Code Style
- **TypeScript**: Strict mode, ESNext modules, Node resolution
- **API Routes**: kebab-case URLs, camelCase in code
- **React Components**: PascalCase naming
- **Files**: kebab-case naming
- **Database**: PascalCase models, camelCase fields

### Multi-tenant Safety
- Always scope queries by `familyId` 
- Include server-side guards to prevent cross-family data leaks
- Never log secrets or PII

### Database Changes
```bash
# Update schema in api/prisma/schema.prisma
# Then create migration:
docker compose -f docker/docker-compose.yml exec api npx prisma migrate dev --name meaningful-migration-name
```

### Testing
- API health: `curl http://localhost:1501/v1/health`
- Check all services: `./check_stack.sh` (or `.ps1` on Windows)

## Coding Standards

### TypeScript
- **Strict mode on** - no implicit `any`
- Prefer explicit return types for exported functions

### API
- **Scope every query by `familyId`** - no cross-family reads/writes
- Validate inputs (e.g., zod or manual guards) and sanitize output (no PII leakage)
- Keep routes registered via `api/src/routes/index.ts`

### Frontend
- **Mobile-first** - test at 390px width
- Use Tailwind utility classes; keep components small and composable
- State: start simple (props/state). Consider React Query if/when needed

### Worker
- Keep long-running process alive; schedule jobs clearly (cron or BullMQ when added)

### Security & Privacy
- Never log secrets/PII
- Treat `nameCipher`, `dobCipher` as already-encrypted placeholders
- Add rate-limiting/auth on sensitive routes (JWT via `utils/auth.ts`)

## Branch & Commit

### Branches
- `feat/<area>-<short-desc>`
- `fix/<area>-<short-desc>`

### Commits
Use conventional commits:
```bash
feat(api): add /children/:id/streaks endpoint
fix(web): correct leaderboard tie-break
docs: update README with seed steps
```

## Adding a DB Field / Model

1. Edit `api/prisma/schema.prisma`
2. Create migration:
   ```bash
   docker compose -f docker/docker-compose.yml exec api npx prisma migrate dev --name <name>
   ```
3. Regenerate client (auto-run by migrate; run again if needed):
   ```bash
   docker compose -f docker/docker-compose.yml exec api npx prisma generate
   ```
4. Update seed if relevant: `api/src/seed.ts`

## Running Tests (placeholder)

- Add tests under `api/tests` or `web/src/__tests__` as introduced
- Prefer Vitest/Jest; keep tests deterministic

## UI/UX Guidelines

- Keep it playful but accessible (sufficient contrast, keyboard focusable controls)
- Large tap targets on mobile
- Avoid flashing/rapid animations; keep motion subtle
- Respect older-kid theme (teen mode: darker, minimal; kid mode: brighter, playful)

## Performance

- Index DB fields used in filters (already done for major relations)
- Paginate lists from the API
- Avoid N+1 by using Prisma `include` or batching where appropriate

## Environment

- All dev env vars live in `docker/dev.env`
- API listens on `:1501`, Web on `:1500`, Redis `:1507`, MinIO `:1504/1505`, MailHog `:1506`, Postgres `:1502`

## Troubleshooting

### Containers named `docker_*` from an old run?
```bash
docker compose -f docker/docker-compose.yml --project-name docker down --remove-orphans
# add -v if you want to wipe volumes
```

### YAML errors
Run `docker compose -f docker/docker-compose.yml config` to validate.

### Prisma asks for a migration name
That means validation passed — enter a short name (e.g., `init`).

## PR Checklist

- [ ] Types explicit; no stray `any`
- [ ] Routes guard by `familyId`
- [ ] Input validation present
- [ ] Mobile layout verified
- [ ] No secrets/PII in logs
- [ ] Updated docs (if needed)
