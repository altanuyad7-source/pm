"""SQLite board storage. Each mutation runs under one write transaction."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS columns (
    id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id),
    title TEXT NOT NULL CHECK(length(trim(title)) > 0),
    position INTEGER NOT NULL CHECK(position >= 0), UNIQUE(board_id, position)
);
CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY, column_id TEXT NOT NULL REFERENCES columns(id),
    title TEXT NOT NULL CHECK(length(trim(title)) > 0),
    details TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL CHECK(position >= 0), UNIQUE(column_id, position)
);
"""

SEED = [
    ("backlog", "Backlog", [
        ("Align roadmap themes", "Draft quarterly themes with impact statements and metrics."),
        ("Gather customer signals", "Review support tags, sales notes, and churn feedback."),
    ]),
    ("discovery", "Discovery", [("Prototype analytics view", "Sketch initial dashboard layout and key drill-downs.")]),
    ("progress", "In Progress", [
        ("Refine status language", "Standardize column labels and tone across the board."),
        ("Design card layout", "Add hierarchy and spacing for scanning dense lists."),
    ]),
    ("review", "Review", [("QA micro-interactions", "Verify hover, focus, and loading states.")]),
    ("done", "Done", [
        ("Ship marketing page", "Final copy approved and asset pack delivered."),
        ("Close onboarding sprint", "Document release notes and share internally."),
    ]),
]


class Database:
    def __init__(self, path: Path):
        self.path = path

    @contextmanager
    def connect(self, write=False):
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            with connection:
                connection.execute("BEGIN IMMEDIATE" if write else "BEGIN")
                yield connection
        finally:
            connection.close()

    def initialize(self):
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.connect(write=True) as connection:
                # Execute separately to keep schema and seed in the same transaction.
                for statement in SCHEMA.split(";"):
                    if statement.strip():
                        connection.execute(statement)
                connection.execute("INSERT OR IGNORE INTO users VALUES ('user-1', 'user')")
                if connection.execute("SELECT id FROM boards WHERE user_id = 'user-1'").fetchone():
                    return
                connection.execute("INSERT INTO boards VALUES ('board-1', 'user-1')")
                card_number = 0
                for position, (slug, title, cards) in enumerate(SEED):
                    column_id = f"col-{slug}"
                    connection.execute("INSERT INTO columns VALUES (?, 'board-1', ?, ?)", (column_id, title, position))
                    for card_position, (card_title, details) in enumerate(cards):
                        card_number += 1
                        connection.execute("INSERT INTO cards VALUES (?, ?, ?, ?, ?)", (f"card-{card_number}", column_id, card_title, details, card_position))
        except (sqlite3.Error, OSError) as error:
            raise RuntimeError(f"Unable to initialize database at {self.path}: {error}") from error

    def board(self, connection, user_id):
        board = connection.execute("SELECT id FROM boards WHERE user_id = ?", (user_id,)).fetchone()
        if not board:
            raise HTTPException(404, "Board not found")
        columns = connection.execute("SELECT id, title FROM columns WHERE board_id = ? ORDER BY position", (board["id"],)).fetchall()
        cards = connection.execute("SELECT cards.id, cards.title, cards.details, cards.column_id FROM cards JOIN columns ON columns.id = cards.column_id WHERE columns.board_id = ? ORDER BY columns.position, cards.position", (board["id"],)).fetchall()
        return {
            "columns": [{"id": column["id"], "title": column["title"], "cardIds": [card["id"] for card in cards if card["column_id"] == column["id"]]} for column in columns],
            "cards": {card["id"]: {key: card[key] for key in ("id", "title", "details")} for card in cards},
        }

    def column(self, connection, user_id, column_id):
        row = connection.execute("SELECT columns.* FROM columns JOIN boards ON boards.id = columns.board_id WHERE columns.id = ? AND boards.user_id = ?", (column_id, user_id)).fetchone()
        if not row:
            raise HTTPException(404, "Column not found")
        return row

    def card(self, connection, user_id, card_id):
        row = connection.execute("SELECT cards.* FROM cards JOIN columns ON columns.id = cards.column_id JOIN boards ON boards.id = columns.board_id WHERE cards.id = ? AND boards.user_id = ?", (card_id, user_id)).fetchone()
        if not row:
            raise HTTPException(404, "Card not found")
        return row

    def rename(self, connection, user_id, column_id, title):
        self.column(connection, user_id, column_id)
        connection.execute("UPDATE columns SET title = ? WHERE id = ?", (title, column_id))

    def add(self, connection, user_id, column_id, title, details):
        self.column(connection, user_id, column_id)
        position = connection.execute("SELECT count(*) FROM cards WHERE column_id = ?", (column_id,)).fetchone()[0]
        connection.execute("INSERT INTO cards VALUES (?, ?, ?, ?, ?)", (str(uuid4()), column_id, title, details, position))

    def edit(self, connection, user_id, card_id, title, details):
        self.card(connection, user_id, card_id)
        connection.execute("UPDATE cards SET title = ?, details = ? WHERE id = ?", (title, details, card_id))

    def ids(self, connection, column_id):
        return [row[0] for row in connection.execute("SELECT id FROM cards WHERE column_id = ? ORDER BY position", (column_id,))]

    def offset(self, connection, column_id):
        maximum = connection.execute("SELECT coalesce(max(position), -1) FROM cards WHERE column_id = ?", (column_id,)).fetchone()[0]
        connection.execute("UPDATE cards SET position = position + ? WHERE column_id = ?", (maximum + 1, column_id))

    def order(self, connection, column_id, ids):
        for position, card_id in enumerate(ids):
            connection.execute("UPDATE cards SET column_id = ?, position = ? WHERE id = ?", (column_id, position, card_id))

    def delete(self, connection, user_id, card_id):
        card = self.card(connection, user_id, card_id)
        connection.execute("DELETE FROM cards WHERE id = ?", (card_id,))
        ids = self.ids(connection, card["column_id"])
        self.offset(connection, card["column_id"])
        self.order(connection, card["column_id"], ids)

    def move(self, connection, user_id, card_id, column_id, position):
        card = self.card(connection, user_id, card_id)
        self.column(connection, user_id, column_id)
        source = card["column_id"]
        source_ids = [id for id in self.ids(connection, source) if id != card_id]
        target_ids = source_ids if source == column_id else self.ids(connection, column_id)
        if position < 0 or position > len(target_ids):
            raise HTTPException(422, "Invalid destination position")
        target_ids.insert(position, card_id)
        self.offset(connection, source)
        if source != column_id:
            self.offset(connection, column_id)
            self.order(connection, source, source_ids)
        self.order(connection, column_id, target_ids)
