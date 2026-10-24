import { describe, expect, it, vi } from 'vitest';
import { downloadReport, formatReport } from '../lib/export';
import { HISTORY_KEY, readHistory, upsertReport, writeHistory } from '../lib/history';
import { assessQuality } from '../lib/quality';
import { item, report } from './fixtures';

describe('local persistence', () => {
  it('handles corrupt JSON and malformed entries without crashing', () => {
    localStorage.setItem(HISTORY_KEY, '{broken');
    expect(readHistory().items).toEqual([]);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([{}, item()]));
    expect(readHistory().items).toHaveLength(1);
    expect(readHistory().warning).toBeDefined();
  });
  it('upserts by id and limits storage to ten entries', () => {
    const items = Array.from({ length: 12 }, (_, n) => item(String(n)));
    expect(upsertReport(items, item('new'))).toHaveLength(10);
    expect(
      upsertReport([item()], { ...item(), report: { ...report, summary: 'Edited' } }),
    ).toHaveLength(1);
    expect(writeHistory(items)).toBe(true);
    expect(readHistory().items).toHaveLength(10);
  });
});
describe('exports and quality', () => {
  it('includes all fields and ordered steps in each format', () => {
    for (const format of ['jira', 'markdown', 'plain'] as const) {
      const output = formatReport(report, format);
      expect(output).toContain('Missing Information');
      expect(output).toContain('Clarifying Questions');
      expect(output).toContain(report.summary);
    }
    expect(formatReport(report, 'jira')).toContain('# Enter a vehicle.');
    expect(formatReport(report, 'markdown')).toContain('1. Enter a vehicle.');
    expect(formatReport(report, 'plain')).not.toContain('h2.');
  });
  it('downloads parseable edited JSON and releases the object URL', async () => {
    const create = vi.fn().mockReturnValue('blob:report');
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadReport({ ...report, summary: 'Edited title' });
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:report');
    const blob = create.mock.calls[0][0] as Blob;
    const content = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    expect(JSON.parse(content).summary).toBe('Edited title');
  });
  it('does not count build-only metadata as environment details', () => {
    const source = item().input;
    const assessed = assessQuality(
      { ...report, environment: 'Build: 1.2' },
      { ...source, build: '1.2' },
    );
    expect(assessed.checks.find((check) => check.label === 'Environment provided')?.passed).toBe(
      false,
    );
  });
});
