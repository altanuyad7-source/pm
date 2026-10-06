# Code review

Date: 2026-10-06. Scope: backend/, frontend/, scripts/, Dockerfile, and compose.yaml at commit b7f9063, plus the one uncommitted line in frontend/src/test/setup.ts. Reviewed against AGENTS.md, docs/PLAN.md, and docs/DATABASE.md.

## Verdict

The core is sound. Storage is transactional with ownership checks, invalid input is rejected without side effects, and every suite passes. Nothing found loses data or matters for security in a local single-user MVP. The issues worth fixing are in drag-and-drop placement, keyboard accessibility, and dependency hygiene.

## Checks run

| Check | Result |
| --- | --- |
| Backend pytest | 28 passed (needed a redirected temp directory on this machine, see Environment) |
| `npm run lint` | clean |
| `npm run test:unit` | 12 passed |
| `npx tsc --noEmit` | 0 errors in the working tree, 38 errors on the committed tree (finding 4) |
| `npm run build` | passes, both in the working tree and on a clean copy of the commit |
| `npm run test:e2e` | 8 passed, using installed Edge |
| `npm audit` | 27 vulnerable packages: 4 critical, 18 high, 4 moderate, 1 low (finding 3) |
| Docker build, start, stop | not run: Docker is not installed here |

Each finding is marked Verified (reproduced by running the code), By inspection, or Not run.

## Fix first

### 1. A card cannot be appended to another column that already has cards

frontend/src/lib/kanban.ts:148. Verified in Edge.

A cross-column drop always inserts the card before the card it resolves to, and a drop in the empty space below the last card still resolves to that last card:

- card-3 released 60px below card-8 in Done gave `card-7, card-3, card-8`
- card-1 released 150px below card-6 in Review gave `card-1, card-6`
- card-2 released 250px below card-5 in In Progress gave `card-4, card-2, card-5`

The only way to put a card last is to move it into the column and then reorder it. Empty columns and same-column reordering work correctly. There is no `onDragOver`, so nothing previews where the card will land.

Tests encode the current behavior: kanban.test.ts "moves cards to another column" expects insert-before, and the E2E test "moves a card between columns" checks only the column, not the position.

Suggested fix: in `handleDragEnd`, compare the dragged rectangle with the target card's rectangle and insert after it when the drop is below (the usual dnd-kit multi-column pattern). Add a unit test and an E2E position assertion.

### 2. Keyboard focus is lost after every save

frontend/src/components/KanbanBoard.tsx:144. Verified in Edge; fix verified on a scratch build.

`<fieldset disabled={busy}>` disables the focused control during each request, so focus drops to `<body>`. After a keyboard move the card cannot be picked up again without tabbing back to it. Picking up and cancelling (no save) keeps focus, which isolates the cause.

Replacing `disabled={busy}` with `aria-busy={busy}` kept focus on the Move button after both a downward and an upward saved move. The `inFlight` guard and `useSortable({ disabled: busy })` still prevent concurrent saves. The test suites were not rerun against this change, and it makes finding 6 easier to hit, so fix both together.

### 3. Frontend dependencies have open advisories and are behind latest

frontend/package.json. Verified with `npm audit` and `npm outdated`.

- Critical: `next` (pinned to exactly 16.1.6), `vitest`, `@vitest/coverage-v8`, `tinypool`. Six of the 27 affected packages are in the production dependency tree.
- The shipped app is a static export served by FastAPI, so the Next server never runs in the container. The exposure is `npm run dev` and the build and test toolchain on a developer machine.
- Behind latest, against AGENTS.md coding standard 1: next 16.1.6 vs 16.3.8, vitest 3.2 vs 5.0, eslint 9 vs 10, typescript 5.9 vs 7.0, jsdom 27 vs 30, @types/node 20 vs 26.

Suggested fix: bump `next` and `eslint-config-next` to 16.3.8, run `npm audit fix`, and rerun lint, unit, build, and E2E. Take the major upgrades separately. docs/PLAN.md lists this as open with a count of 25; it is now 27.

### 4. The committed tree does not type-check; the fix is uncommitted

frontend/src/test/setup.ts:1, frontend/src/test/vitest.d.ts:1. Verified on a clean copy of the commit.

- At b7f9063, `npx tsc --noEmit` reports 38 errors, all missing test globals in test files (`Cannot find name 'it'`, `'expect'`, `'describe'`, and similar).
- The uncommitted line `/// <reference types="vitest/globals" />` in setup.ts brings that to 0.
- `npm run build` passes either way, and there is no type-check script, so no existing check catches this.

Root cause: vitest.d.ts references `vitest`, which does not declare the globals. Changing that file to reference `vitest/globals`, with setup.ts left as committed, also gives 0 errors, clean lint, and 12 passing tests. That keeps type setup in one file. Either way, commit one of the two.

## Worth fixing

### 5. The board is not reloaded after a failed save

frontend/src/components/KanbanBoard.tsx:60. By inspection.

A failed mutation only sets an error message. If the client copy has diverged (a card deleted in a second tab, or a response lost after the server committed), every retry fails the same way until a manual reload, and a retried "Add card" can create a duplicate. Suggested fix: call `load()` after a non-401 failure.

### 6. An action that overlaps a pending save is dropped silently

frontend/src/components/KanbanBoard.tsx:53. By inspection.

`mutate()` returns `false` without an error when a request is in flight, and callers treat that as a failed save. Editing a column title and then immediately clicking Remove or dragging a card can lose the second action with no message. Suggested fix: set an error before returning.

### 7. index.html is served without Cache-Control

backend/main.py:140. Header verified; the stale-page scenario was not reproduced.

