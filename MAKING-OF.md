# Making of Trip Planner

The running story of this project: what got decided, what got tested, and what turned out
to be wrong. Appended to after every working session. Newest entry at the bottom. Rules:
`CLAUDE.md` in the Projects-AI root.

The point of this file is the wrong turns. README.md says where things landed; this is
the record of how, so a decision doesn't get re-litigated in six months because nobody
remembers why it went the way it did.

---

## Session 1 — 8 Oct 2026: the file starts

Created in the Projects-AI making-of review, which found this project had no making-of.
Nothing in the project itself changed in that session.

**Before this file:** 33 commits from 21 Mar 2026 in git log.

## Session 2 — 22 Oct 2026: Node 22.23.4 for the October security release

**How this was found.** Node's 21 Oct 2026 security release (fixes in 22.23.4) was patched
across the fleet on 21–22 Oct. Trip-planner was missed at first. WRONG THEORY: "it isn't
deployed anywhere", based on checking pi5-ai2 only. It turned up while writing the
security-watch brief (`infra/home-network/security-watch/BRIEF.md`, R2), on **Pi5-RGB** at
`/home/davin/docker/my-trip-planner`. Measured: `docker exec my-trip-planner-app-1 node -v`
gave **v22.22.2**. The image was built **7–8 May 2026** from the floating `node:22-alpine`, and
the checkout was at `0cb45cb`. Exposure: the noBGP service "My Trip Planner (Private)", so
only signed-in noBGP users could reach it.

**What production was behind.** Only 6 commits: `06fde16` (Dependabot grouping), the project
card, the folder move and this file's first entry. No code, migrations or Dockerfile changes,
so deploying `main` shipped only the pin.

**Change (PR #24, merged as `f4fc2e4`):** all three `infra/Dockerfile` stages went from
`node:22-alpine` to `node:22.23.4-alpine`. The brief asked for `--no-audit` as in the npm apps,
but this one installs with **pnpm** (`pnpm install --frozen-lockfile`, `packageManager:
pnpm@10.32.1`), which has no audit step during install. The install finished without the stall
the npm builds had on 22 Oct, so nothing was added.

**A permission surprise.** The checkout on Pi5-RGB belongs entirely to **root** (286 entries
under `.git`, `FETCH_HEAD` `root:root 644`), even though it sits in `/home/davin` and the noBGP
node's configured user is `davin`. A `git fetch` as `davin` failed with `cannot open
'.git/FETCH_HEAD': Permission denied`. Ownership was left alone; git ran as root, the same way
the checkout was created.

**Tested before deploy:** a worktree of the branch at `/home/davin/docker/tp-node-test`, built
under a separate compose project (`-p tp-node-test`, using production's `infra/.env` via
`--env-file`). `next build` took 164 s, EXIT 0. The build log showed `BetterAuthError: You are
using the default secret`: `BETTER_AUTH_SECRET` is a runtime env var, not a build arg, so at
build time Better Auth sees no secret. Not new, and the running container has the secret set
(checked by presence and length, not by value). The image then ran on `my-trip-planner_internal`
with the live container's environment, on `127.0.0.1:3910`. Its responses matched production's
baseline, taken first:

| Route | Production before (v22.22.2) | Test image (v22.23.4) |
|---|---|---|
| `/` | 307 → `/login?callbackUrl=%2F`, 22 B | 307 → `/login?callbackUrl=%2F`, 22 B |
| `/api/auth/ok` | 200, 11 B | 200, 11 B |
| `/api/auth/get-session` | 200, 4 B (`null`) | 200, 4 B |
| `/login` | — | 200 |

**Deploy (22 Oct ~03:40 UTC).** The old image was tagged `my-trip-planner-app:pre-node-20261022`
(`faa975878333`) for rollback, then `git pull --ff-only` to `f4fc2e4` and, in `infra/`,
`docker compose up -d --build --no-deps app`, EXIT 0. Postgres, redis and minio weren't
touched (still `Up 2 weeks`).

**Verified after:** app `node -v` **v22.23.4** (image `c04c9470155d`), `Ready in 190ms`;
`/` 307, `/api/auth/ok` 200, `/api/auth/get-session` 200, `/login` 200 (7,599 B); a signed-out
fetch of the noBGP link returns **307 to `auth.nobgp.com`**, so the link is still private. The
test worktree and test image were removed. **Not verified:** a signed-in session, trips loading,
Gmail import or uploads. Those need Davin's login.

**Rollback, if needed:** `docker tag my-trip-planner-app:pre-node-20261022
my-trip-planner-app:latest`, then `docker compose up -d --no-build --no-deps app` in `infra/`.

**Seen in passing, not acted on:**
- Four Dependabot PRs have been open since May and August (#13, #14, #15, #20; #20 groups 29
  updates).
- `minio/minio:latest` can no longer be pulled (`pull access denied`, Watchtower log), so minio
  is frozen at whatever version it's on.
- Watchtower can't update this app either, because the image is built locally. It logs that as
  "Unable to update" but still counts it under `Failed=0`.
