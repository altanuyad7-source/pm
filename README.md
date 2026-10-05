# Kanban Studio

Requires Docker Desktop (Windows/macOS) or Docker Engine with Compose (Linux), with the engine running.

From the project root:

- Windows: `./scripts/start.ps1` and `./scripts/stop.ps1`.
- macOS/Linux: `sh scripts/start.sh` and `sh scripts/stop.sh`.

Open http://localhost:8000 and sign in with `user` / `password`. The .env file can remain empty. Sessions reset when the backend restarts.

Rename columns and create, edit, delete, drag, or reorder cards. Changes are stored in SQLite at /data/kanban.sqlite3 in Docker, backed by the named `kanban-data` volume. Stop scripts preserve it; avoid `docker compose down --volumes` when keeping data. Local development stores the database at backend/data/kanban.sqlite3; DATABASE_PATH can override it.

Local checks: `uv run --directory backend pytest`; from frontend/, run `npm run lint`, `npm run test:unit`, and `npm run build`. A frontend build is served by `uv run --directory backend uvicorn main:app --host 127.0.0.1 --port 8000`.

On this workspace's Windows setup, uv and Python dependencies are installed locally. From the project root, run `./backend/.venv/Scripts/python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000` to use the built app without Docker. Stop it with Ctrl+C.
