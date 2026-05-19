import { useState, useEffect } from 'react';
import { trackOnce } from '../../utils/track';

// Шаг 5 флагмана: тогл «До / После 01.07.2026» — показывает,
// какие теги обязательны в фискальном чеке для маркированного
// товара в зависимости от формата фискальных документов.

type Mode = 'before' | 'after';

const RECEIPTS = {
  before: {
    label: 'До 01.07.2026',
    ffd: 'ФФД 1.05 / 1.1',
    lines: [
      { tag: '1162', name: 'Код товара', value: '0146070345678901·21ABCDEF·93dGS1', highlight: true },
    ],
    note:
      'В старых форматах кода маркировки достаточно одного тега 1162 — просто строка с кодом. Обязательной онлайн-проверки через ТС ПИоТ нет, чек уходит в ОФД и в ФНС.',
  },
  after: {
    label: 'После 01.07.2026',
    ffd: 'ФФД 1.2',
    lines: [
      { tag: '1163', name: 'Код товара (структурированный)', value: 'GS1 DataMatrix · 0146070345678901·21ABCDEF·93dGS1', highlight: true },
      { tag: '2106', name: 'Результат проверки', value: 'Положительный (битовая маска)', highlight: true },
      { tag: '1265', name: 'ID запроса проверки', value: '638f669e-7e8e-4c1d-a4d2-…', highlight: true },
    ],
    note:
      'В ФФД 1.2 для маркированного товара обязательна связка из трёх тегов. 2106 — это битовая маска ответа «Честного знака» (статус кода, результат проверки криптохвоста). 1265 связывает чек с конкретным запросом из Шага 3.',
  },
} as const;

export default function FfdToggle() {
  const [mode, setMode] = useState<Mode>('after');

  useEffect(() => {
    trackOnce(`flagship-ts-piot-ffd-${mode}-viewed`);
    if (mode === 'before') trackOnce('flagship-ts-piot-ffd-toggle');
  }, [mode]);

  const r = RECEIPTS[mode];

  return (
    <div className="ffd-toggle">
      <div className="ffd-switch" role="tablist" aria-label="Формат фискальных документов по датам">
        {(Object.keys(RECEIPTS) as Mode[]).map(m => (
          <button
            key={m}
            type="button"
            role="tab"
            className={`ffd-btn ${mode === m ? 'active' : ''}`}
            onClick={() => setMode(m)}
            aria-selected={mode === m}
          >
            {RECEIPTS[m].label}
          </button>
        ))}
      </div>

      <div className="ffd-receipt" aria-live="polite">
        <div className="ffd-receipt-head">
          <span className="ffd-receipt-title">Фискальный чек</span>
          <span className="ffd-receipt-ffd">{r.ffd}</span>
        </div>
        <div className="ffd-receipt-body">
          {r.lines.map(line => (
            <div key={line.tag} className={`ffd-line ${line.highlight ? 'hl' : ''}`}>
              <span className="ffd-tag">[{line.tag}]</span>
              <span className="ffd-name">{line.name}</span>
              <span className="ffd-value">{line.value}</span>
            </div>
          ))}
        </div>
        <p className="ffd-note">{r.note}</p>
      </div>

      <style>{`
        .ffd-toggle {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
          background: var(--sand, #F4EBD9);
          border-radius: 12px;
        }
        .ffd-switch {
          display: inline-flex;
          align-self: flex-start;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 999px;
          padding: 4px;
        }
        .ffd-btn {
          padding: 0.5em 1.1em;
          background: transparent;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          font: inherit;
          font-size: 0.95rem;
          color: var(--dark, #1F1F1F);
          transition: background 0.15s ease, color 0.15s ease;
        }
        .ffd-btn:focus-visible {
          outline: 2px solid var(--pink, #FF4D8F);
          outline-offset: 2px;
        }
        .ffd-btn.active {
          background: var(--dark, #1F1F1F);
          color: #fff;
        }
        .ffd-receipt {
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          border: 1px dashed rgba(31, 31, 31, 0.15);
        }
        .ffd-receipt-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 0.75rem 1.25rem;
          background: var(--dark, #1F1F1F);
          color: #fff;
        }
        .ffd-receipt-title { font-weight: 600; }
        .ffd-receipt-ffd {
          font-family: ui-monospace, monospace;
          font-size: 0.85rem;
          opacity: 0.8;
        }
        .ffd-receipt-body {
          padding: 1rem 1.25rem;
          display: grid;
          gap: 0.6rem;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.9rem;
          color: var(--dark, #1F1F1F);
        }
        .ffd-line {
          display: grid;
          grid-template-columns: 4rem 1fr;
          gap: 0.5rem 1rem;
          padding: 0.5rem 0.75rem;
          border-radius: 4px;
        }
        .ffd-line.hl {
          background: rgba(255, 77, 143, 0.08);
          box-shadow: inset 3px 0 0 var(--pink, #FF4D8F);
        }
        .ffd-tag {
          font-weight: 700;
          color: var(--pink, #FF4D8F);
        }
        .ffd-line.hl .ffd-tag { color: var(--pink, #FF4D8F); }
        .ffd-name {
          color: #555;
          grid-column: 2;
        }
        .ffd-value {
          grid-column: 2;
          color: var(--dark, #1F1F1F);
          word-break: break-all;
        }
        .ffd-note {
          margin: 0;
          padding: 0.75rem 1.25rem 1rem;
          color: #555;
          font-size: 0.9rem;
          line-height: 1.5;
          border-top: 1px dashed rgba(31, 31, 31, 0.1);
        }
        @media (max-width: 640px) {
          .ffd-toggle { padding: 1rem; }
          .ffd-line { grid-template-columns: 3rem 1fr; font-size: 0.8rem; }
        }
      `}</style>
    </div>
  );
}
