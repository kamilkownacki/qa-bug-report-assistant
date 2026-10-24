import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { HISTORY_KEY } from '../lib/history';
import { item, report } from './fixtures';

function mockApi(result: unknown = { report, mode: 'demo' }, status = 200) {
  const mock = vi.fn().mockImplementation((path: string) =>
    Promise.resolve({
      ok: path.endsWith('/health') || status === 200,
      json: async () => (path.endsWith('/health') ? { mode: 'demo', status: 'ok' } : result),
    }),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
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

describe('report workflow', () => {
  it('starts with an accessible empty state and validates short notes', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('A clearer report starts here.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Bug Report' })).toBeDisabled();
    await user.type(screen.getByLabelText(/Describe the issue/), 'Crash');
    expect(screen.getByRole('button', { name: 'Generate Bug Report' })).toBeDisabled();
    expect(screen.getByText(/at least 10 characters/)).toBeInTheDocument();
    expect(screen.getByText('5 / 5,000')).toBeInTheDocument();
  });
  it('generates a report, shows quality and saves history', async () => {
    await generate();
    expect(screen.getByText('Draft ready')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Report completeness' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.getByDisplayValue('Which build was tested?')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)).toHaveLength(1);
  });
  it('edits sections and persists independent severity and priority', async () => {
    const user = await generate();
    await user.selectOptions(screen.getByLabelText('Severity'), 'Critical');
    expect(screen.getByLabelText('Priority')).toHaveValue('Medium');
    await user.selectOptions(screen.getByLabelText('Priority'), 'High');
    const summary = screen.getByLabelText('Summary');
    await user.clear(summary);
    await user.type(summary, 'Reviewed title');
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY)!)[0];
    expect(saved.report.summary).toBe('Reviewed title');
    expect(saved.report.severity).toBe('Critical');
    expect(saved.report.priority).toBe('High');
  });
  it('copies edited Jira, Markdown and plain text with feedback', async () => {
    const user = await generate();
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(screen.getByRole('button', { name: 'Copy Jira Format' }));
    expect(clipboard).toHaveBeenLastCalledWith(expect.stringContaining('h2. Summary'));
    expect(screen.getByText('Copied to clipboard')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Copy format'), 'markdown');
    await user.click(screen.getByRole('button', { name: 'Copy Markdown' }));
    expect(clipboard).toHaveBeenLastCalledWith(expect.stringContaining('## Summary'));
    await user.selectOptions(screen.getByLabelText('Copy format'), 'plain');
    await user.click(screen.getByRole('button', { name: 'Copy Plain Text' }));
    expect(clipboard).toHaveBeenLastCalledWith(expect.stringMatching(/^Summary\n/));
  });
  it('reports clipboard denial without losing the ticket', async () => {
    const user = await generate();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Denied'));
    await user.click(screen.getByRole('button', { name: 'Copy Jira Format' }));
    expect(screen.getByText(/Clipboard unavailable/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(report.summary)).toBeInTheDocument();
  });
  it('restores, deletes and clears history with confirmation', async () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        item('1'),
        { ...item('2'), report: { ...report, summary: 'Second report' } },
      ]),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Recent Reports/ }));
    await user.click(screen.getByRole('button', { name: /Second report.*Demo/ }));
    expect(screen.getByDisplayValue('Second report')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Recent Reports/ }));
    await user.click(screen.getByRole('button', { name: 'Delete report: Second report' }));
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Delete all reports' }));
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)).toEqual([]);
    expect(screen.getByText('A fresh start.')).toBeInTheDocument();
  });
  it('loads templates, clears inputs and switches theme', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Crash Unexpected exits/ }));
    expect(screen.getByLabelText(/Describe the issue/)).toHaveValue(
      'Game crashes after loading a save created in the previous version.',
    );
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByLabelText(/Describe the issue/)).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
  it('handles invalid server JSON structure safely', async () => {
    mockApi({ report: { summary: 'Incomplete' }, mode: 'demo' });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Load Example' }));
    await user.click(screen.getByRole('button', { name: 'Generate Bug Report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid report');
    expect(screen.getByLabelText(/Describe the issue/)).toHaveValue(report.description);
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });
  it('keeps notes and restores button after API errors', async () => {
    mockApi({ detail: 'The AI provider is unavailable.' }, 502);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Load Example' }));
    await user.click(screen.getByRole('button', { name: 'Generate Bug Report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
    expect(screen.getByLabelText(/Describe the issue/)).toHaveValue(report.description);
    expect(screen.getByRole('button', { name: 'Generate Bug Report' })).toBeEnabled();
  });
  it('disables generation while a request is pending', async () => {
    let resolveReport: (value: unknown) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) =>
        path.endsWith('/health')
          ? Promise.resolve({ ok: true, json: async () => ({ mode: 'demo' }) })
          : new Promise((resolve) => {
              resolveReport = resolve;
            }),
      ),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Load Example' }));
    await user.click(screen.getByRole('button', { name: 'Generate Bug Report' }));
    expect(screen.getByRole('button', { name: 'Generating report…' })).toBeDisabled();
    expect(screen.getByText('Organizing your notes…')).toBeInTheDocument();
    resolveReport({ ok: true, json: async () => ({ report, mode: 'demo' }) });
    await screen.findByDisplayValue(report.summary);
  });
  it('retains at most ten reports after generation', async () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(Array.from({ length: 10 }, (_, n) => item(String(n)))),
    );
    await generate();
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY)!);
    expect(saved).toHaveLength(10);
    expect(saved.some((entry: { id: string }) => entry.id === '9')).toBe(false);
  });
  it('handles unavailable browser storage', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Full');
    });
    await generate();
    expect(screen.getByText(/Browser storage is unavailable or full/)).toBeInTheDocument();
  });
  it('updates quality when reproduction details are edited', async () => {
    const user = await generate();
    const ticket = screen.getByRole('region', { name: 'Your Jira ticket' });
    await user.selectOptions(within(ticket).getByLabelText('Reproduction Rate'), 'Always');
    await waitFor(() => expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '60'));
  });
  it('limits the description to 5000 characters', () => {
    render(<App />);
    const description = screen.getByLabelText(/Describe the issue/);
    expect(description).toHaveAttribute('maxLength', '5000');
    fireEvent.change(description, { target: { value: 'x'.repeat(5000) } });
    expect(screen.getByText('5,000 / 5,000')).toBeInTheDocument();
  });
});
