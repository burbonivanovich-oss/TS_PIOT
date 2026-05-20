import { useState, useMemo, useEffect } from 'react';
import { trackOnce } from '../../utils/track';

// ROI-калькулятор ИП vs ООО (УСН «Доходы» 6%). Прикидочная модель
// для оценки порядка налоговой нагрузки и сравнения форм бизнеса.
// Не финансовая консультация — точный расчёт у бухгалтера.

const fmt = (v: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' ₽';
const fmtShort = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' млн ₽';
  if (Math.abs(v) >= 1_000) return Math.round(v / 1_000) + ' тыс ₽';
  return Math.round(v) + ' ₽';
};

const USN_RATE = 0.06;
const FIXED_CONTRIB_2026 = 53_658;     // фиксированные взносы ИП ПФР+ФОМС, прикидочно на 2026
const VAR_CONTRIB_THRESHOLD = 300_000; // порог для 1% дополнительных взносов
const EMPLOYER_TAX_RATE = 0.302;       // страховые с ФОТ
const NDFL_RATE = 0.13;
const DIVIDEND_TAX_RATE = 0.13;

// НДС-2026 для УСН (те же пороги, что в UsnNdsCalc)
const NDS_THRESHOLD = 60_000_000;
const NDS_LO_LIMIT = 250_000_000;
const NDS_HI_LIMIT = 450_000_000;

function ndsRate(turnover: number): { rate: number; label: string } {
  if (turnover <= NDS_THRESHOLD) return { rate: 0, label: 'без НДС' };
  if (turnover <= NDS_LO_LIMIT) return { rate: 0.05, label: '5%' };
  if (turnover <= NDS_HI_LIMIT) return { rate: 0.07, label: '7%' };
  return { rate: 0.20, label: '20%' };
}

interface IpResult {
  usn: number;
  contributions: number;
  nds: number;
  ndsLabel: string;
  total: number;
  onHand: number;
}

interface OooResult {
  usn: number;
  payroll: number;
  employerTaxes: number;
  netSalary: number;
  netDividends: number;
  dividendTax: number;
  nds: number;
  ndsLabel: string;
  total: number;
  onHand: number;
}

function calcIp(turnover: number): IpResult {
  const nds = ndsRate(turnover);
  const ndsAmount = nds.rate > 0 ? (turnover / (1 + nds.rate)) * nds.rate : 0;
  const usnBase = turnover - ndsAmount;
  const usn = usnBase * USN_RATE;
  const varContrib = Math.max(0, usnBase - VAR_CONTRIB_THRESHOLD) * 0.01;
  const contributions = FIXED_CONTRIB_2026 + varContrib;
  // ИП без работников может уменьшить УСН на взносы до 100%
  const usnAfterCredit = Math.max(0, usn - contributions);
  const total = usnAfterCredit + contributions + ndsAmount;
  return {
    usn: usnAfterCredit,
    contributions,
    nds: ndsAmount,
    ndsLabel: nds.label,
    total,
    onHand: turnover - total,
  };
}

function calcOoo(turnover: number, payrollPerMonth: number): OooResult {
  const nds = ndsRate(turnover);
  const ndsAmount = nds.rate > 0 ? (turnover / (1 + nds.rate)) * nds.rate : 0;
  const usnBase = turnover - ndsAmount;
  const payroll = payrollPerMonth * 12;
  const employerTaxes = payroll * EMPLOYER_TAX_RATE;
  const ndflFromPayroll = payroll * NDFL_RATE;
  const netSalary = payroll - ndflFromPayroll;
  // ООО уменьшает УСН на взносы не более чем на 50%
  const usn = usnBase * USN_RATE;
  const usnReduction = Math.min(employerTaxes, usn * 0.5);
  const usnAfterCredit = usn - usnReduction;
  // прибыль до вывода — то, что осталось после налогов и ФОТ
  const profit = usnBase - usnAfterCredit - payroll - employerTaxes;
  const dividendBase = Math.max(0, profit);
  const dividendTax = dividendBase * DIVIDEND_TAX_RATE;
  const netDividends = dividendBase - dividendTax;
  const onHand = netSalary + netDividends;
  return {
    usn: usnAfterCredit,
    payroll,
    employerTaxes,
    netSalary,
    netDividends,
    dividendTax,
    nds: ndsAmount,
    ndsLabel: nds.label,
    total: turnover - onHand,
    onHand,
  };
}

