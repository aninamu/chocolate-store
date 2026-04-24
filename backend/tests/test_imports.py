def test_openapi_on_app():
    from app.main import app

    assert "chocolate" in (app.title or "").lower()
