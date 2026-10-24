import type { ProvenanceStatus } from '../lib/schema';
const explanations: Record<ProvenanceStatus, string> = {
  provided:
    'Directly supported by tester notes, metadata, answers, or a manual edit. Translation and rewording are still Provided.',
  inferred:
    'An expectation, category, or assessment inferred from the observations. Verify it before submitting.',
  missing: 'This information has not been supplied. Unknown does not mean No.',
};
export function ProvenanceBadge({ status }: { status: ProvenanceStatus }) {
  return (
    <span className={`provenance-badge provenance-${status}`} title={explanations[status]}>
      {status[0].toUpperCase() + status.slice(1)}
    </span>
  );
}
export function ProvenanceLegend({ unavailable }: { unavailable?: boolean }) {
  if (unavailable)
    return (
      <p className="provenance-legend">
        This older report has no recorded provenance. Badges are hidden; review its sources before
        submitting.
      </p>
    );
  return (
    <details className="provenance-legend">
      <summary>Provided · Inferred · Missing — what do these mean?</summary>
      <dl>
        {(Object.keys(explanations) as ProvenanceStatus[]).map((status) => (
          <div key={status}>
            <dt>
              <ProvenanceBadge status={status} />
            </dt>
            <dd>{explanations[status]}</dd>
          </div>
        ))}
      </dl>
      <p>
        These labels describe sources, not a guarantee of accuracy. The tester reviews and submits.
      </p>
    </details>
  );
}
