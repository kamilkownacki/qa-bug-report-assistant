from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Severity = Literal["Blocker", "Critical", "Major", "Minor", "Trivial"]
Priority = Literal["Highest", "High", "Medium", "Low", "Lowest"]
Rate = Literal["Unknown", "1/5", "2/5", "3/5", "4/5", "5/5", "Always"]
ProvenanceStatus = Literal["provided", "inferred", "missing"]
DetailLevel = Literal["compact", "standard", "detailed"]


class Provenance(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summary: ProvenanceStatus
    description: ProvenanceStatus
    preconditions: ProvenanceStatus
    stepsToReproduce: ProvenanceStatus
    actualResult: ProvenanceStatus
    expectedResult: ProvenanceStatus
    reproductionRate: ProvenanceStatus
    severity: ProvenanceStatus
    priority: ProvenanceStatus
    environment: ProvenanceStatus
    component: ProvenanceStatus
    regression: ProvenanceStatus


class IssueInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    description: str = Field(min_length=10, max_length=5000)
    platform: Literal["", "PC", "PlayStation 5", "Xbox Series X/S", "Nintendo Switch", "Other"] = ""
    build: str = Field(default="", max_length=120)
    environment: str = Field(default="", max_length=500)
    area: Literal[
        "",
        "Gameplay",
        "UI",
        "Audio",
        "Graphics",
        "Performance",
        "Network",
        "Save System",
        "Localization",
        "Other",
    ] = ""
    reproductionRate: Rate = "Unknown"
    detailLevel: DetailLevel = "standard"

    @field_validator("description")
    @classmethod
    def meaningful_notes(cls, value: str) -> str:
        if value.lower() in {"unknown", "not provided"}:
            raise ValueError("Describe an observed issue rather than a missing-value placeholder")
        return value


class Report(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    summary: str = Field(min_length=1, max_length=250)
    description: str = Field(min_length=1, max_length=10000)
    preconditions: list[str] = Field(max_length=30)
    stepsToReproduce: list[str] = Field(max_length=30)
    actualResult: str = Field(min_length=1, max_length=10000)
    expectedResult: str = Field(min_length=1, max_length=10000)
    reproductionRate: Rate
    severity: Severity
    priority: Priority
    environment: str = Field(min_length=1, max_length=2000)
    component: str = Field(min_length=1, max_length=150)
    regression: Literal["Yes", "No", "Unknown"]
    labels: list[str] = Field(max_length=30)
    additionalNotes: list[str] = Field(max_length=30)
    missingInformation: list[str] = Field(max_length=30)
    clarifyingQuestions: list[str] = Field(max_length=5)
    suggestedInvestigation: list[str] = Field(max_length=30)
    provenance: Provenance

    @field_validator(
        "preconditions",
        "stepsToReproduce",
        "labels",
        "additionalNotes",
        "missingInformation",
        "clarifyingQuestions",
        "suggestedInvestigation",
    )
    @classmethod
    def bounded_items(cls, values: list[str]) -> list[str]:
        if any(not item.strip() or len(item) > 2000 for item in values):
            raise ValueError("List items must contain 1–2000 characters")
        return values

    @model_validator(mode="after")
    def consistent_missing_provenance(self) -> "Report":
        for key, status in self.provenance.model_dump().items():
            value = getattr(self, key)
            missing = not value or (isinstance(value, str) and value.lower() in {"unknown", "not provided"})
            if missing != (status == "missing"):
                raise ValueError(f"Provenance for {key} must agree with whether its value is missing")
        return self


class ClarifyingAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    question: str = Field(min_length=1, max_length=2000)
    answer: str = Field(max_length=2000)


class RefinementInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    originalInput: IssueInput
    report: Report
    answers: list[ClarifyingAnswer] = Field(max_length=5)

    @field_validator("answers")
    @classmethod
    def ignore_blank_answers(cls, answers: list[ClarifyingAnswer]) -> list[ClarifyingAnswer]:
        return [item for item in answers if item.answer]

    @model_validator(mode="after")
    def current_questions_only(self) -> "RefinementInput":
        questions = [item.question for item in self.answers]
        if len(set(questions)) != len(questions):
            raise ValueError("Answer each question only once")
        if any(question not in self.report.clarifyingQuestions for question in questions):
            raise ValueError("Answers must refer to questions in the current report")
        return self


class GenerationResponse(BaseModel):
    report: Report
    mode: Literal["demo", "ai"]
