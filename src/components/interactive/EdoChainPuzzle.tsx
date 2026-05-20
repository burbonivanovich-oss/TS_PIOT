import { useState, useEffect, useMemo } from 'react';
import { trackOnce, track } from '../../utils/track';

// Drag-and-drop пазл: правильно расположить шаги цепочки ЭДО при
// маркировке. HTML5 drag API + кнопки ↑↓ для accessibility и
// мобильных устройств (drag на touch плохо работает).

interface Step {
  id: string;
  shortLabel: string;
  actor: 'crpt' | 'manufacturer' | 'supplier' | 'shop';
  doc: string;
  detail: string;
}

const STEPS_CORRECT: Step[] = [
  {
    id: 'emit',
    shortLabel: 'Эмиссия кодов',
    actor: 'crpt',
    doc: 'ЦРПТ выдаёт коды маркировки',
    detail: 'Производитель оплачивает эмиссию в системе «Честный знак» и получает уникальные коды DataMatrix на каждую единицу товара.',
  },
  {
    id: 'apply',
    shortLabel: 'Нанесение и отчёт',
    actor: 'manufacturer',
    doc: 'Отчёт о нанесении в ЧЗ',
    detail: 'Производитель печатает коды на упаковке и подаёт отчёт о нанесении. Статус кодов меняется с «Эмитирован» на «Нанесён».',
  },
  {
    id: 'introduce',
    shortLabel: 'Ввод в оборот',
    actor: 'manufacturer',
    doc: 'Уведомление о вводе в оборот',
    detail: 'Производитель подаёт уведомление в ЧЗ — товар легально доступен для продажи. Статус кодов меняется на «В обороте».',
  },
  {
    id: 'upd-to-supplier',
    shortLabel: 'УПД производитель → дистрибьютор',
    actor: 'manufacturer',
    doc: 'УПД с кодами через ЭДО',
    detail: 'Электронный УПД с перечнем кодов маркировки отправляется через оператора ЭДО. Дистрибьютор подписывает УПД и принимает товар.',
  },
  {
    id: 'upd-to-shop',
    shortLabel: 'УПД дистрибьютор → магазин',
    actor: 'supplier',
    doc: 'УПД с кодами через ЭДО',
    detail: 'Дистрибьютор отгружает партию в магазин с электронным УПД. Магазин подписывает УПД — права на коды переходят к магазину.',
  },
  {
    id: 'check-on-kkt',
    shortLabel: 'Проверка кода на кассе',
    actor: 'shop',
    doc: 'Запрос ТС ПИоТ → ЧЗ',
    detail: 'При продаже касса через ТС ПИоТ отправляет код в «Честный знак» и получает разрешение или блокировку.',
  },
  {
    id: 'withdraw',
    shortLabel: 'Вывод из оборота',
    actor: 'shop',
    doc: 'Чек ФФД 1.2 → ОФД → ЧЗ',
    detail: 'Касса формирует чек с тегами 1163 + 2106, ОФД передаёт его в «Честный знак». Статус кода меняется на «Выведен из оборота».',
  },
];

const ACTOR_LABELS: Record<Step['actor'], string> = {
  crpt: 'ЦРПТ',
  manufacturer: 'Производитель',
  supplier: 'Дистрибьютор',
  shop: 'Магазин',
};

