import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { HISTORY_KEY } from '../lib/history';
import { item, report } from './fixtures';
import { emptyInput, reportSchema, type Report } from '../lib/schema';
import { normalizeDraft, refineReport } from '../lib/api';
import { formatReport } from '../lib/export';

const updatedReport: Report = {
  ...report,
  environment: 'Build: 0.8.24',
  missingInformation: [],
  clarifyingQuestions: [],
  provenance: { ...report.provenance, environment: 'provided' },
};
function mockApi() {
  const fetch = vi.fn(async (path: string) => ({
    ok: true,
    json: async () =>
      path.endsWith('/health')
        ? { mode: 'demo' }
        : { report: path.endsWith('/refine') ? updatedReport : report, mode: 'demo' },
  }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
beforeEach(() => {
  mockApi();
});
async function generate() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Load Example' }));
  await user.click(screen.getByRole('button', { name: 'Generate Bug Report' }));
  await screen.findByDisplayValue(report.summary);
  return user;
}

describe('report detail and evidence', () => {
  it('defaults to Standard and sends the selected detail level', async () => {
    const fetch = mockApi();
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByLabelText('Report detail')).toHaveValue('standard');
    await user.click(screen.getByRole('button', { name: 'Load Example' }));
    await user.selectOptions(screen.getByLabelText('Report detail'), 'detailed');
    await user.click(screen.getByRole('button', { name: 'Generate Bug Report' }));
    await screen.findByDisplayValue(report.summary);
    const call = fetch.mock.calls.find(([path]) => path === '/api/reports');
    const options = (call as unknown as [string, RequestInit])[1];
    expect(JSON.parse(String(options.body)).detailLevel).toBe('detailed');
  });
  it('renders provenance, legend and editable suggested investigation', async () => {
    const user = await generate();
    expect(screen.getAllByText('Provided').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inferred').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Missing').length).toBeGreaterThan(0);
    expect(screen.getByText(/what do these mean/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Suggested tests/)).toHaveValue(
      report.suggestedInvestigation.join('\n'),
    );
    expect(screen.getByText(/These are not observed facts/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Suggested tests/));
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)[0].report.suggestedInvestigation).toEqual(
      [''],
    );
  });
  it('manual edits change provenance and clearing a value marks it missing', async () => {
    const user = await generate();
    const field = screen.getByLabelText(/Expected Result/).closest('.field')!;
    expect(within(field as HTMLElement).getByText('Inferred')).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Expected Result/));
    expect(within(field as HTMLElement).getByText('Missing')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Expected Result/), 'Verified by tester.');
    expect(within(field as HTMLElement).getByText('Provided')).toBeInTheDocument();
  });
  it('rejects invalid provenance and suggested-investigation types', () => {
    expect(
      reportSchema.safeParse({
        ...report,
        provenance: { ...report.provenance, summary: 'guessed' },
      }).success,
    ).toBe(false);
    expect(reportSchema.safeParse({ ...report, suggestedInvestigation: 'Check' }).success).toBe(
      false,
    );
  });
});

