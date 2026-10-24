# Validation record

## 2026-10-24 — AI QA assistant extension

Extended the current `f6733fc` implementation after a clean fast-forward to the latest configured GitHub branch. Existing Gemini routing, retry/backoff, OpenAI-compatible support, Windows launchers, and AI-assisted-development disclosure are preserved. Validation ran locally with Python 3.12.14, Node 24.19.0, and Linux Chromium 154.0.8037.57.

| Check | Result | Scope |
| --- | --- | --- |
| Backend `pytest -q` | **82 passed** | All prior tests plus detail forwarding to both providers, provenance/schema bounds, missing-value consistency, successful/empty/uncertain refinement, exact identifiers, safe failures, Gemini retry, repeat rounds, and negated/ambiguous frequency |
| Frontend `npm test` | **34 passed** | Existing workflows plus detail selection, badges, investigation edits/exports, answer entry/persistence, endpoint payload, current draft vs original notes, same history entry, loading/errors, and legacy restoration |
| ESLint | **Passed** | Frontend source, unit tests, and E2E |
| TypeScript / production build | **Passed** | `npm run build` includes strict `tsc -b` and Vite production bundling |
| Ruff check / format check | **Passed** | All backend source and tests |
| Prettier check | **Passed** | Frontend source and configuration |
| Playwright | **5 passed** | All four original scenarios plus Polish generation → answer build/rate → update → verify preserved title/priority and Unknown regression → restore after reload |
| Automated accessibility | **Passed** | Existing empty/generated views in light/dark themes, plus the refined report on a 390px viewport, using axe WCAG A/AA and 2.1 AA tags |
| Mobile layout | **Passed** | Original 390px/320px overflow checks; new refinement path also checked at 390px |
| Dev proxy functional requests | **Passed** | Real API health, Polish demo generation, and build/rate refinement through Vite on port 5173 |
| Diff review | **Passed** | Reviewed source, prompts, tests, documentation and refreshed synthetic screenshots; `git diff --check` clean |

Tests used deterministic demo or mocked provider responses; no real Gemini/OpenAI requests or API quota were consumed. Provider calls are mocked even in retry/error tests. Production-browser tests start their backend with `QA_MODE=demo`.

### Changes covered

- `Report` now includes a typed `provenance` object and separate editable `suggestedInvestigation`; input includes `detailLevel`, defaulting to Standard.
- `POST /api/reports/refine` receives original notes/metadata, the current edited report, and nonempty question/answer pairs. An empty refinement returns unchanged data without a provider call.
- Offline updates accept explicit supported build, numeric rate, platform, and environment answers. Negated, conflicting, unsupported, or uncertain prose stays unresolved rather than being converted into a fabricated fact. Recognized facts remove only their corresponding gaps/questions.
- Field badges distinguish directly supported data (including translation), inference, and missing values. Older history entries remain readable with unavailable provenance explicitly disclosed.
- Refinement persists in the same history entry; pending answer drafts survive restoration. API errors preserve the draft and answers. Investigation exports remain clearly separate from reproduction steps.

### Remaining limits

- Real-provider generation/refinement and semantic accuracy were not evaluated. Prompts preserve evidence and edits, but schema validation and provenance labels cannot prove factual truth. Human review remains necessary.
- Demo refinement is deliberately narrow. Arbitrary question interpretation and translation of free-form answers require a live provider; unsupported answers are preserved as quoted notes and keep their gap open.
- Existing dependency warnings remain: Starlette TestClient recommends `httpx2`; Rollup drops unrecognized purity annotations from Zod comments. They did not fail tests or the production build.
- Browser coverage is Chromium on Linux, not Firefox/WebKit, real mobile hardware, or screen-reader usability. No actual Jira paste/submission was tested.
- Hosted CI and deployment/publication were not executed by this local validation. The full manual/exploratory matrix is in [TEST_CASES.md](TEST_CASES.md).

## Earlier validation — 2026-10-23

Validated on 2026-10-23 in the development cloud instance: Python 3.12.14, Node 24.19.0, npm 11.9.0, system Chromium 154.0.8037.57. This records local execution, not a hosted CI run or a live AI evaluation.

| Check | Result | Evidence / scope |
| --- | --- | --- |
| Backend pytest | **29 passed** | Endpoint, boundaries, metadata, demo templates, arbitrary notes, strict schema, mocked AI success/errors/timeouts, secret-safe errors |
| Frontend Vitest | **19 passed** | Generation, editing, copy formats/denial, storage failures/corruption, history restore/delete/limit, theme, loading, JSON export, heuristic |
| Playwright | **4 passed** | Production bundle with real FastAPI: desktop workflow, persisted edits after reload, all templates on mobile, JSON download, real clipboard, Escape/focus return, no horizontal overflow at 390px/320px |
| Automated accessibility | **Passed** | axe WCAG 2 A/AA and 2.1 AA tags: empty light view, generated light view, generated dark view; included in Playwright |
| ESLint / TypeScript | **Passed** | App, unit tests, and browser configuration/tests type-checked; production build completed |
| Ruff check / format | **Passed** | Backend source and tests |
| Prettier check | **Passed** | Frontend source and configuration |
| npm audit | **0 known vulnerabilities** | All production and development dependencies at the time of this run |
| PyPI advisory metadata | **0 affected dependencies** | Exact versions of all 25 entries in `backend/requirements.lock`, queried against PyPI version metadata |
| Repeatable setup | **Passed** | `bash scripts/setup.sh` reinstalls locked dependencies, builds successfully, preserves source and `.env` |
| Functional requests | **Passed** | Health and report generation via the running API, plus browser requests through Vite proxy |

Screenshots in `docs/screenshots/` were captured during these browser tests with synthetic notes. Accessibility automation is partial coverage; screen-reader usability and subjective readability still benefit from manual review.

## Issues found and corrected during development

- A successful-generation notification overwrote the storage-full warning. The warning now remains visible and the draft can still be exported.
- Focus restoration ran while the history modal still made the opener inert. Focus now returns after the modal is removed.
- Secondary text and ready-state badges initially missed AA contrast. Colors were darkened, tooltip controls received valid semantics, and the accessibility check now passes.
- Dependency checks found advisories in initial Zod, test-runner, pytest, and Starlette versions. Patched versions are now locked and the checks above pass.
- The cloud machine's default npm cache was not writable. The setup script uses ignored repository-local caches.

## Limits and checks not executed

- No paid/live AI request: there is no configured key. The HTTPS provider integration is exercised with mocked success, malformed output, HTTP errors, and timeout responses. Schema validation cannot prove factual accuracy.
- No actual Jira submission or paste verification in a Jira instance. Export emits Jira wiki markup, Markdown, plain text, and JSON; Jira editor versions differ in how they interpret pasted markup.
- Browser execution used Linux Chromium only. Firefox, WebKit, screen readers, and real mobile hardware were not exercised.
- GitHub Actions configuration is supplied but has not run on GitHub in this task.
- Environment publication and restoration in a fresh task are separate platform operations and have not been verified here.

The full manual/exploratory matrix remains in [TEST_CASES.md](TEST_CASES.md); automated coverage does not imply every manual case was executed.
