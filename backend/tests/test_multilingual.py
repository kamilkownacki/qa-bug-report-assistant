from app.demo import demo_report
from app.models import IssueInput


def test_polish_demo_example_generates_english_report():
    report = demo_report(
        IssueInput(description="Po wejściu do samochodu i otwarciu mapy gra czasami się zawiesza.")
    )

    assert report.summary == "Game sometimes freezes when opening the map inside a vehicle"
    assert report.description == "After entering a vehicle and opening the map, the game sometimes freezes."
    assert report.actualResult == "After entering a vehicle and opening the map, the game sometimes freezes."
    assert report.stepsToReproduce == [
        "Enter a vehicle.",
        "Open the map.",
        "Observe the game behavior.",
    ]
    assert report.expectedResult == "The map should open without freezing the game."
    assert all("jaki" not in question.lower() for question in report.clarifyingQuestions)
