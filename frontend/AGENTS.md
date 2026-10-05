# Frontend

Follow the project-root AGENTS.md and docs/PLAN.md. This directory contains the existing Kanban Studio demo; follow the approved plan when implementing changes.

## Stack and commands

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, and dnd-kit for drag-and-drop. The @/ alias resolves to src/.

Run commands from frontend/:

- `npm install`: install dependencies.
- `npm run dev`: start the development server.
- `npm run build`: build the frontend.
- `npm run lint`: run ESLint.
- `npm run test:unit`: run Vitest tests.
- `npm run test:e2e`: run Playwright tests against the exported frontend and backend at 127.0.0.1:8000 using Chromium. Run npm run build first and ensure uv is on PATH with backend dependencies installed.

## Current implementation

- src/app/page.tsx renders AuthenticatedApp, which checks the session, handles login/logout, and renders KanbanBoard after sign-in. layout.tsx and globals.css define the app shell and styling.
- src/lib/kanban.ts defines Card, Column, and BoardData, seeds five columns and sample cards, and implements moveCard and createId.
- BoardData contains an ordered columns array, each column's ordered cardIds, and a cards map indexed by ID.
- src/components/KanbanBoard.tsx loads the saved board from the API. Mutations use src/lib/api.ts, await the server's updated board, and prevent simultaneous saves. Dragging supports pointer and keyboard sensors; failed requests retain saved state.
- KanbanColumn renders columns; KanbanCard renders sortable cards and removal controls; KanbanCardPreview renders the drag overlay; NewCardForm collects title and details.
- KanbanCard includes a title/details editor with save/cancel. NewCardForm preserves drafts after failed saves. Column renaming saves on blur or Enter; failed saves restore the saved title. Expired sessions return users to sign-in.
- next.config.ts enables static export; Docker builds the frontend and FastAPI hosts the output. npm run dev by itself does not supply the authentication API; use the exported app with FastAPI for integrated testing.

## Tests and guidance

Vitest uses jsdom, React Testing Library, and src/test/setup.ts. Tests cover board loading, mutations, failure handling, login/logout, and movement helpers. Playwright tests in tests/kanban.spec.ts exercise the production export with an isolated SQLite database per test run under .e2e-data/.

Preserve the existing five-column layout and project colors. Keep interactive code in client components and use same-origin API requests in production. Keep static export compatible with FastAPI hosting; avoid features requiring a production Next.js server.

Keep changes simple and focused. Do not add AI features or an AI sidebar. Test observable behavior, ordering, and persistence failures. Run checks relevant to implementation changes and report any unverified runtime or platform behavior.
