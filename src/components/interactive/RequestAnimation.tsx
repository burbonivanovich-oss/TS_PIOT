import { useState, useEffect } from 'react';
import { trackOnce, track } from '../../utils/track';

// Шаг 3 флагмана: запрос в «Честный знак» и поведение при потере
// связи. Тогл «связь есть / нет» переключает базовую логику, при
// потере связи появляется ползунок «сколько часов без интернета»
// с тремя порогами (2 ч, 72 ч, больше 72 ч), каждый из которых
// меняет, что разрешает делать касса.

type Mode = 'online' | 'offline';
type Bucket = 'short' | 'medium' | 'long' | 'expired';

interface BucketMeta {
  id: Bucket;
  hours: string;
  status: 'ok' | 'warn' | 'block';
  headline: string;
  detail: string;
}

const BUCKETS: BucketMeta[] = [
  {
    id: 'short',
    hours: '< 2 часов',
    status: 'ok',
    headline: 'Касса работает по локальной базе',
    detail:
      'ТС ПИоТ переключается на ЛМ ЧЗ — локальный снимок чёрных списков кодов. Если кода нет в чёрном списке, продажа разрешается. Данные о продаже накапливаются и уйдут в ЧЗ через ОФД, когда связь восстановится.',
  },
  {
    id: 'medium',
    hours: 'от 2 до 72 часов',
    status: 'warn',
    headline: 'Продавать можно, но сбой надо зафиксировать',
    detail:
      'После 2 часов без связи продавец обязан зафиксировать сбой в журнале (в системе кассы или письменно). Проверка по локальной базе продолжает работать, продажа разрешена. Если на этот момент придёт проверка — кассир покажет журнал.',
  },
  {
    id: 'long',
    hours: 'около 72 часов',
    status: 'warn',
    headline: 'Локальная база на исходе',
    detail:
      'Локальный модуль действует 72 часа с последнего обновления. Подойдя к этому порогу, ТС ПИоТ начинает предупреждать кассира. Подключите интернет, чтобы база освежилась — иначе следующая продажа маркированного товара заблокируется.',
  },
  {
    id: 'expired',
    hours: '> 72 часов',
    status: 'block',
    headline: 'Маркированный товар продать нельзя',
    detail:
      'Локальная база считается устаревшей — её данные больше не достоверны. Касса блокирует продажу маркированных товаров до восстановления связи. Немаркированные товары продаются как обычно. После восстановления связи накопленные продажи (если они были до истечения 72 ч) автоматически передадутся в ЧЗ через ОФД.',
  },
];

const BUCKET_IDS: Bucket[] = ['short', 'medium', 'long', 'expired'];

