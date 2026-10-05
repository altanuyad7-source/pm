"""Local MVP API and static frontend host."""

import os
import secrets
from time import time
from pathlib import Path
from urllib.parse import urlsplit
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, StringConstraints
from database import Database

COOKIE = "kanban_session"
SESSION_SECONDS = 60 * 60 * 24


class Credentials(BaseModel):
    username: str
    password: str


Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class Rename(BaseModel):
    title: Title


class CardInput(Rename):
    details: str = ""


class MoveInput(BaseModel):
    column_id: str
    position: int = Field(ge=0, strict=True)


def create_app(static_dir: Path | None = None, database_path: Path | None = None) -> FastAPI:
    database = Database(database_path or Path(os.environ.get("DATABASE_PATH", Path(__file__).parent / "data" / "kanban.sqlite3")))

    @asynccontextmanager
    async def lifespan(app):
        database.initialize()
        yield

    app = FastAPI(title="Kanban Studio", lifespan=lifespan)
    sessions: dict[str, float] = {}

    @app.middleware("http")
    async def check_origin(request: Request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("origin")
            if origin and urlsplit(origin).netloc != request.headers.get("host"):
                from fastapi.responses import JSONResponse

                return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    def current_user(request: Request):
        token = request.cookies.get(COOKIE, "")
        if sessions.get(token, 0) <= time():
            sessions.pop(token, None)
            raise HTTPException(401, "Please sign in")
        return "user-1"

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.post("/api/login")
    def login(credentials: Credentials, response: Response):
        if credentials.username != "user" or credentials.password != "password":
            raise HTTPException(401, "Invalid username or password")
        token = secrets.token_urlsafe(32)
        sessions[token] = time() + SESSION_SECONDS
        response.set_cookie(
            COOKIE, token, httponly=True, samesite="strict", max_age=SESSION_SECONDS
        )
        return {"username": "user"}

    @app.get("/api/session")
    def session(user_id: str = Depends(current_user)):
        return {"username": "user"}

    @app.post("/api/logout")
    def logout(request: Request, response: Response):
        sessions.pop(request.cookies.get(COOKIE, ""), None)
        response.delete_cookie(COOKIE)
        return {"status": "ok"}

    @app.get("/api/board")
    def board(user_id: str = Depends(current_user)):
        with database.connect() as connection:
            return database.board(connection, user_id)

    @app.patch("/api/columns/{column_id}")
    def rename(column_id: str, body: Rename, user_id: str = Depends(current_user)):
        with database.connect(write=True) as connection:
            database.rename(connection, user_id, column_id, body.title)
            return database.board(connection, user_id)

    @app.post("/api/columns/{column_id}/cards", status_code=201)
    def add_card(column_id: str, body: CardInput, user_id: str = Depends(current_user)):
        with database.connect(write=True) as connection:
            database.add(connection, user_id, column_id, body.title, body.details)
            return database.board(connection, user_id)

    @app.patch("/api/cards/{card_id}")
    def edit_card(card_id: str, body: CardInput, user_id: str = Depends(current_user)):
        with database.connect(write=True) as connection:
            database.edit(connection, user_id, card_id, body.title, body.details)
            return database.board(connection, user_id)

    @app.delete("/api/cards/{card_id}")
    def delete_card(card_id: str, user_id: str = Depends(current_user)):
        with database.connect(write=True) as connection:
            database.delete(connection, user_id, card_id)
            return database.board(connection, user_id)

    @app.post("/api/cards/{card_id}/move")
    def move_card(card_id: str, body: MoveInput, user_id: str = Depends(current_user)):
        with database.connect(write=True) as connection:
            database.move(connection, user_id, card_id, body.column_id, body.position)
            return database.board(connection, user_id)

    # Keep unknown API paths out of the static file handler.
    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    def missing_api(path: str):
        raise HTTPException(404, "API route not found")

    directory = static_dir or Path(os.environ.get("STATIC_DIR", Path(__file__).parent.parent / "frontend" / "out"))
    if directory.is_dir():
        app.mount("/", StaticFiles(directory=directory, html=True), name="frontend")
    else:
        @app.get("/", response_class=HTMLResponse)
        def home():
            return '<h1>Kanban Studio backend</h1><p>Build the frontend to see the board.</p><a href="/api/health">API health</a>'

    return app


app = create_app()
