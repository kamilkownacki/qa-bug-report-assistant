import {
  refinementSchema,
  responseSchema,
  type IssueInput,
  type RefinementInput,
  type Report,
  provenanceKeys,
} from './schema';
async function requestReport(endpoint: string, payload: IssueInput | RefinementInput) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 125000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null;
      throw new Error(
        typeof detail === 'string'
          ? detail
          : endpoint.endsWith('/refine')
            ? 'Could not update the report. Check your answers and try again.'
            : 'Could not generate the report. Check your notes and try again.',
      );
    }
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success)
      throw new Error('The server returned an invalid report. Please try again.');
    return parsed.data;
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error('The server returned an invalid report. Please try again.');
    if (error instanceof TypeError)
      throw new Error('Cannot reach the server. Check that the backend is running.');
    if (error instanceof DOMException && error.name === 'AbortError')
      throw new Error('The request timed out. Your notes are safe; please try again.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function generateReport(input: IssueInput) {
  return requestReport('/api/reports', input);
}
export function normalizeDraft(report: Report): Report {
  const normalized = structuredClone(report);
  for (const key of Object.keys(normalized) as (keyof Report)[]) {
    const value = normalized[key];
    if (Array.isArray(value))
      Object.assign(normalized, { [key]: value.map((item) => item.trim()).filter(Boolean) });
    else if (typeof value === 'string' && !value.trim())
      Object.assign(normalized, { [key]: 'Unknown' });
  }
  for (const key of provenanceKeys) {
    const value = normalized[key];
    const missing = Array.isArray(value)
      ? value.length === 0
      : ['unknown', 'not provided'].includes(value.trim().toLowerCase());
    if (missing) normalized.provenance[key] = 'missing';
    else if (normalized.provenance[key] === 'missing') normalized.provenance[key] = 'provided';
  }
  return normalized;
}
export function refineReport(input: RefinementInput) {
  const payload = refinementSchema.parse({
    ...input,
    report: normalizeDraft(input.report),
    answers: input.answers.filter((item) => item.answer.trim()),
  });
  return requestReport('/api/reports/refine', payload);
}
