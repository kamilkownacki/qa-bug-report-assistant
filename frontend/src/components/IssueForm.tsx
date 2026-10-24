import { ArrowUpRight, Eraser, FlaskConical, LoaderCircle, Sparkles } from 'lucide-react';
import Field from './Field';
import { areas, platforms, rates, detailLevels, type IssueInput } from '../lib/schema';
interface Props {
  input: IssueInput;
  onChange: (input: IssueInput) => void;
  onGenerate: () => void;
  onClear: () => void;
  onExample: () => void;
  loading: boolean;
  disabled?: boolean;
  error: string;
}
export default function IssueForm({
  input,
  onChange,
  onGenerate,
  onClear,
  onExample,
  loading,
  disabled = false,
  error,
}: Props) {
  const update = <K extends keyof IssueInput>(key: K, value: IssueInput[K]) =>
    onChange({ ...input, [key]: value });
  const short = input.description.trim().length > 0 && input.description.trim().length < 10;
  return (
    <section className="panel input-panel" aria-labelledby="input-heading">
      <div className="panel-heading">
        <div className="step-number">01</div>
        <div>
          <h2 id="input-heading">Start with the details</h2>
          <p>A few notes are all you need.</p>
        </div>
        <button
          className="text-button example-button"
          onClick={onExample}
          disabled={loading || disabled}
        >
          <FlaskConical size={14} /> Load Example
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onGenerate();
        }}
      >
        <fieldset disabled={loading || disabled}>
          <Field label="Describe the issue" hint="Required">
            {(id) => (
              <textarea
                id={id}
                className="issue-description"
                placeholder="Example: After entering the vehicle and opening the map, the game occasionally freezes."
                value={input.description}
                onChange={(event) => update('description', event.target.value)}
                minLength={10}
                maxLength={5000}
                required
                aria-describedby="description-help"
              />
            )}
          </Field>
          <div id="description-help" className="input-meta">
            <span>
              {short
                ? 'Add a little more detail (at least 10 characters).'
                : 'What happened? What were you doing?'}
            </span>
            <span>{input.description.length.toLocaleString()} / 5,000</span>
          </div>
          <div className="divider-label">
            <span>Context</span>
            <span>Optional, but helpful</span>
          </div>
          <div className="form-grid">
            <Field label="Platform">
              {(id) => (
                <select
                  id={id}
                  value={input.platform}
                  onChange={(event) =>
                    update('platform', event.target.value as IssueInput['platform'])
                  }
                >
                  {platforms.map((value) => (
                    <option key={value} value={value}>
                      {value || 'Select platform'}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Build / Version">
              {(id) => (
                <input
                  id={id}
                  placeholder="e.g. 1.4.2 or build #1280"
                  maxLength={120}
                  value={input.build}
                  onChange={(event) => update('build', event.target.value)}
                />
              )}
            </Field>
            <Field label="Area">
              {(id) => (
                <select
                  id={id}
                  value={input.area}
                  onChange={(event) => update('area', event.target.value as IssueInput['area'])}
                >
                  {areas.map((value) => (
                    <option key={value} value={value}>
                      {value || 'Select area'}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Reproduction Rate">
              {(id) => (
                <select
                  id={id}
                  value={input.reproductionRate}
                  onChange={(event) =>
                    update('reproductionRate', event.target.value as IssueInput['reproductionRate'])
                  }
                >
                  {rates.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <Field label="Environment">
            {(id) => (
              <input
                id={id}
                placeholder="Hardware, OS, test environment…"
                maxLength={500}
                value={input.environment}
                onChange={(event) => update('environment', event.target.value)}
              />
            )}
          </Field>
          <Field label="Report detail">
            {(id) => (
              <select
                id={id}
                value={input.detailLevel}
                onChange={(event) =>
                  update('detailLevel', event.target.value as IssueInput['detailLevel'])
                }
                aria-describedby="detail-help"
              >
                {detailLevels.map((level) => (
                  <option key={level} value={level}>
                    {level[0].toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <p id="detail-help" className="detail-help">
            {input.detailLevel === 'compact'
              ? 'Short wording, all important facts.'
              : input.detailLevel === 'detailed'
                ? 'More context when available. Never more invented facts.'
                : 'Balanced detail and atomic steps for Jira.'}
          </p>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="button subtle" onClick={onClear}>
              <Eraser size={15} /> Clear
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={loading || disabled || input.description.trim().length < 10}
            >
              {loading ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
              {loading ? 'Generating report…' : 'Generate Bug Report'}
              {!loading && <ArrowUpRight size={16} />}
            </button>
          </div>
        </fieldset>
      </form>
      <div className="evidence-note">
        <div className="small-spark">✧</div>
        <p>
          <strong>Better reports start with facts.</strong>
          <br />
          Missing details become questions, never made-up answers.
        </p>
      </div>
    </section>
  );
}
