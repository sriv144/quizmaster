# QuizMaster

QuizMaster is a full-stack quiz and assessment platform for learners and administrators.

## Stack

- React 19 and React Router Framework Mode (`apps/web`)
- NestJS with Fastify (`apps/api`)
- PostgreSQL and Prisma ORM
- pnpm workspaces

## Architecture

- `apps/web` contains the responsive learner and administrator SPA. Vercel serves it and proxies `/api/*` to Render so secure session cookies remain first-party.
- `apps/api` contains the versioned NestJS API, OpenAPI UI, session authentication, quiz authoring, attempt snapshots, grading, analytics, and presigned media uploads.
- `packages/api-client` is the typed browser boundary for API requests and CSRF headers.
- `migration` is the one-time, idempotent SQLite-to-PostgreSQL importer.
- PostgreSQL owns transactional data. S3-compatible object storage such as Cloudflare R2 owns question media; uploaded files are never stored on the API filesystem.

## Local development

1. Install Node.js 24 LTS and pnpm 11.
2. Copy `.env.example` to `.env` and `apps/web/.env.example` to `apps/web/.env`.
3. Start PostgreSQL, MinIO, and Mailpit with `docker compose up -d`.
4. Run `pnpm install`, `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:seed`.
5. Start both applications with `pnpm dev`.

The web app runs at `http://localhost:5173`, the API at `http://localhost:3000`, and Mailpit at `http://localhost:8025`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run web and API development servers |
| `pnpm build` | Build all workspaces |
| `pnpm test` | Run unit and integration tests |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm lint` | Run ESLint |
| `pnpm db:migrate` | Apply a development migration |
| `pnpm db:seed` | Seed a local administrator and sample content |
| `pnpm migrate:legacy` | Import a legacy SQLite database |

API documentation is available at `http://localhost:3000/api/docs` outside production.

## Legacy migration

1. Apply the PostgreSQL schema with `pnpm db:deploy`.
2. Point `LEGACY_DATABASE_PATH` at a read-only copy of `quiz_master.db` and optionally set `MIGRATION_OUTPUT_DIR`.
3. Run `pnpm migrate:legacy`. The command can be rerun safely: legacy IDs and attempt positions are upserted rather than duplicated.
4. Review `legacy-import-report.json`. Ambiguous answer keys, empty quizzes, historical question-count mismatches, and media paths that still need an object-storage upload are called out explicitly.
5. Keep flagged historical grades unchanged. Repair draft content separately, upload the listed media to object storage, and only then publish the affected quizzes.

Migrated accounts do not receive their old passwords. They are marked for a secure password-reset flow.

## Deployment

- For the selected temporary free demo with no domain, follow [the step-by-step hosting guide](docs/HOSTING.md).
- The current Blueprint provisions free Render API and database instances; the database expires after 30 days. Use sample data for this demo.
- Create the Render API and PostgreSQL database from `render.yaml`.
- Configure optional R2/S3 and Resend values in the Render API Environment page when enabling images or email. The text-only demo starts without them.
- Confirm the API service hostname in the `/api` rewrite in `vercel.json`, then import the repository into Vercel.
- Set `APP_ORIGIN` to the final Vercel origin and deploy. The container startup applies checked-in Prisma migrations; optional `SEED_DEMO_DATA=true` bootstraps a sample quiz and administrator.
- Run the legacy import from a trusted machine or one-off private job; do not upload the SQLite source to Git or a public build service.

The CI workflow runs schema generation, migrations, linting, typechecking, tests, and production builds on Node 24.

## Security note

The original Flask repository committed a SQLite database containing plaintext passwords and personal information. The new importer never carries those passwords forward: migrated users must claim their account through a password-reset link. The historical database and generated migration reports must not be recommitted. Removing them from this branch does not remove them from existing Git history; rotate exposed credentials and perform a coordinated history rewrite before making the repository public.
