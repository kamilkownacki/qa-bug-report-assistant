import asyncio
import json
import random
from pathlib import Path
from typing import Any, Protocol

import httpx
from pydantic import ValidationError

from .config import Settings
from .demo import demo_report
from .models import IssueInput, RefinementInput, Report
from .refinement import demo_refine

GEMINI_MAX_ATTEMPTS = 4
GEMINI_RETRYABLE_STATUS_CODES = {408, 429}


class ProviderError(Exception):
    """Safe user-facing provider failure; never expose upstream payloads or keys."""


class ReportProvider(Protocol):
    async def generate(self, issue: IssueInput) -> Report: ...

    async def refine(self, refinement: RefinementInput) -> Report: ...


class DemoProvider:
    async def generate(self, issue: IssueInput) -> Report:
        return demo_report(issue)

    async def refine(self, refinement: RefinementInput) -> Report:
        try:
            return demo_refine(refinement)
        except ValueError as exc:
            raise ProviderError(
                "The updated report exceeds its size limits. Shorten the answers or notes and try again."
            ) from exc


def _system_prompt(*, refine: bool = False) -> str:
    prompt = Path(__file__).with_name("system_prompt.txt").read_text(encoding="utf-8")
    if refine:
        prompt += "\n" + Path(__file__).with_name("refinement_prompt.txt").read_text(encoding="utf-8")
    return prompt


def _gemini_schema(value: Any) -> Any:
    """Keep only JSON Schema keywords supported by Gemini structured output."""
    if isinstance(value, list):
        return [_gemini_schema(item) for item in value]
    if not isinstance(value, dict):
        return value

    allowed = {
        "$id",
        "$defs",
        "$ref",
        "$anchor",
        "type",
        "format",
        "title",
        "description",
        "enum",
        "items",
        "prefixItems",
        "minItems",
        "maxItems",
        "minimum",
        "maximum",
        "anyOf",
        "oneOf",
        "properties",
        "additionalProperties",
        "required",
    }
    cleaned: dict[str, Any] = {}
    for key, item in value.items():
        if key == "properties" and isinstance(item, dict):
            cleaned[key] = {name: _gemini_schema(schema) for name, schema in item.items()}
        elif key == "$defs" and isinstance(item, dict):
            cleaned[key] = {name: _gemini_schema(schema) for name, schema in item.items()}
        elif key in allowed:
            cleaned[key] = _gemini_schema(item)
    return cleaned


def _gemini_retryable(status_code: int) -> bool:
    return status_code in GEMINI_RETRYABLE_STATUS_CODES or 500 <= status_code <= 599


def _gemini_retry_delay(retry_index: int) -> float:
    return min(8.0, 2**retry_index) + random.uniform(0.0, 0.25)


def _gemini_http_error(status_code: int) -> ProviderError:
    if status_code == 400:
        return ProviderError("Gemini rejected the request. Check QA_GEMINI_MODEL and API configuration.")
    if status_code in {401, 403}:
        return ProviderError("Gemini authentication failed. Check QA_GEMINI_API_KEY and API access.")
    if status_code == 402:
        return ProviderError("Gemini requires available billing or credits for this request.")
    if status_code == 404:
        return ProviderError("Gemini model or endpoint was not found. Check QA_GEMINI_MODEL and API version.")
    if status_code == 408:
        return ProviderError("Gemini request timed out after multiple attempts. Please try again shortly.")
    if status_code == 429:
        return ProviderError("Gemini rate limit reached after multiple attempts. Please try again shortly.")
    if 500 <= status_code <= 599:
        return ProviderError("Gemini is temporarily overloaded or unavailable. Please try again shortly.")
    return ProviderError("Gemini request failed. Check server configuration or try again later.")


