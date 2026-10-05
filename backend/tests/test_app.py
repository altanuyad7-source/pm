from fastapi.testclient import TestClient

from main import COOKIE, create_app


def test_health_and_placeholder():
    with TestClient(create_app()) as client:
        assert client.get("/api/health").json() == {"status": "ok"}
        assert client.get("/").status_code == 200
        assert client.get("/api/missing").status_code == 404


def test_static_files_and_api_routing(tmp_path):
    (tmp_path / "index.html").write_text("<h1>Board</h1>")
    (tmp_path / "asset.css").write_text("body {color: red}")
    with TestClient(create_app(tmp_path)) as client:
        assert "Board" in client.get("/").text
        assert client.get("/asset.css").status_code == 200
        assert client.get("/missing").status_code == 404
        assert client.get("/api/missing").json() == {"detail": "API route not found"}
        assert client.get("/api/health").status_code == 200


def test_login_session_logout():
    with TestClient(create_app()) as client:
        assert client.get("/api/session").status_code == 401
        assert client.post("/api/login", json={"username": "user", "password": "wrong"}).status_code == 401
        response = client.post("/api/login", json={"username": "user", "password": "password"})
        assert response.status_code == 200
        assert "HttpOnly" in response.headers["set-cookie"]
        assert "SameSite=strict" in response.headers["set-cookie"]
        token = client.cookies.get(COOKIE)
        assert client.get("/api/session").json() == {"username": "user"}
        assert client.post("/api/logout").status_code == 200
        assert client.get("/api/session").status_code == 401
        assert client.get("/api/session", headers={"Cookie": f"{COOKIE}={token}"}).status_code == 401


def test_cross_origin_mutations_are_rejected():
    with TestClient(create_app()) as client:
        assert client.post("/api/login", headers={"Origin": "http://other-host"}, json={"username": "user", "password": "password"}).status_code == 403
        assert client.post("/api/login", headers={"Origin": "http://testserver"}, json={"username": "user", "password": "password"}).status_code == 200


def test_expired_session_requires_login(monkeypatch):
    with TestClient(create_app()) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})
        monkeypatch.setattr("main.time", lambda: float("inf"))
        assert client.get("/api/session").status_code == 401
