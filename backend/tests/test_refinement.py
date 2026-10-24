import json

import pytest
from test_api import MAP, mock_gemini_upstream, mock_openai_upstream

from app.demo import demo_report
from app.main import app, get_provider
from app.models import IssueInput

BUILD_QUESTION = "Which build was tested?"
RATE_QUESTION = "How often does the issue reproduce across repeated attempts?"


def payload(**changes):
    issue = IssueInput(description=MAP)
    data = {"originalInput": issue.model_dump(), "report": demo_report(issue).model_dump(), "answers": []}
    return data | changes


@pytest.mark.parametrize("level", ["compact", "standard", "detailed"])
@pytest.mark.parametrize("provider", ["gemini", "openai"])
def test_detail_reaches_each_provider(client, monkeypatch, level, provider):
    issue = IssueInput(description=MAP, detailLevel=level)
    report = demo_report(issue).model_dump()
    mock = mock_gemini_upstream if provider == "gemini" else mock_openai_upstream
    captured = mock(monkeypatch, content=json.dumps(report))
    response = client.post("/api/reports", json=issue.model_dump())
    assert response.status_code == 200
    if provider == "gemini":
        data = captured["contents"][0]["parts"][0]["text"]
        prompt = captured["systemInstruction"]["parts"][0]["text"]
    else:
        data = captured["messages"][1]["content"]
        prompt = captured["messages"][0]["content"]
    assert json.loads(data)["detailLevel"] == level
    assert "detailLevel controls verbosity" in prompt


def test_invalid_detail_level(client):
    assert client.post("/api/reports", json={"description": MAP, "detailLevel": "verbose"}).status_code == 422


def test_demo_detail_does_not_add_facts(client):
    reports = [
        client.post("/api/reports", json={"description": MAP, "detailLevel": level}).json()["report"]
        for level in ["compact", "standard", "detailed"]
    ]
    assert len(reports[0]["stepsToReproduce"]) < len(reports[1]["stepsToReproduce"])
    for report in reports:
        assert report["environment"] == "Not provided"
        assert report["reproductionRate"] == "Unknown"
        assert len(report["description"].split(".")) <= 3
        assert not any(
            "save" in step.lower() or "launch" in step.lower() for step in report["stepsToReproduce"]
        )


def test_detail_uses_available_metadata_without_losing_facts(client):
    for level in ["compact", "standard", "detailed"]:
        report = client.post(
            "/api/reports",
            json={"description": MAP, "build": "0.8.24", "platform": "PC", "detailLevel": level},
        ).json()["report"]
        assert "0.8.24" in report["environment"]
        assert "PC" in report["environment"]
        if level != "compact":
            assert "0.8.24" in report["description"]
        if level == "detailed":
            assert "PC" in report["description"]


def test_provided_inferred_and_missing_and_suggestions(client):
    report = client.post(
        "/api/reports",
        json={"description": "Po wejściu do samochodu i otwarciu mapy gra czasami się zawiesza."},
    ).json()["report"]
    assert report["provenance"]["description"] == "provided"  # Translation is not inference.
    assert report["provenance"]["summary"] == "provided"
    assert report["provenance"]["expectedResult"] == "inferred"
    assert report["provenance"]["severity"] == "inferred"
    assert report["provenance"]["priority"] == "inferred"
    assert report["provenance"]["regression"] == "missing"
    assert report["provenance"]["environment"] == "missing"
    assert 3 <= len(report["suggestedInvestigation"]) <= 6
    assert len(report["clarifyingQuestions"]) <= 5
    assert all(
        suggestion not in report["stepsToReproduce"] for suggestion in report["suggestedInvestigation"]
    )
    assert report["preconditions"] == []  # Entering the vehicle is an action, not a prior state.


@pytest.mark.parametrize(
    "change",
    [
        {"provenance": {"description": "guessed"}},
        {"suggestedInvestigation": "Test more"},
        {"suggestedInvestigation": [""]},
        {"suggestedInvestigation": ["x" * 2001]},
        {"suggestedInvestigation": ["Check"] * 31},
        {"clarifyingQuestions": ["Question?"] * 6},
    ],
)
def test_invalid_response_metadata_rejected_safely(client, monkeypatch, change):
    report = demo_report(IssueInput(description=MAP)).model_dump()
    report.update(change)
    mock_gemini_upstream(monkeypatch, content=json.dumps(report))
    response = client.post("/api/reports", json={"description": MAP})
    assert response.status_code == 502
    assert "invalid report" in response.json()["detail"]
    assert "test-gemini-secret" not in response.text


