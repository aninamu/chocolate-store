def test_openapi_on_app():
    from app.main import app

    assert "chocolate" in (app.title or "").lower()


def test_list_chocolates_exposes_repeated_tag_query_param():
    from app.main import app

    r = app.openapi()["paths"]["/api/chocolates"]["get"]["parameters"]
    tag = next(p for p in r if p["name"] == "tag")
    assert tag["schema"].get("type") == "array"
    desc = (tag.get("description") or "").lower()
    assert "at least one" in desc
    assert "or semantics" in desc
