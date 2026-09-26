# Demo data

Presentation/demo data for Campus Skill Exchange. It creates a small, realistic
ecosystem so the app can be demonstrated end to end:

**Login → Profile → Skills → Learning Goals → Discovery → Matching → Mutual Exchange**

## Enabling the seed

The seed refuses to run unless you explicitly opt in.

```bash
# PowerShell
$env:DEMO_SEED='true'

# bash
export DEMO_SEED=true
```

Two further safety rules are always enforced:

- The seed **refuses to run when `NODE_ENV=production`**.
- The seed **only ever creates, updates, or deletes rows whose email starts with
  `demo.`**. Real accounts and data are never touched.

`DATABASE_URL` is read from the repository-root `.env`, exactly as the Prisma CLI
does. Make sure that file points at a database you are happy to modify.

## Commands

```bash
npm run demo:seed     # create or update the demo ecosystem (idempotent)
npm run demo:reset    # delete only the demo users and their dependent rows
```

Both are safe to run repeatedly. `demo:seed` uses upserts keyed on the existing
unique constraints (`User.email`, `Skill.normalizedName`, `BadgeDefinition.code`,
`UserSkill(userId, skillId)`, and so on), so running it twice creates **no
duplicates**.

## Demo accounts

All demo accounts share one password. It is only a local presentation credential
and exists nowhere in the application code.

| Email                      | Role        | Demonstrates                                      |
| -------------------------- | ----------- | ------------------------------------------------- |
| `demo.kaviya@example.test` | USER        | Teaches Java + JavaScript, wants AWS + SQL        |
| `demo.arun@example.test`   | USER        | Teaches AWS + Cloud Computing, wants Java + React |
| `demo.priya@example.test`  | USER        | Teaches React + UI/UX, wants Python + ML + DBMS   |
| `demo.rahul@example.test`  | USER        | Teaches Python + ML, wants React + SQL + AWS      |
| `demo.ananya@example.test` | USER        | Teaches SQL + DBMS, wants JavaScript + Cloud      |
| `demo.admin@example.test`  | USER, ADMIN | Admin Control Centre, analytics, safety reports   |

**Password:** `DemoExchange2026!`

Override it with `DEMO_PASSWORD` (minimum 12 characters) if you prefer. The
password is only applied when an account is first created, so a later re-run
never silently overwrites a password you changed by hand.

## What the seed creates

- **10 canonical skills** — Java, Python, JavaScript, React, AWS, SQL, UI/UX,
  Machine Learning, Cloud Computing, DBMS.
- **6 users** with argon2id-hashed `PasswordCredential` rows and explicit
  `UserRole` rows, so every account can actually sign in.
- **6 profiles** with department, year, institution, bio, and interests.
- **UserSkill rows** split into `canTeach: true` and `canTeach: false`, which is
  what Discovery and Matching read.
- **LearningGoals** so each user has explicit "skills I want to learn".
- **Availability slots** for the teaching users.
- **6 certifications** (mostly `VERIFIED`, one `PENDING`).
- **5 projects**.
- **4 badge definitions** and **4 badge awards**.

### Matching is designed to be obvious

The teach/want sets produce these mutual pairs out of the box:

- **Kaviya ↔ Arun** — Kaviya teaches Java, Arun wants Java; Arun teaches AWS, Kaviya wants AWS.
- **Kaviya ↔ Ananya** — JavaScript and SQL.
- **Priya ↔ Rahul** — React and Python.
- **Priya ↔ Ananya** — UI/UX and DBMS.

There are also several one-directional matches, so Discovery looks realistic
rather than perfectly symmetrical.

## What the seed deliberately does NOT create

To keep the demo truthful, the seed does **not** fabricate:

- Google Calendar/Meet links — ONLINE sessions must be scheduled through the
  real Google integration.
- Razorpay payments or transactions — payments require real provider
  verification and a webhook.
- Ratings, assessments, reputation, session records, or notifications — these
  are produced by genuine user flows.

Those areas are created by actually using the product during a demo.

## Reset warning

`npm run demo:reset` performs a **hard delete** of every demo user and relies on
the existing database cascades to remove their profiles, skills, goals,
availability, certifications, projects, sessions, and notifications.

- It matches **only** emails beginning with `demo.`, so real accounts are safe.
- `UserBadge` rows are deleted first, because `UserBadge → BadgeDefinition` is an
  `onDelete: Restrict` relation.
- **Badge definitions are kept** — they are shared lookup data.

```bash
npm run demo:reset
```

Never run the reset against a database you cannot afford to lose, and never run
either command with `NODE_ENV=production` (both refuse).