describe('answer and update workflow', () => {
  it('sends original notes, current edits, questions and nonempty answers; replaces the same history entry', async () => {
    const fetch = mockApi();
    const user = await generate();
    await user.clear(screen.getByLabelText('Summary'));
    await user.type(screen.getByLabelText('Summary'), 'Manual title');
    // Form changes for a future generation must not replace this ticket's original input.
    await user.clear(screen.getByLabelText(/Describe the issue/));
    await user.type(
      screen.getByLabelText(/Describe the issue/),
      'Different notes for another report.',
    );
    await user.type(screen.getByLabelText('Which build was tested?'), 'Build 0.8.24');
    await user.click(screen.getByRole('button', { name: 'Update report' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Environment', { selector: 'textarea' })).toHaveValue(
        'Build: 0.8.24',
      ),
    );
    const call = fetch.mock.calls.find(([path]) => path === '/api/reports/refine');
    const body = JSON.parse(String((call as unknown as [string, RequestInit])[1].body));
    expect(body.originalInput.description).toBe(report.description);
    expect(body.report.summary).toBe('Manual title');
    expect(body.report.clarifyingQuestions).toEqual(['Which build was tested?']);
    expect(body.answers).toEqual([{ question: 'Which build was tested?', answer: 'Build 0.8.24' }]);
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY)!);
    expect(saved).toHaveLength(1);
    expect(saved[0].report.environment).toBe('Build: 0.8.24');
    expect(screen.queryByLabelText('Which build was tested?')).not.toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '60');
  });
  it('never submits empty or whitespace-only answers', async () => {
    const fetch = mockApi();
    const user = await generate();
    const button = screen.getByRole('button', { name: 'Update report' });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('Which build was tested?'), '   ');
    expect(button).toBeDisabled();
    expect(fetch.mock.calls.some(([path]) => path === '/api/reports/refine')).toBe(false);
  });
  it('ignores unanswered questions in the API payload', async () => {
    const fetch = mockApi();
    await refineReport({
      originalInput: emptyInput,
      report,
      answers: [
        { question: 'Which build was tested?', answer: '0.8.24' },
        { question: 'Another question?', answer: '  ' },
      ],
    });
    const call = fetch.mock.calls.find(([path]) => path.endsWith('/refine'));
    expect(
      JSON.parse(String((call as unknown as [string, RequestInit])[1].body)).answers,
    ).toHaveLength(1);
  });
  it('keeps the draft and answers after a safe provider error', async () => {
    const user = await generate();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ detail: 'Gemini is temporarily unavailable.' }),
      })),
    );
    await user.type(screen.getByLabelText('Which build was tested?'), 'Build 0.8.24');
    await user.click(screen.getByRole('button', { name: 'Update report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
    expect(screen.getByDisplayValue(report.summary)).toBeInTheDocument();
    expect(screen.getByLabelText('Which build was tested?')).toHaveValue('Build 0.8.24');
    expect(screen.getByRole('button', { name: 'Update report' })).toBeEnabled();
    expect(screen.getByLabelText('Environment', { selector: 'textarea' })).toHaveValue(
      'Not provided',
    );
  });
  it('handles invalid refinement response without losing the draft', async () => {
    const user = await generate();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ report: {}, mode: 'demo' }) })),
    );
    await user.type(screen.getByLabelText('Which build was tested?'), 'Build 0.8.24');
    await user.click(screen.getByRole('button', { name: 'Update report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid report');
    expect(screen.getByDisplayValue(report.summary)).toBeInTheDocument();
    expect(screen.getByLabelText('Which build was tested?')).toHaveValue('Build 0.8.24');
  });
  it('shows update loading while keeping the current draft visible and protected', async () => {
    const user = await generate();
    let resolve: (value: unknown) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      ),
    );
    await user.type(screen.getByLabelText('Which build was tested?'), 'Build 0.8.24');
    await user.click(screen.getByRole('button', { name: 'Update report' }));
    expect(screen.getByRole('button', { name: 'Updating report…' })).toBeDisabled();
    expect(screen.getByLabelText('Summary')).toHaveValue(report.summary);
    expect(screen.getByLabelText('Summary')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generate Bug Report' })).toBeDisabled();
    resolve({ ok: true, json: async () => ({ report: updatedReport, mode: 'demo' }) });
    await screen.findByDisplayValue('Build: 0.8.24');
    expect(screen.getByLabelText('Summary')).toBeEnabled();
  });
  it('persists answer drafts so restoring a report does not lose investigation work', async () => {
    const user = await generate();
    await user.type(screen.getByLabelText('Which build was tested?'), 'Build 0.8.24');
    expect(
      JSON.parse(localStorage.getItem(HISTORY_KEY)!)[0].followUpAnswers['Which build was tested?'],
    ).toBe('Build 0.8.24');
    await user.click(screen.getByRole('button', { name: /Recent Reports/ }));
    await user.click(screen.getByRole('button', { name: new RegExp(report.summary + '.*Demo') }));
    expect(screen.getByLabelText('Which build was tested?')).toHaveValue('Build 0.8.24');
  });
});

describe('compatibility and exports', () => {
  it('keeps legacy history readable without pretending to know provenance', async () => {
    const legacy = item();
    const {
      provenance: _provenance,
      suggestedInvestigation: _investigation,
      ...legacyReport
    } = legacy.report;
    void _provenance;
    void _investigation;
    const { detailLevel: _detail, ...legacyInput } = legacy.input;
    void _detail;
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ ...legacy, input: legacyInput, report: legacyReport }]),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Recent Reports/ }));
    await user.click(screen.getByRole('button', { name: new RegExp(report.summary + '.*Demo') }));
    expect(screen.getByDisplayValue(report.summary)).toBeInTheDocument();
    expect(screen.getByText(/older report has no recorded provenance/)).toBeInTheDocument();
    expect(screen.getByLabelText('Report detail')).toHaveValue('standard');
  });
  it('normalizes blank edited fields for refinement without mutating the visible draft', () => {
    const draft = { ...report, summary: '', stepsToReproduce: [' ', 'Open the map.', ''] };
    const normalized = normalizeDraft(draft);
    expect(normalized.summary).toBe('Unknown');
    expect(normalized.provenance.summary).toBe('missing');
    expect(normalized.stepsToReproduce).toEqual(['Open the map.']);
    expect(draft.summary).toBe('');
  });
  it('keeps investigation in its own export section and JSON includes provenance', () => {
    for (const format of ['jira', 'markdown', 'plain'] as const) {
      const output = formatReport(report, format);
      expect(output).toContain('Suggested Investigation · proposed tests, not observed facts');
      expect(output).toContain(report.suggestedInvestigation[0]);
      expect(output.split('Steps to Reproduce')[1].split('Actual Result')[0]).not.toContain(
        report.suggestedInvestigation[0],
      );
    }
    expect(JSON.parse(JSON.stringify(report)).provenance.expectedResult).toBe('inferred');
  });
  it('limits follow-up answer size in the UI', async () => {
    await generate();
    const answer = screen.getByLabelText('Which build was tested?');
    expect(answer).toHaveAttribute('maxLength', '2000');
    fireEvent.change(answer, { target: { value: '0.8.24' } });
    expect(screen.getByRole('button', { name: 'Update report' })).toBeEnabled();
  });
});
