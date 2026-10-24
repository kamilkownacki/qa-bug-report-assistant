import { useState } from 'react';
import {
  Check,
  ChevronDown,
  Clipboard,
  Download,
  FileCheck2,
  FileText,
  Info,
  LoaderCircle,
  PencilLine,
} from 'lucide-react';
import Field from './Field';
import Quality from './Quality';
import ImproveReport from './ImproveReport';
import { ProvenanceLegend } from './Provenance';
import {
  priorities,
  rates,
  severities,
  type IssueInput,
  type Report,
  type Provenance,
} from '../lib/schema';
import { downloadReport, formatReport, type ExportFormat } from '../lib/export';
interface Props {
  report: Report | null;
  input: IssueInput;
  mode: 'demo' | 'ai' | null;
  loading: boolean;
  onEdit: (report: Report) => void;
  notify: (message: string) => void;
  refining: boolean;
  refineError: string;
  answers: Record<string, string>;
  onAnswer: (question: string, answer: string) => void;
  onRefine: () => void;
  provenanceUnavailable?: boolean;
}
export default function TicketEditor({
  report,
  input,
  mode,
  loading,
  onEdit,
  notify,
  refining,
  refineError,
  answers,
  onAnswer,
  onRefine,
  provenanceUnavailable,
}: Props) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('jira');
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const update = <K extends keyof Report>(key: K, value: Report[K]) => {
    if (!report) return;
    const provenance = { ...report.provenance };
    if (key in provenance) {
      const missing = Array.isArray(value)
        ? !value.some((line) => line.trim())
        : typeof value === 'string' &&
          (!value.trim() || ['unknown', 'not provided'].includes(value.trim().toLowerCase()));
      provenance[key as keyof Provenance] = missing ? 'missing' : 'provided';
    }
    onEdit({ ...report, [key]: value, provenance });
  };
  const source = (key: keyof Provenance) =>
    provenanceUnavailable ? undefined : report?.provenance[key];
  const textField = (
    key:
      'summary' | 'description' | 'actualResult' | 'expectedResult' | 'environment' | 'component',
    label: string,
    rows = 3,
  ) => (
    <Field label={label} key={key} provenance={source(key)}>
      {(id) => (
        <textarea
          id={id}
          rows={rows}
          value={String(report?.[key] ?? '')}
          maxLength={
            key === 'summary'
              ? 250
              : key === 'component'
                ? 150
                : key === 'environment'
                  ? 2000
                  : 10000
          }
          onChange={(event) => update(key, event.target.value)}
        />
      )}
    </Field>
  );
  const listField = (
    key:
      | 'preconditions'
      | 'stepsToReproduce'
      | 'labels'
      | 'additionalNotes'
      | 'missingInformation'
      | 'clarifyingQuestions'
      | 'suggestedInvestigation',
    label: string,
    rows = 3,
  ) => (
    <Field
      label={label}
      hint="One per line"
      key={key}
      provenance={key === 'preconditions' || key === 'stepsToReproduce' ? source(key) : undefined}
    >
      {(id) => (
        <textarea
          id={id}
          rows={rows}
          placeholder="Not provided"
          value={report?.[key].join('\n') ?? ''}
          onChange={(event) =>
            update(
              key,
              event.target.value
                .split('\n')
                .slice(0, key === 'clarifyingQuestions' ? 5 : 30)
                .map((line) => line.slice(0, 2000)),
            )
          }
        />
      )}
    </Field>
  );
  async function copy() {
    if (!report) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(formatReport(report, exportFormat));
      notify('Copied to clipboard');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Clipboard unavailable. Try Download JSON or allow clipboard access.');
    } finally {
      setCopying(false);
    }
  }
  return (
    <section
      className="panel ticket-panel"
      aria-labelledby="ticket-heading"
      aria-busy={loading || refining}
    >
      <div className="panel-heading">
        <div className="step-number">02</div>
        <div>
          <h2 id="ticket-heading">Your Jira ticket</h2>
          <p>Review, refine, and make it yours.</p>
        </div>
        <span className={`status-badge ${report ? 'ready' : ''}`}>
          <span />
          {loading
            ? 'Working'
            : refining
              ? 'Updating'
              : report
                ? 'Draft ready'
                : 'Awaiting details'}
        </span>
      </div>
      {loading ? (
        <div className="ticket-empty loading-state" role="status">
          <LoaderCircle className="spin" size={30} />
          <h3>Organizing your notes…</h3>
          <p>Keeping the facts. Finding the gaps.</p>
          <div className="skeleton-lines">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : !report ? (
        <div className="ticket-empty">
          <div className="empty-illustration">
            <span className="floating-check">
              <Check size={17} />
            </span>
            <FileText size={46} strokeWidth={1.3} />
            <span className="illustration-line" />
            <span className="illustration-line short" />
          </div>
          <span className="eyebrow">FROM NOTES TO ACTION</span>
          <h3>A clearer report starts here.</h3>
          <p>
            Describe what went wrong, add the context you have,
            <br className="desktop-break" /> and we'll help you turn it into a structured ticket.
          </p>
          <div className="empty-pills">
            <span>
              <Check size={12} /> Jira-ready structure
            </span>
            <span>
              <Check size={12} /> Fully editable
            </span>
          </div>
          <div className="empty-footnote">
            <Info size={13} /> Unknown details stay unknown.
          </div>
        </div>
      ) : (
        <fieldset className="ticket-content" disabled={refining}>
          <div className="draft-notice">
            <PencilLine size={14} />
            <span>
              Editable draft · {mode === 'demo' ? 'Demo response' : 'AI-assisted response'}
            </span>
            <span>Review before submitting</span>
          </div>
          <ProvenanceLegend unavailable={provenanceUnavailable} />
          <div className="editor-fields">
            {textField('summary', 'Summary', 2)}
            {textField('description', 'Description')}
            {listField('preconditions', 'Preconditions', 2)}
            {listField('stepsToReproduce', 'Steps to Reproduce', 4)}
            <div className="results-grid">
              {textField('actualResult', 'Actual Result')}
              {textField('expectedResult', 'Expected Result · inferred when obvious')}
            </div>
            <div className="form-grid">
              <Field label="Severity" provenance={source('severity')}>
                {(id) => (
                  <div className="select-with-info">
                    <select
                      id={id}
                      value={report.severity}
                      onChange={(event) =>
                        update('severity', event.target.value as Report['severity'])
                      }
                    >
                      {severities.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="tooltip-trigger"
                      aria-label="Severity = impact of the defect on the product."
                    >
                      <Info size={15} />
                      <span role="tooltip">Severity = impact of the defect on the product.</span>
                    </button>
                  </div>
                )}
              </Field>
              <Field label="Priority" provenance={source('priority')}>
                {(id) => (
                  <div className="select-with-info">
                    <select
                      id={id}
                      value={report.priority}
                      onChange={(event) =>
                        update('priority', event.target.value as Report['priority'])
                      }
                    >
                      {priorities.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="tooltip-trigger"
                      aria-label="Priority = urgency with which the defect should be addressed."
                    >
                      <Info size={15} />
                      <span role="tooltip">
                        Priority = urgency with which the defect should be addressed.
                      </span>
                    </button>
                  </div>
                )}
              </Field>
              <Field label="Reproduction Rate" provenance={source('reproductionRate')}>
                {(id) => (
                  <select
                    id={id}
                    value={report.reproductionRate}
                    onChange={(event) =>
                      update('reproductionRate', event.target.value as Report['reproductionRate'])
                    }
                  >
                    {rates.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Regression" provenance={source('regression')}>
                {(id) => (
                  <select
                    id={id}
                    value={report.regression}
                    onChange={(event) =>
                      update('regression', event.target.value as Report['regression'])
                    }
                  >
                    {['Unknown', 'Yes', 'No'].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <p className="suggestion-note">
              Severity and priority are suggestions. Confirm both with your team.
            </p>
            {textField('environment', 'Environment', 2)}
            {textField('component', 'Component / Area', 1)}
            {listField('labels', 'Suggested Labels', 2)}
            {listField('additionalNotes', 'Additional Notes', 3)}
          </div>
          <Quality report={report} input={input} />
          <div className="investigation-section">
            <div className="section-icon-title">
              <FileCheck2 size={17} />
              <h3>Before you submit</h3>
            </div>
            <p>Questions worth checking before submitting:</p>
            {listField('missingInformation', 'Missing Information', 4)}
            {listField('clarifyingQuestions', 'Clarifying Questions', 5)}
          </div>
          <div className="investigation-section suggested-section">
            <h3>Suggested Investigation</h3>
            <p>Proposed tests to run next. These are not observed facts or Steps to Reproduce.</p>
            {listField('suggestedInvestigation', 'Suggested tests', 6)}
          </div>
          <ImproveReport
            questions={report.clarifyingQuestions.filter((question) => question.trim())}
            answers={answers}
            onAnswer={onAnswer}
            onRefine={onRefine}
            loading={refining}
            error={refineError}
          />
          <div className="export-bar">
            <div className="export-copy">
              <button className="button primary" onClick={() => void copy()} disabled={copying}>
                {copied ? <Check size={15} /> : <Clipboard size={15} />}
                {exportFormat === 'jira'
                  ? 'Copy Jira Format'
                  : exportFormat === 'markdown'
                    ? 'Copy Markdown'
                    : 'Copy Plain Text'}
              </button>
              <div className="export-select">
                <select
                  aria-label="Copy format"
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                >
                  <option value="jira">Jira</option>
                  <option value="markdown">Markdown</option>
                  <option value="plain">Plain Text</option>
                </select>
                <ChevronDown size={12} />
              </div>
            </div>
            <button
              className="button subtle"
              onClick={() => {
                downloadReport(report);
                notify('JSON downloaded');
              }}
            >
              <Download size={15} /> Download JSON
            </button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
