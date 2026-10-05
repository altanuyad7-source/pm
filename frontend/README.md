# Kanban Studio

## Run

```bash
npm install
npm run dev
```

The development server alone does not provide the login API. For the integrated app, build the static frontend and start FastAPI as documented in the project-root README.

## Tests

For the integrated app, install backend dependencies with `uv sync --directory ../backend`, run `npm run build`, and ensure uv is on PATH. Playwright starts FastAPI and tests the static export on port 8000. Install Chromium with `npx playwright install chromium` if needed.

Alternatively set PLAYWRIGHT_CHANNEL to msedge to use installed Microsoft Edge.

```bash
npm run test:unit
npm run test:e2e
```
