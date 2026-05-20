import { useState, useEffect } from 'react';
import { trackOnce, track } from '../../utils/track';

// Шаг 4 флагмана: три варианта ответа от «Честного знака».
// Читатель кликает любой → раскрывается ветка сценария с
// объяснением, что будет дальше. Из «не-валидных» можно
// вернуться к основному пути.

type Branch = 'valid' | 'withdrawn' | 'missing';

interface BranchMeta {
  id: Branch;
  icon: string;
  label: string;
  tone: 'lime' | 'pink' | 'dark';
  short: string;
  cassaAction: string;
  detail: string;
  note?: string;
}

const BRANCHES: BranchMeta[] = [
  {
    id: 'valid',
    icon: '✓',
    label: 'Код валиден',
    tone: 'lime',
    short: 'Нормальный путь',
    cassaAction: 'Касса формирует фискальный чек с тегом 1163',
    detail:
      'Код в системе «Честного знака», подпись прошла проверку. Касса добавляет в чек структурированный реквизит «Код товара» (тег 1163) и результат проверки (тег 2106). Дальше — продажа, выдача чека, передача через ОФД.',
  },
  {
    id: 'withdrawn',
    icon: '⚠',
    label: 'Выведен из оборота',
    tone: 'pink',
    short: 'Этой пачкой уже расплачивались',
    cassaAction: 'Продажа блокируется',
    detail:
      'По данным ЦРПТ, до 70% таких случаев — операционные ошибки, не подделки. Чаще всего: повторное сканирование при сбое чека (касса не отметила, что код уже списан), неправильно оформленный возврат, расхождения при приёмке от поставщика.',
    note:
      'Касса не выписывает штраф онлайн — это делает Роспотребнадзор или Минпромторг по результатам проверки. Кассир может отдать пачку покупателю и предложить другую с валидным кодом.',
  },
  {
    id: 'missing',
    icon: '✗',
    label: 'Нет в системе',
    tone: 'dark',
    short: 'Кода нет в реестре ЧЗ',
    cassaAction: 'Продажа блокируется',
    detail:
      'Код не найден в базе «Честного знака». Возможные причины: товар в обороте нелегально, подделанный код маркировки, или, реже, технический сбой в загрузке кода производителем.',
    note:
      'Рекомендация — снять товар с витрины и не возвращать в продажу до выяснения. Если поставщик настаивает, что код валидный, проверить статус через приложение «Честный знак» вручную.',
  },
];

export default function ResponseBranch() {
  const [selected, setSelected] = useState<Branch | null>(null);

  useEffect(() => {
    if (!selected) return;
    trackOnce(`flagship-ts-piot-branch-${selected}-explored`);
    if (selected !== 'valid') {
      track('flagship-ts-piot-error-branch-clicked');
    }
  }, [selected]);

  const active = selected ? BRANCHES.find(b => b.id === selected)! : null;

  return (
    <div className="rb">
      <div className="rb-cards" role="group" aria-label="Варианты ответа от Честного знака">
        {BRANCHES.map(b => (
          <button
            key={b.id}
            type="button"
            className={`rb-card tone-${b.tone} ${selected === b.id ? 'active' : ''}`}
            onClick={() => setSelected(b.id)}
            aria-pressed={selected === b.id}
          >
            <span className="rb-icon" aria-hidden="true">{b.icon}</span>
            <span className="rb-label">{b.label}</span>
            <span className="rb-short">{b.short}</span>
          </button>
        ))}
      </div>

      <div className="rb-info" aria-live="polite">
        {active ? (
          <>
            <div className="rb-info-head">
              <span className={`rb-info-tag tone-${active.tone}`}>{active.cassaAction}</span>
            </div>
            <p className="rb-info-detail">{active.detail}</p>
            {active.note && <p className="rb-info-note">{active.note}</p>}
            {active.id !== 'valid' && (
              <button
                type="button"
                className="rb-return"
                onClick={() => setSelected('valid')}
              >
                ← Вернуться к нормальному сценарию
              </button>
            )}
          </>
        ) : (
          <p className="rb-info-empty">
            Выберите вариант ответа выше — увидите, что произойдёт с кассой и продажей.
          </p>
        )}
      </div>

      <style>{`
        .rb {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
          background: var(--sand, #F4EBD9);
          border-radius: 12px;
        }
        .rb-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }
        .rb-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.35rem;
          padding: 0.85rem 1rem;
          background: rgba(255, 255, 255, 0.7);
          border: 2px solid transparent;
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          font: inherit;
          color: var(--dark, #1F1F1F);
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
        }
        .rb-card:hover,
        .rb-card:focus-visible {
          background: #fff;
          outline: none;
        }
        .rb-card.active {
          background: #fff;
          transform: translateY(-2px);
        }
        .rb-card.tone-lime.active   { border-color: var(--lime, #C8FF6B); }
        .rb-card.tone-pink.active   { border-color: var(--pink, #FF4D8F); }
        .rb-card.tone-dark.active   { border-color: var(--dark, #1F1F1F); }
        .rb-icon {
          display: inline-flex;
          width: 1.65rem;
          height: 1.65rem;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-weight: 700;
          font-size: 0.95rem;
        }
        .rb-card.tone-lime .rb-icon { background: var(--lime, #C8FF6B); color: var(--dark, #1F1F1F); }
        .rb-card.tone-pink .rb-icon { background: var(--pink, #FF4D8F); color: #fff; }
        .rb-card.tone-dark .rb-icon { background: var(--dark, #1F1F1F); color: #fff; }
        .rb-label {
          font-weight: 600;
          font-size: 1rem;
          line-height: 1.2;
        }
        .rb-short {
          font-size: 0.82rem;
          color: #555;
          line-height: 1.3;
        }
        .rb-info {
          padding: 1rem 1.25rem;
          background: #fff;
          border-radius: 8px;
          border-left: 4px solid var(--pink, #FF4D8F);
        }
        .rb-info-head { margin-bottom: 0.6rem; }
        .rb-info-tag {
          display: inline-block;
          padding: 0.2em 0.7em;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .rb-info-tag.tone-lime { background: var(--lime, #C8FF6B); color: var(--dark, #1F1F1F); }
        .rb-info-tag.tone-pink { background: var(--pink, #FF4D8F); color: #fff; }
        .rb-info-tag.tone-dark { background: var(--dark, #1F1F1F); color: #fff; }
        .rb-info-detail {
          margin: 0;
          line-height: 1.55;
          color: var(--dark, #1F1F1F);
        }
        .rb-info-note {
          margin: 0.75rem 0 0;
          padding: 0.75rem 1rem;
          background: var(--sand, #F4EBD9);
          border-radius: 6px;
          font-size: 0.9rem;
          line-height: 1.5;
          color: #444;
        }
        .rb-return {
          margin-top: 1rem;
          padding: 0.4em 0.9em;
          background: transparent;
          border: 1px solid rgba(31, 31, 31, 0.2);
          border-radius: 999px;
          cursor: pointer;
          font: inherit;
          font-size: 0.9rem;
          color: var(--dark, #1F1F1F);
          transition: background 0.15s ease;
        }
        .rb-return:hover { background: var(--sand, #F4EBD9); }
        .rb-info-empty {
          margin: 0;
          color: #666;
          font-style: italic;
          line-height: 1.5;
        }
        @media (max-width: 640px) {
          .rb { padding: 1rem; }
          .rb-cards { grid-template-columns: 1fr; }
          .rb-label { font-size: 0.95rem; }
        }
      `}</style>
    </div>
  );
}
