import { useState, useMemo, useEffect } from 'react';
import { trackOnce } from '../../utils/track';

// Слайдер штрафа за оборот товаров без маркировки (ст. 15.12
// КоАП ч. 4). Штрафы фиксированные, но конфискация партии
// добавляет реальную «стоимость» нарушения сверх штрафа.

type Subject = 'ip' | 'legal' | 'official';

const FINES: Record<Subject, { min: number; max: number; label: string }> = {
  ip: { min: 5_000, max: 10_000, label: 'ИП' },
  legal: { min: 50_000, max: 300_000, label: 'Юрлицо' },
  official: { min: 5_000, max: 10_000, label: 'Должностное лицо' },
};

const fmt = (v: number) =>
  new Intl.NumberFormat('ru-RU').format(Math.round(v)) + ' ₽';

export default function MarkingFineSlider() {
  const [batchK, setBatchK] = useState(200); // тыс. ₽, стоимость партии
  const [subject, setSubject] = useState<Subject>('ip');

  const batchValue = batchK * 1_000;

  useEffect(() => {
    trackOnce('calc-shtraf-markirovka-used');
  }, [batchK, subject]);

  const fine = FINES[subject];
  const totalMin = fine.min + batchValue;
  const totalMax = fine.max + batchValue;

  const ratio = useMemo(() => {
    if (batchValue === 0) return Infinity;
    return totalMax / batchValue;
  }, [totalMax, batchValue]);

  return (
    <div className="mfs">
      <div className="mfs-controls">
        <div className="mfs-subjects" role="radiogroup" aria-label="Тип нарушителя">
          {(Object.keys(FINES) as Subject[]).map(s => (
            <button
              key={s}
              type="button"
              role="radio"
              className={`mfs-subj ${subject === s ? 'active' : ''}`}
              onClick={() => setSubject(s)}
              aria-checked={subject === s}
            >
              {FINES[s].label}
            </button>
          ))}
        </div>

        <label className="mfs-slider-wrap">
          <span className="mfs-slider-label">
            Стоимость партии без маркировки: <strong>{fmt(batchValue)}</strong>
          </span>
          <input
            type="range"
            min={10}
            max={5000}
            step={10}
            value={batchK}
            onChange={e => setBatchK(parseInt(e.target.value, 10))}
            aria-label="Стоимость партии в тысячах рублей"
          />
          <div className="mfs-ticks" aria-hidden="true">
            <span>10 000</span>
            <span>1 млн</span>
            <span>3 млн</span>
            <span>5 млн</span>
          </div>
        </label>
      </div>

      <div className="mfs-result">
        <div className="mfs-result-row">
          <div className="mfs-result-label">Штраф по ст. 15.12 ч. 4 КоАП</div>
          <div className="mfs-result-val">
            {fmt(fine.min)} – {fmt(fine.max)}
          </div>
        </div>
        <div className="mfs-result-row">
          <div className="mfs-result-label">Конфискация партии</div>
          <div className="mfs-result-val">{fmt(batchValue)}</div>
        </div>
        <div className="mfs-result-row total">
          <div className="mfs-result-label">Итого потери</div>
          <div className="mfs-result-val">
            {fmt(totalMin)} – {fmt(totalMax)}
          </div>
        </div>
      </div>

      {Number.isFinite(ratio) && ratio > 1.5 && (
        <div className="mfs-warn">
          Конфискация {' '}
          {batchValue > 0 && (
            <strong>в {(batchValue / fine.max).toFixed(1)} раз</strong>
          )}{' '}
          больше штрафа. Для МСБ потеря партии обычно болезненнее самой
          санкции — особенно если товар скоропортящийся (молочка, кондитерка).
        </div>
      )}

      <p className="mfs-disclaimer">
        Расчёт по ст. 15.12 ч. 4 КоАП («оборот товаров без маркировки»).
        Конкретная сумма штрафа в пределах вилки и решение о конфискации —
        у инспектора Роспотребнадзора или Минпромторга по результатам
        проверки. На штрафы могут влиять смягчающие/отягчающие обстоятельства
        и повторность нарушения.
      </p>

      <style>{`
        .mfs {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
          background: var(--sand, #F4EBD9);
          border-radius: 12px;
        }
        .mfs-controls {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .mfs-subjects {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        .mfs-subj {
          padding: 0.5em 1.1em;
          background: #fff;
          border: 2px solid transparent;
          border-radius: 999px;
          cursor: pointer;
          font: inherit;
          font-size: 0.9rem;
          color: var(--dark, #1F1F1F);
        }
        .mfs-subj.active {
          background: var(--dark, #1F1F1F);
          color: #fff;
        }
        .mfs-slider-wrap {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .mfs-slider-label {
          font-size: 0.95rem;
          color: var(--dark, #1F1F1F);
        }
        .mfs-slider-wrap input[type='range'] {
          width: 100%;
          accent-color: var(--pink, #FF4D8F);
        }
        .mfs-ticks {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: #666;
          font-family: ui-monospace, monospace;
        }

        .mfs-result {
          background: #fff;
          border-radius: 8px;
          padding: 0.5rem 1rem;
        }
        .mfs-result-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 1rem;
          padding: 0.75rem 0;
          align-items: baseline;
          border-bottom: 1px dashed rgba(0, 0, 0, 0.08);
        }
        .mfs-result-row:last-child { border-bottom: none; }
        .mfs-result-row.total {
          font-weight: 700;
          border-top: 2px solid var(--dark, #1F1F1F);
          border-bottom: none;
          padding-top: 0.85rem;
          padding-bottom: 0.85rem;
        }
        .mfs-result-label { color: var(--dark, #1F1F1F); }
        .mfs-result-val {
          font-family: ui-monospace, monospace;
          font-size: 1.05rem;
          color: var(--dark, #1F1F1F);
        }
        .mfs-result-row.total .mfs-result-val {
          font-size: 1.2rem;
          color: var(--pink, #FF4D8F);
        }

        .mfs-warn {
          padding: 0.85rem 1.15rem;
          background: rgba(255, 77, 143, 0.08);
          border-left: 3px solid var(--pink, #FF4D8F);
          border-radius: 6px;
          font-size: 0.92rem;
          line-height: 1.5;
          color: var(--dark, #1F1F1F);
        }
        .mfs-disclaimer {
          margin: 0;
          padding: 0.85rem 1rem;
          background: rgba(0, 0, 0, 0.04);
          border-radius: 8px;
          color: #555;
          font-size: 0.85rem;
          line-height: 1.5;
        }
        @media (max-width: 640px) {
          .mfs { padding: 1rem; }
        }
      `}</style>
    </div>
  );
}