def test_inconsistent_missing_provenance_rejected(client):
    data = payload()
    data["report"]["provenance"]["environment"] = "provided"
    assert client.post("/api/reports/refine", json=data).status_code == 422


def test_refinement_incorporates_build_and_rate_preserves_edits(client):
    data = payload(
        answers=[
            {"question": BUILD_QUESTION, "answer": "Build 0.8.24"},
            {"question": RATE_QUESTION, "answer": "Happens around 3 out of 5 attempts."},
        ]
    )
    data["report"].update(summary="Manually reviewed title", priority="High", labels=["qa-reviewed"])
    response = client.post("/api/reports/refine", json=data)
    assert response.status_code == 200
    report = response.json()["report"]
    assert report["summary"] == "Manually reviewed title"
    assert report["priority"] == "High"
    assert report["labels"] == ["qa-reviewed"]
    assert report["stepsToReproduce"] == data["report"]["stepsToReproduce"]
    assert report["environment"] == "Build: 0.8.24"
    assert report["reproductionRate"] == "3/5"
    assert report["provenance"]["environment"] == "provided"
    assert report["provenance"]["reproductionRate"] == "provided"
    assert "Build / version" not in report["missingInformation"]
    assert "Reproduction frequency" not in report["missingInformation"]
    assert BUILD_QUESTION not in report["clarifyingQuestions"]
    assert RATE_QUESTION not in report["clarifyingQuestions"]
    assert "Regression status" in report["missingInformation"]
    assert report["regression"] == "Unknown"
    assert any("around 3 out of 5" in note for note in report["additionalNotes"])


@pytest.mark.parametrize("answers", [[], [{"question": BUILD_QUESTION, "answer": "   "}]])
def test_empty_answers_do_not_call_provider_or_create_data(client, answers):
    class NeverCallProvider:
        async def refine(self, refinement):
            pytest.fail("An empty refinement must not call a provider")

    app.dependency_overrides[get_provider] = NeverCallProvider
    data = payload(answers=answers)
    try:
        response = client.post("/api/reports/refine", json=data)
        assert response.status_code == 200
        assert response.json()["report"] == data["report"]
    finally:
        app.dependency_overrides.pop(get_provider, None)


@pytest.mark.parametrize("answer", ["Unknown", "I don't know", "nie wiem", "Not sure"])
def test_unknown_answers_remain_unknown(client, answer):
    data = payload(answers=[{"question": BUILD_QUESTION, "answer": answer}])
    report = client.post("/api/reports/refine", json=data).json()["report"]
    assert report["environment"] == "Not provided"
    assert BUILD_QUESTION in report["clarifyingQuestions"]
    assert "Build / version" in report["missingInformation"]
    assert report["regression"] == "Unknown"


def test_ambiguous_frequency_does_not_invent_a_number(client):
    data = payload(answers=[{"question": RATE_QUESTION, "answer": "It only happens sometimes."}])
    report = client.post("/api/reports/refine", json=data).json()["report"]
    assert report["reproductionRate"] == "Unknown"
    assert RATE_QUESTION in report["clarifyingQuestions"]
    assert any("only happens sometimes" in note for note in report["additionalNotes"])


@pytest.mark.parametrize(
    "answers",
    [
        [{"question": "Unasked?", "answer": "Yes"}],
        [{"question": BUILD_QUESTION, "answer": "1.0"}] * 2,
        [{"question": BUILD_QUESTION, "answer": "x" * 2001}],
    ],
)
def test_refinement_request_validation(client, answers):
    assert client.post("/api/reports/refine", json=payload(answers=answers)).status_code == 422