`GET /` returns `ETag` and `Last-Modified` only. Browsers may then reuse the page heuristically, and after a rebuild a cached index.html points at chunk files that no longer exist. Suggested fix: send `Cache-Control: no-cache` for HTML in the existing middleware.

### 8. Dragging probably does not work on touch screens

frontend/src/components/KanbanCard.tsx:35. By inspection; no touch device tested.

Nothing in frontend/src sets `touch-action`. dnd-kit's PointerSensor needs `touch-action: none` on the handle, otherwise the browser takes the gesture for scrolling and cancels the drag. Suggested fix: add `touch-none` to the Move button rather than the whole card, so the page can still be scrolled.

### 9. A title-only PATCH erases a card's details

backend/main.py:33. Verified.

`PATCH /api/cards/{id}` reuses `CardInput`, whose `details` defaults to `""`. Sending `{"title": "Renamed"}` returned 200 and cleared the details. The UI always sends both fields, so only direct API clients are affected. Suggested fix: make `details` required when editing.

### 10. A malformed Origin header returns 500

backend/main.py:57. Verified.

`Origin: http://[::1` makes `urlsplit` raise `ValueError` inside the middleware. The request is still refused, but as a 500 with a traceback instead of a 403. Suggested fix: compare the header to `http://{host}` and `https://{host}` as strings instead of parsing it.

### 11. E2E tests depend on a fresh database and on run order

frontend/tests/kanban.spec.ts. Verified with `--repeat-each 2`: the second pass of both "persists" tests failed.

All tests share one database per run and assert on seeded state, so retries, repeat runs, and UI mode fail. A plain `npm run test:e2e` is unaffected.

### 12. The data volume name depends on the folder name

compose.yaml:15. By inspection.

Compose prefixes the volume with the project name, which defaults to the directory name, so the volume is `pm_kanban-data`, not `kanban-data` as the README says. Renaming or moving the checkout starts with an empty board. Suggested fix: add a top-level `name:` to compose.yaml. Data already stored stays in the old volume.

### 13. Screen readers hear card IDs during a drag

frontend/src/components/KanbanBoard.tsx:137. Verified: the live region reads "card-5", and kanban.spec.ts:99 asserts on it.

dnd-kit's default announcements use IDs, and cards created in the app have UUIDs. Suggested fix: pass `accessibility.announcements` using card titles. Also, headings jump from `h1` to `h4` (KanbanCard.tsx:50).

### 14. The PowerShell scripts can fail when stderr is redirected

scripts/start.ps1:7, scripts/stop.ps1. Not run.

With `$ErrorActionPreference = 'Stop'`, Windows PowerShell 5.1 turns docker's stderr progress output into a terminating error when the error stream is redirected or the host is not a console (for example ISE). In a plain console window the scripts are fine.

## Cleanup

- Dead code and leftovers:
  - `createId` (frontend/src/lib/kanban.ts:164) is never called.
  - `_columnId` is threaded through KanbanBoard.tsx:87 and KanbanColumn.tsx:57 but never read.
  - Five template SVGs in frontend/public are unreferenced and ship in the export.
  - `"start": "next start"` cannot work with `output: "export"` (it exits with that error).
  - The `test` script duplicates `test:unit`.
  - frontend/test-results/.last-run.json is tracked although its directory is ignored.
- Duplication:
  - KanbanBoard.tsx:28-35 and 37-45 are two copies of the board load.
  - AuthenticatedApp.tsx has three raw `fetch` calls instead of using lib/api.ts.
  - Seed data exists in both `SEED` (backend/database.py) and `initialData` (kanban.ts), where it is now only a test fixture.
- backend/main.py:58 imports `JSONResponse` inside the middleware although `HTMLResponse` is imported from the same module at the top.
- Line length: backend/database.py has 10 lines over 120 characters (longest 250); several TSX lines exceed 200.
- Every pytest run prints `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead` (backend/pyproject.toml dev dependencies).
- The Dockerfile copies `main.py` and `database.py` by name, so a new backend module must be added there. It builds with Node 22 while local development uses Node 26.
- Documentation drift:
  - AGENTS.md "Starting Point" still describes a frontend-only demo.
  - frontend/AGENTS.md says kanban.ts seeds the board and lists `createId`.
  - README.md ends with a paragraph specific to one machine.
- Trivia:
  - `HEAD` on an unknown `/api/` path returns the static handler's HTML 404 (verified).
  - Dropping a card where it already sits still sends a move request.
  - Cards with empty details render an empty paragraph.
  - backend/database.py:56 runs the `PRAGMA` before the `try/finally` that closes the connection.

## Accepted for the MVP

No action recommended while this is a local demo with public credentials. Revisit when real authentication is added.

- The session store grows without bound: tokens are removed only on logout or when an expired token is presented again (500 logins left 500 entries).
- The Host header is not validated, so a DNS-rebinding page could reach the localhost-bound app and sign in with the demo credentials (a request with matching `Origin` and `Host` of `evil.example:8000` was accepted).
- `current_user` always returns `user-1`, the cookie has no `Secure` flag, login is not rate-limited, request bodies are unbounded, and the container runs as root.

## Not verified

- The Docker image, Compose healthcheck, volume persistence, and the macOS/Linux scripts.
- Touch input, and browsers other than Edge.
- Findings 5, 6, 8, 12, and 14, which rest on reading the code.

## Environment

Unrelated to the code: on this machine plain `pytest` fails with `PermissionError: [WinError 5]` because `%TEMP%\pytest-of-altan` and `backend\.pytest_cache` are not accessible to the current user. The tests pass with `-p no:cacheprovider --basetemp <writable directory>`. Removing or re-owning those two directories from an elevated shell fixes it.
