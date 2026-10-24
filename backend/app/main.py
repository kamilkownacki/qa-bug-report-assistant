from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from .config import Settings
from .models import GenerationResponse, IssueInput, RefinementInput
from .providers import AIProvider, DemoProvider, GeminiProvider, ProviderError, ReportProvider

app = FastAPI(title="QA Bug Report Assistant", version="1.1.0")


def get_settings() -> Settings:
    return Settings()


def get_provider(settings: Settings = Depends(get_settings)) -> ReportProvider:
    provider = settings.provider_name
    if provider == "demo":
        return DemoProvider()
    if provider == "gemini":
        return GeminiProvider(settings)
    return AIProvider(settings)


@app.exception_handler(ProviderError)
async def provider_error_handler(request: Request, exc: ProviderError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.get("/api/health")
def health(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    provider = settings.provider_name
    return {
        "status": "ok",
        "mode": "demo" if provider == "demo" else "ai",
        "provider": provider,
    }


@app.post("/api/reports", response_model=GenerationResponse)
async def generate_report(
    issue: IssueInput,
    provider: ReportProvider = Depends(get_provider),
    settings: Settings = Depends(get_settings),
) -> GenerationResponse:
    return GenerationResponse(
        report=await provider.generate(issue),
        mode="demo" if settings.provider_name == "demo" else "ai",
    )


@app.post("/api/reports/refine", response_model=GenerationResponse)
async def refine_report(
    refinement: RefinementInput,
    provider: ReportProvider = Depends(get_provider),
    settings: Settings = Depends(get_settings),
) -> GenerationResponse:
    # No answer is not negative evidence, and must never consume provider quota.
    report = await provider.refine(refinement) if refinement.answers else refinement.report
    return GenerationResponse(report=report, mode="demo" if settings.demo else "ai")
