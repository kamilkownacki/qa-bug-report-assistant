import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bug, Check, Clock3, Github, Moon, ShieldCheck, Sun, X } from 'lucide-react';
import IssueForm from './components/IssueForm';
import TicketEditor from './components/TicketEditor';
import Templates from './components/Templates';
import HistoryDialog from './components/HistoryDialog';
import { generateReport, refineReport } from './lib/api';
import { readHistory, upsertReport, writeHistory } from './lib/history';
import { emptyInput, type HistoryItem, type IssueInput, type Report } from './lib/schema';
import { mapExample, templates } from './lib/templates';
function initialTheme(): boolean {
  try {
    const saved = localStorage.getItem('qa-assistant.theme');
    return saved
      ? saved === 'dark'
      : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  } catch {
    return false;
  }
}
export default function App() {
  const [input, setInput] = useState<IssueInput>({ ...emptyInput });
  const [active, setActive] = useState<HistoryItem | null>(null);
  const [initialHistory] = useState(readHistory);
  const [history, setHistory] = useState(initialHistory.items);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dark, setDark] = useState(initialTheme);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState('');
  const busy = loading || refining;
  const [toast, setToast] = useState(initialHistory.warning || '');
  const [mode, setMode] = useState<'demo' | 'ai' | null>(null);
  const historyButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('qa-assistant.theme', dark ? 'dark' : 'light');
    } catch {
      /* Theme still works in memory. */
    }
  }, [dark]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => {
        if (
          value &&
          typeof value === 'object' &&
          'mode' in value &&
          (value.mode === 'demo' || value.mode === 'ai')
        )
          setMode(value.mode);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const persist = (items: HistoryItem[]) => {
    setHistory(items);
    const saved = writeHistory(items);
    if (!saved) setToast('Browser storage is unavailable or full. Export this report to keep it.');
    return saved;
  };
  async function generate() {
    if (busy) return;
    if (input.description.trim().length < 10) {
      setError('Please describe the issue in at least 10 characters.');
      return;
    }
    setLoading(true);
    setRefineError('');
    setError('');
    try {
      const result = await generateReport({ ...input, description: input.description.trim() });
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        input: { ...input },
        report: result.report,
        mode: result.mode,
      };
      setActive(item);
      setMode(result.mode);
      if (persist(upsertReport(history, item))) {
        setToast('Report generated. Review the draft before submitting.');
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }
  function edit(report: Report) {
    if (!active) return;
    const updated = { ...active, report };
    setActive(updated);
    persist(upsertReport(history, updated));
  }
  function answerQuestion(question: string, answer: string) {
    if (!active || busy) return;
    const updated = {
      ...active,
      followUpAnswers: { ...active.followUpAnswers, [question]: answer },
    };
    setActive(updated);
    persist(upsertReport(history, updated));
    setRefineError('');
  }
  async function refine() {
    if (!active || busy) return;
    const answers = active.report.clarifyingQuestions
      .map((question) => ({ question, answer: active.followUpAnswers?.[question]?.trim() || '' }))
      .filter((item) => item.answer);
    if (!answers.length) return;
    setRefining(true);
    setRefineError('');
    try {
      const result = await refineReport({
        originalInput: active.input,
        report: active.report,
        answers,
      });
      const updated = { ...active, report: result.report, mode: result.mode, followUpAnswers: {} };
      setActive(updated);
      setMode(result.mode);
      if (persist(upsertReport(history, updated)))
        setToast('Report updated. Review the new evidence before submitting.');
    } catch (failure) {
      setRefineError(
        failure instanceof Error
          ? failure.message
          : 'Could not update the report. Your draft and answers are safe.',
      );
    } finally {
      setRefining(false);
    }
  }
  function loadExample(index?: number) {
    const example = index === undefined ? null : templates[index];
    setInput({
      ...emptyInput,
      description: example?.description ?? mapExample,
      area: example?.area ?? 'Gameplay',
    });
    setError('');
    setToast('Example loaded. Add context or generate a report.');
  }
  function closeHistory() {
    setHistoryOpen(false);
    requestAnimationFrame(() => historyButton.current?.focus());
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#main" aria-label="QA Bug Report Assistant home">
            <span className="brand-icon">
              <Bug size={22} />
            </span>
            <span>
              QA<span className="brand-slash">/</span>
              <strong>Bug Report Assistant</strong>
            </span>
            <span className="version-tag">v1.0</span>
          </a>
          <div className="header-actions">
            <a
              href="https://github.com/kamilkownacki/qa-bug-report-assistant"
              target="_blank"
              rel="noreferrer"
              className="github-link"
            >
              <Github size={17} />
              <span>View on GitHub</span>
              <ArrowUpRight size={13} />
            </a>
            <span className="header-separator" />
            <button
              className="icon-button"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="main-container">
        <div className="page-intro">
          <div>
            <div className="eyebrow">
              <span className="tiny-line" /> YOUR QA WORKFLOW, A LITTLE CLEARER
            </div>
            <h1>
              Rough notes. <span>Clear reports.</span>
            </h1>
            <p>Turn what you found into a bug report your team can act on.</p>
          </div>
          <button
            ref={historyButton}
            className="button history-button"
            onClick={() => setHistoryOpen(true)}
            disabled={busy}
          >
            <Clock3 size={16} /> Recent Reports<span className="count-badge">{history.length}</span>
          </button>
        </div>
        <div className="workspace-banner">
          <div>
            <span className="mode-icon">
              <FlaskIcon />
            </span>
            <p>
              <strong>
                {mode === 'demo'
                  ? 'Demo mode is on'
                  : mode === 'ai'
                    ? 'AI mode is on'
                    : 'Connecting to backend'}
              </strong>
              <span>
                {mode === 'demo'
                  ? 'Explore the workflow with example responses. No API key needed.'
                  : mode === 'ai'
                    ? 'Structured AI assistance. Always review generated details.'
                    : 'Checking which generation mode is available.'}
              </span>
            </p>
          </div>
          <span className="privacy-note">
            <ShieldCheck size={15} />
            {mode === 'ai'
              ? 'Notes sent to configured AI provider'
              : 'History stays in your browser'}
          </span>
        </div>
        <div className="workspace-grid">
          <IssueForm
            input={input}
            onChange={setInput}
            onGenerate={() => void generate()}
            onClear={() => {
              setInput({ ...emptyInput });
              setError('');
            }}
            onExample={() => loadExample()}
            loading={loading}
            disabled={refining}
            error={error}
          />
          <TicketEditor
            report={active?.report ?? null}
            input={active?.input ?? input}
            mode={active?.mode ?? null}
            loading={loading}
            onEdit={edit}
            refining={refining}
            refineError={refineError}
            answers={active?.followUpAnswers ?? {}}
            onAnswer={answerQuestion}
            onRefine={() => void refine()}
            provenanceUnavailable={active?.provenanceUnavailable}
            notify={setToast}
          />
        </div>
        <Templates onLoad={loadExample} disabled={busy} />
        <div className="principles">
          <span>
            <ShieldCheck size={15} /> Facts first. Assumptions flagged.
          </span>
          <span>
            <Check size={15} /> Built for a human review.
          </span>
          <span>No account required.</span>
        </div>
      </main>
      <footer className="app-footer">
        <span>
          <Bug size={14} /> QA Bug Report Assistant
        </span>
        <span>
          Made with a QA mindset.<span className="footer-dot">·</span>Better questions. Better
          reports.
        </span>
      </footer>
      {historyOpen && (
        <HistoryDialog
          items={history}
          onClose={closeHistory}
          onRestore={(item) => {
            setActive(item);
            setInput(item.input);
            setRefineError('');
            setError('');
            closeHistory();
            setToast('Report restored. Edits are saved automatically.');
          }}
          onDelete={(id) => {
            persist(history.filter((item) => item.id !== id));
            if (active?.id === id) setActive(null);
          }}
          onClear={() => {
            const saved = persist([]);
            setActive(null);
            if (saved) setToast('Local history cleared');
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
function FlaskIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M9 3h6M10 3v6l-6 10a1.3 1.3 0 0 0 1.2 2h13.6a1.3 1.3 0 0 0 1.2-2L14 9V3M7 15h10" />
    </svg>
  );
}
