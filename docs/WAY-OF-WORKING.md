# Way of working: how we write code

These rules keep the codebase consistent and easy to read for everyone on the team. Follow them in every PR.
Reviewers can ask for changes based on this document.

The project is **NestJS + TypeScript in pure ESM** (`"type": "module"`, `module: nodenext`). Some rules below
exist because of that, so read the *Imports* notes carefully.

---

## 1. Folder structure and barrel exports (`index.ts`)

Every folder has an **`index.ts` that re-exports its public API**. Code outside the folder imports from the
barrel, never from a file deep inside it.

```
src/
  users/
    index.ts                ← barrel: exports what other modules may use
    users.module.ts
    users.controller.ts
    users.service.ts
    dto/
      index.ts
      create-user.dto.ts
      update-user.dto.ts
    entities/
      index.ts
      user.entity.ts
    utils/
      index.ts
      normalize-email.util.ts
```

```ts
// src/users/dto/index.ts
export * from './create-user.dto.js';
export * from './update-user.dto.js';

// src/users/index.ts
export * from './users.module.js';
export * from './users.service.js';
export * from './dto/index.js';
export * from './entities/index.js';
```

```ts
// ✅ from another module
import { UsersService, CreateUserDto } from '../users/index.js';

// ❌ reaching into another module's internals
import { UsersService } from '../users/users.service.js';
```

Rules:

- **Imports use the `.js` extension** and point to `index.js` explicitly (`'../users/index.js'`, not `'../users'`).
  Node ESM does not resolve folder imports or missing extensions, so TypeScript (`nodenext`) rejects them at
  compile time.
- A barrel exports only what other folders need. Internal helpers stay unexported.
- **Inside a folder, import siblings directly** (`'./users.service.js'`), never through your own barrel. Doing that
  creates circular imports, which show up as `undefined` classes at runtime and Nest DI errors.
- Prefer named exports. Use no default exports, except where a tool requires one (`src/db/data-source.ts` for
  the TypeORM CLI).

**Exceptions: these folders have no `index.ts`:**

| Folder | Why |
|---|---|
| `src/db/migrations/` | TypeORM loads **every file** in it as a migration; an `index.ts` would break `migration:run`. |
| `src/db/scripts/` | Executable entry points, not modules. |
| `test/` | Test files are not imported by anything. |
| `src/` (root) | `main.ts` / `app.module.ts` are the app entry. |

---

## 2. No logic in the `return`

A `return` statement **returns a value; it doesn't compute it**. Calculations, conditions, mapping and calls are
done first and stored in **well-named variables**. The return then reads like a sentence.

```ts
// ❌ logic inside the return
return {
  ...mentor,
  rating: reviews.length ? reviews.reduce((s, r) => s + r.score, 0) / reviews.length : null,
  isAvailable: slots.some((s) => s.dayOfWeek === today && !s.isBooked) && mentor.status === 'APPROVED',
};

// ✅ logic in variables, simple return
const totalScore = reviews.reduce((sum, review) => sum + review.score, 0);
const averageRating = reviews.length ? totalScore / reviews.length : null;
const hasFreeSlotToday = slots.some((slot) => slot.dayOfWeek === today && !slot.isBooked);
const isApproved = mentor.status === 'APPROVED';
const isAvailable = hasFreeSlotToday && isApproved;

return { ...mentor, rating: averageRating, isAvailable };
```

The same applies to:

- **Conditions:** `if (isEligibleForReview)` rather than `if (enrolment.status === 'ACTIVE' && sessions.length >= 1 && !review)`.
- **Function arguments:** don't nest calls such as `send(format(build(user)))`. Name each step.
- **Ternaries:** at most one level. Nested ternaries become `if` / early returns or a variable per case.

Variable names describe **what the value means**, not how it was computed: `averageRating`, `isAvailable`,
`pendingApplications`. Avoid `result`, `data`, `temp` or `x`. Booleans start with `is` / `has` / `can` / `should`.

---

## 3. Util files

When logic is **pure** (no Nest DI, no database, no HTTP) and is either reused or makes a service hard to read,
move it into a util file.

Where it goes:

| Scope | Location |
|---|---|
| Used by one feature only | `src/<feature>/utils/` |
| Used by several features | `src/common/utils/` |
| Database helpers | `src/db/utils/` |

Rules:

- File name: `kebab-case` + `.util.ts`, e.g. `money.util.ts`, `normalize-email.util.ts`.
- **One topic per file.** Never create a catch-all `utils.ts` / `helpers.ts` file.
- Utils are **pure functions**: same input → same output, no side effects, no `this`. Anything needing DI or I/O
  is a service (provider), not a util.
- Export utils through the folder's `index.ts` (rule 1).
- Every util has a `*.spec.ts` next to it. Pure functions are the easiest code to test.
- Don't create a util "just in case". Extract it when it's reused, or when naming it makes the caller clearer.
- Before writing a new util, check `src/common/utils/` for one that already does the job.

```ts
// src/common/utils/money.util.ts
const BANI_PER_RON = 100;

export const ronToBani = (ron: number): number => Math.round(ron * BANI_PER_RON);
export const baniToRon = (bani: number): number => bani / BANI_PER_RON;
```

---

## 4. Functions and classes

- **One responsibility per function.** If you need "and" to describe it, split it. Aim for functions that fit on
  one screen (~30 lines).
- **Early returns** instead of deep nesting: handle invalid cases first, then the happy path.
- **Max ~3 parameters.** Beyond that, pass one typed object (`{ mentorId, from, to }`).
- **Controllers stay thin.** They take the request, call a service, and return its result. Business rules live in
  services; data access goes through repositories or the service layer.
- **Don't swallow errors.** Throw Nest HTTP exceptions (`NotFoundException`, `BadRequestException`…) with a clear
  message. Never write an empty `catch {}`.

## 5. Naming

| Thing | Convention | Example |
|---|---|---|
| Files | `kebab-case` + Nest suffix | `mentor-profile.service.ts`, `create-session.dto.ts` |
| Classes, types, interfaces | `PascalCase` | `MentorProfileService`, `SessionStatus` |
| Variables, functions | `camelCase` | `pendingApplications`, `calculateCommission()` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_APPLICATION_QUESTIONS` |
| DB tables / columns | `snake_case` (set by migrations) | `mentor_profiles.status_reason` |

## 6. Types

- `strict` mode stays on. **Don't use `any`.** The linter allows it, but the team doesn't. Use `unknown` and narrow
  it, or write the proper type.
- Public service methods declare their return type.
- Statuses and types use **string literal unions or `as const` objects** that match the DB `CHECK` values exactly.
- Use `import type { … }` for type-only imports.

## 7. No magic values

Numbers and strings that carry meaning become named constants: limits (`MAX_MENTEE_QUESTIONS = 3`), statuses,
durations, rates. Money is always an **integer in bani** (RON × 100), as in the database.

## 8. Async code

- Always `await` promises or return them. Lint enforces this with `no-floating-promises`.
- Independent calls run in parallel with `Promise.all`, not one after another.
- Use `async`/`await`, not `.then()` chains.

## 9. Database

- Schema changes go **only through new migrations** (`synchronize` stays `false`). See [DATABASE.md](DATABASE.md).
- **Never edit a migration that has already run** anywhere shared. Write a new one instead.
- Keep migration filenames and class names unchanged: TypeORM tracks them by name.
- Rules the database already enforces (see `DB-SCHEMA.md`) can still be checked in the service for a friendly error,
  but the DB constraint is the source of truth.

## 10. Config and secrets

- Read config from environment variables, never hard-code it. See [ENVIRONMENT.md](ENVIRONMENT.md).
- Never commit secrets, real connection strings, tokens or real user data.

## 11. Comments

- Comment **why**, not what. If the code needs a comment to explain *what* it does, rename variables or extract a
  function instead.
- No commented-out code in PRs. Git keeps the history.
- `TODO`s include a reason or ticket: `// TODO(#42): handle partial refunds`.

## 12. Tests

- Unit tests live next to the code as `*.spec.ts`; e2e tests live in `test/` as `*.e2e-spec.ts` (Vitest).
- New logic comes with tests: utils always, services for their business rules.
- A test name says the expected behaviour: `it('rejects an application without answers')`.

---

## Before opening a PR

- [ ] Every new folder has an `index.ts`, except the folders listed as exceptions in rule 1, and imports from other folders go through barrels.
- [ ] No logic in `return` statements; values are named.
- [ ] Pure, reusable logic lives in a `*.util.ts` in the right `utils/` folder, with a spec.
- [ ] No `any`, no magic values, no empty `catch`, no commented-out code.
- [ ] `npm run lint`, `npm run format`, `npm test` and `npm run build` all pass.
- [ ] Schema changes are in a new migration; no secrets in the diff.
