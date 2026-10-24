import type { Report } from './schema';
export const sections = [
  ['summary', 'Summary'],
  ['description', 'Description'],
  ['preconditions', 'Preconditions'],
  ['stepsToReproduce', 'Steps to Reproduce'],
  ['actualResult', 'Actual Result'],
  ['expectedResult', 'Expected Result'],
  ['reproductionRate', 'Reproduction Rate'],
  ['severity', 'Severity'],
  ['priority', 'Priority'],
  ['environment', 'Environment'],
  ['component', 'Component / Area'],
  ['regression', 'Regression'],
  ['labels', 'Suggested Labels'],
  ['additionalNotes', 'Additional Notes'],
  ['missingInformation', 'Missing Information'],
  ['clarifyingQuestions', 'Clarifying Questions'],
  ['suggestedInvestigation', 'Suggested Investigation · proposed tests, not observed facts'],
] as const satisfies readonly (readonly [keyof Report, string])[];
export type ExportFormat = 'jira' | 'markdown' | 'plain';
export function formatReport(report: Report, format: ExportFormat): string {
  return sections
    .map(([key, title]) => {
      const value = report[key];
      const heading =
        format === 'jira' ? `h2. ${title}` : format === 'markdown' ? `## ${title}` : title;
      const content = Array.isArray(value)
        ? value
            .filter((item) => item.trim())
            .map((item, index) => {
              const marker =
                key === 'stepsToReproduce' || key === 'clarifyingQuestions'
                  ? format === 'jira'
                    ? '#'
                    : `${index + 1}.`
                  : format === 'jira'
                    ? '*'
                    : '-';
              return `${marker} ${item}`;
            })
            .join('\n') || 'Not provided'
        : value || 'Not provided';
      return `${heading}\n${content}`;
    })
    .join('\n\n');
}
export function downloadReport(report: Report) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'qa-bug-report.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
