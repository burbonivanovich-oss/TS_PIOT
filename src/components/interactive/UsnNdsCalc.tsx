import { useState, useMemo, useEffect } from 'react';
import { trackOnce } from '../../utils/track';

// Калькулятор УСН + НДС-2026. Упрощённая модель для прикидки:
// читатель вводит годовой оборот → видит примерные итоги при
// разных режимах. Не финансовый совет, точный расчёт — у бухгалтера.

type UsnMode = 'doxody' | 'doxody-rasxody';

const fmt = (v: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' ₽';

const USN_DOXODY_RATE = 0.06;
const USN_DOXODY_RASXODY_RATE = 0.15;
const NDS_THRESHOLD = 60_000_000;       // ₽/год, лимит освобождения от НДС
const NDS_LO_LIMIT = 250_000_000;       // ₽/год, верхняя граница ставки 5%
const NDS_HI_LIMIT = 450_000_000;       // ₽/год, верхняя граница ставки 7%

function ndsRate(turnover: number): { rate: number; label: string; note?: string } {
  if (turnover <= NDS_THRESHOLD) return { rate: 0, label: 'без НДС', note: 'оборот ≤ 60 млн ₽' };
  if (turnover <= NDS_LO_LIMIT) return { rate: 0.05, label: '5%' };
  if (turnover <= NDS_HI_LIMIT) return { rate: 0.07, label: '7%' };
  return { rate: 0.20, label: '20%', note: 'переход на ОСН — здесь приблизительно' };
}

export default function UsnNdsCalc() {
  const [turnoverMln, setTurnoverMln] = useState(30); // млн ₽
  const [usn, setUsn] = useState<UsnMode>('doxody');
  const [marginPct, setMarginPct] = useState(20); // маржа для УСН-Д-Р (% от оборота)

  const turnover = turnoverMln * 1_000_000;

  useEffect(() => {
    trackOnce('calc-usn-nds-used');
  }, [turnoverMln, usn, marginPct]);

  const result = useMemo(() => {
    const nds = ndsRate(turnover);
    // НДС считаем «сверху» от выручки — упрощённо: оборот включает НДС,
    // то есть налог уже сидит в цене. Для прикидки выделяем: оборот / (1 + ставка) * ставка.
    const ndsAmount = nds.rate > 0 ? (turnover / (1 + nds.rate)) * nds.rate : 0;
    const usnBase = turnover - ndsAmount; // упрощённо: налогооблагаемая база без НДС
    let usnAmount = 0;
    if (usn === 'doxody') {
      usnAmount = usnBase * USN_DOXODY_RATE;
    } else {
      const profit = usnBase * (marginPct / 100);
      usnAmount = profit * USN_DOXODY_RASXODY_RATE;
      // минимальный налог: 1% от доходов
      const minTax = usnBase * 0.01;
      if (usnAmount < minTax) usnAmount = minTax;
    }
    const total = usnAmount + ndsAmount;
    return {
      nds,
      ndsAmount,
      usnBase,
      usnAmount,
      total,
      ndsAmountPct: turnover > 0 ? (ndsAmount / turnover) * 100 : 0,
      usnAmountPct: turnover > 0 ? (usnAmount / turnover) * 100 : 0,
    };
  }, [turnover, usn, marginPct]);

  return (
    <div className="usn-calc">
      <div className="usn-controls">
        <label className="usn-field">
          <span className="usn-field-label">
            Годовой оборот: <strong>{turnoverMln} млн ₽</strong>
          </span>
          <input
            type="range"
            min={1}
            max={500}
            step={1}
            value={turnoverMln}
            onChange={e => setTurnoverMln(parseInt(e.target.value, 10))}
            aria-label="Годовой оборот в миллионах рублей"
          />
          <div className="usn-ticks" aria-hidden="true">
            <span>1</span><span>60</span><span>250</span><span>450</span><span>500</span>
          </div>
        </label>

        <div className="usn-row">
          <div className="usn-toggle" role="tablist" aria-label="Режим УСН">
            <button
              type="button"
              role="tab"
              className={`usn-toggle-btn ${usn === 'doxody' ? 'active' : ''}`}
              onClick={() => setUsn('doxody')}
              aria-selected={usn === 'doxody'}
            >
              УСН «Доходы» 6%
            </button>
            <button
              type="button"
              role="tab"
              className={`usn-toggle-btn ${usn === 'doxody-rasxody' ? 'active' : ''}`}
              onClick={() => setUsn('doxody-rasxody')}
              aria-selected={usn === 'doxody-rasxody'}
            >
              УСН «Доходы – Расходы» 15%
            </button>
          </div>

          {usn === 'doxody-rasxody' && (
            <label className="usn-field tight">
              <span className="usn-field-label">
                Маржа (прибыль): <strong>{marginPct}%</strong>
              </span>
              <input
                type="range"
                min={5}
                max={70}
                step={1}
                value={marginPct}
                onChange={e => setMarginPct(parseInt(e.target.value, 10))}
                aria-label="Маржа в процентах от оборота"
              />
            </label>
          )}
        </div>
      </div>

      <div className="usn-result">
        <div className="usn-result-row">
          <div className="usn-result-label">УСН ({usn === 'doxody' ? '6%' : '15%'})</div>
          <div className="usn-result-val">{fmt(result.usnAmount)}</div>
          <div className="usn-result-pct">{result.usnAmountPct.toFixed(1)}% от оборота</div>
        </div>
        <div className="usn-result-row">
          <div className="usn-result-label">
            НДС ({result.nds.label})
            {result.nds.note && <span className="usn-note">· {result.nds.note}</span>}
          </div>
          <div className="usn-result-val">
            {result.nds.rate > 0 ? fmt(result.ndsAmount) : '0 ₽'}
          </div>
          <div className="usn-result-pct">
            {result.nds.rate > 0 ? `${result.ndsAmountPct.toFixed(1)}% от оборота` : ''}
          </div>
        </div>
        <div className="usn-result-row total">
          <div className="usn-result-label">Итого налогов в год</div>
          <div className="usn-result-val">{fmt(result.total)}</div>
          <div className="usn-result-pct">
            {turnover > 0 ? `${((result.total / turnover) * 100).toFixed(1)}% от оборота` : ''}
          </div>
        </div>
      </div>

      <p className="usn-disclaimer">
        Прикидочные цифры для оценки порядка налоговой нагрузки. Реальная цифра
        зависит от структуры доходов и расходов, региональных льгот, страховых
        взносов, торгового сбора и других факторов. Перед принятием решений
        проверьте с бухгалтером.
      </p>

      <style>{`
        .usn-calc {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
          background: var(--sand, #F4EBD9);
          border-radius: 12px;
        }
        .usn-controls {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .usn-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .usn-field.tight { gap: 0.35rem; flex: 1 1 200px; }
        .usn-field-label {
          font-size: 0.95rem;
          color: var(--dark, #1F1F1F);
        }
        .usn-field input[type='range'] {
          width: 100%;
          accent-color: var(--pink, #FF4D8F);
        }
        .usn-ticks {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: #666;
          font-family: ui-monospace, monospace;
        }
        .usn-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem 1.25rem;
          align-items: flex-end;
        }
        .usn-toggle {
          display: inline-flex;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 999px;
          padding: 4px;
        }
        .usn-toggle-btn {
          padding: 0.45em 1em;
          background: transparent;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          font: inherit;
          font-size: 0.9rem;
          color: var(--dark, #1F1F1F);
          transition: background 0.15s ease, color 0.15s ease;
        }
        .usn-toggle-btn.active {
          background: var(--dark, #1F1F1F);
          color: #fff;
        }

        .usn-result {
          background: #fff;
          border-radius: 8px;
          padding: 0.5rem 1rem;
        }
        .usn-result-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 0.75rem 1rem;
          padding: 0.75rem 0;
          align-items: baseline;
          border-bottom: 1px dashed rgba(0, 0, 0, 0.08);
        }
        .usn-result-row:last-child { border-bottom: none; }
        .usn-result-row.total {
          font-weight: 700;
          border-top: 2px solid var(--dark, #1F1F1F);
          border-bottom: none;
        }
        .usn-result-label { color: var(--dark, #1F1F1F); }
        .usn-note {
          font-size: 0.8rem;
          color: #888;
          font-weight: 400;
        }
        .usn-result-val {
          font-family: ui-monospace, monospace;
          font-size: 1.05rem;
          color: var(--dark, #1F1F1F);
        }
        .usn-result-pct {
          font-size: 0.85rem;
          color: #888;
        }
        .usn-result-row.total .usn-result-val {
          font-size: 1.2rem;
          color: var(--pink, #FF4D8F);
        }

        .usn-disclaimer {
          margin: 0;
          padding: 0.85rem 1rem;
          background: rgba(0, 0, 0, 0.04);
          border-radius: 8px;
          color: #555;
          font-size: 0.85rem;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .usn-calc { padding: 1rem; }
          .usn-toggle-btn { font-size: 0.82rem; padding: 0.4em 0.7em; }
          .usn-result-row { grid-template-columns: 1fr; gap: 0.15rem; }
          .usn-result-row.total .usn-result-val { font-size: 1.05rem; }
        }
      `}</style>
    </div>
  );
}
