"""Conservative offline refinement. Unknown text is retained as evidence, never guessed."""

import re

from .models import RefinementInput, Report

UNSURE = {
    "unknown",
    "not provided",
    "not sure",
    "i don't know",
    "don't know",
    "nie wiem",
    "n/a",
    "no",
    "none",
    "not tested",
}


def demo_refine(refinement: RefinementInput) -> Report:
    report = refinement.report.model_copy(deep=True)
    for item in refinement.answers:
        answer = item.answer.strip()
        if not answer or answer.lower().rstrip(".") in UNSURE:
            continue
        question = item.question
        resolved = False
        gap = None
        if question == "Which build was tested?":
            # Only a bounded identifier, optionally prefixed by Build/Version; no prose-as-build.
            match = re.fullmatch(
                r"(?:(?:build|version)(?:\s*[:#]\s*|\s+))?([A-Za-z0-9](?:[A-Za-z0-9._+/-]{0,118}[A-Za-z0-9_+/-])?)\.?",
                answer,
                re.I,
            )
            if match:
                _environment_value(report, "Build", match.group(1))
                gap, resolved = "Build / version", True
        elif question == "How often does the issue reproduce across repeated attempts?":
            match = re.fullmatch(
                r"(?:(?:it\s+)?(?:happens|occurs|reproduces)\s+)?"
                r"(?:(?:around|about|approximately|około)\s+)?"
                r"([1-5])\s*(?:/|out of|z)\s*5(?:\s+(?:attempts|times|prób|razy))?\.?",
                answer,
                re.I,
            )
            if match:
                report.reproductionRate = f"{match.group(1)}/5"
                resolved = True
            elif answer.lower().rstrip(".") in {"always", "every time", "zawsze"}:
                report.reproductionRate, resolved = "Always", True
            if resolved:
                report.provenance.reproductionRate = "provided"
                gap = "Reproduction frequency"
        elif question == "Which platform was tested?":
            platforms = {
                value.lower(): value
                for value in ["PC", "PlayStation 5", "Xbox Series X/S", "Nintendo Switch"]
            }
            platform = platforms.get(answer.lower().rstrip("."))
            if platform:
                _environment_value(report, "Platform", platform)
                gap, resolved = "Platform", True
        elif question == "Which environment or hardware configuration was tested?" and not re.search(
            r"\b(?:maybe|not sure|don't know|probably|chyba|nie wiem)\b", answer, re.I
        ):
            # Explicitly supplied environment description, preserved rather than interpreted.
            _environment_value(report, "Environment", answer)
            gap, resolved = "Environment / hardware configuration", True
        evidence = f"Tester answer — {question}: {answer}"
        if evidence not in report.additionalNotes:
            if len(report.additionalNotes) >= 30 or len(evidence) > 2000:
                raise ValueError("Answer evidence exceeds the report limit")
            report.additionalNotes.append(evidence)
        if resolved:
            report.clarifyingQuestions = [q for q in report.clarifyingQuestions if q != question]
            report.missingInformation = [value for value in report.missingInformation if value != gap]
        # Unsupported answers stay in notes. The corresponding gap remains unresolved.
    return Report.model_validate(report.model_dump())


def _environment_value(report: Report, label: str, value: str) -> None:
    lines = (
        [] if report.environment.lower() in {"unknown", "not provided"} else report.environment.splitlines()
    )
    new_line = f"{label}: {value}"
    # Replace the explicitly corrected metadata line while preserving unrelated environment details.
    lines = [line for line in lines if not line.startswith(f"{label}:")]
    lines.append(new_line)
    report.environment = "\n".join(lines)
    if report.provenance.environment != "inferred":
        report.provenance.environment = "provided"