function shuffle<T>(arr: T[]): T[] {
  // Fisher–Yates. Для 7 элементов вероятность исходного порядка
  // 1/5040 — приемлемо, не дёргаемся проверкой.
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function EdoChainPuzzle() {
  const [order, setOrder] = useState<Step[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setOrder(shuffle(STEPS_CORRECT));
    trackOnce('edo-puzzle-started');
  }, []);

  const correctness = useMemo(
    () => order.map((s, i) => s.id === STEPS_CORRECT[i]?.id),
    [order],
  );
  const allCorrect = correctness.length === STEPS_CORRECT.length && correctness.every(Boolean);
  const correctCount = correctness.filter(Boolean).length;

  function moveStep(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setOrder(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setChecked(false);
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    moveStep(idx, idx - 1);
    track('edo-puzzle-step-moved', { dir: 'up' });
  }
  function moveDown(idx: number) {
    if (idx === order.length - 1) return;
    moveStep(idx, idx + 1);
    track('edo-puzzle-step-moved', { dir: 'down' });
  }

  function check() {
    setChecked(true);
    if (allCorrect) {
      trackOnce('edo-puzzle-solved');
    } else {
      track('edo-puzzle-check-failed', { correct: correctCount, total: STEPS_CORRECT.length });
    }
  }

  function reset() {
    setOrder(shuffle(STEPS_CORRECT));
    setChecked(false);
    track('edo-puzzle-reset');
  }

  return (
    <div className="edo">
      <div className="edo-instructions">
        <p>
          Перетащите шаги (или используйте кнопки ↑↓) так, чтобы получилась
          правильная последовательность движения товара от эмиссии кодов до
          продажи через кассу.
        </p>
      </div>

      <ol className="edo-list">
        {order.map((step, idx) => {
          const correct = checked && correctness[idx];
          const incorrect = checked && !correctness[idx];
          return (
            <li
              key={step.id}
              className={`edo-card actor-${step.actor} ${correct ? 'ok' : ''} ${incorrect ? 'err' : ''} ${draggingIdx === idx ? 'dragging' : ''} ${overIdx === idx ? 'over' : ''}`}
              draggable
              onDragStart={(e) => {
                setDraggingIdx(idx);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDraggingIdx(null);
                setOverIdx(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overIdx !== idx) setOverIdx(idx);
              }}
              onDragLeave={() => {
                if (overIdx === idx) setOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingIdx !== null && draggingIdx !== idx) {
                  moveStep(draggingIdx, idx);
                  track('edo-puzzle-step-moved', { dir: 'drop' });
                }
                setDraggingIdx(null);
                setOverIdx(null);
              }}
            >
              <div className="edo-card-pos">{idx + 1}</div>
              <div className="edo-card-body">
                <div className="edo-card-head">
                  <span className="edo-card-actor">{ACTOR_LABELS[step.actor]}</span>
                  <span className="edo-card-title">{step.shortLabel}</span>
                </div>
                <div className="edo-card-doc">{step.doc}</div>
                {(checked && incorrect) && (
                  <div className="edo-card-hint">
                    Должно быть на позиции {STEPS_CORRECT.findIndex(s => s.id === step.id) + 1}
                  </div>
                )}
              </div>
              <div className="edo-card-controls">
                <button
                  type="button"
                  className="edo-mv"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  aria-label={`Переместить «${step.shortLabel}» вверх`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="edo-mv"
                  onClick={() => moveDown(idx)}
                  disabled={idx === order.length - 1}
                  aria-label={`Переместить «${step.shortLabel}» вниз`}
                >
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="edo-actions">
        <button type="button" className="edo-check" onClick={check}>
          {checked ? 'Проверить ещё раз' : 'Проверить'}
        </button>
        <button type="button" className="edo-reset" onClick={reset}>
          Перемешать
        </button>
        {checked && (
          <span className={`edo-score ${allCorrect ? 'all' : ''}`}>
            {allCorrect
              ? `Всё на местах · ${correctCount}/${STEPS_CORRECT.length}`
              : `На своих местах ${correctCount} из ${STEPS_CORRECT.length}`}
          </span>
        )}
      </div>

      {checked && allCorrect && (
        <div className="edo-solution">
          <h4>Что мы только что разобрали</h4>
          <ol>
            {STEPS_CORRECT.map(s => (
              <li key={s.id}>
                <strong>{s.shortLabel}.</strong> {s.detail}
              </li>
            ))}
          </ol>
        </div>
      )}

      <style>{`
        .edo {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
          background: var(--sand, #F4EBD9);
          border-radius: 12px;
        }
        .edo-instructions p {
          margin: 0;
          color: #333;
          line-height: 1.55;
        }
        .edo-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .edo-card {
          display: grid;
          grid-template-columns: 2.2rem 1fr auto;
          gap: 0.85rem;
          align-items: center;
          padding: 0.85rem 1rem;
          background: #fff;
          border: 2px solid transparent;
          border-radius: 10px;
          cursor: grab;
          user-select: none;
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
        }
        .edo-card.dragging {
          opacity: 0.4;
          cursor: grabbing;
        }
        .edo-card.over {
          border-color: var(--pink, #FF4D8F);
          transform: translateY(-1px);
        }
        .edo-card.ok {
          border-color: var(--lime, #C8FF6B);
          background: rgba(200, 255, 107, 0.12);
        }
        .edo-card.err {
          border-color: var(--pink, #FF4D8F);
          background: rgba(255, 77, 143, 0.06);
        }
        .edo-card-pos {
          font-family: ui-monospace, monospace;
          font-weight: 700;
          font-size: 1.05rem;
          color: var(--dark, #1F1F1F);
          text-align: center;
          background: var(--sand, #F4EBD9);
          width: 2.2rem;
          height: 2.2rem;
          line-height: 2.2rem;
          border-radius: 50%;
        }
        .edo-card.ok .edo-card-pos { background: var(--lime, #C8FF6B); }
        .edo-card.err .edo-card-pos { background: var(--pink, #FF4D8F); color: #fff; }
        .edo-card-body { min-width: 0; }
        .edo-card-head {
          display: flex;
          gap: 0.5rem;
          align-items: baseline;
          flex-wrap: wrap;
          margin-bottom: 0.2rem;
        }
        .edo-card-actor {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.1em 0.55em;
          background: rgba(0, 0, 0, 0.06);
          color: #333;
          border-radius: 999px;
        }
        .edo-card.actor-crpt          .edo-card-actor { background: var(--dark, #1F1F1F); color: #fff; }
        .edo-card.actor-manufacturer  .edo-card-actor { background: rgba(255, 77, 143, 0.12); color: #9E2B4F; }
        .edo-card.actor-supplier      .edo-card-actor { background: rgba(30, 74, 122, 0.12); color: #1E4A7A; }
        .edo-card.actor-shop          .edo-card-actor { background: rgba(26, 92, 58, 0.12); color: #1A5C3A; }
        .edo-card-title {
          font-weight: 600;
          color: var(--dark, #1F1F1F);
        }
        .edo-card-doc {
          font-size: 0.85rem;
          color: #666;
        }
        .edo-card-hint {
          margin-top: 0.35rem;
          font-size: 0.8rem;
          color: var(--pink, #FF4D8F);
        }
        .edo-card-controls {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .edo-mv {
          width: 1.85rem;
          height: 1.85rem;
          background: transparent;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 6px;
          cursor: pointer;
          color: var(--dark, #1F1F1F);
          font-size: 0.95rem;
          padding: 0;
        }
        .edo-mv:hover:not(:disabled) {
          background: var(--sand, #F4EBD9);
        }
        .edo-mv:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .edo-actions {
          display: flex;
          gap: 0.6rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .edo-check {
          padding: 0.6em 1.4em;
          background: var(--dark, #1F1F1F);
          color: #fff;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          font: inherit;
          font-weight: 600;
        }
        .edo-reset {
          padding: 0.55em 1.2em;
          background: transparent;
          color: var(--dark, #1F1F1F);
          border: 1px solid rgba(0, 0, 0, 0.2);
          border-radius: 999px;
          cursor: pointer;
          font: inherit;
          font-size: 0.9rem;
        }
        .edo-score {
          font-size: 0.95rem;
          color: var(--dark, #1F1F1F);
        }
        .edo-score.all {
          color: #1A5C3A;
          font-weight: 600;
        }

        .edo-solution {
          margin-top: 0.5rem;
          padding: 1.25rem 1.5rem;
          background: rgba(200, 255, 107, 0.18);
          border-radius: 10px;
          border-left: 4px solid var(--lime, #C8FF6B);
        }
        .edo-solution h4 {
          margin: 0 0 0.75rem;
          font-size: 1.05rem;
          color: var(--dark, #1F1F1F);
        }
        .edo-solution ol {
          margin: 0;
          padding-left: 1.25rem;
          line-height: 1.65;
          color: var(--dark, #1F1F1F);
        }
        .edo-solution li { margin-bottom: 0.45rem; font-size: 0.95rem; }
        .edo-solution li strong { color: var(--pink, #FF4D8F); }

        @media (max-width: 640px) {
          .edo { padding: 1rem; }
          .edo-card { grid-template-columns: 2rem 1fr auto; gap: 0.6rem; padding: 0.7rem 0.85rem; }
          .edo-card-pos { width: 2rem; height: 2rem; line-height: 2rem; font-size: 0.95rem; }
          .edo-card-title { font-size: 0.95rem; }
        }
      `}</style>
    </div>
  );
}
