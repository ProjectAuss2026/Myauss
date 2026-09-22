# Architecture

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="runtime.architecture.dark.png" />
  <img src="runtime.architecture.light.png" alt="AUSS runtime architecture: members' browsers run the React SPA, which calls /api through a security pipeline to the Express API, then Prisma and PostgreSQL. Auth, scheduled jobs and PostgreSQL run on Railway; Stripe, Brevo and Sentry are external services." />
</picture>

The runtime architecture of the production codebase, generated with [Archify](https://github.com/tt-a1i/archify).

| File | What it is |
|---|---|
| [`runtime.architecture.json`](runtime.architecture.json) | The source. Edit this, then regenerate. |
| [`runtime.architecture.html`](runtime.architecture.html) | The interactive diagram, a single self-contained file |
| `runtime.architecture.light.png` / `.dark.png` | Static previews for GitHub |

## Viewing the interactive diagram

GitHub shows `.html` files as source code, so **download [`runtime.architecture.html`](runtime.architecture.html) and open it in a browser**. It needs no install and works offline. In it you can:

- play the three guided views: **Request path**, **Card payments** and **Background jobs**
- click any component and follow its **SRC** links to the exact files and lines it was drawn from on GitHub
- trace a route between two components, switch between light and dark, or export PNG or SVG

## What it reflects

- The diagram is pinned to `main` at [`aace5f7`](https://github.com/ProjectAuss2026/Myauss/commit/aace5f7e9dfe4ccdb45e0260c573ac6f7e3dc325) (17 Sep 2026). All 24 source links were verified against that commit when it was generated. They keep working, but won't reflect later changes.
- Everything inside **Railway · production** runs in the `auss-backend` service or its PostgreSQL database. Stripe, Brevo and Sentry are external services.
- Not shown yet, because they weren't in production at that commit: the event waitlist (#84) and the removal of SMTP email.

## Regenerating it

Regenerate after a change to the architecture: a new external service, a new background job, or a move of where something runs.

```bash
# Archify is a zero-dependency Node CLI. This diagram was built with commit 5289f68.
git clone https://github.com/tt-a1i/archify.git ../archify
export ARCHIFY_UPDATE_CHECK_DISABLED=1     # skip the optional update check
ARCHIFY=../archify/archify/bin/archify.mjs

# 1. Edit runtime.architecture.json. Set meta.repository.revision to the new
#    main commit (full SHA), and update any source line numbers that moved.

# 2. Validate. Repeat until it reports 0 errors and 0 warnings.
node $ARCHIFY validate architecture docs/architecture/runtime.architecture.json \
  --quality showcase --repo-root . --json

# 3. Render the HTML. This re-verifies every source link against that commit.
node $ARCHIFY deliver architecture docs/architecture/runtime.architecture.json \
  docs/architecture/runtime.architecture.html --quality showcase --repo-root . --json
```

`--repo-root` must be a clone of this repo that has fetched the pinned commit.

To refresh the preview images, copy the HTML somewhere outside the repo and run `node $ARCHIFY visual-check <copy>.html --json`. It writes screenshots next to the file. Crop the diagram panel out of the `2048x1320` screenshots.

Archify is also an agent skill (`npx skills add tt-a1i/archify`). An AI coding agent with it installed can make these edits for you.
