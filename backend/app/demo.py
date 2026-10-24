"""Offline assistance: evidence-preserving notes, never invented technical details."""

from .models import IssueInput, Provenance, Report


def demo_report(issue: IssueInput) -> Report:
    text = issue.description
    lower = text.lower()
    # Only fixed, fully matching examples receive a curated English rewrite.
    # This includes a Polish example to demonstrate multilingual notes -> English Jira output.
    examples = {
        "after entering a vehicle and opening the map, the game sometimes freezes.": (
            "Game sometimes freezes when opening the map inside a vehicle",
            [],
            ["Enter a vehicle.", "Open the map.", "Observe the game behavior."],
            "The map should open without freezing the game.",
            "Gameplay",
            ["vehicle", "map", "freeze"],
            ["Does this happen with every vehicle?", "Is the freeze temporary or permanent?"],
            "After entering a vehicle and opening the map, the game sometimes freezes.",
        ),
        "po wejściu do samochodu i otwarciu mapy gra czasami się zawiesza.": (
            "Game sometimes freezes when opening the map inside a vehicle",
            [],
            ["Enter a vehicle.", "Open the map.", "Observe the game behavior."],
            "The map should open without freezing the game.",
            "Gameplay",
            ["vehicle", "map", "freeze"],
            ["Does this happen with every vehicle?", "Is the freeze temporary or permanent?"],
            "After entering a vehicle and opening the map, the game sometimes freezes.",
        ),
        "game crashes after loading a save created in the previous version.": (
            "Game crashes when loading a save from the previous version",
            ["A save created in the previous version is available."],
            ["Load a save created in the previous version.", "Observe the game behavior."],
            "The save should load without crashing the game.",
            "Save System",
            ["crash", "save"],
            ["Which versions created and loaded the save?", "Does a newly created save also cause a crash?"],
            "Game crashes after loading a save created in the previous version.",
        ),
        "inventory tooltip stays visible after closing the inventory.": (
            "Inventory tooltip remains visible after closing the inventory",
            ["An inventory tooltip is visible."],
            ["Close the inventory while a tooltip is visible.", "Observe the tooltip."],
            "The inventory tooltip should disappear when the inventory closes.",
            "UI",
            ["inventory", "tooltip"],
            ["Does this affect every item tooltip?"],
            "Inventory tooltip stays visible after closing the inventory.",
        ),
        "fps drops significantly when entering the city.": (
            "Frame rate drops when entering the city",
            [],
            ["Enter the city.", "Observe the frame rate."],
            "Entering the city should not cause a significant frame rate drop.",
            "Performance",
            ["fps", "city"],
            [
                "What are the measured frame rates before and after entering the city?",
                "Which graphics settings and hardware were used?",
            ],
            "FPS drops significantly when entering the city.",
        ),
        "quest progress is lost after loading an autosave.": (
            "Quest progress is lost after loading an autosave",
            ["An autosave is available."],
            ["Load the autosave.", "Check quest progress."],
            "Quest progress recorded in the autosave should be preserved.",
            "Save System",
            ["quest", "autosave"],
            ["Which quest and progress were affected?", "Was the progress recorded before the autosave?"],
            "Quest progress is lost after loading an autosave.",
        ),
        "npc dialogue audio stops playing after skipping several dialogue lines.": (
            "NPC dialogue audio stops after skipping dialogue lines",
            ["NPC dialogue is playing."],
            ["Skip several dialogue lines.", "Listen for subsequent NPC dialogue audio."],
            "NPC dialogue audio should continue for subsequent lines.",
            "Audio",
            ["dialogue", "audio"],
            ["How many lines were skipped?", "Does the audio resume in a new conversation?"],
            "NPC dialogue audio stops playing after skipping several dialogue lines.",
        ),
    }
    example = examples.get(lower)
    if example:
        summary, preconditions, steps, expected, area, labels, questions, english_text = example
        description = english_text
        actual_result = english_text
    else:
        summary = text if len(text) <= 160 else text[:157] + "…"
        description = text
        actual_result = text
        preconditions, steps, expected, area, labels, questions = (
            [],
            [],
            "Unknown",
            "Unknown",
            [],
            ["What exact actions reproduce the issue?", "What behavior was expected?"],
        )
    # Questions are distinct from proposed tests and capped to avoid interrogation loops.
    context_questions = questions
    questions = []
    missing = []
    if not issue.build:
        missing.append("Build / version")
        questions.append("Which build was tested?")
    if not issue.platform:
        missing.append("Platform")
        questions.append("Which platform was tested?")
    if not issue.environment:
        missing.append("Environment / hardware configuration")
        questions.append("Which environment or hardware configuration was tested?")
    if issue.reproductionRate == "Unknown":
        missing.append("Reproduction frequency")
        questions.append("How often does the issue reproduce across repeated attempts?")
    if not steps:
        missing.extend(["Exact reproduction steps", "Expected behavior"])
    missing.append("Regression status")
    questions = (questions + context_questions)[:5]
    environment = []
    if issue.platform:
        environment.append(f"Platform: {issue.platform}")
    if issue.build:
        environment.append(f"Build: {issue.build}")
    if issue.environment:
        environment.append(issue.environment)
    severity = "Major"
    if example and area in ("UI", "Audio"):
        severity = "Minor"
    if example and "crashes" in lower:
        severity = "Critical"
    if issue.detailLevel == "compact" and steps and steps[-1].startswith("Observe"):
        steps = steps[:-1]
    if issue.build and issue.detailLevel != "compact":
        description += f" The tested build is {issue.build}."
    if issue.detailLevel == "detailed":
        if issue.platform:
            description += f" The tested platform is {issue.platform}."
        if issue.environment:
            description += f" Tester-provided environment: {issue.environment}."
    investigation = suggested_checks(area)
    return Report(
        summary=summary,
        description=description,
        preconditions=preconditions,
        stepsToReproduce=steps,
        actualResult=actual_result,
        expectedResult=expected,
        reproductionRate=issue.reproductionRate,
        severity=severity,
        priority="Medium",
        environment="\n".join(environment) or "Not provided",
        component=issue.area or area,
        regression="Unknown",
        labels=labels,
        additionalNotes=[
            "Demo mode: curated examples use fixed responses; other notes are preserved verbatim with unknown fields.",
            "AI mode accepts Polish or other languages and generates the report in English.",
            "Severity and priority are suggestions. Confirm impact and urgency before submitting.",
        ],
        missingInformation=missing,
        clarifyingQuestions=questions,
        suggestedInvestigation=investigation,
        provenance=Provenance(
            summary="provided",
            description="provided",
            actualResult="provided",
            preconditions="provided" if preconditions else "missing",
            stepsToReproduce="provided" if steps else "missing",
            expectedResult="inferred" if expected != "Unknown" else "missing",
            reproductionRate="provided" if issue.reproductionRate != "Unknown" else "missing",
            severity="inferred",
            priority="inferred",
            environment="provided" if environment else "missing",
            component="provided" if issue.area else "inferred" if area != "Unknown" else "missing",
            regression="missing",
        ),
    )