class GeminiProvider:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def generate(self, issue: IssueInput) -> Report:
        return await self._request(issue.model_dump_json(), refine=False)

    async def refine(self, refinement: RefinementInput) -> Report:
        return await self._request(refinement.model_dump_json(), refine=True)

    async def _request(self, data: str, *, refine: bool) -> Report:
        api_key = self.settings.gemini_api_key.get_secret_value()
        if not api_key:
            raise ProviderError("Gemini is not configured. Add QA_GEMINI_API_KEY or use demo mode.")
        if not self.settings.gemini_base_url.startswith("https://"):
            raise ProviderError("The Gemini API URL must use HTTPS.")

        model = self.settings.gemini_model.removeprefix("models/")
        url = f"{self.settings.gemini_base_url.rstrip('/')}/models/{model}:generateContent"
        payload = {
            "systemInstruction": {"parts": [{"text": _system_prompt(refine=refine)}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": data}],
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": _gemini_schema(Report.model_json_schema()),
            },
        }

        async with httpx.AsyncClient(timeout=self.settings.ai_timeout_seconds) as client:
            for attempt in range(GEMINI_MAX_ATTEMPTS):
                try:
                    response = await client.post(
                        url,
                        headers={
                            "x-goog-api-key": api_key,
                            "x-goog-api-client": "qa-bug-report-assistant/1.0.0",
                        },
                        json=payload,
                    )
                    if response.status_code >= 400:
                        if _gemini_retryable(response.status_code) and attempt < GEMINI_MAX_ATTEMPTS - 1:
                            await asyncio.sleep(_gemini_retry_delay(attempt))
                            continue
                        raise _gemini_http_error(response.status_code)

                    parts = response.json()["candidates"][0]["content"]["parts"]
                    content = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
                    if not content:
                        raise ValueError("Gemini returned no text content")
                    return Report.model_validate_json(content)
                except ProviderError:
                    raise
                except httpx.TimeoutException as exc:
                    if attempt < GEMINI_MAX_ATTEMPTS - 1:
                        await asyncio.sleep(_gemini_retry_delay(attempt))
                        continue
                    raise ProviderError(
                        "Gemini timed out after multiple attempts. Please try again shortly."
                    ) from exc
                except httpx.NetworkError as exc:
                    if attempt < GEMINI_MAX_ATTEMPTS - 1:
                        await asyncio.sleep(_gemini_retry_delay(attempt))
                        continue
                    raise ProviderError(
                        "Gemini network request failed after multiple attempts. Please try again shortly."
                    ) from exc
                except (
                    ValidationError,
                    ValueError,
                    KeyError,
                    IndexError,
                    TypeError,
                    json.JSONDecodeError,
                ) as exc:
                    raise ProviderError(
                        "The AI returned an invalid report. Your notes are safe; please try again."
                    ) from exc

        raise ProviderError("Gemini request failed unexpectedly. Please try again.")


class AIProvider:
    """OpenAI-compatible provider kept as an optional alternative."""

    def __init__(self, settings: Settings):
        self.settings = settings

    async def generate(self, issue: IssueInput) -> Report:
        return await self._request(issue.model_dump_json(), refine=False)

    async def refine(self, refinement: RefinementInput) -> Report:
        return await self._request(refinement.model_dump_json(), refine=True)

    async def _request(self, data: str, *, refine: bool) -> Report:
        api_key = self.settings.ai_api_key.get_secret_value()
        if not api_key:
            raise ProviderError("OpenAI-compatible AI is not configured. Add QA_AI_API_KEY or use demo mode.")
        if not self.settings.ai_base_url.startswith("https://"):
            raise ProviderError("The AI provider URL must use HTTPS.")
        try:
            async with httpx.AsyncClient(timeout=self.settings.ai_timeout_seconds) as client:
                response = await client.post(
                    self.settings.ai_base_url.rstrip("/") + "/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": self.settings.ai_model,
                        "messages": [
                            {"role": "system", "content": _system_prompt(refine=refine)},
                            {"role": "user", "content": data},
                        ],
                        "response_format": {
                            "type": "json_schema",
                            "json_schema": {
                                "name": "bug_report",
                                "strict": True,
                                "schema": Report.model_json_schema(),
                            },
                        },
                    },
                )
                response.raise_for_status()
                return Report.model_validate_json(response.json()["choices"][0]["message"]["content"])
        except (
            ValidationError,
            ValueError,
            KeyError,
            IndexError,
            TypeError,
            json.JSONDecodeError,
        ) as exc:
            raise ProviderError(
                "The AI returned an invalid report. Your notes are safe; please try again."
            ) from exc
        except httpx.TimeoutException as exc:
            raise ProviderError("The AI provider timed out. Please try again.") from exc
        except httpx.HTTPError as exc:
            raise ProviderError(
                "The AI provider is unavailable. Check server configuration or try again later."
            ) from exc