@pytest.mark.parametrize("provider", ["gemini", "openai"])
def test_refinement_uses_existing_transports_prompts_and_validation(client, monkeypatch, provider):
    data = payload(answers=[{"question": BUILD_QUESTION, "answer": "Build 0.8.24"}])
    result = data["report"] | {
        "environment": "Build: 0.8.24",
        "provenance": data["report"]["provenance"] | {"environment": "provided"},
    }
    if provider == "gemini":
        captured = mock_gemini_upstream(monkeypatch, content=json.dumps(result), statuses=[503, 200])
    else:
        captured = mock_openai_upstream(monkeypatch, content=json.dumps(result))
    response = client.post("/api/reports/refine", json=data)
    assert response.status_code == 200
    if provider == "gemini":
        assert captured["calls"] == 2
        assert captured["delays"] == [1.0]
        prompt = captured["systemInstruction"]["parts"][0]["text"]
        sent = json.loads(captured["contents"][0]["parts"][0]["text"])
    else:
        prompt = captured["messages"][0]["content"]
        sent = json.loads(captured["messages"][1]["content"])
    assert "Preserve existing verified information and manual edits" in prompt
    assert "Blank/unanswered" in prompt
    assert sent == data
    assert "test-gemini-secret" not in response.text
    assert "test-secret" not in response.text


def test_refine_gemini_failure_safe_and_original_payload_unchanged(client, monkeypatch):
    data = payload(answers=[{"question": BUILD_QUESTION, "answer": "0.8.24"}])
    captured = mock_gemini_upstream(monkeypatch, status=429)
    response = client.post("/api/reports/refine", json=data)
    assert response.status_code == 502
    assert captured["calls"] == 4
    assert data["report"]["environment"] == "Not provided"
    assert "test-gemini-secret" not in response.text


def test_refine_invalid_gemini_response_is_safe(client, monkeypatch):
    mock_gemini_upstream(monkeypatch, content="not json")
    response = client.post(
        "/api/reports/refine", json=payload(answers=[{"question": BUILD_QUESTION, "answer": "0.8.24"}])
    )
    assert response.status_code == 502
    assert "invalid report" in response.json()["detail"]


def test_refine_size_limit_is_safe(client):
    data = payload(answers=[{"question": BUILD_QUESTION, "answer": "0.8.24"}])
    data["report"]["additionalNotes"] = ["Existing note"] * 30
    response = client.post("/api/reports/refine", json=data)
    assert response.status_code == 502
    assert "size limits" in response.json()["detail"]


@pytest.mark.parametrize(
    "answer", ["Not 3 out of 5 attempts.", "It was 3/5, but it is now 1/5.", "Maybe it is 4/5."]
)
def test_ambiguous_or_negated_rate_is_not_promoted_to_fact(client, answer):
    data = payload(answers=[{"question": RATE_QUESTION, "answer": answer}])
    report = client.post("/api/reports/refine", json=data).json()["report"]
    assert report["reproductionRate"] == "Unknown"
    assert report["provenance"]["reproductionRate"] == "missing"
    assert RATE_QUESTION in report["clarifyingQuestions"]
    assert any(answer in note for note in report["additionalNotes"])


def test_refinement_rounds_preserve_previous_answers_and_environment(client):
    data = payload(answers=[{"question": BUILD_QUESTION, "answer": "Build 0.8.24"}])
    first = client.post("/api/reports/refine", json=data).json()["report"]
    second = client.post(
        "/api/reports/refine",
        json=payload(report=first, answers=[{"question": RATE_QUESTION, "answer": "3/5"}]),
    ).json()["report"]
    assert second["environment"] == "Build: 0.8.24"
    assert second["reproductionRate"] == "3/5"
    assert BUILD_QUESTION not in second["clarifyingQuestions"]
    assert RATE_QUESTION not in second["clarifyingQuestions"]
    assert any("Build 0.8.24" in note for note in second["additionalNotes"])


def test_uncertain_environment_stays_unresolved(client):
    question = "Which environment or hardware configuration was tested?"
    report = client.post(
        "/api/reports/refine",
        json=payload(answers=[{"question": question, "answer": "Maybe Windows 11, not sure."}]),
    ).json()["report"]
    assert report["environment"] == "Not provided"
    assert question in report["clarifyingQuestions"]


def test_build_identifier_is_preserved_verbatim(client):
    report = client.post(
        "/api/reports/refine",
        json=payload(answers=[{"question": BUILD_QUESTION, "answer": "buildCandidate_0.8.24"}]),
    ).json()["report"]
    assert report["environment"] == "Build: buildCandidate_0.8.24"


def test_placeholder_notes_are_rejected_instead_of_crashing_demo(client):
    response = client.post("/api/reports", json={"description": "Not provided"})
    assert response.status_code == 422
