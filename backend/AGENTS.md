# Backend

FastAPI in main.py serves /api/health, dummy login/logout/session endpoints, authenticated board APIs, and the frontend static export. database.py manages SQLite schema, sample data, ownership checks, and transactional ordering. Run `uv run pytest` or `uv run uvicorn main:app --host 127.0.0.1 --port 8000` from this directory. Dependencies are in pyproject.toml and uv.lock.

Sessions use HTTP-only same-site cookies and an in-memory token registry; restarting signs users out but retains board data. Database initialization runs at startup and seeds only a missing demo board. All board endpoints enforce authentication and storage operations check user ownership. API mutations return the updated BoardData JSON. SQLite connections enable foreign keys, close after use, and use one write transaction for every mutation. Follow ../AGENTS.md, ../docs/PLAN.md, and ../docs/DATABASE.md.
