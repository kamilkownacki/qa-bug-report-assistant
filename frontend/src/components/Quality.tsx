import { Check, CircleHelp, X } from 'lucide-react';
import { assessQuality } from '../lib/quality';
import type { IssueInput, Report } from '../lib/schema';
export default function Quality({ report, input }: { report: Report; input: IssueInput }) {
  const { checks, score } = assessQuality(report, input);
  return (
    <section className="quality-section" aria-labelledby="quality-heading">
      <div className="quality-top">
        <div>
          <h3 id="quality-heading">Report Quality</h3>
          <p>Small details make a stronger report.</p>
        </div>
        <strong>
          {score}
          <span>%</span>
        </strong>
      </div>
      <div
        className="quality-track"
        role="meter"
        aria-label="Report completeness"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: `${score}%` }} />
      </div>
      <ul className="quality-checks">
        {checks.map((check) => (
          <li key={check.label} className={check.passed ? 'passed' : 'missing'}>
            {check.passed ? <Check size={14} /> : <X size={14} />}
            {check.label}
          </li>
        ))}
      </ul>
      <p className="quality-disclaimer">
        <CircleHelp size={13} /> Completeness heuristic:{' '}
        {checks.filter((check) => check.passed).length} of {checks.length} checks. Review accuracy
        yourself.
      </p>
    </section>
  );
}
