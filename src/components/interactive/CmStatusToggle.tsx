import { useState, useEffect } from 'react';
import { trackOnce } from '../../utils/track';

// Шаг 7 флагмана: статусы кода маркировки в ГИС МТ.
// Пять статусов в жизненном цикле + ветвь «Заблокирован» как
// исключительная. Кликаешь по статусу — видишь, в каком моменте
// он наступает.

type StatusId = 'emitted' | 'applied' | 'in_orb' | 'withdrawn' | 'blocked';

interface Status {
  id: StatusId;
  label: string;
  when: string;
  detail: string;
  branch?: boolean;
}

const STATUSES: Status[] = [
  {
    id: 'emitted',
    label: 'Эмитирован',
    when: 'ЦРПТ сгенерировал код по заявке',
    detail:
      'Код существует только в системе «Честный знак»: на товаре его ещё нет. Производитель оплатил эмиссию и получил список кодов для печати.',
  },
  {
    id: 'applied',
    label: 'Нанесён',
    when: 'Производитель подал отчёт о нанесении',
    detail:
      'Код напечатан на упаковке (этикетка, тиснение, прямая печать). До ввода в оборот товар ещё нельзя продавать.',
  },
  {
    id: 'in_orb',
    label: 'В обороте',
    when: 'После «Ввода в оборот»',
    detail:
      'Товар легально перемещается по цепочке: производитель → дистрибьютор → магазин. Продавать конечному покупателю можно только в этом статусе.',
  },
  {
    id: 'withdrawn',
    label: 'Выведен из оборота',
    when: 'После продажи через ККТ / списания / экспорта',
    detail:
      'Финальный статус для нормального жизненного цикла. Зафиксированы ИНН продавца, номер ККТ, номер фискального документа и его признак (ФПД), дата и время продажи.',
  },
  {
    id: 'blocked',
    label: 'Заблокирован',
    when: 'Внеплановая остановка',
    detail:
      'По решению Роспотребнадзора, Минпромторга или внутреннему решению ЦРПТ. Не результат продажи — это исключительная ветка. Из «Заблокирован» нельзя продать товар, но можно списать.',
    branch: true,
  },
];

export default function CmStatusToggle() {
  const [active, setActive] = useState<StatusId>('withdrawn');

  useEffect(() => {
    trackOnce(`flagship-ts-piot-status-${active}-explored`);
  }, [active]);

  const meta = STATUSES.find(s => s.id === active)!;

  return (
    <div className="cm-status">
      <div className="cm-flow" role="group" aria-label="Жизненный цикл кода маркировки">
        {STATUSES.filter(s => !s.branch).map((s, idx, arr) => (
          <div key={s.id} className="cm-flow-item">
            <button
              type="button"
              className={`cm-node ${active === s.id ? 'active' : ''} ${s.id === 'withdrawn' ? 'final' : ''}`}
              onClick={() => setActive(s.id)}
              aria-pressed={active === s.id}
            >
              {s.label}
            </button>
            {idx < arr.length - 1 && <span className="cm-arrow" aria-hidden="true">→</span>}
          </div>
        ))}
      </div>

      <div className="cm-branch">
        <span className="cm-branch-line" aria-hidden="true">↘</span>
        {STATUSES.filter(s => s.branch).map(s => (
          <button
            key={s.id}
            type="button"
            className={`cm-node branch ${active === s.id ? 'active' : ''}`}
            onClick={() => setActive(s.id)}
            aria-pressed={active === s.id}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="cm-info" aria-live="polite">
        <div className="cm-info-when">{meta.when}</div>
        <p className="cm-info-detail">{meta.detail}</p>

        {meta.id === 'withdrawn' && (
          <dl className="cm-info-card">
            <div><dt>ИНН продавца</dt><dd>7707083893</dd></div>
            <div><dt>Номер ККТ</dt><dd>0001234567000123</dd></div>
            <div><dt>Номер ФД</dt><dd>432156</dd></div>
            <div><dt>ФПД</dt><dd>2884945971</dd></div>
            <div><dt>Дата</dt><dd>2026-05-19, 12:34:17</dd></div>
          </dl>
        )}
      </div>

      <style>{`
        .cm-status {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
          background: var(--sand, #F4EBD9);
          border-radius: 12px;
        }
        .cm-flow {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
        }
        .cm-flow-item {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        .cm-arrow {
          color: var(--dark, #1F1F1F);
          opacity: 0.4;
          font-size: 1.1rem;
        }
        .cm-branch {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          margin-left: 2rem;
        }
        .cm-branch-line {
          color: var(--dark, #1F1F1F);
          opacity: 0.4;
          font-size: 1.2rem;
        }
        .cm-node {
          padding: 0.45em 0.9em;
          background: rgba(255, 255, 255, 0.6);
          border: 2px solid transparent;
          border-radius: 999px;
          cursor: pointer;
          font: inherit;
          font-size: 0.95rem;
          color: var(--dark, #1F1F1F);
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
        }
        .cm-node:hover,
        .cm-node:focus-visible {
          background: #fff;
          outline: none;
        }
        .cm-node.active {
          background: var(--pink, #FF4D8F);
          border-color: var(--dark, #1F1F1F);
          color: #fff;
          transform: translateY(-1px);
        }
        .cm-node.final.active {
          background: var(--pink, #FF4D8F);
        }
        .cm-node.branch {
          font-size: 0.85rem;
          opacity: 0.85;
        }
        .cm-info {
          padding: 1rem 1.25rem;
          background: #fff;
          border-radius: 8px;
          border-left: 4px solid var(--pink, #FF4D8F);
        }
        .cm-info-when {
          font-weight: 600;
          color: var(--dark, #1F1F1F);
          font-size: 0.9rem;
          margin-bottom: 0.4rem;
        }
        .cm-info-detail {
          margin: 0;
          line-height: 1.5;
          color: var(--dark, #1F1F1F);
        }
        .cm-info-card {
          margin: 1rem 0 0;
          padding: 0.75rem 1rem;
          background: var(--sand, #F4EBD9);
          border-radius: 6px;
          font-size: 0.9rem;
          display: grid;
          gap: 0.35rem;
        }
        .cm-info-card > div {
          display: grid;
          grid-template-columns: minmax(8rem, auto) 1fr;
          gap: 0.75rem;
        }
        .cm-info-card dt {
          color: #666;
        }
        .cm-info-card dd {
          margin: 0;
          color: var(--dark, #1F1F1F);
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        }
        @media (max-width: 640px) {
          .cm-status { padding: 1rem; }
          .cm-flow { gap: 0.35rem; }
          .cm-node { font-size: 0.85rem; padding: 0.4em 0.7em; }
          .cm-branch { margin-left: 0.5rem; }
          .cm-info-card > div { grid-template-columns: 1fr; gap: 0.1rem; }
        }
      `}</style>
    </div>
  );
}
