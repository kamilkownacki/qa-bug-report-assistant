import { LoaderCircle, Sparkles } from 'lucide-react';
import Field from './Field';
interface Props {
  questions: string[];
  answers: Record<string, string>;
  onAnswer: (question: string, answer: string) => void;
  onRefine: () => void;
  loading: boolean;
  error: string;
}
export default function ImproveReport({
  questions,
  answers,
  onAnswer,
  onRefine,
  loading,
  error,
}: Props) {
  const hasAnswer = questions.some((question) => answers[question]?.trim());
  return (
    <section className="improve-section" aria-labelledby="improve-heading" aria-busy={loading}>
      <h3 id="improve-heading">Improve this report</h3>
      <p>Investigate, answer what you know, then update the draft. Empty answers stay unknown.</p>
      {questions.length ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (hasAnswer && !loading) onRefine();
          }}
        >
          {questions.map((question) => (
            <Field key={question} label={question}>
              {(id) => (
                <textarea
                  id={id}
                  rows={2}
                  maxLength={2000}
                  value={answers[question] || ''}
                  onChange={(event) => onAnswer(question, event.target.value)}
                  placeholder="Add your observation or leave unanswered"
                  disabled={loading}
                />
              )}
            </Field>
          ))}
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <div className="refine-actions">
            <span>Updates this draft. Your other edits are preserved.</span>
            <button className="button primary" type="submit" disabled={!hasAnswer || loading}>
              {loading ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
              {loading ? 'Updating report…' : 'Update report'}
            </button>
          </div>
          {loading && (
            <p role="status">Incorporating your answers. Your current draft is still here.</p>
          )}
        </form>
      ) : (
        <p>No open questions. Review the report and suggested tests before submitting.</p>
      )}
    </section>
  );
}
