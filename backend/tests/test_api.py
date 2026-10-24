import asyncio
import json

import httpx
import pytest

from app.config import Settings
from app.demo import demo_report
from app.main import app, get_settings
from app.models import IssueInput
from app.providers import AIProvider, GeminiProvider

MAP = "After entering a vehicle and opening the map, the game sometimes freezes."


def test_health_and_demo_endpoint(client):
    assert client.get("/api/health").json() == {
        "status": "ok",
        "mode": "demo",
        "provider": "demo",
    }
    response = client.post("/api/reports", json={"description": MAP})
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "demo"
    report = body["report"]
    assert report["reproductionRate"] == "Unknown"
    assert report["environment"] == "Not provided"
    assert report["regression"] == "Unknown"
    assert "Build / version" in report["missingInformation"]
    assert not any("save" in step.lower() or "launch" in step.lower() for step in report["stepsToReproduce"])
    assert "Which build was tested?" in report["clarifyingQuestions"]


@pytest.mark.parametrize("description", ["", "short", "   ", "x" * 5001])
def test_description_validation(client, description):
    assert client.post("/api/reports", json={"description": description}).status_code == 422


@pytest.mark.parametrize(
    "field,value",
    [
        ("reproductionRate", "Often"),
        ("platform", "Amiga"),
        ("area", "Secret"),
        ("extra", True),
    ],
)
def test_rejects_invalid_metadata(client, field, value):
    assert client.post("/api/reports", json={"description": MAP, field: value}).status_code == 422


def test_input_boundary_and_metadata(client):
    assert client.post("/api/reports", json={"description": "x" * 5000}).status_code == 200
    data = {
        "description": MAP,
        "platform": "PC",
        "build": "1.2",
        "environment": "Windows 11",
        "area": "Gameplay",
        "reproductionRate": "2/5",
    }
    report = client.post("/api/reports", json=data).json()["report"]
    assert report["reproductionRate"] == "2/5"
    assert report["environment"] == "Platform: PC\nBuild: 1.2\nWindows 11"
    assert "Build / version" not in report["missingInformation"]
    assert "Reproduction frequency" not in report["missingInformation"]


def test_arbitrary_notes_are_not_fabricated(client):
    notes = "Something odd happens on the main menu."
    report = client.post("/api/reports", json={"description": notes}).json()["report"]
    assert report["description"] == notes
    assert report["actualResult"] == notes
    assert report["expectedResult"] == "Unknown"
    assert report["stepsToReproduce"] == []
    assert report["preconditions"] == []
    assert report["component"] == "Unknown"


@pytest.mark.parametrize(
    "description",
    [
        "Game crashes after loading a save created in the previous version.",
        "Inventory tooltip stays visible after closing the inventory.",
        "FPS drops significantly when entering the city.",
        "Quest progress is lost after loading an autosave.",
        "NPC dialogue audio stops playing after skipping several dialogue lines.",
    ],
)
def test_all_demo_templates(client, description):
    response = client.post("/api/reports", json={"description": description})
    assert response.status_code == 200
    report = response.json()["report"]
    assert report["actualResult"] == description
    assert report["regression"] == "Unknown"
    assert report["stepsToReproduce"]
    assert report["clarifyingQuestions"]


def test_modes_provider_priority_and_secrets():
    assert Settings(mode="auto", _env_file=None).provider_name == "demo"
    assert Settings(mode="auto", gemini_api_key="gemini-secret", _env_file=None).provider_name == "gemini"
    assert Settings(mode="auto", ai_api_key="openai-secret", _env_file=None).provider_name == "openai"
    assert (
        Settings(
            mode="auto",
            gemini_api_key="gemini-secret",
            ai_api_key="openai-secret",
            _env_file=None,
        ).provider_name
        == "gemini"
    )
    assert Settings(mode="demo", gemini_api_key="private", _env_file=None).provider_name == "demo"
    assert Settings(mode="ai", _env_file=None).provider_name == "gemini"
    settings_repr = repr(
        Settings(
            gemini_api_key="gemini-secret",
            ai_api_key="openai-secret",
            _env_file=None,
        )
    )
    assert "gemini-secret" not in settings_repr
    assert "openai-secret" not in settings_repr