export default function RequestAnimation() {
  const [mode, setMode] = useState<Mode>('online');
  const [bucketIdx, setBucketIdx] = useState(0);

  useEffect(() => {
    if (mode === 'offline') {
      track('flagship-ts-piot-offline-toggle');
    }
    trackOnce(`flagship-ts-piot-request-${mode}-explored`);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'offline') return;
    trackOnce(`flagship-ts-piot-offline-${BUCKET_IDS[bucketIdx]}-explored`);
  }, [mode, bucketIdx]);

  const bucket = BUCKETS[bucketIdx];

  return (
    <div className="ra">
      <div className="ra-toggle" role="tablist" aria-label="Состояние связи с Честным знаком">
        <button
          type="button"
          role="tab"
          className={`ra-toggle-btn ${mode === 'online' ? 'active' : ''}`}
          onClick={() => setMode('online')}
          aria-selected={mode === 'online'}
        >
          Связь есть
        </button>
        <button
          type="button"
          role="tab"
          className={`ra-toggle-btn ${mode === 'offline' ? 'active' : ''}`}
          onClick={() => setMode('offline')}
          aria-selected={mode === 'offline'}
        >
          Связи нет
        </button>
      </div>

      {mode === 'online' ? (
        <div className="ra-online">
          <div className="ra-timer">
            <span className="ra-timer-val">1,5</span>
            <span className="ra-timer-unit">секунды</span>
          </div>
          <div className="ra-flow">
            <span className="ra-node">Касса</span>
            <span className="ra-arrow" aria-hidden="true">→</span>
            <span className="ra-pack">{'{ cm, inn, kkt_rn, op_type }'}</span>
            <span className="ra-arrow" aria-hidden="true">→</span>
            <span className="ra-node cloud">Честный знак</span>
          </div>
          <p className="ra-text">
            ТС ПИоТ упаковывает код маркировки, ИНН, регистрационный номер ККТ и
            тип операции в небольшой JSON-пакет и отправляет в «Честный знак».
            Целевой таймаут — около <strong>1,5 секунды</strong>. Если ответ не
            пришёл за это время, ТС ПИоТ не блокирует кассу: автоматически
            переключается на локальную базу.
          </p>
        </div>
      ) : (
        <div className="ra-offline">
          <div className="ra-slider-wrap">
            <label className="ra-slider-label">
              Сколько касса без интернета: <strong>{bucket.hours}</strong>
            </label>
            <input
              type="range"
              min={0}
              max={BUCKETS.length - 1}
              step={1}
              value={bucketIdx}
              onChange={e => setBucketIdx(parseInt(e.target.value, 10))}
              aria-label="Длительность работы без связи"
              className="ra-slider"
            />
            <div className="ra-slider-ticks" aria-hidden="true">
              {BUCKETS.map((b, i) => (
                <span key={b.id} className={`ra-tick status-${b.status} ${i === bucketIdx ? 'on' : ''}`}>
                  {b.hours}
                </span>
              ))}
            </div>
          </div>

          <div className={`ra-state status-${bucket.status}`}>
            <div className="ra-state-head">{bucket.headline}</div>
            <p className="ra-state-detail">{bucket.detail}</p>
          </div>
        </div>
      )}

      <style>{`
        .ra {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
          background: var(--sand, #F4EBD9);
          border-radius: 12px;
        }
        .ra-toggle {
          display: inline-flex;
          align-self: flex-start;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 999px;
          padding: 4px;
        }
        .ra-toggle-btn {
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
        .ra-toggle-btn:focus-visible {
          outline: 2px solid var(--pink, #FF4D8F);
          outline-offset: 2px;
        }
        .ra-toggle-btn.active {
          background: var(--dark, #1F1F1F);
          color: #fff;
        }

        .ra-online, .ra-offline {
          padding: 1.25rem;
          background: #fff;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .ra-timer {
          align-self: flex-end;
          display: inline-flex;
          align-items: baseline;
          gap: 0.35rem;
          padding: 0.35rem 0.85rem;
          background: var(--pink, #FF4D8F);
          color: #fff;
          border-radius: 999px;
          font-weight: 600;
        }
        .ra-timer-val { font-size: 1.05rem; }
        .ra-timer-unit { font-size: 0.85rem; opacity: 0.9; }
        .ra-flow {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.95rem;
        }
        .ra-node {
          padding: 0.35rem 0.75rem;
          background: var(--sand, #F4EBD9);
          border-radius: 6px;
          font-weight: 600;
        }
        .ra-node.cloud {
          background: #fff;
          border: 1px solid rgba(31, 31, 31, 0.15);
        }
        .ra-pack {
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.8rem;
          padding: 0.35rem 0.65rem;
          background: rgba(200, 255, 107, 0.25);
          border: 1px dashed rgba(31, 31, 31, 0.2);
          border-radius: 6px;
          color: #333;
        }
        .ra-arrow {
          color: var(--dark, #1F1F1F);
          opacity: 0.4;
        }
        .ra-text {
          margin: 0;
          line-height: 1.55;
          color: var(--dark, #1F1F1F);
        }

        .ra-slider-wrap {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .ra-slider-label {
          font-size: 0.95rem;
          color: var(--dark, #1F1F1F);
        }
        .ra-slider {
          width: 100%;
          accent-color: var(--pink, #FF4D8F);
        }
        .ra-slider-ticks {
          display: flex;
          justify-content: space-between;
          gap: 0.25rem;
        }
        .ra-tick {
          font-size: 0.75rem;
          color: #777;
          flex: 1 1 0;
          text-align: center;
        }
        .ra-tick:first-child { text-align: left; }
        .ra-tick:last-child { text-align: right; }
        .ra-tick.on { color: var(--dark, #1F1F1F); font-weight: 600; }

        .ra-state {
          padding: 1rem 1.15rem;
          border-radius: 8px;
          border-left: 4px solid;
        }
        .ra-state.status-ok    { background: rgba(200, 255, 107, 0.18); border-left-color: var(--lime, #C8FF6B); }
        .ra-state.status-warn  { background: rgba(255, 199, 0, 0.12);  border-left-color: #FFB300; }
        .ra-state.status-block { background: rgba(255, 77, 143, 0.10); border-left-color: var(--pink, #FF4D8F); }
        .ra-state-head {
          font-weight: 600;
          color: var(--dark, #1F1F1F);
          margin-bottom: 0.4rem;
        }
        .ra-state-detail {
          margin: 0;
          line-height: 1.55;
          color: var(--dark, #1F1F1F);
        }

        @media (max-width: 640px) {
          .ra { padding: 1rem; }
          .ra-online, .ra-offline { padding: 1rem; }
          .ra-flow { font-size: 0.85rem; }
        }
      `}</style>
    </div>
  );
}