export default function RoiIpVsOoo() {
  const [turnoverMln, setTurnoverMln] = useState(10);
  const [payrollK, setPayrollK] = useState(40); // тыс ₽/мес

  const turnover = turnoverMln * 1_000_000;

  useEffect(() => {
    trackOnce('roi-ip-ooo-used');
  }, [turnoverMln, payrollK]);

  const ip = useMemo(() => calcIp(turnover), [turnover]);
  const ooo = useMemo(() => calcOoo(turnover, payrollK * 1000), [turnover, payrollK]);

  const diff = ip.onHand - ooo.onHand;
  const winner: 'ip' | 'ooo' | 'tie' = Math.abs(diff) < 10_000 ? 'tie' : diff > 0 ? 'ip' : 'ooo';

  return (
    <div className="roi">
      <div className="roi-controls">
        <label className="roi-field">
          <span className="roi-field-label">
            Годовой оборот: <strong>{turnoverMln} млн ₽</strong>
          </span>
          <input
            type="range"
            min={1}
            max={400}
            step={1}
            value={turnoverMln}
            onChange={e => setTurnoverMln(parseInt(e.target.value, 10))}
            aria-label="Годовой оборот в миллионах рублей"
          />
          <div className="roi-ticks" aria-hidden="true">
            <span>1</span><span>60 (НДС)</span><span>250</span><span>400</span>
          </div>
        </label>

        <label className="roi-field">
          <span className="roi-field-label">
            Зарплата директора ООО: <strong>{payrollK} тыс ₽/мес</strong>
            <span className="roi-hint"> · влияет только на ООО</span>
          </span>
          <input
            type="range"
            min={30}
            max={300}
            step={5}
            value={payrollK}
            onChange={e => setPayrollK(parseInt(e.target.value, 10))}
            aria-label="Зарплата директора в тысячах рублей в месяц"
          />
        </label>
      </div>

      <div className="roi-cards">
        <article className={`roi-card ${winner === 'ip' ? 'win' : ''}`}>
          <header className="roi-card-head">
            <h4>ИП на УСН 6%</h4>
            <span className="roi-card-tag">без работников</span>
          </header>
          <dl className="roi-card-rows">
            <div className="roi-row">
              <dt>УСН (после взносов)</dt>
              <dd>{fmt(ip.usn)}</dd>
            </div>
            <div className="roi-row">
              <dt>Страховые взносы ИП</dt>
              <dd>{fmt(ip.contributions)}</dd>
            </div>
            <div className="roi-row">
              <dt>НДС ({ip.ndsLabel})</dt>
              <dd>{ip.nds > 0 ? fmt(ip.nds) : '0 ₽'}</dd>
            </div>
            <div className="roi-row total-row">
              <dt>Итого ушло государству</dt>
              <dd>{fmt(ip.total)}</dd>
            </div>
            <div className="roi-row final-row">
              <dt>На руки в год</dt>
              <dd className="big">{fmt(ip.onHand)}</dd>
            </div>
          </dl>
        </article>

        <article className={`roi-card ${winner === 'ooo' ? 'win' : ''}`}>
          <header className="roi-card-head">
            <h4>ООО на УСН 6%</h4>
            <span className="roi-card-tag">один учредитель = директор</span>
          </header>
          <dl className="roi-card-rows">
            <div className="roi-row">
              <dt>УСН (после взносов с ФОТ)</dt>
              <dd>{fmt(ooo.usn)}</dd>
            </div>
            <div className="roi-row">
              <dt>ФОТ + страховые (30,2%)</dt>
              <dd>{fmt(ooo.payroll + ooo.employerTaxes)}</dd>
            </div>
            <div className="roi-row">
              <dt>НДФЛ с дивидендов (13%)</dt>
              <dd>{fmt(ooo.dividendTax)}</dd>
            </div>
            <div className="roi-row">
              <dt>НДС ({ooo.ndsLabel})</dt>
              <dd>{ooo.nds > 0 ? fmt(ooo.nds) : '0 ₽'}</dd>
            </div>
            <div className="roi-row total-row">
              <dt>Итого ушло государству</dt>
              <dd>{fmt(ooo.total)}</dd>
            </div>
            <div className="roi-row final-row">
              <dt>На руки в год</dt>
              <dd className="big">{fmt(ooo.onHand)}</dd>
              <dd className="sub">зарплата {fmtShort(ooo.netSalary)} + дивиденды {fmtShort(ooo.netDividends)}</dd>
            </div>
          </dl>
        </article>
      </div>

      <div className={`roi-verdict winner-${winner}`}>
        {winner === 'tie' ? (
          <>
            <strong>Паритет.</strong> Разница в пользу одной из форм меньше 10 тыс ₽ в год —
            выбирайте по нефинансовым причинам: ответственность, число учредителей,
            планы по найму.
          </>
        ) : winner === 'ip' ? (
          <>
            <strong>На этом обороте выгоднее ИП</strong> — экономия{' '}
            <strong>{fmt(Math.abs(diff))} в год</strong>. ООО оправдано, если важна
            ограниченная ответственность или вы делите бизнес с партнёрами.
          </>
        ) : (
          <>
            <strong>На этом обороте выгоднее ООО</strong> — экономия{' '}
            <strong>{fmt(Math.abs(diff))} в год</strong>. Часто такое происходит, когда
            оптимизация через зарплату директора и дивиденды перекрывает удобство ИП.
          </>
        )}
      </div>

      <p className="roi-disclaimer">
        Прикидочная модель: УСН «Доходы» 6%, ИП без работников, ООО — один
        учредитель–директор. Не учитываем региональные пониженные ставки УСН,
        торговый сбор, льготы ИТ/общепита, добровольное страхование. Для точного
        расчёта под вашу ситуацию обратитесь к бухгалтеру.
      </p>

      <style>{`
        .roi {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding: 1.5rem;
          background: var(--sand, #F4EBD9);
          border-radius: 12px;
        }
        .roi-controls {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .roi-field { display: flex; flex-direction: column; gap: 0.5rem; }
        .roi-field-label {
          font-size: 0.95rem;
          color: var(--dark, #1F1F1F);
        }
        .roi-hint { color: #888; font-weight: 400; font-size: 0.85rem; }
        .roi-field input[type='range'] {
          width: 100%;
          accent-color: var(--pink, #FF4D8F);
        }
        .roi-ticks {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: #666;
          font-family: ui-monospace, monospace;
        }

        .roi-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.85rem;
        }
        .roi-card {
          padding: 1.15rem 1.25rem;
          background: #fff;
          border-radius: 10px;
          border: 2px solid transparent;
          transition: border-color 0.2s ease;
        }
        .roi-card.win { border-color: var(--pink, #FF4D8F); }
        .roi-card-head {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 0.85rem;
          padding-bottom: 0.6rem;
          border-bottom: 1px dashed rgba(0, 0, 0, 0.08);
        }
        .roi-card-head h4 {
          margin: 0;
          font-size: 1.1rem;
          color: var(--dark, #1F1F1F);
        }
        .roi-card-tag {
          font-size: 0.75rem;
          color: #888;
        }

        .roi-card-rows { margin: 0; }
        .roi-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.75rem;
          padding: 0.45rem 0;
          align-items: baseline;
          font-size: 0.9rem;
        }
        .roi-row dt { color: #555; margin: 0; }
        .roi-row dd { margin: 0; font-family: ui-monospace, monospace; color: var(--dark, #1F1F1F); }
        .roi-row.total-row {
          border-top: 1px dashed rgba(0, 0, 0, 0.08);
          padding-top: 0.65rem;
          margin-top: 0.25rem;
          font-weight: 600;
        }
        .roi-row.final-row {
          padding-top: 0.65rem;
          border-top: 2px solid var(--dark, #1F1F1F);
          margin-top: 0.45rem;
        }
        .roi-row.final-row dd.big {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--pink, #FF4D8F);
        }
        .roi-row.final-row dd.sub {
          grid-column: 1 / -1;
          margin-top: 0.2rem;
          font-size: 0.78rem;
          color: #888;
          text-align: right;
        }

        .roi-verdict {
          padding: 1rem 1.25rem;
          border-radius: 8px;
          font-size: 0.95rem;
          line-height: 1.55;
          border-left: 4px solid;
        }
        .roi-verdict.winner-ip  { background: rgba(200, 255, 107, 0.15); border-left-color: var(--lime, #C8FF6B); }
        .roi-verdict.winner-ooo { background: rgba(255, 77, 143, 0.08); border-left-color: var(--pink, #FF4D8F); }
        .roi-verdict.winner-tie { background: rgba(0, 0, 0, 0.04); border-left-color: rgba(0, 0, 0, 0.3); }

        .roi-disclaimer {
          margin: 0;
          padding: 0.85rem 1rem;
          background: rgba(0, 0, 0, 0.04);
          border-radius: 8px;
          color: #555;
          font-size: 0.85rem;
          line-height: 1.5;
        }

        @media (max-width: 720px) {
          .roi { padding: 1rem; }
          .roi-cards { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
