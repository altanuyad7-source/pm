# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Where the rules live

AGENTS.md at the repo root is the source of truth for business requirements, MVP limits, the color scheme, and coding standards (keep it simple, no emojis, prove root cause before fixing). backend/, frontend/, and scripts/ each have their own AGENTS.md. docs/PLAN.md is the approved phase plan and docs/DATABASE.md the approved schema. This file only adds commands and the cross-cutting architecture.

All seven plan phases are implemented. What is left is listed at the end of docs/PLAN.md: the Docker image and the macOS/Linux scripts have never been run, and npm reports dependency vulnerabilities. The plan explicitly excludes AI features.

## Commands

Backend (Python 3.13, uv), from the repo root:

- `uv run --directory backend pytest` - all tests
- `uv run --directory backend pytest tests/test_board.py::test_failed_transaction_rolls_back` - one test
- `uv run --directory backend uvicorn main:app --host 127.0.0.1 --port 8000` - API plus `frontend/out` if it has been built

Frontend, from `frontend/`:

- `npm run lint`
- `npm run test:unit` - Vitest. One file: `npx vitest run src/lib/kanban.test.ts`; one test: add `-t "name"`
- `npm run build` - static export to `frontend/out`
- `npm run test:e2e` - Playwright. One test: `npx playwright test -g "moves a card"`

Docker (the shipped way to run it): `./scripts/start.ps1` / `./scripts/stop.ps1` on Windows, `sh scripts/start.sh` / `sh scripts/stop.sh` elsewhere. Then http://localhost:8000, sign in with `user` / `password`. Stop keeps the `kanban-data` volume; never add volume deletion to it.

Things that are easy to get wrong:

- E2E tests run against the static export, so `npm run build` must come first. Playwright starts its own uvicorn on 127.0.0.1:8000 with `reuseExistingServer: false`, so that port must be free (stop the container or any local server). Each run gets a fresh database under `frontend/.e2e-data/`. Set `PLAYWRIGHT_CHANNEL=msedge` to use installed Edge instead of downloading Chromium.
- On this Windows workspace uv is not installed globally. It lives in the root `.venv/Scripts/uv.exe` and is on PATH only while that venv is active; backend dependencies are in `backend/.venv`. uv's "VIRTUAL_ENV does not match" warning is expected. Without uv: `./backend/.venv/Scripts/python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000`.

## Architecture

One origin, one process. FastAPI (`backend/main.py`) serves the JSON API under `/api/` and mounts the Next.js static export at `/`. Next is configured with `output: "export"`, so there is no Next server at runtime and nothing that needs one (route handlers, rewrites, server actions) can be used. The Dockerfile builds `out/` in a Node stage and copies it into the Python image as `/app/static`.

Consequence for development: `npm run dev` gives you the UI with no API behind it. There is no proxy, and the backend rejects state-changing requests whose Origin host differs from Host. To exercise the real app, build the frontend, run uvicorn, and use port 8000.

### Backend

- `create_app(static_dir, database_path)` is a factory, and tests build isolated apps with it. The module-level `app` reads `DATABASE_PATH` (default `backend/data/kanban.sqlite3`) and `STATIC_DIR` (default `frontend/out`). `tests/conftest.py` points `DATABASE_PATH` at a temp directory for every test.
- Sessions are an in-memory token-to-expiry dict inside the factory closure: they are lost on restart and are not shared between app instances. `current_user` validates the cookie but always returns the hardcoded `user-1`. Multi-user support exists only in the schema and in `Database` methods, which all take `user_id` and join through `boards` to enforce ownership.
- Route order matters. The `/api/{path:path}` catch-all is registered after the real routes and before the static mount so unknown API paths return a JSON 404 instead of falling through to StaticFiles.
- Every mutation route opens `database.connect(write=True)` (one `BEGIN IMMEDIATE` transaction, committed or rolled back by the context manager), calls one `Database` method, and returns `database.board(...)`, the whole board, from that same transaction. `Database` raises `HTTPException` directly for missing or foreign resources.
- Card positions are dense, zero-based, and protected by `UNIQUE(column_id, position)`. Reordering therefore goes through `offset()` (shift the column past its own maximum) and then `order()` (renumber). Updating positions in place trips the constraint; `delete` and `move` both follow this pattern.
- `initialize()` runs at startup, is idempotent, and seeds only when the demo user has no board. There are no migrations, only `CREATE TABLE IF NOT EXISTS`, so editing `SCHEMA` does not change an existing database file.

### Frontend

- `page.tsx` -> `AuthenticatedApp` (session check, login, logout) -> `KanbanBoard` (owns board state) -> `KanbanColumn` -> `KanbanCard` / `NewCardForm`.
- The server is authoritative and there are no optimistic updates. `KanbanBoard.mutate()` sends one request through `lib/api.ts`, replaces the whole board with the response, and resolves to a boolean that child components use to keep a draft or revert it. An `inFlight` ref and a disabled `<fieldset>` allow one mutation at a time.
- On drop, `moveCard` in `lib/kanban.ts` computes the resulting order locally only to derive `{column_id, position}` for `POST /api/cards/{id}/move`. The UI then renders what the server returns, which is why a failed move snaps back without extra code.
- A 401 from any board request calls `onUnauthorized` and returns the user to sign-in.
- `BoardData` (`columns[]` with ordered `cardIds`, plus a `cards` map keyed by ID) is the wire contract; `Database.board()` must keep producing exactly that shape.
- `initialData` in `lib/kanban.ts` is now only a test fixture mirroring `SEED` in `backend/database.py`. Unit and E2E tests depend on the seeded IDs (`col-<slug>`, `card-1` to `card-8`) and on the `column-<id>` / `card-<id>` test IDs, so change seed data in both places.
