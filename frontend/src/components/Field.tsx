import { useId, type ReactNode } from 'react';
import { ProvenanceBadge } from './Provenance';
import type { ProvenanceStatus } from '../lib/schema';
interface Props {
  label: string;
  children: (id: string) => ReactNode;
  hint?: string;
  className?: string;
  provenance?: ProvenanceStatus;
}
export default function Field({ label, children, hint, provenance, className = '' }: Props) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <div className="field-label">
        <label htmlFor={id}>
          {label}
          {hint && <span className="field-hint">{hint}</span>}
        </label>
        {provenance && <ProvenanceBadge status={provenance} />}
      </div>
      {children(id)}
    </div>
  );
}
