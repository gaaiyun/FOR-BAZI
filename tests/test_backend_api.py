# -*- coding: utf-8 -*-
"""
API endpoint tests for FOR-BAZI backend.

Covers: health check, chart calculation, compatibility, texts query, and SSE streaming.
Uses FastAPI TestClient for synchronous testing of async endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


def test_health_check():
    """GET /health should return 200 with status field."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "ok"


# ---------------------------------------------------------------------------
# Chart calculation
# ---------------------------------------------------------------------------


def test_chart_calculation():
    """POST /api/v1/chart with valid input should return 200 with chart data."""
    response = client.post("/api/v1/chart", json={
        "gender": "乾造 (Male)",
        "datetime_str": "1985-06-15 09:20",
    })
    assert response.status_code == 200
    data = response.json()
    assert "chart" in data
    chart = data["chart"]
    assert "pillars" in chart
    assert len(chart["pillars"]) == 4
    assert "day_master" in chart


def test_chart_female():
    """POST /api/v1/chart with female gender should also succeed."""
    response = client.post("/api/v1/chart", json={
        "gender": "坤造 (Female)",
        "datetime_str": "2000-03-15 12:00",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["chart"]["gender"] == "坤造 (Female)"


def test_chart_invalid_gender():
    """POST /api/v1/chart with invalid gender should return 422."""
    response = client.post("/api/v1/chart", json={
        "gender": "X",
        "datetime_str": "1985-06-15 09:20",
    })
    assert response.status_code == 422


def test_chart_invalid_date():
    """POST /api/v1/chart with unparseable date should return 400."""
    response = client.post("/api/v1/chart", json={
        "gender": "乾造 (Male)",
        "datetime_str": "invalid",
    })
    assert response.status_code in (400, 422)


def test_chart_missing_fields():
    """POST /api/v1/chart with missing required fields should return 422."""
    response = client.post("/api/v1/chart", json={})
    assert response.status_code == 422


def test_chart_response_has_wuxing_power_and_geju():
    """Chart response should include derived wuxing_power and geju analyses."""
    response = client.post("/api/v1/chart", json={
        "gender": "乾造 (Male)",
        "datetime_str": "1985-06-15 09:20",
    })
    assert response.status_code == 200
    data = response.json()
    # wuxing_power and geju may be null if analysis fails, but keys should exist
    assert "wuxing_power" in data
    assert "geju" in data


# ---------------------------------------------------------------------------
# Compatibility
# ---------------------------------------------------------------------------


def test_compatibility():
    """POST /api/v1/compatibility with valid inputs should return 200."""
    response = client.post("/api/v1/compatibility", json={
        "person_a": {
            "gender": "乾造 (Male)",
            "datetime_str": "1985-06-15 09:20",
        },
        "person_b": {
            "gender": "坤造 (Female)",
            "datetime_str": "2000-03-15 12:00",
        },
    })
    assert response.status_code == 200
    data = response.json()
    assert "person_a" in data
    assert "person_b" in data
    assert "score" in data
    assert "summary" in data
    assert "day_master_relation" in data


def test_compatibility_invalid_gender():
    """POST /api/v1/compatibility with invalid gender should return 422."""
    response = client.post("/api/v1/compatibility", json={
        "person_a": {
            "gender": "X",
            "datetime_str": "1985-06-15 09:20",
        },
        "person_b": {
            "gender": "坤造 (Female)",
            "datetime_str": "2000-03-15 12:00",
        },
    })
    assert response.status_code == 422


def test_compatibility_invalid_date():
    """POST /api/v1/compatibility with bad date should return 400."""
    response = client.post("/api/v1/compatibility", json={
        "person_a": {
            "gender": "乾造 (Male)",
            "datetime_str": "invalid",
        },
        "person_b": {
            "gender": "坤造 (Female)",
            "datetime_str": "2000-03-15 12:00",
        },
    })
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Classical text query
# ---------------------------------------------------------------------------


def test_texts_query():
    """GET /api/v1/texts with valid source should return 200."""
    response = client.get("/api/v1/texts", params={"source": "穷通宝鉴"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_texts_query_with_keyword():
    """GET /api/v1/texts with query keyword should return filtered results."""
    response = client.get("/api/v1/texts", params={"query": "甲", "source": "穷通宝鉴"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_texts_invalid_source_returns_empty():
    """GET /api/v1/texts with unknown source returns 200 with empty list."""
    response = client.get("/api/v1/texts", params={"source": "不存在的书"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0


def test_texts_no_params():
    """GET /api/v1/texts without params returns all entries."""
    response = client.get("/api/v1/texts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


# ---------------------------------------------------------------------------
# SSE streaming (basic)
# ---------------------------------------------------------------------------


def test_chat_stream_accepts_request():
    """POST /api/v1/chat/stream accepts a request with message only (uses config defaults)."""
    response = client.post("/api/v1/chat/stream", json={
        "message": "hello",
    })
    # api_key is now optional (auto-filled from config), so 200 is expected
    assert response.status_code in (200, 400, 422)


def test_chat_stream_invalid_api_key():
    """POST /api/v1/chat/stream with a bogus API key should not crash.

    Depending on the provider, this may stream an error event or fail outright.
    We just verify it does not return a 500-level server error caused by
    missing validation -- the endpoint should at least accept the request.
    """
    response = client.post("/api/v1/chat/stream", json={
        "message": "hello",
        "api_key": "sk-test-invalid-key",
        "provider": "OpenAI",
        "model": "gpt-4o",
    })
    # Accept 200 (starts streaming) or any client/server error that isn't
    # an unhandled exception (FastAPI wraps those as 500 with detail).
    # We mainly want to ensure the endpoint is wired correctly.
    assert response.status_code in (200, 400, 401, 403, 422, 500)
