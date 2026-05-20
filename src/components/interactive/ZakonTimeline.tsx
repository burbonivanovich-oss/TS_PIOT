import { useState, useMemo, useEffect } from 'react';
import { track } from '../../utils/track';

// Трекер изменений законодательства 2026 года. Принимает на вход
// массив норм, рендерит фильтр по месяцам (range slider 0..11) и
// карточки изменений, попадающих в окно фильтра.

export interface Norm {
  date: string;        // YYYY-MM-DD
  monthIdx: number;    // 0..11
  title: string;
  category: 'ts-piot' | 'markirovka' | 'nalogi' | 'kkt' | 'trud' | 'other';
  source: string;      // НПА с номером
  sourceUrl?: string;
  summary: string;
  articleUrl?: string;
}

interface Props {
  norms: Norm[];
}

const MONTHS = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
];

const CATEGORY_LABELS: Record<Norm['category'], string> = {
  'ts-piot': 'ТС ПИоТ',
  'markirovka': 'Маркировка',
  'nalogi': 'Налоги',
  'kkt': 'ККТ и ОФД',
  'trud': 'Трудовое',
  'other': 'Прочее',
};

let lastTrackTs = 0;

export default function ZakonTimeline({ norms }: Props) {
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(11);
  const [cat, setCat] = useState<Norm['category'] | 'all'>('all');

  // throttled track при изменении окна
  useEffect(() => {
    const now = Date.now();
    if (now - lastTrackTs < 500) return;
    lastTrackTs = now;
    track('zakon-2026-filter-used', { from, to, cat });
  }, [from, to, cat]);

  const visible = useMemo(() => {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    return norms
      .filter(n => n.monthIdx >= lo && n.monthIdx <= hi)
      .filter(n => cat === 'all' || n.category === cat)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [norms, from, to, cat]);

  const monthCount = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const n of norms) {
      if (cat !== 'all' && n.category !== cat) continue;
      counts[n.monthIdx] = (counts[n.monthIdx] || 0) + 1;
    }
    return counts;
  }, [norms, cat]);

  return (
    <div className="zt">
      <div className="zt-controls">
        <div className="zt-cats">
          <button
            type="button"
            className={`zt-cat ${cat === 'all' ? 'active' : ''}`}
            onClick={() => setCat('all')}
          >
            Все
          </button>
          {(Object.keys(CATEGORY_LABELS) as Norm['category'][]).map(c => (
            <button
              key={c}
              type="button"
              className={`zt-cat ${cat === c ? 'active' : ''}`}
              onClick={() => setCat(c)}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <div className="zt-range">
          <div className="zt-range-label">
            Окно: <strong>{MONTHS[Math.min(from, to)]} – {MONTHS[Math.max(from, to)]} 2026</strong>
            <span className="zt-range-count">· {visible.length} изм.</span>
          </div>
          <div className="zt-sliders">
            <input
              type="range"
              min={0}
              max={11}
              value={from}
              onChange={e => setFrom(parseInt(e.target.value, 10))}
              aria-label="С месяца"
            />
            <input
              type="range"
              min={0}
              max={11}
              value={to}
              onChange={e => setTo(parseInt(e.target.value, 10))}
              aria-label="По месяц"
            />
          </div>
          <div className="zt-ticks" aria-hidden="true">
            {MONTHS.map((m, i) => (
              <span
                key={m}
                className={`zt-tick ${(i >= Math.min(from, to) && i <= Math.max(from, to)) ? 'in' : 'out'}`}
              >
                <span className="zt-tick-name">{m}</span>
                {monthCount[i] ? <span className="zt-tick-dot">{monthCount[i]}</span> : null}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ol className="zt-list">
        {visible.length === 0 && (
          <li className="zt-empty">В этом окне ничего нет. Расширьте диапазон или смените категорию.</li>
        )}
        {visible.map(n => (
          <li key={n.date + n.title} className={`zt-item cat-${n.category}`}>
            <div className="zt-item-date">
              <time dateTime={n.date}>
                {n.date.split('-')[2]}.{n.date.split('-')[1]}.{n.date.split('-')[0].slice(2)}
              </time>
              <span className="zt-item-cat">{CATEGORY_LABELS[n.category]}</span>
            </div>
            <div className="zt-item-body">
              <h3 className="zt-item-title">{n.title}</h3>
              <p className="zt-item-summary">{n.summary}</p>
              <div className="zt-item-foot">
                {n.sourceUrl ? (
                  <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" className="zt-item-src">
                    {n.source} ↗
                  </a>
                ) : (
                  <span className="zt-item-src">{n.source}</span>
                )}
                {n.articleUrl && (
                  <a href={n.articleUrl} className="zt-item-art">Наш разбор →</a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <style>{`
        .zt {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .zt-controls {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.25rem;
          background: var(--sand, #F4EBD9);
          border-radius: 12px;
        }
        .zt-cats {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        .zt-cat {
          padding: 0.4em 0.85em;
          background: #fff;
          border: 2px solid transparent;
          border-radius: 999px;
          cursor: pointer;
          font: inherit;
          font-size: 0.85rem;
          color: var(--dark, #1F1F1F);
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .zt-cat:hover { background: #fff; }
        .zt-cat.active {
          background: var(--dark, #1F1F1F);
          color: #fff;
        }
        .zt-range { display: flex; flex-direction: column; gap: 0.6rem; }
        .zt-range-label {
          font-size: 0.95rem;
          color: var(--dark, #1F1F1F);
        }
        .zt-range-count {
          color: #666;
          font-size: 0.85rem;
          margin-left: 0.4rem;
        }
        .zt-sliders {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .zt-sliders input[type='range'] {
          width: 100%;
          accent-color: var(--pink, #FF4D8F);
        }
        .zt-ticks {
          display: flex;
          justify-content: space-between;
          gap: 0.15rem;
        }
        .zt-tick {
          flex: 1 1 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
          font-size: 0.7rem;
        }
        .zt-tick-name { color: #888; }
        .zt-tick.in .zt-tick-name { color: var(--dark, #1F1F1F); font-weight: 600; }
        .zt-tick-dot {
          display: inline-flex;
          min-width: 1.2em;
          height: 1.2em;
          padding: 0 0.3em;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(31, 31, 31, 0.15);
          color: var(--dark, #1F1F1F);
          font-size: 0.65rem;
          font-weight: 600;
        }
        .zt-tick.in .zt-tick-dot {
          background: var(--pink, #FF4D8F);
          color: #fff;
        }

        .zt-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }
        .zt-empty {
          padding: 1.5rem;
          text-align: center;
          color: #666;
          font-style: italic;
          background: #fff;
          border-radius: 10px;
          border: 1px dashed rgba(0, 0, 0, 0.1);
        }
        .zt-item {
          display: grid;
          grid-template-columns: 7.5rem 1fr;
          gap: 0.5rem 1.25rem;
          padding: 1rem 1.25rem;
          background: #fff;
          border-radius: 10px;
          border-left: 4px solid;
        }
        .zt-item.cat-ts-piot    { border-left-color: var(--pink, #FF4D8F); }
        .zt-item.cat-markirovka { border-left-color: #9E2B4F; }
        .zt-item.cat-nalogi     { border-left-color: #1E4A7A; }
        .zt-item.cat-kkt        { border-left-color: #5A3E7A; }
        .zt-item.cat-trud       { border-left-color: #1A5C3A; }
        .zt-item.cat-other      { border-left-color: #555; }

        .zt-item-date {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.35rem;
        }
        .zt-item-date time {
          font-family: ui-monospace, monospace;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--dark, #1F1F1F);
        }
        .zt-item-cat {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #666;
          padding: 0.1em 0.5em;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
        }
        .zt-item-body { min-width: 0; }
        .zt-item-title {
          font-size: 1rem;
          margin: 0 0 0.35rem;
          line-height: 1.3;
          color: var(--dark, #1F1F1F);
        }
        .zt-item-summary {
          margin: 0 0 0.5rem;
          line-height: 1.55;
          color: #333;
          font-size: 0.95rem;
        }
        .zt-item-foot {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem 1rem;
          font-size: 0.85rem;
        }
        .zt-item-src { color: #666; }
        .zt-item-art { color: var(--pink, #FF4D8F); font-weight: 600; }
        a.zt-item-src:hover, a.zt-item-art:hover { text-decoration: underline; }

        @media (max-width: 640px) {
          .zt-item {
            grid-template-columns: 1fr;
            gap: 0.5rem;
          }
          .zt-item-date {
            flex-direction: row;
            align-items: center;
          }
          .zt-tick-name { font-size: 0.65rem; }
        }
      `}</style>
    </div>
  );
}
