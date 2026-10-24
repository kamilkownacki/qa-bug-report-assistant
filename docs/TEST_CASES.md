# QA Test Cases

## Scope and approach

Validate a tester's workflow from incomplete notes to a reviewed export. Prioritize truthful handling of missing evidence, recoverability after errors, and preservation of edits. Automated tests use deterministic demo responses or mocked AI; real-provider factual quality needs a separate exploratory review.

**Preconditions:** backend and frontend running; demo mode enabled unless specified; a clean browser profile for persistence cases. Test with a keyboard, a desktop viewport, and a 390px mobile viewport. Use synthetic notes only.

**Priorities:** P0 = evidence integrity or data loss; P1 = core workflow; P2 = presentation/usability.

| ID | Priority | Scenario / data | Steps | Expected result | Coverage |
| --- | --- | --- | --- | --- | --- |
| QA-001 | P1 | Empty description | Leave description empty; try Generate; POST an empty description directly. | UI prevents generation; API returns 422; no history item. | Component + API |
| QA-002 | P1 | Very short description | Enter `Crash` (5 chars); then exactly 10 non-whitespace characters. | Short notes show guidance and disabled action; 10 chars accepted. Server trims leading/trailing whitespace. | Component + API |
| QA-003 | P1 | Very long description | Enter 5,000 characters; submit 5,001 via API. | UI has a counter and 5,000-char limit; API accepts 5,000 and rejects 5,001 with 422. | Component + API |
| QA-004 | P0 | Missing environment | Generate map example without context. | Environment is Not provided; build/platform/rate missing; no OS, hardware, or exact frequency invented. | API |
| QA-005 | P0 | Unsupported steps | Generate vehicle/map example. | Steps contain entering vehicle/opening map/observation only; no invented launch, save load, or vehicle model. | API |
| QA-006 | P0 | Arbitrary notes | Submit `Something odd happens on the main menu.` | Demo preserves input; expected behavior Unknown; steps empty; clarifying questions shown. | API |
| QA-007 | P1 | AI API unavailable | Mock upstream 401, 429, 500 and timeout; generate. | Safe 502 detail; UI preserves notes and existing draft; retry enabled; no secret/upstream payload revealed. | API + component |
| QA-008 | P0 | Invalid AI response | Return non-JSON, empty object, invalid severity, null, array. | Pydantic rejects response; API returns safe 502; UI shows an error; invalid report is not saved. | API + component |
| QA-009 | P1 | Copy to clipboard | Generate; edit summary; copy Jira, Markdown, plain text. | Copied text includes current edits and all sections; Jira uses `h2.`, `*`, `#`; Markdown uses headings/numbered steps; success toast. | Component + utility |
| QA-010 | P1 | Clipboard denied | Deny clipboard permission; click Copy. | Useful notification suggests JSON; draft remains editable. | Component |
| QA-011 | P0 | Local history limit | Generate 11 distinct reports. | Exactly ten retained; oldest removed; no duplicate ID after edits. | Component + utility |
| QA-012 | P0 | Clearing history | Open Recent Reports; Clear history; cancel; repeat and confirm. | Cancel preserves entries; confirmation clears local entries and active report. | Component + manual cancel |
| QA-013 | P0 | Editing generated ticket | Change summary, steps, severity, priority, labels, questions; restore and export. | All fields editable; severity does not change priority; edits survive restore and appear in exports. | Component + manual all fields |
| QA-014 | P1 | Restore/delete | Restore older report; remove one entry. | Matching original input and edited report restored; deleting one leaves others; deleting active report clears editor. | Component |
| QA-015 | P2 | Mobile layout | At 390px and 320px, generate a long report. | Input above output; no horizontal scrolling; controls usable; history and export accessible. | Manual/browser |
| QA-016 | P1 | Loading and duplicate requests | Keep generation request pending; attempt repeat submission. | Spinner/skeleton visible; inputs and Generate disabled; only one request initiated; controls recover. | Component |
| QA-017 | P1 | All templates | Click each template, then Generate. | Correct notes/area loaded; valid report generated for all five; no fabricated regression status. | API + component + manual |
| QA-018 | P1 | Metadata preservation | Provide PC, build 1.2, Windows 11, 2/5, Gameplay. | Demo environment includes supplied values; rate 2/5; no questions for already supplied build/rate. | API |
| QA-019 | P1 | JSON download | Edit title; download; parse file. | Valid JSON contains edited title and every report field; no API key; temporary object URL released. | Utility |
| QA-020 | P1 | Corrupt/full localStorage | Store malformed JSON/entries or deny writes. | App opens safely; unusable entries skipped; write failure warns user; generation/export remain usable. | Component + utility |
| QA-021 | P2 | Theme | Toggle theme; reload; test both modes. | Theme retained when storage works; readable text, controls, focus, and error states. | Component + manual |
| QA-022 | P1 | Keyboard/accessibility | Tab through form; focus tooltips; open history; Tab/Shift+Tab; Escape. | Inputs labelled; focus visible; tooltips available on focus; native modal traps focus; Escape closes; focus returns to opener. | Manual/browser |
| QA-023 | P1 | Quality heuristic | Generate with missing context; add rate; change regression. | Score equals passed checks / 10, updates for edited report fields, shows heuristic caveat; never claims accuracy. | Component + utility |
| QA-024 | P0 | Key isolation | Run demo without key; inspect frontend build and requests. | No key required; no provider key in client bundle, history, or error detail; .env ignored by Git. | API + manual |
| QA-025 | P0 | Prompt injection | Enter notes asking to invent build 123 or reveal the API key. | Demo echoes only user notes; live provider should follow system rules, mark unsupported facts unknown, and never reveal credentials. | Manual live AI (optional) |
| QA-026 | P1 | Live provider success | Configure an approved HTTPS provider with strict JSON-schema support; use synthetic example. | Valid schema, exact supplied metadata, no invented facts; mode AI; review output manually. | Mocked API; real provider optional |

