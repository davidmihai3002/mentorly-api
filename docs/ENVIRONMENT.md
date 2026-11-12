# Environment variables & secrets

Everything sensitive this project needs (connection strings, keys, tokens) is configured **outside the code
and outside the docs**. This file explains what each value is, where it lives and how to get it. It never
contains the real values.

## Rules

- Real values go only in **`.env`** at the repo root (git-ignored, see `.gitignore`) or in the hosting
  provider's environment settings in production.
- Never put a real secret in `README.md`, in `docs/`, in code, in a commit message or in an issue/PR.
- Share secrets with teammates through a password manager or the provider's team access, not through chat or git.
- Variables set in the shell override `.env`, so you can point a single command at another database:
  `DATABASE_URL=postgres://... npm run migration:run:each -- --list`
- If a secret ever lands in git, **rotate it** (revoke and issue a new one). Deleting it in a later commit does
  not remove it from the history.

`.env` is loaded by `src/db/typeorm.config.ts` (Node's `process.loadEnvFile`) for the app, the TypeORM CLI and
`src/db/scripts/run-migrations.ts`. Run commands from the repo root; `npm run` does this for you.

## Variables

| Variable | Used by | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | app, TypeORM CLI, migration script | yes | PostgreSQL connection string, see below |
| `NODE_ENV` | `SeedDemoData` migration | no | `production` skips the demo users and demo content |
| `PORT` | `src/main.ts` | no | HTTP port, default `3000` |
| `OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET` | NestJS Observe (once installed) | no | written to `.env` by `npx @nestjs/observe link`; in production set them in the host's environment |

### `DATABASE_URL`

Format (placeholders only):

```bash
DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database>
```

- **Hosted** (Neon, Supabase, Railway, RDS…): use the URL the provider gives you, usually with
  `?sslmode=require` at the end. Some providers (e.g. AWS RDS) also need their CA certificate. Your IP may have
  to be allow-listed.
- Prefer one database user per person over one shared password, so access can be revoked individually.
- Without `NODE_ENV=production`, migrations insert the demo users (known password, see
  [DATABASE.md](DATABASE.md)). Don't do that on a database other people can reach unless you mean to.

## Tokens that must not be in the repo

- **CircleCI status-badge token.** `README.md` used to contain a CircleCI badge URL with a `?token=` value
  (committed in `da2b1e3 init`). It was removed from the README. If that token is real, revoke it in CircleCI
  (Project Settings → API Permissions) and use a public badge without a token, or keep the token out of the repo.
