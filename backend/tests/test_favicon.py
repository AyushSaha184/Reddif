from fastapi.testclient import TestClient

from main import app


def test_favicon_returns_no_content() -> None:
    with TestClient(app) as client:
        response = client.get("/favicon.ico")

    assert response.status_code == 204
    assert response.text == ""


def test_missing_route_still_returns_404() -> None:
    with TestClient(app) as client:
        response = client.get("/definitely-missing-route")

    assert response.status_code == 404


def test_favicon_not_in_openapi_schema() -> None:
    paths = app.openapi().get("paths", {})

    assert "/favicon.ico" not in paths