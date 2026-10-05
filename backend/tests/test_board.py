import sqlite3

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from database import Database
from main import create_app


def login(client):
    assert client.post("/api/login", json={"username": "user", "password": "password"}).status_code == 200


def test_full_board_lifecycle_survives_app_recreation(tmp_path):
    path = tmp_path / "board.sqlite3"
    with TestClient(create_app(database_path=path)) as client:
        login(client)
        board = client.get("/api/board").json()
        assert len(board["columns"]) == 5
        assert len(board["cards"]) == 8
        board = client.patch("/api/columns/col-backlog", json={"title": "  Ideas  "}).json()
        assert board["columns"][0]["title"] == "Ideas"
        response = client.post("/api/columns/col-backlog/cards", json={"title": "New", "details": "Notes"})
        assert response.status_code == 201
        card_id = response.json()["columns"][0]["cardIds"][-1]
        board = client.patch(f"/api/cards/{card_id}", json={"title": "Edited", "details": "Saved"}).json()
        assert board["cards"][card_id]["title"] == "Edited"
        board = client.post(f"/api/cards/{card_id}/move", json={"column_id": "col-backlog", "position": 0}).json()
        assert board["columns"][0]["cardIds"][0] == card_id
        board = client.post(f"/api/cards/{card_id}/move", json={"column_id": "col-review", "position": 1}).json()
        assert board["columns"][3]["cardIds"] == ["card-6", card_id]
        board = client.delete("/api/cards/card-6").json()
        assert board["columns"][3]["cardIds"] == [card_id]
        assert "card-6" not in board["cards"]
        expected = board
    with TestClient(create_app(database_path=path)) as client:
        assert client.get("/api/board").status_code == 401
        login(client)
        assert client.get("/api/board").json() == expected


def test_empty_column_moves_and_stable_order():
    with TestClient(create_app()) as client:
        login(client)
        client.delete("/api/cards/card-3")
        response = client.post("/api/cards/card-1/move", json={"column_id": "col-discovery", "position": 0})
        assert response.status_code == 200
        assert response.json()["columns"][1]["cardIds"] == ["card-1"]
        response = client.post("/api/cards/card-2/move", json={"column_id": "col-discovery", "position": 1})
        assert response.json()["columns"][1]["cardIds"] == ["card-1", "card-2"]
        response = client.post("/api/cards/card-2/move", json={"column_id": "col-discovery", "position": 0})
        assert response.json()["columns"][1]["cardIds"] == ["card-2", "card-1"]
        ids = [id for column in response.json()["columns"] for id in column["cardIds"]]
        assert len(ids) == len(set(ids)) == 7


@pytest.mark.parametrize("method,path,body,status", [
    ("patch", "/api/columns/col-backlog", {"title": " "}, 422),
    ("post", "/api/columns/col-backlog/cards", {"title": ""}, 422),
    ("patch", "/api/cards/card-1", {"title": " "}, 422),
    ("patch", "/api/columns/missing", {"title": "Valid"}, 404),
    ("post", "/api/columns/missing/cards", {"title": "Valid"}, 404),
    ("patch", "/api/cards/missing", {"title": "Valid"}, 404),
    ("delete", "/api/cards/missing", None, 404),
    ("post", "/api/cards/card-1/move", {"column_id": "missing", "position": 0}, 404),
    ("post", "/api/cards/missing/move", {"column_id": "col-backlog", "position": 0}, 404),
    ("post", "/api/cards/card-1/move", {"column_id": "col-backlog", "position": 2}, 422),
    ("post", "/api/cards/card-1/move", {"column_id": "col-review", "position": -1}, 422),
    ("post", "/api/cards/card-1/move", {"column_id": "col-review", "position": "0"}, 422),
])
def test_invalid_mutations_leave_board_unchanged(method, path, body, status):
    with TestClient(create_app()) as client:
        login(client)
        before = client.get("/api/board").json()
        assert client.request(method, path, json=body).status_code == status
        assert client.get("/api/board").json() == before


@pytest.mark.parametrize("method,path,body", [
    ("get", "/api/board", None),
    ("patch", "/api/columns/col-backlog", {"title": "Test"}),
    ("post", "/api/columns/col-backlog/cards", {"title": "Test"}),
    ("patch", "/api/cards/card-1", {"title": "Test"}),
    ("delete", "/api/cards/card-1", None),
    ("post", "/api/cards/card-1/move", {"column_id": "col-review", "position": 0}),
])
def test_board_routes_require_authentication(method, path, body):
    with TestClient(create_app()) as client:
        assert client.request(method, path, json=body).status_code == 401


def test_user_isolation_and_database_constraints(tmp_path):
    path = tmp_path / "board.sqlite3"
    database = Database(path)
    database.initialize()
    with database.connect(write=True) as connection:
        connection.execute("INSERT INTO users VALUES ('other', 'other')")
        connection.execute("INSERT INTO boards VALUES ('other-board', 'other')")
        connection.execute("INSERT INTO columns VALUES ('other-col', 'other-board', 'Private', 0)")
        connection.execute("INSERT INTO cards VALUES ('other-card', 'other-col', 'Secret', '', 0)")
    with TestClient(create_app(database_path=path)) as client:
        login(client)
        assert "other-card" not in client.get("/api/board").json()["cards"]
        for method, route, body in [
            ("patch", "/api/columns/other-col", {"title": "Changed"}),
            ("post", "/api/columns/other-col/cards", {"title": "Changed"}),
            ("patch", "/api/cards/other-card", {"title": "Changed"}),
            ("delete", "/api/cards/other-card", None),
            ("post", "/api/cards/card-1/move", {"column_id": "other-col", "position": 0}),
        ]:
            assert client.request(method, route, json=body).status_code == 404
    with database.connect() as connection:
        assert database.board(connection, "other")["cards"]["other-card"]["title"] == "Secret"
        with pytest.raises(HTTPException):
            database.card(connection, "other", "card-1")
    for statement in [
        "INSERT INTO boards VALUES ('extra', 'user-1')",
        "INSERT INTO cards VALUES ('bad', 'missing', 'Title', '', 0)",
        "INSERT INTO cards VALUES ('bad', 'col-backlog', ' ', '', 10)",
        "INSERT INTO cards VALUES ('bad', 'col-backlog', 'Title', '', 0)",
    ]:
        with pytest.raises(sqlite3.IntegrityError), database.connect(write=True) as connection:
            connection.execute(statement)


def test_failed_transaction_rolls_back(tmp_path):
    database = Database(tmp_path / "board.sqlite3")
    database.initialize()
    with database.connect() as connection:
        before = database.board(connection, "user-1")
    with pytest.raises(RuntimeError), database.connect(write=True) as connection:
        database.move(connection, "user-1", "card-1", "col-review", 0)
        raise RuntimeError("Simulated write failure")
    database.initialize()
    with database.connect() as connection:
        assert database.board(connection, "user-1") == before


def test_invalid_database_path_reports_location(tmp_path):
    path = tmp_path / "broken.sqlite3"
    path.write_text("not a database")
    with pytest.raises(RuntimeError, match="broken.sqlite3"):
        Database(path).initialize()
