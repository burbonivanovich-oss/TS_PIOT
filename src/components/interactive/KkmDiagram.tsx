import { useState, useEffect } from 'react';
import { trackOnce } from '../../utils/track';

// Шаг 2 флагмана: касса в разрезе на hardware и software зоны.
// Главная мысль — ТС ПИоТ это программный модуль, не «коробка».
// Закрепляем через структуру: ФН — единственное железо, всё
// остальное — программы рядом друг с другом.

type Zone = 'hw' | 'sw';
type ModuleId = 'fn' | 'pos' | 'kkt-driver' | 'scanner-driver' | 'ofd' | 'tspot' | 'lm';

interface Module {
  id: ModuleId;
  zone: Zone;
  label: string;
  detail: string;
  highlight?: boolean;
}

const MODULES: Module[] = [
  {
    id: 'fn',
    zone: 'hw',
    label: 'ФН (фискальный накопитель)',
    detail:
      'Это физический чип внутри ККТ — единственное железо в этом списке. Накапливает фискальные данные локально и шифрует их перед передачей. Меняется раз в 15 или 36 месяцев в зависимости от режима налогообложения.',
  },
  {
    id: 'pos',
    zone: 'sw',
    label: 'Кассовая программа',
    detail:
      'Frontend, который видит кассир: список товаров, кнопки оплаты, печать чека. 1С:Розница, Эвотор, АТОЛ Sigma, Saby Retail. Эта программа взаимодействует со всеми остальными модулями.',
  },
  {
    id: 'kkt-driver',
    zone: 'sw',
    label: 'Драйвер ККТ',
    detail:
      'Прослойка между кассовой программой и фискальным накопителем. Превращает «отбей чек на 1500 рублей» в команды для ФН и формирует фискальный документ нужного формата (ФФД 1.05/1.1/1.2).',
  },
  {
    id: 'scanner-driver',
    zone: 'sw',
    label: 'Драйвер сканера / эквайринга',
    detail:
      'Принимает данные от сканера штрих-кодов и от терминала оплаты. Передаёт код маркировки в ТС ПИоТ для проверки и результат оплаты в кассовую программу.',
  },
  {
    id: 'ofd',
    zone: 'sw',
    label: 'Модуль связи с ОФД',
    detail:
      'Отправляет готовые фискальные документы в ОФД (оператор фискальных данных). Если связи нет — складывает в очередь и отправляет, когда интернет вернётся. С маркированных чеков ОФД дальше передаёт данные и в ФНС, и в «Честный знак».',
  },
  {
    id: 'tspot',
    zone: 'sw',
    label: 'ТС ПИоТ',
    detail:
      'Технические средства получения информации о товаре. Сертифицированный модуль связи с ГИС МТ («Честный знак»). Принимает код маркировки от сканера, формирует запрос «проверка перед продажей», получает ответ, упаковывает результат в фискальный документ (теги 1163 и 2106). С 28.12.2025 обязателен на каждой кассе с маркированным товаром.',
    highlight: true,
  },
  {
    id: 'lm',
    zone: 'sw',
    label: 'ЛМ ЧЗ (локальная база)',
    detail:
      'Локальный модуль проверки кодов. Кеширует «чёрный список» кодов от «Честного знака» на 72 часа. Если в момент продажи интернета нет, ТС ПИоТ проверяет код по этой локальной базе. После 72 часов без обновления база считается устаревшей.',
  },
];

export default function KkmDiagram() {
  const [active, setActive] = useState<ModuleId>('tspot');

  useEffect(() => {
    trackOnce(`flagship-ts-piot-module-${active}-explored`);
  }, [active]);

  const meta = MODULES.find(m => m.id === active)!;
  const hw = MODULES.filter(m => m.zone === 'hw');
  const sw = MODULES.filter(m => m.zone === 'sw');

  return (
    <div className="kkm">
      <div className="kkm-diagram" role="group" aria-label="Модули кассового ПО">
        <div className="kkm-zone hw">
          <div className="kkm-zone-label">Hardware (железо)</div>
          {hw.map(m => (
            <button
              key={m.id}
              type="button"
              className={`kkm-mod ${active === m.id ? 'active' : ''}`}
              onClick={() => setActive(m.id)}
              aria-pressed={active === m.id}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="kkm-zone sw">
          <div className="kkm-zone-label">Software (программы)</div>
          <div className="kkm-sw-grid">
            {sw.map(m => (
              <button
                key={m.id}
                type="button"
                className={`kkm-mod ${active === m.id ? 'active' : ''} ${m.highlight ? 'hl' : ''}`}
                onClick={() => setActive(m.id)}
                aria-pressed={active === m.id}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="kkm-info" aria-live="polite">
        <div className="kkm-info-head">
          <span className={`kkm-info-tag tone-${meta.zone}`}>
            {meta.zone === 'hw' ? 'железо' : 'программа'}
          </span>
          <span className="kkm-info-label">{meta.label}</span>
        </div>
        <p className="kkm-info-detail">{meta.detail}</p>
      </div>

      <style>{`
        .kkm {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
          background: var(--sand, #F4EBD9);
          border-radius: 12px;
        }
        .kkm-diagram {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 8px;
        }
        .kkm-zone {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .kkm-zone-label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #666;
          margin-bottom: 0.15rem;
        }
        .kkm-sw-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }
        .kkm-mod {
          padding: 0.55rem 0.85rem;
          background: #fff;
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          font: inherit;
          font-size: 0.9rem;
          line-height: 1.25;
          color: var(--dark, #1F1F1F);
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
        }
        .kkm-mod:hover,
        .kkm-mod:focus-visible {
          background: var(--sand, #F4EBD9);
          outline: none;
        }
        .kkm-mod.hl {
          box-shadow: inset 3px 0 0 var(--pink, #FF4D8F);
          font-weight: 600;
        }
        .kkm-mod.active {
          border-color: var(--dark, #1F1F1F);
          transform: translateY(-1px);
        }
        .kkm-mod.hl.active {
          background: var(--pink, #FF4D8F);
          color: #fff;
          box-shadow: none;
        }
        .kkm-info {
          padding: 1rem 1.25rem;
          background: #fff;
          border-radius: 8px;
          border-left: 4px solid var(--pink, #FF4D8F);
        }
        .kkm-info-head {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }
        .kkm-info-tag {
          display: inline-block;
          padding: 0.15em 0.6em;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: lowercase;
        }
        .kkm-info-tag.tone-hw {
          background: var(--dark, #1F1F1F);
          color: #fff;
        }
        .kkm-info-tag.tone-sw {
          background: var(--lime, #C8FF6B);
          color: var(--dark, #1F1F1F);
        }
        .kkm-info-label {
          font-weight: 600;
          color: var(--dark, #1F1F1F);
        }
        .kkm-info-detail {
          margin: 0;
          line-height: 1.55;
          color: var(--dark, #1F1F1F);
        }
        @media (max-width: 640px) {
          .kkm { padding: 1rem; }
          .kkm-sw-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
