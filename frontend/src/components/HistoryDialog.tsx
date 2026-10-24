import { useEffect, useRef, useState } from 'react';
import { Clock3, Trash2, X } from 'lucide-react';
import type { HistoryItem } from '../lib/schema';
interface Props {
  items: HistoryItem[];
  onClose: () => void;
  onRestore: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}
export default function HistoryDialog({ items, onClose, onRestore, onDelete, onClear }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="history-dialog"
      aria-labelledby="history-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="history-heading">
        <div>
          <h2 id="history-title">
            <Clock3 size={20} /> Recent Reports
          </h2>
          <p>Stored only in this browser · {items.length} / 10</p>
        </div>
        <button className="icon-button" aria-label="Close recent reports" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {items.length === 0 ? (
        <div className="history-empty">
          <FilePlaceholder />
          <h3>A fresh start.</h3>
          <p>Your generated reports will appear here.</p>
        </div>
      ) : (
        <ul className="history-list">
          {items.map((item) => (
            <li key={item.id}>
              <button className="history-restore" onClick={() => onRestore(item)}>
                <strong>{item.report.summary || 'Untitled report'}</strong>
                <small>
                  {new Date(item.createdAt).toLocaleString()} ·{' '}
                  {item.mode === 'demo' ? 'Demo' : 'AI'} · {item.report.severity}
                </small>
              </button>
              <button
                className="icon-button danger"
                aria-label={`Delete report: ${item.report.summary}`}
                onClick={() => onDelete(item.id)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <div className="history-footer">
          {confirmClear ? (
            <>
              <span>Delete all local reports?</span>
              <button className="button subtle" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
              <button
                className="button danger"
                onClick={() => {
                  onClear();
                  setConfirmClear(false);
                }}
              >
                Delete all reports
              </button>
            </>
          ) : (
            <>
              <p>No account. No server-side history.</p>
              <button className="button subtle danger" onClick={() => setConfirmClear(true)}>
                <Trash2 size={14} /> Clear history
              </button>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
function FilePlaceholder() {
  return <Clock3 size={32} strokeWidth={1.2} />;
}