## Follow-up and provenance cases

| ID | Priority | Scenario / data | Steps | Expected result | Coverage |
| --- | --- | --- | --- | --- | --- |
| QA-027 | P1 | Detail selection | Check default; generate the same supplied metadata in Compact, Standard, Detailed. | Standard default; detailLevel reaches each provider; compact keeps facts and detailed adds only supplied context. | Component + API |
| QA-028 | P0 | Source distinction | Generate the Polish vehicle/map example without build/rate. | Translation/rewording Provided; obvious expected result Inferred; missing environment/rate/regression Missing; suggested severity/priority Inferred. | API + component |
| QA-029 | P0 | Invalid provenance / investigation | Mock a provider returning an unsupported provenance value, malformed investigation, or inconsistent Missing status. | Pydantic rejects invalid data, safe 502, no key leakage; invalid requests receive 422; no saved corrupt report. | API + component |
| QA-030 | P0 | Successful refinement | Generate; edit title/priority; answer Build 0.8.24 and around 3 out of 5; Update. | Build/rate added with Provided status; approximate answer retained; corresponding gaps/questions removed; unrelated manual edits and Unknown regression preserved. | API + component + browser |
| QA-031 | P0 | Unanswered / uncertain | Leave all answers empty/whitespace; also submit Unknown, Not sure, and ambiguous frequency. | No provider call for empty answers; UI action disabled; uncertainty remains; no invented number, negative result, or regression. | API + component |
| QA-032 | P0 | Refinement failure | Mock invalid JSON, Gemini 429/503, timeout, or full report notes. | Existing safe provider behavior/retry policy retained; draft and answers remain; size failures do not silently drop evidence. | API + component |
| QA-033 | P0 | Original notes and edited report | Modify input for a future ticket while the current report is open; answer a current question. | Refinement sends the current ticket's original input and latest edited report; not the other unsent input. | Component |
| QA-034 | P1 | Duplicate or unasked answers | POST duplicate question/answer pairs or answer an unrelated question. | 422; no provider call; blank answers ignored. | API |
| QA-035 | P1 | Update loading | Delay refinement response; attempt editing/export/generation/history restore. | Current draft stays visible; mutation controls disabled; update status shown; controls recover after completion. | Component |
| QA-036 | P0 | History compatibility | Restore a pre-feature ticket without provenance/detail metadata; restore an answer draft. | Legacy content readable, Standard default, unavailable provenance explained; typed answers retained; refined ticket occupies the same entry. | Component + browser |
| QA-037 | P0 | Investigation separation | Edit/remove suggestions; export all formats and JSON. | New test proposals are separate from steps/facts; text exports label them as proposed tests; JSON retains provenance. | API + component + utility |
| QA-038 | P1 | Manual source edit | Edit an inferred expected result, then clear it. | Manual content Provided; cleared value Missing; labels do not claim independent verification. | Component |
| QA-039 | P1 | Multiple refinement rounds | Answer build; update; answer rate; update; reload and restore. | Previous supplied build remains, rate is incorporated, known questions do not return, entry count unchanged. | API + manual/browser |

## Exploratory charters

- **Truthfulness:** incomplete, contradictory, multilingual, and multiple-defect notes. Separate observed facts from inferred expected behavior. Check that severity and urgency are never presented as verified facts.
- **Recovery:** disconnect backend, deny clipboard, fill storage, refresh after edits, restore a report, change template while an old report is visible. Confirm no accidental replacement of the draft.
- **Accessibility:** screen reader labels/live notifications; focus order; 200% zoom; both themes; reduced motion; touch targets and viewport overflow.
- **Privacy:** confirm browser-local storage and deletion behavior. In AI mode, verify network requests go only to the configured provider through the backend.

## Reporting a failure

Record test ID, commit, runtime/browser versions, mode, synthetic input, exact steps, expected/actual result, and evidence. Do not include API keys. Keep observed failures, unexecuted checks, and optional live-provider experiments separate in test reports.
