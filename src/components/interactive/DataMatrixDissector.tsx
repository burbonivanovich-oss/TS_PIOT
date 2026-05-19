import { useState, useEffect } from 'react';
import { trackOnce } from '../../utils/track';

type Part = 'gtin' | 'serial' | 'gs' | 'crypto' | null;

interface PartMeta {
  label: string;
  ai: string;
  value: string;
  color: string;
  text: string;
}

const PARTS: Record<Exclude<Part, null>, PartMeta> = {
  gtin: {
    label: 'GTIN',
    ai: '01',
    value: '46070345678901',
    color: 'var(--lime)',
    text:
      'GTIN — глобальный номер товара, 14 цифр. Говорит системе, что это за SKU: «зефир ванильный, 250 г, условный производитель». GTIN в примере условный — не сканировать.',
  },
  serial: {
    label: 'Серийный номер',
    ai: '21',
    value: 'ABCDEF',
    color: 'var(--pink)',
    text:
      'Серийник — 6 символов (цифры и латиница, регистр любой). Это идентификатор конкретно этой пачки, не SKU. Около миллиарда комбинаций на один GTIN: соседние упаковки на полке имеют разные серийники.',
  },
  gs: {
    label: 'GS-разделитель',
    ai: '⟨GS⟩',
    value: '',
    color: '#888',
    text:
      'Между группами кода стоит невидимый символ GS (ASCII 29). Поэтому код нельзя просто скопировать как обычный текст — потеряется структура. В начале строки тоже стоит служебный FNC1 (ASCII 232).',
  },
  crypto: {
    label: 'Криптохвост',
    ai: '93',
    value: 'dGS1',
    color: 'var(--pink)',
    text:
      'Подпись от «Честного знака», для пищёвки — ровно 4 символа фиксированной длины. Чтобы сгенерировать валидный криптохвост, нужен закрытый ключ ЦРПТ. Поэтому подделать код напечатанием своего — нельзя: касса проверит подпись.',
  },
};

export default function DataMatrixDissector() {
  const [active, setActive] = useState<Part>(null);

  useEffect(() => {
    if (active) trackOnce(`flagship-ts-piot-dm-${active}-explored`);
  }, [active]);

  const meta = active ? PARTS[active] : null;

  return (
    <div className="dm-dissector">
      <div className="dm-code" role="group" aria-label="Состав кода маркировки DataMatrix">
        <button
          type="button"
          className={`dm-part ${active === 'gtin' ? 'active' : ''}`}
          onMouseEnter={() => setActive('gtin')}
          onFocus={() => setActive('gtin')}
          onClick={() => setActive(active === 'gtin' ? null : 'gtin')}
          aria-pressed={active === 'gtin'}
        >
          <span className="dm-ai">01</span>
          <span className="dm-val">46070345678901</span>
        </button>
        <button
          type="button"
          className={`dm-part ${active === 'serial' ? 'active' : ''}`}
          onMouseEnter={() => setActive('serial')}
          onFocus={() => setActive('serial')}
          onClick={() => setActive(active === 'serial' ? null : 'serial')}
          aria-pressed={active === 'serial'}
        >
          <span className="dm-ai">21</span>
          <span className="dm-val">ABCDEF</span>
        </button>
        <button
          type="button"
          className={`dm-part dm-gs ${active === 'gs' ? 'active' : ''}`}
          onMouseEnter={() => setActive('gs')}
          onFocus={() => setActive('gs')}
          onClick={() => setActive(active === 'gs' ? null : 'gs')}
          aria-label="GS-разделитель"
          aria-pressed={active === 'gs'}
        >
          <span className="dm-val">⟨GS⟩</span>
        </button>
        <button
          type="button"
          className={`dm-part ${active === 'crypto' ? 'active' : ''}`}
          onMouseEnter={() => setActive('crypto')}
          onFocus={() => setActive('crypto')}
          onClick={() => setActive(active === 'crypto' ? null : 'crypto')}
          aria-pressed={active === 'crypto'}
        >
          <span className="dm-ai">93</span>
          <span className="dm-val">dGS1</span>
        </button>
      </div>

      <div className="dm-hint" aria-live="polite">
        {meta ? (
          <>
            <div className="dm-hint-head">
              <span className="dm-hint-ai" style={{ background: meta.color }}>
                {meta.ai}
              </span>
              <span className="dm-hint-label">{meta.label}</span>
            </div>
            <p className="dm-hint-text">{meta.text}</p>
          </>
        ) : (
          <p className="dm-hint-empty">
            Наведите курсор или нажмите на любую часть кода — увидите, из чего она состоит.
          </p>
        )}
      </div>

      <style>{`
        .dm-dissector {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
          background: var(--sand, #F4EBD9);
          border-radius: 12px;
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .dm-code {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
          align-items: stretch;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: clamp(0.875rem, 2.5vw, 1.125rem);
        }
        .dm-part {
          display: inline-flex;
          align-items: center;
          gap: 0.4em;
          padding: 0.55em 0.8em;
          background: rgba(255, 255, 255, 0.6);
          border: 2px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
          font: inherit;
          color: inherit;
        }
        .dm-part:hover,
        .dm-part:focus-visible {
          background: #fff;
          outline: none;
        }
        .dm-part.active {
          background: #fff;
          border-color: var(--dark, #1F1F1F);
          transform: translateY(-1px);
        }
        .dm-gs {
          background: transparent;
          opacity: 0.6;
          padding-left: 0.4em;
          padding-right: 0.4em;
        }
        .dm-gs.active { opacity: 1; }
        .dm-ai {
          font-weight: 700;
          background: var(--dark, #1F1F1F);
          color: #fff;
          padding: 0.1em 0.4em;
          border-radius: 3px;
          font-size: 0.85em;
        }
        .dm-val {
          color: var(--dark, #1F1F1F);
        }
        .dm-hint {
          min-height: 5.5rem;
          padding: 1rem 1.25rem;
          background: #fff;
          border-radius: 8px;
          border-left: 4px solid var(--pink, #FF4D8F);
        }
        .dm-hint-head {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 0.4rem;
        }
        .dm-hint-ai {
          display: inline-block;
          font-family: ui-monospace, monospace;
          font-weight: 700;
          padding: 0.1em 0.5em;
          border-radius: 4px;
          color: var(--dark, #1F1F1F);
          font-size: 0.85rem;
        }
        .dm-hint-label {
          font-weight: 600;
          color: var(--dark, #1F1F1F);
        }
        .dm-hint-text {
          margin: 0;
          line-height: 1.5;
          color: var(--dark, #1F1F1F);
        }
        .dm-hint-empty {
          margin: 0;
          color: #666;
          font-style: italic;
          line-height: 1.5;
        }
        @media (max-width: 640px) {
          .dm-dissector { padding: 1rem; }
          .dm-code { font-size: 0.9rem; }
          .dm-part { padding: 0.45em 0.6em; }
        }
      `}</style>
    </div>
  );
}