def suggested_checks(area: str) -> list[str]:
    if area == "Gameplay":
        return [
            "Check whether the issue reproduces with different vehicle types.",
            "Verify whether opening the map outside a vehicle reproduces the issue.",
            "Repeat the reported sequence after restarting the game.",
            "Check whether the issue reproduces on a new save.",
            "Observe whether the game recovers after waiting.",
        ]
    checks = {
        "Save System": [
            "Compare an affected save with a newly created save.",
            "Repeat the reported load and record exactly what fails or changes.",
            "Retest the same save after restarting the game.",
        ],
        "UI": [
            "Check whether different inventory item tooltips remain visible.",
            "Compare closing the inventory with different supported input methods.",
            "Check whether reopening the inventory clears the tooltip.",
        ],
        "Performance": [
            "Measure frame rate before and after entering the same city location.",
            "Repeat the route with the same graphics settings to assess consistency.",
            "Compare results after restarting the game and record the hardware used.",
        ],
        "Audio": [
            "Compare skipping dialogue with playing the same dialogue without skipping.",
            "Record how many skipped lines trigger the audio interruption.",
            "Check whether starting a new conversation restores dialogue audio.",
        ],
    }
    return checks.get(
        area,
        [
            "Record the exact actions leading to the reported behavior.",
            "Compare the reported behavior with the intended behavior of the affected feature.",
            "Repeat those same actions and record the reproduction frequency.",
        ],
    )
