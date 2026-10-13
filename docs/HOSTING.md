# Host the free QuizMaster demo

This guide is for a temporary demo with no purchased domain. It uses Vercel for the React website and Render for the Node API and a single PostgreSQL database. The repository's `render.yaml` selects free instances. No cloud resources have been created by preparing these files.

Use sample data for this demo. Render's free PostgreSQL database expires after 30 days, and its free API sleeps after inactivity. A first request can therefore take longer. See [Render's free-instance limits](https://render.com/docs/free). The Vercel Hobby plan is for personal, non-commercial use; see [Hobby](https://vercel.com/docs/plans/hobby).

## 1. Accounts and websites

Sign up with the same GitHub account where practical. Grant repository access to `sriv144/quizmaster` when each provider requests it.

| Website | Purpose | Needed now? |
| --- | --- | --- |
| [GitHub repository](https://github.com/sriv144/quizmaster) | The committed React/Node source that the hosts build | Yes |
| [Render dashboard](https://dashboard.render.com/) | API and PostgreSQL | Yes |
| [Vercel new project](https://vercel.com/new) | React website and free `vercel.app` address | Yes |
| [Resend API keys](https://resend.com/api-keys) | Optional test password-reset email | Later |
| [Cloudflare dashboard](https://dash.cloudflare.com/) | Optional R2 image storage | Later; R2 activation can require billing |

There is no need for MongoDB, Redis, Supabase, a Prisma cloud account, a Render API key, or a Vercel API token for the dashboard setup below. Prisma is the app's database tool, not a separate database subscription.

## 2. Publish the prepared source

The hosts cannot read uncommitted local files. The rebuild and hosting changes must be committed and pushed first. Check that the selected GitHub branch contains `apps/web`, `apps/api`, `render.yaml`, and `pnpm-lock.yaml`.

Use `codex/react-node-rebuild` for a first demo, or merge the reviewed rebuild PR into `main` and select `main` on both hosts. Keep both hosts on the same source branch.

The existing public repository's old history contains a SQLite database with personal data and plaintext passwords. The rebuild deletes it from the current tree; historical copies still require a coordinated history rewrite. Do not import those personal records into this temporary demo.

## 3. Render: create the database and API together

After the branch is published, open [New Blueprint for this repository](https://dashboard.render.com/blueprint/new?repo=https://github.com/sriv144/quizmaster).

1. Connect GitHub and select `sriv144/quizmaster`.
2. Select the published rebuild branch (or `main` after merging).
3. Use `render.yaml` as the Blueprint path and name it `quizmaster-demo`.
4. Confirm both `quizmaster-api` and `quizmaster-db` show the **Free** plan, in Singapore.
5. Enter the three prompted values below. A temporary `APP_ORIGIN` is acceptable; replace it after Vercel assigns your real URL.
6. Select **Deploy Blueprint** / **Apply**. If the dashboard proposes paid resources, stop and verify the branch and Blueprint path.

| Render setting | What to enter |
| --- | --- |
| `APP_ORIGIN` | Initially `https://example.invalid`; later the exact Vercel website origin, without a trailing slash |
| `ADMIN_EMAIL` | An email you control |
| `ADMIN_PASSWORD` | A unique password, at least 12 characters, including uppercase, lowercase, and a number; store it in your password manager |

The Blueprint also sets `NODE_ENV=production`, `SEED_DEMO_DATA=true`, generates `SESSION_SECRET`, and assigns `DATABASE_URL` from the database's private connection. Do not manually replace that reference with `localhost` or a Vercel URL.

The Docker startup script applies the checked-in Prisma migrations, seeds the administrator and sample quiz, then starts the API. It deliberately uses startup migrations because Render's pre-deploy command is for paid services. See [Render deployment commands](https://render.com/docs/deploys#pre-deploy-command).

Once Render reports **Live**, copy the API's actual `https://...onrender.com` URL. Open `https://YOUR-API.onrender.com/api/v1/health/ready`; expect an HTTP 200 response.

Repeated seed runs leave existing accounts unchanged. After the first successful boot, set `SEED_DEMO_DATA=false` and remove `ADMIN_PASSWORD` from the API's Environment page, then save and redeploy. Keep the login password in your password manager. This avoids leaving bootstrap credentials in service configuration.

### What happens to the database?

Render creates the database name, username, password, hostname, and connection URL. Prisma creates the application's tables; you do not need to create them manually.

`DATABASE_URL` is a secret. The API uses the **Internal Database URL** because it runs in the same Render region. A machine outside Render would need the **External Database URL** and an allowed source IP. The demo Blueprint sets `ipAllowList: []`, restricting the database to Render's private network. See [Render database connections](https://render.com/docs/postgresql-creating-connecting).

For optional local inspection, temporarily allow only your public IP on the database's Networking page and store the External Database URL in a local, ignored `.env`. Remove that external access afterward. Never run `prisma migrate reset` on the hosted database.

## 4. Point the frontend at the actual API

In root `vercel.json`, replace only the hostname in the API rewrite:

```json
{ "source": "/api/:path*", "destination": "https://YOUR-ACTUAL-API.onrender.com/api/:path*" }
```

Commit and push the edit. The website calls `/api/v1/...` on its own origin; Vercel forwards those requests to Render. This keeps session cookies first-party. Do not put database URLs or backend secret keys into frontend variables, and do not add `VITE_DATABASE_URL`.

## 5. Vercel: deploy the React website

Open [Vercel new project](https://vercel.com/new), import `sriv144/quizmaster`, and use these settings:

| Setting | Value |
| --- | --- |
| Project name | `quizmaster-demo` or another available name |
| Root Directory | Repository root (`./`); do not change it to `apps/web` |
| Framework preset | Other; this project builds a static React Router SPA |
| Node.js version | 24.x |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm --filter @quizmaster/web build` |
| Output Directory | `apps/web/build/client` |
| Frontend environment secrets | None |

Select the published rebuild branch, or set it under Project Settings > Git > Production Branch if needed, and deploy that branch. See [Vercel's project setup](https://vercel.com/docs/getting-started-with-vercel).

Copy the assigned stable project URL, for example `https://quizmaster-demo-YOUR-NAME.vercel.app`. In Render > API > Environment, replace `APP_ORIGIN` with that exact origin, without a trailing slash, and redeploy. Use this stable URL for subsequent testing; a commit-specific preview URL is a different origin.

## 6. Test the demo

1. Open the Vercel URL and sign in with the administrator credentials supplied to Render.
2. Confirm the administrator sees the sample content.
3. Sign out, create a separate learner account, and complete the Starter Challenge.
4. Refresh and confirm the result persists.
5. Confirm a learner cannot use administrator endpoints.
6. Refresh `/subjects` directly to verify SPA routing.

Image uploads are disabled until storage is configured. Without email configuration, password reset does not deliver messages; registration and password login still work. Do not invite users who depend on password recovery until email delivery is verified.

## 7. Optional: test password-reset emails without a domain

1. Create an account at [Resend](https://resend.com/signup).
2. Open [API Keys](https://resend.com/api-keys), create a key named `quizmaster-demo` with sending permission, and copy the value once.
3. In Render > API > Environment, set `RESEND_API_KEY` to the key and `EMAIL_FROM` to `QuizMaster <onboarding@resend.dev>`.
4. Verify `APP_ORIGIN` is your stable Vercel URL and redeploy.
5. Test Forgot Password for an app account using the same email as your Resend account.

Resend's testing sender only delivers to your own account email. To send to learners, add a domain you own at [Resend Domains](https://resend.com/domains), install the DNS records Resend supplies, wait for verification, and use a sender on that domain. See [API key permissions](https://resend.com/docs/dashboard/api-keys/introduction), [domain verification](https://resend.com/docs/dashboard/domains/introduction), and [testing sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

## 8. Optional later: R2 image storage and keys

The current admin screen authors text questions; the media API exists, but a complete image picker and attachment flow still needs frontend integration. Creating R2 credentials alone does not add image controls to that screen. R2 is unnecessary for the initial text-only demo.

If you enable storage later:

1. Open [Cloudflare](https://dash.cloudflare.com/), select your account > **R2 Object Storage**, activate it after reviewing billing, and create a bucket named `quizmaster-media`.
2. Under the R2 overview's Account Details, select **Manage** beside API Tokens. Create an R2 token with **Object Read & Write**, scoped to that bucket. Copy the **Access Key ID** and **Secret Access Key**. The general Cloudflare API token is not the S3 secret. See [R2 authentication](https://developers.cloudflare.com/r2/api/tokens/).
3. For a demo, enable the bucket's **Public Development URL** in Settings and copy its `https://pub-....r2.dev` origin. A public media bucket must contain only images intended to be public, never database backups or answer keys. For production, attach a custom media domain instead; `r2.dev` is for development. See [public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).
4. Add the following variables only to the Render API, then redeploy.

| Variable | R2 value |
| --- | --- |
| `S3_ENDPOINT` | `https://ACCOUNT_ID.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `quizmaster-media` |
| `S3_ACCESS_KEY_ID` | R2 Access Key ID |
| `S3_SECRET_ACCESS_KEY` | R2 Secret Access Key |
| `S3_PUBLIC_URL` | The public `https://pub-....r2.dev` origin, or your media domain; no trailing slash |

In the bucket's Settings > CORS Policy, add the policy below, replacing the origin with your exact stable frontend URL. Presigned uploads still need CORS. See [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/).

```json
[
  {
    "AllowedOrigins": ["https://YOUR-PROJECT.vercel.app"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Render asks for a paid database | Selected branch must contain the demo `render.yaml` with `plan: free` for both resources |
| API won't start | Render logs; database readiness; automatically assigned `DATABASE_URL`; administrator password requirements on first seed |
| Frontend builds fail | Node 24, repository-root setting, frozen lockfile install, and published source branch |
| Vercel API requests return 404 or 502 | Actual Render hostname in `vercel.json`; API health; possible free-service cold start |
| Login works but reset email is absent | `RESEND_API_KEY`, `EMAIL_FROM`, actual `APP_ORIGIN`, and testing-recipient restriction |
| Upload returns 503 | Storage intentionally disabled until all required S3 settings exist |
| Browser upload gives a CORS error | Exact frontend origin in bucket CORS; permitted PUT and headers |
| Seed no longer changes admin password | Intentional: it only creates a missing account. Use password recovery once email is configured |

Before keeping real data, move to persistent hosting, verify backups and recovery, resolve flagged legacy content, and complete the remaining media and admin editing/review flows.
