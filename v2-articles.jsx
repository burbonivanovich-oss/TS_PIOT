/* global React, V2, NavV2, ReadBadge */
const TR = window.V2;
const NR = window.NavV2;
const RR = window.ReadBadge;

// V2 — Articles index — calm, scannable, time-aware
function ArticlesV2() {
  const A = TR.green;
  return (
    <div style={{ width: 1440, background: TR.paper, color: TR.ink, fontFamily: TR.body, paddingBottom: 80 }}>
      <NR accent={A} />

      <div style={{ padding: '48px 40px 28px', borderBottom: `1px solid ${TR.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontFamily: TR.mono, fontSize: 11, letterSpacing: 1, color: TR.muted, marginBottom: 14 }}>ГЛАВНАЯ / СТАТЬИ</div>
            <div style={{ fontFamily: TR.serif, fontSize: 72, lineHeight: 1, letterSpacing: -0.5 }}>Все материалы</div>
            <div style={{ fontFamily: TR.body, fontSize: 16, color: TR.text, marginTop: 14 }}>411 статей · 28 часов чтения · в среднем 6 мин на материал</div>
          </div>
          <div style={{ display: 'flex', border: `1px solid ${TR.line2}`, background: TR.white }}>
            <input placeholder="Что вы ищете?" style={{ width: 320, padding: '11px 14px', border: 'none', fontFamily: TR.body, fontSize: 14, background: 'transparent', outline: 'none' }} />
            <button style={{ background: TR.ink, color: TR.paper, border: 'none', padding: '0 18px', cursor: 'pointer', fontSize: 13 }}>⌕</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 40px', borderBottom: `1px solid ${TR.line}`, background: TR.white }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontFamily: TR.mono, fontSize: 10, color: TR.muted, letterSpacing: 1, marginRight: 12 }}>РАЗДЕЛ</span>
          {[
            { name: 'Все', count: 411, active: true },
            { name: 'Финансы', count: 147 },
            { name: 'Налоги', count: 92 },
            { name: 'Право', count: 64 },
            { name: 'Технологии', count: 108 },
            { name: 'Кейсы', count: 38 },
          ].map((f, i) => (
            <span key={i} style={{
              fontFamily: TR.body, fontSize: 13, padding: '7px 12px',
              background: f.active ? TR.ink : 'transparent',
              color: f.active ? TR.paper : TR.text,
              border: f.active ? 'none' : `1px solid ${TR.line2}`,
            }}>
              {f.name}<span style={{ marginLeft: 6, color: f.active ? '#9DA9A0' : TR.muted, fontSize: 11 }}>{f.count}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontFamily: TR.body, fontSize: 13 }}>
          <span style={{ color: TR.muted }}>Время:</span>
          <span style={{ fontWeight: 600 }}>Любое</span>
          <span style={{ color: TR.muted, marginLeft: 12 }}>Сорт:</span>
          <span style={{ fontWeight: 600 }}>Сначала новые ↓</span>
        </div>
      </div>

      <div style={{ padding: '32px 40px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32, marginBottom: 50 }}>
          <div style={{
            background: TR.ink, color: TR.paper, padding: 32, position: 'relative', overflow: 'hidden', minHeight: 360,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div style={{ position: 'absolute', right: -10, bottom: -40, fontFamily: TR.display, fontSize: 280, color: 'rgba(255,255,255,0.06)', letterSpacing: -4, lineHeight: 0.85 }}>ЕНС</div>
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: TR.mono, fontSize: 11, letterSpacing: 1, color: A, fontWeight: 600 }}>★ ГЛАВНОЕ · НАЛОГИ</span>
              <span style={{ fontFamily: TR.mono, fontSize: 11, color: TR.line2 }}>29 АПРЕЛЯ</span>
            </div>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ fontFamily: TR.serif, fontSize: 48, lineHeight: 1.05, letterSpacing: -0.4 }}>
                ЕНС, уведомления и&nbsp;дедлайны: как пройти май без штрафов
              </div>
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: TR.body, fontSize: 13, color: TR.line2 }}>Ольга Кравец</span>
                <span style={{ fontFamily: TR.mono, fontSize: 11, color: A, fontWeight: 600 }}>● 12 мин</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { tag: 'ТЕХНОЛОГИИ', date: '27 АПР', mins: 9, t: 'КЭДО в команде из 12 человек' },
              { tag: 'ПРАВО', date: '26 АПР', mins: 6, t: 'Оферта в интернет-магазине: 7 ошибок' },
            ].map((c, i) => (
              <div key={i} style={{ flex: 1, background: TR.white, border: `1px solid ${TR.line}`, padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: TR.mono, fontSize: 11 }}>
                  <span style={{ color: A, fontWeight: 600 }}>{c.tag}</span>
                  <span style={{ color: TR.muted }}>{c.date}</span>
                </div>
                <div style={{ fontFamily: TR.serif, fontSize: 26, lineHeight: 1.2 }}>{c.t}</div>
                <RR mins={c.mins} accent={A} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, borderBottom: `2px solid ${TR.ink}` }}>
          <div style={{ fontFamily: TR.serif, fontSize: 32 }}>Архив — апрель 2026</div>
          <span style={{ fontFamily: TR.mono, fontSize: 11, color: TR.muted }}>34 МАТЕРИАЛА</span>
        </div>
        {[
          { tag: 'ФИНАНСЫ', date: '25 АПР', mins: 5, t: 'Счёт-фактура без НДС: нужен или нет в 2026', desc: 'Когда ИП на упрощёнке всё-таки обязан её выставить.', author: 'Ольга Кравец' },
          { tag: 'ИНТЕРВЬЮ', date: '24 АПР', mins: 11, t: '«Когда у тебя один сотрудник — он важнее, чем клиент»', desc: 'Разговор с владелицей кофейни о найме первого человека.', author: 'Редакция' },
          { tag: 'НАЛОГИ', date: '22 АПР', mins: 7, t: 'Упрощёнка в 2026: пороги, ставки, переходы', desc: 'Что изменилось в правилах применения УСН.', author: 'Ольга Кравец' },
          { tag: 'ПРАВО', date: '20 АПР', mins: 8, t: 'Трудовой или ГПХ: что выбрать для команды из пяти', desc: 'Сравнение двух форматов и риски, о которых не говорят.', author: 'Иван Сухой' },
          { tag: 'ТЕХНОЛОГИИ', date: '18 АПР', mins: 13, t: 'СБИС, Контур или Такском: как выбрать оператора ЭДО', desc: 'Сравнили три популярных сервиса по цене и удобству.', author: 'Мария Лонг' },
          { tag: 'ФИНАНСЫ', date: '16 АПР', mins: 6, t: 'Как читать выписку из ЕНС', desc: 'Что значат строки в личном кабинете и как заметить ошибку.', author: 'Ольга Кравец' },
          { tag: 'КЕЙС', date: '14 АПР', mins: 14, t: 'Как открыть кофейню в регионе и не прогореть', desc: 'Цифры и решения от владельца сети из трёх точек в Перми.', author: 'Антон Реш' },
          { tag: 'НАЛОГИ', date: '12 АПР', mins: 4, t: 'НПД: когда самозанятому выгодно выйти в ИП', desc: 'Точка перехода в цифрах и список преимуществ ИП.', author: 'Ольга Кравец' },
        ].map((row, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '120px 90px 1fr 160px 100px 30px',
            gap: 24, padding: '22px 0', borderBottom: `1px solid ${TR.line}`, alignItems: 'baseline',
          }}>
            <div style={{ fontFamily: TR.mono, fontSize: 11, letterSpacing: 1, color: A, fontWeight: 600 }}>{row.tag}</div>
            <div style={{ fontFamily: TR.mono, fontSize: 11, color: TR.muted }}>{row.date}</div>
            <div>
              <div style={{ fontFamily: TR.serif, fontSize: 24, lineHeight: 1.2, marginBottom: 6 }}>{row.t}</div>
              <div style={{ fontFamily: TR.body, fontSize: 13, color: TR.text, lineHeight: 1.5 }}>{row.desc}</div>
            </div>
            <div style={{ fontFamily: TR.body, fontSize: 13, color: TR.text }}>{row.author}</div>
            <div style={{ textAlign: 'right' }}><RR mins={row.mins} accent={A} /></div>
            <div style={{ fontFamily: TR.serif, fontSize: 22, color: TR.muted, textAlign: 'right' }}>→</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// V2 — Article (reference DNA, but quieter palette: ink + paper + green)
function ArticleV2() {
  const A = TR.green;
  return (
    <div style={{ width: 1440, background: TR.paper, color: TR.ink, fontFamily: TR.body, paddingBottom: 80 }}>
      <div style={{ height: 3, background: TR.line, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '34%', background: A }} />
      </div>
      <NR accent={A} />

      <div style={{ display: 'grid', gridTemplateColumns: '58% 42%', minHeight: 700 }}>
        <div style={{
          background: TR.ink, color: TR.paper, padding: 36, position: 'relative', overflow: 'hidden',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{ position: 'absolute', right: -40, bottom: -180, fontFamily: TR.display, fontSize: 580, lineHeight: 0.85, color: 'rgba(255,255,255,0.06)', letterSpacing: -8 }}>ЕНС</div>
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: TR.mono, fontSize: 11, letterSpacing: 1, color: A, fontWeight: 600 }}>● УВЕДОМЛЕНИЯ</span>
            <span style={{ fontFamily: TR.mono, fontSize: 11, color: TR.line2 }}>♥ 247  ↗ 32</span>
          </div>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ fontFamily: TR.serif, fontStyle: 'italic', fontSize: 22, color: A, marginBottom: 12 }}>главное за неделю —</div>
            <div style={{ fontFamily: TR.mono, fontSize: 11, color: TR.line2, maxWidth: 420, lineHeight: 1.6 }}>
              ПЛАТЕЖИ В ЕНС / УВЕДОМЛЕНИЯ ДО 25 ЧИСЛА / СВЕРКА В ЛК / ПЕРВЫЕ ШТРАФЫ — В ИЮНЕ
            </div>
          </div>
          <div style={{ position: 'relative', zIndex: 2, fontFamily: TR.mono, fontSize: 10, color: TR.line2 }}>
            ГЛАВНАЯ / СТАТЬИ / НАЛОГИ
          </div>
        </div>
        <div style={{ background: TR.paper, padding: '36px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: TR.mono, fontSize: 11, color: TR.text }}>29 АПРЕЛЯ 2026</span>
            <RR mins={12} accent={A} />
          </div>
          <div style={{ fontFamily: TR.serif, fontSize: 64, lineHeight: 1.05, letterSpacing: -0.5 }}>
            ЕНС, уведомления и&nbsp;дедлайны. Как пройти май без&nbsp;штрафов
          </div>
          <div style={{ borderTop: `1px solid ${TR.line2}`, paddingTop: 18 }}>
            <div style={{ fontFamily: TR.body, fontSize: 16, lineHeight: 1.55, color: TR.text }}>
              Без воды — только то, что нужно сделать в мае: какие платежи в ЕНС не пропустить, какие уведомления подать, и где в личном кабинете лежит сверка.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, fontFamily: TR.body, fontSize: 13, color: TR.text }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: TR.line }} />
              <span><span style={{ color: TR.ink, fontWeight: 600 }}>Ольга Кравец</span> · редактор «Финансы»</span>
            </div>
          </div>
        </div>
      </div>

      {/* TL;DR — answers "what should I do?" in 30 sec */}
      <div style={{ padding: '32px 40px 0' }}>
        <div style={{ background: TR.ink, color: TR.paper, padding: 28, display: 'grid', gridTemplateColumns: '180px 1fr', gap: 32, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: TR.mono, fontSize: 10, letterSpacing: 1.5, color: A, marginBottom: 6, fontWeight: 600 }}>★ TL;DR</div>
            <div style={{ fontFamily: TR.serif, fontSize: 32, lineHeight: 1 }}>30 секунд</div>
          </div>
          <div style={{ fontFamily: TR.body, fontSize: 15, lineHeight: 1.6, color: TR.line2 }}>
            <strong style={{ color: TR.paper }}>До 25 мая</strong> — подайте уведомления (форма КНД 1110355). <strong style={{ color: TR.paper }}>До 28 мая</strong> — переведите деньги на ЕНС с КБК. <strong style={{ color: TR.paper }}>До 31 мая</strong> — сверьтесь в ЛК. Пропуск уведомления = штраф 200₽ + автоматические пени.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '28% 72%', minHeight: 720, marginTop: 32 }}>
        <div style={{ padding: 24 }}>
          <div style={{
            background: TR.ink, color: TR.paper, padding: 24, position: 'relative', overflow: 'hidden', minHeight: 320,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div style={{ position: 'absolute', right: -10, bottom: -40, fontFamily: TR.display, fontSize: 200, color: 'rgba(255,255,255,0.06)', letterSpacing: -4 }}>ЕСП</div>
            <div style={{ position: 'relative', zIndex: 2, fontFamily: TR.mono, fontSize: 10, letterSpacing: 1, color: A, fontWeight: 600 }}>● ПАРТНЁР</div>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ fontFamily: TR.serif, fontSize: 26, lineHeight: 1.1, marginBottom: 12 }}>Нужна помощь с ЕСП и отчётностью?</div>
              <div style={{ fontFamily: TR.body, fontSize: 13, color: TR.line2, lineHeight: 1.5, marginBottom: 16 }}>
                Бухгалтер на аутсорсе для ИП и ООО. Первый месяц — бесплатно.
              </div>
              <button style={{ width: '100%', fontFamily: TR.body, fontSize: 12, fontWeight: 600, padding: '11px', background: TR.paper, color: TR.ink, border: 'none', cursor: 'pointer' }}>Узнать подробнее →</button>
            </div>
          </div>
          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: TR.mono, fontSize: 10, letterSpacing: 1, color: TR.muted, paddingBottom: 10, borderBottom: `1px solid ${TR.line}`, marginBottom: 8 }}>СОДЕРЖАНИЕ</div>
            {[
              { n: '01', t: 'Что такое ЕНС в 2026', active: true },
              { n: '02', t: 'Уведомления: формат и сроки' },
              { n: '03', t: 'Сверка в личном кабинете' },
              { n: '04', t: 'Если что-то пошло не так' },
              { n: '05', t: 'Чек-лист на май' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 8, padding: '10px 0', borderBottom: i < 4 ? `1px solid ${TR.line}` : 'none', fontSize: 13, color: s.active ? TR.ink : TR.text, fontWeight: s.active ? 600 : 400 }}>
                <span style={{ fontFamily: TR.mono, fontSize: 11, color: s.active ? A : TR.muted }}>{s.n}</span>
                <span>{s.t}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '12px 64px 0 24px' }}>
          <div style={{ maxWidth: 680 }}>
            <p style={{ fontFamily: TR.body, fontSize: 15, lineHeight: 1.75, color: TR.text }}>
              С 2023 года все платежи в бюджет идут через единый налоговый счёт. На бумаге — упрощение. На практике первые два года владельцы малого бизнеса жаловались на потерянные деньги и непредсказуемые штрафы. К 2026 году правила игры стали жёстче: за пропуск уведомления штраф приходит автоматически.
            </p>
            <h2 style={{ fontFamily: TR.display, fontSize: 56, lineHeight: 0.95, letterSpacing: -0.5, margin: '36px 0 18px' }}>
              ЧТО ТАКОЕ ЕНС И ЗАЧЕМ ОН ВООБЩЕ
            </h2>
            <p style={{ fontFamily: TR.body, fontSize: 15, lineHeight: 1.75, color: TR.text, marginBottom: 16 }}>
              ЕНС — виртуальный кошелёк налогоплательщика в ФНС. Все деньги, которые вы перечисляете в бюджет, сначала попадают на этот единый счёт, а потом распределяются между налогами и взносами. Распределяет сама налоговая по приоритетам.
            </p>
            <div style={{ borderTop: `1px solid ${TR.line2}`, marginTop: 18, marginBottom: 24 }}>
              {[
                'Подайте уведомление об исчисленных суммах до 25 числа',
                'Перечислите деньги на ЕНС с правильным КБК до 28 числа',
                'Через 1–3 дня сверьте начисления в личном кабинете',
                'Если что-то расходится — подайте корректирующее уведомление',
              ].map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 12, padding: '14px 0', borderBottom: `1px solid ${TR.line2}`, fontSize: 15, color: TR.text, lineHeight: 1.55 }}>
                  <span>—</span><span>{t}</span>
                </div>
              ))}
            </div>
            <div style={{ background: TR.line, padding: '24px 28px', borderLeft: `4px solid ${TR.ink}`, margin: '28px 0' }}>
              <div style={{ fontFamily: TR.serif, fontStyle: 'italic', fontSize: 24, lineHeight: 1.3 }}>
                «Главное — не количество отчётов, а то, чтобы налоговая знала о тебе ровно столько, сколько нужно».
              </div>
              <div style={{ fontFamily: TR.mono, fontSize: 11, color: TR.muted, marginTop: 14, textTransform: 'uppercase' }}>— АННА Г., БУХГАЛТЕР ИП НА УСН</div>
            </div>
            <h2 style={{ fontFamily: TR.display, fontSize: 56, lineHeight: 0.95, letterSpacing: -0.5, margin: '36px 0 18px' }}>УВЕДОМЛЕНИЯ: ФОРМАТ И СРОКИ</h2>
            <div style={{ marginBottom: 24 }}>
              {[
                { n: '01', t: 'СОБЕРИТЕ СУММЫ', d: 'Откройте бухгалтерскую программу или Excel и выпишите все налоги: УСН, страховые взносы за себя, НДФЛ за сотрудников.' },
                { n: '02', t: 'ОФОРМИТЕ УВЕДОМЛЕНИЕ', d: 'Форма КНД 1110355 — её можно сдать через личный кабинет, оператора ЭДО или на бумаге.' },
                { n: '03', t: 'ОТПРАВЬТЕ ДО 25 ЧИСЛА', d: 'Это критично. Уведомление, поданное 26-го, считается просроченным. Штраф — 200 ₽ за каждый документ.' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 24, padding: '20px 0', borderTop: `1px solid ${TR.line2}` }}>
                  <div style={{ fontFamily: TR.display, fontSize: 80, lineHeight: 0.85, color: TR.line2, letterSpacing: -1 }}>{s.n}</div>
                  <div>
                    <div style={{ fontFamily: TR.display, fontSize: 28, lineHeight: 1, marginBottom: 10 }}>{s.t}</div>
                    <div style={{ fontFamily: TR.body, fontSize: 14, lineHeight: 1.65, color: TR.text }}>{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: TR.mono, fontSize: 10, letterSpacing: 1.5, color: TR.muted, marginTop: 28, marginBottom: 12 }}>ТАБЛ. 01 — ДЕДЛАЙНЫ МАЯ 2026</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `2px solid ${TR.ink}` }}>
                {['ДАТА', 'ЧТО ДЕЛАТЬ', 'КОМУ', 'ШТРАФ ЗА ПРОПУСК'].map((h, i) => (
                  <th key={i} style={{ fontFamily: TR.mono, fontSize: 10, letterSpacing: 1.2, color: TR.muted, textTransform: 'uppercase', textAlign: 'left', padding: '12px 12px 12px 0', fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[
                  ['до 25 мая', 'Уведомление по УСН (Q1)', 'ИП и ООО на УСН', '200 ₽ + пени'],
                  ['до 28 мая', 'Платёж аванса УСН', 'ИП и ООО на УСН', 'пени 1/300 ставки ЦБ'],
                  ['до 25 мая', 'Уведомление по НДФЛ', 'Работодатели', '200 ₽ + блокировка счёта'],
                  ['до 28 мая', 'Страховые взносы', 'Работодатели', 'пени 1/300 ставки ЦБ'],
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${TR.line2}` }}>
                    {row.map((c, j) => (
                      <td key={j} style={{ padding: '14px 12px 14px 0', fontSize: 14, color: j === 0 ? TR.ink : TR.text, fontWeight: j === 0 ? 600 : 400 }}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ background: TR.ink, color: TR.paper, padding: 32, position: 'relative', overflow: 'hidden', margin: '36px 0' }}>
              <div style={{ position: 'absolute', right: -10, top: -40, fontFamily: TR.display, fontSize: 180, color: 'rgba(255,255,255,0.05)', letterSpacing: -4 }}>+1</div>
              <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'end' }}>
                <div>
                  <div style={{ fontFamily: TR.mono, fontSize: 11, letterSpacing: 1.5, color: A, marginBottom: 10, fontWeight: 600 }}>// РАССЫЛКА</div>
                  <div style={{ fontFamily: TR.serif, fontSize: 36, lineHeight: 1.05 }}>Чек-лист на май — в&nbsp;рассылке</div>
                </div>
                <button style={{ fontFamily: TR.body, fontWeight: 600, fontSize: 13, padding: '13px 22px', background: TR.paper, color: TR.ink, border: 'none', cursor: 'pointer' }}>Получить →</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// === V2 — Article alternative — IGNORES THE REFERENCE ====
// Single-column long-form, calm, time-aware. Stripe Press / Monocle.
function ArticleV2Alt() {
  const A = TR.amber;
  return (
    <div style={{ width: 1440, background: TR.white, color: TR.ink, fontFamily: TR.body, paddingBottom: 80 }}>
      <div style={{ height: 3, background: TR.line, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '34%', background: A }} />
      </div>
      <NR accent={A} />

      {/* Centered editorial hero — no split, no decorative giant letters */}
      <div style={{ padding: '80px 80px 40px', maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 14, fontFamily: TR.mono, fontSize: 11, letterSpacing: 1, color: TR.muted, marginBottom: 28 }}>
          <span style={{ color: A, fontWeight: 600 }}>● НАЛОГИ</span>
          <span>·</span>
          <span>29 АПРЕЛЯ 2026</span>
          <span>·</span>
          <RR mins={12} accent={A} />
        </div>
        <div style={{ fontFamily: TR.serif, fontSize: 76, lineHeight: 1.05, letterSpacing: -0.5, color: TR.ink, marginBottom: 28 }}>
          ЕНС, уведомления и&nbsp;дедлайны. Как пройти май без&nbsp;штрафов
        </div>
        <div style={{ fontFamily: TR.serif, fontStyle: 'italic', fontSize: 24, lineHeight: 1.4, color: TR.text, marginBottom: 32 }}>
          Без воды — только то, что нужно сделать в мае: какие платежи в&nbsp;ЕНС не пропустить, какие уведомления подать, и где в&nbsp;личном кабинете лежит сверка.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 20, borderTop: `1px solid ${TR.line}` }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: TR.line }} />
          <div>
            <div style={{ fontFamily: TR.body, fontSize: 14, fontWeight: 600 }}>Ольга Кравец</div>
            <div style={{ fontFamily: TR.body, fontSize: 12, color: TR.muted }}>Редактор раздела «Финансы» · 10 лет в малом бизнесе</div>
          </div>
        </div>
      </div>

      {/* TL;DR card — for the reader who only has 30 sec */}
      <div style={{ padding: '0 80px', maxWidth: 980, margin: '0 auto' }}>
        <div style={{ background: TR.paper2, padding: '28px 32px', borderLeft: `4px solid ${A}`, marginBottom: 40 }}>
          <div style={{ fontFamily: TR.mono, fontSize: 11, letterSpacing: 1.5, color: A, marginBottom: 10, fontWeight: 600 }}>★ ЕСЛИ У ВАС 30 СЕКУНД</div>
          <div style={{ fontFamily: TR.body, fontSize: 16, lineHeight: 1.65, color: TR.text }}>
            <strong style={{ color: TR.ink }}>До 25 мая</strong> — подайте уведомления (форма КНД 1110355). <strong style={{ color: TR.ink }}>До 28 мая</strong> — переведите деньги на ЕНС с КБК. <strong style={{ color: TR.ink }}>До 31 мая</strong> — сверьтесь в ЛК. Пропуск уведомления = штраф 200₽ + автоматические пени.
          </div>
        </div>
      </div>

      {/* Body — single column, generous, with floating TOC on right */}
      <div style={{ padding: '0 80px', display: 'grid', gridTemplateColumns: '1fr 220px', gap: 60, maxWidth: 1280, margin: '0 auto' }}>
        <div>
          <p style={{ fontFamily: TR.body, fontSize: 17, lineHeight: 1.75, color: TR.text, marginBottom: 18 }}>
            <span style={{ fontFamily: TR.serif, fontSize: 64, float: 'left', lineHeight: 0.85, marginRight: 10, marginTop: 6, color: TR.ink }}>С</span>
            2023 года все платежи в бюджет идут через единый налоговый счёт. На бумаге — упрощение. На практике первые два года владельцы малого бизнеса жаловались на потерянные деньги и непредсказуемые штрафы. К 2026 году правила стали жёстче: за пропуск уведомления штраф приходит автоматически.
          </p>
          <h2 style={{ fontFamily: TR.serif, fontSize: 40, lineHeight: 1.1, letterSpacing: -0.3, color: TR.ink, margin: '36px 0 16px' }}>
            Что такое ЕНС и зачем он&nbsp;нужен
          </h2>
          <p style={{ fontFamily: TR.body, fontSize: 16, lineHeight: 1.75, color: TR.text, marginBottom: 24 }}>
            ЕНС — виртуальный кошелёк налогоплательщика в ФНС. Все деньги, которые вы перечисляете в бюджет, сначала попадают на этот единый счёт, а потом распределяются между налогами и взносами по приоритетам: сначала недоимки, потом текущие платежи, потом пени и штрафы.
          </p>

          {/* Clean checklist — better for time-poor reader */}
          <div style={{ background: TR.paper2, padding: '24px 28px', marginBottom: 28 }}>
            <div style={{ fontFamily: TR.mono, fontSize: 11, letterSpacing: 1, color: A, marginBottom: 14, fontWeight: 600 }}>★ ЧЕК-ЛИСТ</div>
            {[
              'Подайте уведомление об исчисленных суммах до 25 числа',
              'Перечислите деньги на ЕНС с правильным КБК до 28 числа',
              'Через 1–3 дня сверьте начисления в ЛК',
              'Если что-то расходится — подайте корректирующее уведомление',
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '10px 0', alignItems: 'flex-start', fontSize: 15, color: TR.text, lineHeight: 1.5 }}>
                <span style={{ width: 16, height: 16, border: `1.5px solid ${TR.ink}`, marginTop: 3, flexShrink: 0 }} />
                <span>{t}</span>
              </div>
            ))}
          </div>

          <div style={{ borderLeft: `3px solid ${A}`, padding: '12px 0 12px 24px', margin: '32px 0' }}>
            <div style={{ fontFamily: TR.serif, fontStyle: 'italic', fontSize: 24, lineHeight: 1.35, color: TR.ink }}>
              «Главное — не количество отчётов, а чтобы налоговая знала о тебе ровно столько, сколько нужно».
            </div>
            <div style={{ fontFamily: TR.body, fontSize: 13, color: TR.muted, marginTop: 10 }}>— Анна Г., бухгалтер ИП на УСН</div>
          </div>

          <h2 style={{ fontFamily: TR.serif, fontSize: 40, lineHeight: 1.1, letterSpacing: -0.3, color: TR.ink, margin: '36px 0 16px' }}>
            Уведомления: формат и&nbsp;сроки
          </h2>
          <p style={{ fontFamily: TR.body, fontSize: 16, lineHeight: 1.75, color: TR.text, marginBottom: 24 }}>
            Уведомление — короткий документ: «вот столько денег я плачу, и вот это — какие налоги». Без уведомления платёж просто зависнет на ЕНС, а налоги — числятся неуплаченными.
          </p>

          {/* Steps — simple numbered cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {[
              { t: 'Соберите суммы', d: 'Выпишите налоги: УСН, страховые взносы, НДФЛ за сотрудников.' },
              { t: 'Оформите уведомление', d: 'Форма КНД 1110355 — через ЛК, оператора ЭДО или на бумаге.' },
              { t: 'Отправьте до 25 числа', d: 'Это критично. 26-го — уже просрочено. Штраф 200 ₽ за документ.' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 18, padding: 20, background: TR.paper, alignItems: 'baseline' }}>
                <div style={{ fontFamily: TR.serif, fontSize: 36, color: A, lineHeight: 1 }}>0{i+1}</div>
                <div>
                  <div style={{ fontFamily: TR.serif, fontSize: 22, color: TR.ink, marginBottom: 4 }}>{s.t}</div>
                  <div style={{ fontFamily: TR.body, fontSize: 14, color: TR.text, lineHeight: 1.55 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Table — minimal */}
          <div style={{ fontFamily: TR.mono, fontSize: 10, letterSpacing: 1.5, color: TR.muted, marginTop: 32, marginBottom: 12 }}>ТАБЛ. 01 — ДЕДЛАЙНЫ МАЯ</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `2px solid ${TR.ink}` }}>
              {['ДАТА', 'ЧТО ДЕЛАТЬ', 'ШТРАФ'].map((h, i) => (
                <th key={i} style={{ fontFamily: TR.mono, fontSize: 10, letterSpacing: 1.2, color: TR.muted, textAlign: 'left', padding: '12px 12px 12px 0', fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[
                ['до 25 мая', 'Уведомления (УСН, НДФЛ)', '200 ₽ + пени'],
                ['до 28 мая', 'Платежи на ЕНС', 'пени 1/300'],
                ['до 31 мая', 'Сверка в ЛК', '—'],
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${TR.line}` }}>
                  {row.map((c, j) => (
                    <td key={j} style={{ padding: '14px 12px 14px 0', fontSize: 15, color: j === 0 ? TR.ink : TR.text, fontWeight: j === 0 ? 600 : 400 }}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Restrained CTA — text + arrow, no big black box */}
          <div style={{ marginTop: 44, padding: '32px 0', borderTop: `1px solid ${TR.line}`, borderBottom: `1px solid ${TR.line}` }}>
            <div style={{ fontFamily: TR.mono, fontSize: 11, letterSpacing: 1.5, color: A, marginBottom: 8, fontWeight: 600 }}>// РАССЫЛКА</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontFamily: TR.serif, fontSize: 32, lineHeight: 1.1, maxWidth: 540 }}>
                Чек-лист на май и&nbsp;шаблоны уведомлений — в&nbsp;письме в&nbsp;четверг.
              </div>
              <button style={{ fontFamily: TR.body, fontSize: 14, fontWeight: 600, padding: '12px 22px', background: TR.ink, color: TR.paper, border: 'none', cursor: 'pointer' }}>Подписаться →</button>
            </div>
          </div>
        </div>

        {/* Right rail — sticky, minimal */}
        <div style={{ paddingTop: 4 }}>
          <div style={{ position: 'sticky', top: 24 }}>
            <div style={{ fontFamily: TR.mono, fontSize: 10, letterSpacing: 1.2, color: TR.muted, marginBottom: 14 }}>СОДЕРЖАНИЕ</div>
            {[
              { t: 'Что такое ЕНС', active: true },
              { t: 'Уведомления: формат' },
              { t: 'Сверка в ЛК' },
              { t: 'Если ошибка' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '8px 12px', fontSize: 13, lineHeight: 1.4,
                color: s.active ? TR.ink : TR.text, fontWeight: s.active ? 600 : 400,
                borderLeft: s.active ? `2px solid ${A}` : `2px solid transparent`,
                marginLeft: -12,
              }}>{s.t}</div>
            ))}
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${TR.line}`, fontFamily: TR.mono, fontSize: 10, letterSpacing: 1, color: TR.muted, marginBottom: 10 }}>ВАМ ТАКЖЕ ПОНРАВИТСЯ</div>
            <div style={{ fontFamily: TR.serif, fontSize: 16, lineHeight: 1.25, marginBottom: 4 }}>Как читать выписку из ЕНС</div>
            <div style={{ fontFamily: TR.mono, fontSize: 10, color: TR.muted }}>6 МИН · О. КРАВЕЦ</div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ArticlesV2 = ArticlesV2;
window.ArticleV2 = ArticleV2;
window.ArticleV2Alt = ArticleV2Alt;
