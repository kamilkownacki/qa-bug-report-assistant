import type { IssueInput, Report } from './schema';
const known = (value: string) =>
  !!value.trim() && !['unknown', 'not provided'].includes(value.trim().toLowerCase());
export function assessQuality(report: Report, input: IssueInput) {
  const checks = [
    {
      label: 'Clear issue description',
      passed: known(report.description) && report.description.length >= 20,
    },
    { label: 'Actual result identified', passed: known(report.actualResult) },
    { label: 'Expected result available · verify inference', passed: known(report.expectedResult) },
    { label: 'Reproduction steps available', passed: report.stepsToReproduce.length > 0 },
    {
      label: 'Build version provided',
      passed: known(input.build) || /^Build: .+/m.test(report.environment),
    },
    { label: 'Reproduction rate provided', passed: report.reproductionRate !== 'Unknown' },
    {
      label: 'Platform provided',
      passed: known(input.platform) || /^Platform: .+/m.test(report.environment),
    },
    {
      label: 'Environment provided',
      passed:
        known(report.environment) &&
        (known(input.environment) ||
          report.environment
            .split('\n')
            .some((line) => known(line) && !/^(Build|Platform):/i.test(line))),
    },
    { label: 'Component identified', passed: known(report.component) },
    { label: 'Regression investigated', passed: report.regression !== 'Unknown' },
  ];
  return {
    checks,
    score: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100),
  };
}
