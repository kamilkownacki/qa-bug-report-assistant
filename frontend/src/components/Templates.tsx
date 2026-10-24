import {
  ArrowUpRight,
  AudioLines,
  ChartNoAxesCombined,
  LayoutPanelTop,
  Save,
  Zap,
} from 'lucide-react';
import { templates } from '../lib/templates';
const icons = [Zap, LayoutPanelTop, ChartNoAxesCombined, Save, AudioLines];
export default function Templates({
  onLoad,
  disabled,
}: {
  onLoad: (index: number) => void;
  disabled: boolean;
}) {
  return (
    <section className="templates" aria-labelledby="templates-title">
      <div className="section-caption">
        <h2 id="templates-title">A starting point, if you need one</h2>
        <span>5 example scenarios</span>
      </div>
      <div className="template-grid">
        {templates.map((template, index) => {
          const Icon = icons[index];
          return (
            <button
              key={template.name}
              className="template-card"
              onClick={() => onLoad(index)}
              disabled={disabled}
            >
              <span className={`template-icon color-${index}`}>
                <Icon size={17} />
              </span>
              <span>
                <strong>{template.name}</strong>
                <small>{template.hint}</small>
              </span>
              <ArrowUpRight size={14} className="template-arrow" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
