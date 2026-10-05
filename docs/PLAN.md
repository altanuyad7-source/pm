# Project Management MVP plan

## Scope and decisions

Build a local Kanban app with a Next.js frontend statically served by FastAPI from one Docker container. Use uv for Python dependencies and SQLite for persistence. No AI features, sidebar, external AI services, or API keys are required. The project-root .env may remain empty; provide usable local configuration defaults.

The MVP has one dummy login (`user` / `password`) and one board per user. Preserve the existing five columns: Backlog, Discovery, In Progress, Review, and Done. Users can rename columns and manually create, edit, delete, move, and reorder cards. Columns cannot be added, deleted, or reordered. Preserve the existing styling and color palette.

Use relational SQLite tables rather than a single JSON board document. Return JSON compatible with the frontend BoardData shape. Each user owns one board; columns and cards have explicit positions. Mount the database directory in a Docker volume. Seed the demo user, columns, and existing sample cards only when initializing a new board.

## Part 1: Planning and frontend documentation

- [x] Review the existing frontend and test configuration.
- [x] Remove AI requirements and specify manual card creation/deletion.
- [x] Choose relational SQLite storage and document persistence behavior.
- [x] Create frontend/AGENTS.md describing the current implementation.
- [x] Expand the plan with checklists and validation criteria.
- [x] Obtain user approval of this plan before implementation.

Success: scope, architecture, existing capabilities, and remaining work are documented and approved. This phase changes documentation only.

Progress: approved by the user on October 4, 2026.

## Part 2: Docker and backend scaffolding

- [x] Add a uv-managed FastAPI backend and dependency lockfile.
- [x] Add /api/health and initially serve a small static page at /.
- [x] Add Docker and Compose configuration with a database volume and localhost port binding.
- [x] Add start/stop scripts for Windows PowerShell and macOS/Linux shells; briefly document Docker prerequisites and commands.
- [x] Make stop scripts preserve stored data and surface startup failures clearly.

Validation: backend tests check the health response. Build/start the container, verify / and /api/health, then stop it using the scripts. Exercise available platforms and report platforms not verified.

Success: one documented command starts a healthy container and one stops it without deleting data.

Progress: scaffolding and scripts implemented. Backend health checks and PowerShell syntax validated locally. Docker is not installed here, so container startup/shutdown and macOS/Linux scripts remain unverified.

## Part 3: Serve the existing frontend

- [x] Configure Next.js static export and a multi-stage Docker build that copies exported files into the backend image.
- [x] Serve pages/assets through FastAPI, preserving /api routing and proper API 404 responses.
- [x] Preserve the current Kanban demo and styling during integration.
- [x] Document frontend development and production build commands.

Validation: run frontend lint, unit tests, and production build. Verify assets and the board load from the container; run browser smoke tests against the served production app.

Success: one container serves the five-column board without a separate Next.js server.

Progress: static export builds successfully; frontend lint and unit tests pass. Backend tests verify static asset hosting and API routing. Docker image verification remains pending.

## Part 4: Dummy sign-in and sign-out

- [x] Add login, logout, and session-status endpoints using the hardcoded MVP credentials.
- [x] Use an HTTP-only, same-site session cookie. Check same-origin requests for state-changing operations and require authentication for board APIs once added.
- [x] Add a login form and logout control; show the board after authentication is confirmed.
- [x] Handle invalid credentials, expired sessions, and failed requests with clear messages.

Validation: backend tests cover valid/invalid credentials, sessions, logout, and unauthorized requests. Frontend tests cover form behavior. Browser tests verify sign-in, reload while signed in, and sign-out.

Success: the board requires sign-in, and logout invalidates access. No registration or real authentication provider is included.

Progress: session endpoints and login/logout UI implemented. Backend, frontend, and browser tests cover credentials, session reload, expiry, and logout. Docker remains unavailable. npm installation reports 25 vulnerabilities in the existing frontend dependency tree; dependency remediation remains pending.

## Part 5: Database schema and initialization

- [x] Document the concrete schema and constraints in docs/: users, boards, columns, and cards.
- [x] Specify a unique user-to-board relationship, foreign keys, stable IDs, and explicit column/card positions.
- [x] Specify card title/details fields and nonblank titles and column names.
- [x] Document initialization, sample data, transactions, and ordering.
- [x] Obtain user sign-off on the concrete schema before implementing it.
- [x] Create the database and seed new boards automatically without overwriting saved changes.

Validation: temporary-database tests cover initial creation, repeated initialization without duplicates, foreign-key constraints, persisted ordering, and reopening saved data.

Success: storage supports future multiple users, initializes one board per user, and survives application restarts.

Progress: schema approved by the user and implemented in backend/database.py. Database tests verify idempotent initialization, constraints, ordering, ownership, rollback, and persistence after application recreation.

## Part 6: Board API

- [x] Add authenticated endpoints to read the current user's board and rename a column.
- [x] Add endpoints to create, edit, delete, and move/reorder cards using a destination column and position.
- [x] Return BoardData JSON with columns, ordered cardIds, and a cards map.
- [x] Validate inputs and board ownership; return consistent errors for invalid data and missing resources.
- [x] Apply moves and ordering changes transactionally so a card appears exactly once.

Validation: backend tests cover all operations, empty-column moves, within-column ordering, invalid titles/positions/IDs, unauthorized requests, and user isolation with test fixtures. Reopen the database to verify committed changes persist.

Success: every required board action is available through an authenticated API with durable, consistent data.

Progress: all routes implemented; 28 backend tests pass, including invalid requests, user isolation, empty-column moves, and rollback. Mutations return the updated board after a successful transaction.

## Part 7: Persistent frontend and final verification

- [x] Replace demo initialization with loading the authenticated board from the API.
- [x] Connect column renaming, creation/deletion, and drag-and-drop to backend mutations.
- [x] Add a simple card editor for title/details with save and cancel actions; title/details editing is now implemented.
- [x] Show loading, empty, and failure states. Await successful mutations and refresh the board; restore saved state when a drag fails.
- [x] Keep the layout and ensure forms/controls have accessible labels, focus behavior, and usable narrow-screen layouts.
- [x] Update tests for authenticated, persistent behavior and document startup, shutdown, and data storage concisely.

Validation: run backend tests, frontend lint/unit tests, production build, and Playwright against the complete container. Verify login, rename, create, edit, delete, cross-column moves, within-column reordering, and reload persistence. Recreate the container with the same volume and confirm saved data remains. Verify failed mutations do not leave unsaved changes displayed.

Success: all manual Kanban actions work after sign-in, survive reload and container recreation, and run locally without external service credentials.

Progress: implementation complete. All 28 backend tests and 12 frontend unit tests pass; lint and production static export pass. All eight browser scenarios pass using Microsoft Edge against FastAPI (seven in the full run and the corrected keyboard check in a targeted rerun). Coverage includes rename/create/edit/delete with reload persistence, cross-column movement, keyboard reordering, failed dragging, session expiry, and a narrow-screen layout. Database persistence across application recreation is verified by backend tests.

Remaining validation and maintenance:

- [ ] Build/start/stop the Docker container and verify persistence after container recreation on a machine with Docker installed.
- [ ] Execute the macOS/Linux scripts on those platforms.
- [ ] Address the existing frontend dependency vulnerabilities reported by npm.
