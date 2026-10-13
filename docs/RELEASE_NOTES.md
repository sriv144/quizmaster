Replace the Flask application with a React 19 / React Router SPA and a NestJS/Fastify API backed by PostgreSQL and Prisma. Learners can register, sign in, take quizzes, save answers, submit attempts, and review results; administrators can create content, publish quizzes, and inspect account activity.

The initial hosting target is a temporary free demo without a purchased domain. `render.yaml` provisions a free API and PostgreSQL database in Singapore, generates the session secret, and asks for administrator credentials. Container startup applies migrations and optionally seeds a sample quiz. `docs/HOSTING.md` walks through Render and Vercel setup, connection URLs, optional Resend testing, and optional R2 credentials.

Authentication uses Argon2 password hashes, opaque sessions, role checks, CSRF headers, and a global rate-limit guard. Attempt questions are snapshotted and graded server-side. Missing storage configuration leaves the API usable with uploads explicitly disabled. Hosted password-reset tokens are not logged when email delivery is unconfigured.

The legacy importer preserves historical grades, discards plaintext passwords, normalizes question types, and flags ambiguous keys, empty quizzes, and historical count mismatches. The current tree removes the committed virtual environment, Flask templates, uploads, bytecode, and SQLite database. Historical personal data remains in the existing public repository history and needs a separately coordinated cleanup.

Validation:

- Local lint, workspace typechecking, four API unit tests, and production builds pass.
- Prisma client generation succeeds without a build-time DATABASE_URL.
- Earlier local HTTP/browser checks covered authentication, registration, quiz submission, grading, and results; the hosted configuration has not yet been exercised.
- Docker image build remains unverified: the local Docker Desktop installation fails during inference-manager initialization.

Remaining before public launch:

- Create the hosting accounts/resources, update the actual Render hostname in `vercel.json`, and set the final frontend APP_ORIGIN.
- Run hosted smoke tests, including cookie forwarding and password recovery.
- Review migrated content; keep the temporary free demo on sample data. Render free databases expire after 30 days.
- Complete admin content editing/migration-review controls and question-image upload/attachment UI. The current authoring UI creates text questions and the media API is not yet wired to an image picker.
- Verify backups and resolve the sensitive-data exposure in Git history before using real learner records.