def mock_openai_upstream(monkeypatch, *, content=None, status=200, timeout=False):
    captured = {}

    async def post(self, url, **kwargs):
        captured["url"] = url
        captured["headers"] = kwargs.get("headers", {})
        captured.update(kwargs["json"])
        if timeout:
            raise httpx.ReadTimeout("private upstream message")
        request = httpx.Request("POST", url)
        return httpx.Response(
            status,
            json={"choices": [{"message": {"content": content}}]},
            request=request,
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    app.dependency_overrides[get_settings] = lambda: Settings(
        mode="ai",
        provider="openai",
        ai_api_key="test-secret",
        _env_file=None,
    )
    return captured


def mock_gemini_upstream(monkeypatch, *, content=None, status=200, statuses=None, timeout=False):
    captured = {"calls": 0, "delays": []}

    async def post(self, url, **kwargs):
        captured["calls"] += 1
        captured["url"] = url
        captured["headers"] = kwargs.get("headers", {})
        captured.update(kwargs["json"])
        if timeout:
            raise httpx.ReadTimeout("private upstream message")
        response_status = status
        if statuses:
            response_status = statuses[min(captured["calls"] - 1, len(statuses) - 1)]
        request = httpx.Request("POST", url)
        return httpx.Response(
            response_status,
            json={"candidates": [{"content": {"parts": [{"text": content}]}}]},
            request=request,
        )

    async def sleep(delay):
        captured["delays"].append(delay)

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    monkeypatch.setattr(asyncio, "sleep", sleep)
    monkeypatch.setattr("app.providers.random.uniform", lambda start, end: 0.0)
    app.dependency_overrides[get_settings] = lambda: Settings(
        mode="ai",
        provider="gemini",
        gemini_api_key="test-gemini-secret",
        _env_file=None,
    )
    return captured


@pytest.mark.parametrize(
    "content",
    ["not json", "{}", '{"severity":"Impossible"}', "null", "[]"],
)
def test_invalid_openai_response_is_safe(client, monkeypatch, content):
    mock_openai_upstream(monkeypatch, content=content)
    response = client.post("/api/reports", json={"description": MAP})
    assert response.status_code == 502
    assert "invalid report" in response.json()["detail"]
    assert "test-secret" not in response.text


def test_valid_openai_response_schema_and_prompt(client, monkeypatch):
    report = demo_report(IssueInput(description=MAP)).model_dump()
    captured = mock_openai_upstream(monkeypatch, content=json.dumps(report))
    response = client.post("/api/reports", json={"description": MAP})
    assert response.status_code == 200
    assert response.json()["mode"] == "ai"
    assert response.json()["report"] == report
    assert captured["response_format"]["json_schema"]["strict"] is True
    assert captured["response_format"]["json_schema"]["schema"]["additionalProperties"] is False
    assert "Never invent" in captured["messages"][0]["content"]
    assert "ALWAYS generate" in captured["messages"][0]["content"]


def test_valid_gemini_response_schema_and_prompt(client, monkeypatch):
    report = demo_report(IssueInput(description=MAP)).model_dump()
    captured = mock_gemini_upstream(monkeypatch, content=json.dumps(report))
    response = client.post("/api/reports", json={"description": MAP})
    assert response.status_code == 200
    assert response.json()["mode"] == "ai"
    assert response.json()["report"] == report
    assert captured["calls"] == 1
    assert captured["delays"] == []
    assert captured["url"].endswith("/models/gemini-3.8-flash:generateContent")
    assert captured["headers"]["x-goog-api-key"] == "test-gemini-secret"
    assert captured["generationConfig"]["responseMimeType"] == "application/json"
    schema = captured["generationConfig"]["responseJsonSchema"]
    assert schema["additionalProperties"] is False
    assert "maxLength" not in json.dumps(schema)
    prompt = captured["systemInstruction"]["parts"][0]["text"]
    assert "Never invent" in prompt
    assert "ALWAYS generate" in prompt


def test_gemini_retries_transient_errors_then_succeeds(client, monkeypatch):
    report = demo_report(IssueInput(description=MAP)).model_dump()
    captured = mock_gemini_upstream(
        monkeypatch,
        content=json.dumps(report),
        statuses=[503, 503, 200],
    )
    response = client.post("/api/reports", json={"description": MAP})
    assert response.status_code == 200
    assert response.json()["report"] == report
    assert captured["calls"] == 3
    assert captured["delays"] == [1.0, 2.0]


@pytest.mark.parametrize(
    "status,message,attempts,delays",
    [
        (400, "rejected the request", 1, []),
        (401, "authentication failed", 1, []),
        (403, "authentication failed", 1, []),
        (404, "model or endpoint was not found", 1, []),
        (408, "timed out after multiple attempts", 4, [1.0, 2.0, 4.0]),
        (429, "rate limit reached after multiple attempts", 4, [1.0, 2.0, 4.0]),
        (500, "temporarily overloaded or unavailable", 4, [1.0, 2.0, 4.0]),
        (503, "temporarily overloaded or unavailable", 4, [1.0, 2.0, 4.0]),
    ],
)
def test_gemini_http_failures_are_safe_and_retry_when_transient(
    client,
    monkeypatch,
    status,
    message,
    attempts,
    delays,
):
    captured = mock_gemini_upstream(monkeypatch, status=status)
    response = client.post("/api/reports", json={"description": MAP})
    assert response.status_code == 502
    assert message in response.json()["detail"].lower()
    assert captured["calls"] == attempts
    assert captured["delays"] == delays
    assert "test-gemini-secret" not in response.text


def test_gemini_timeout_retries_then_fails(client, monkeypatch):
    captured = mock_gemini_upstream(monkeypatch, timeout=True)
    response = client.post("/api/reports", json={"description": MAP})
    assert response.status_code == 502
    assert "timed out after multiple attempts" in response.json()["detail"].lower()
    assert captured["calls"] == 4
    assert captured["delays"] == [1.0, 2.0, 4.0]
    assert "private" not in response.text


@pytest.mark.parametrize(
    "status,timeout,message",
    [
        (401, False, "unavailable"),
        (429, False, "unavailable"),
        (500, False, "unavailable"),
        (200, True, "timed out"),
    ],
)
def test_openai_upstream_failure_safe(client, monkeypatch, status, timeout, message):
    mock_openai_upstream(monkeypatch, status=status, timeout=timeout)
    response = client.post("/api/reports", json={"description": MAP})
    assert response.status_code == 502
    assert message in response.json()["detail"]
    assert "private" not in response.text


def test_explicit_ai_without_key(client):
    app.dependency_overrides[get_settings] = lambda: Settings(mode="ai", _env_file=None)
    response = client.post("/api/reports", json={"description": MAP})
    assert response.status_code == 502
    assert "not configured" in response.json()["detail"]


def test_insecure_openai_url_rejected():
    provider = AIProvider(
        Settings(
            mode="ai",
            provider="openai",
            ai_api_key="test",
            ai_base_url="http://example.org",
            _env_file=None,
        )
    )
    with pytest.raises(Exception, match="must use HTTPS"):
        asyncio.run(provider.generate(IssueInput(description=MAP)))


def test_insecure_gemini_url_rejected():
    provider = GeminiProvider(
        Settings(
            mode="ai",
            provider="gemini",
            gemini_api_key="test",
            gemini_base_url="http://example.org",
            _env_file=None,
        )
    )
    with pytest.raises(Exception, match="must use HTTPS"):
        asyncio.run(provider.generate(IssueInput(description=MAP)))
