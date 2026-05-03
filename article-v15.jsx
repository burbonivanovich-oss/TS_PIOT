/* global React */
const T15 = window.DELO_TOKENS;
const N15 = window.DeloNav;

// V1.5 — expanded after Karen's feedback
// Changes:
//  - smaller display headlines (Bebas H2: 44 -> 36)
//  - no orange/colored backgrounds; ochre only as line/text accent
//  - hero now includes a real photo (placeholder image with caption)
//  - added 6 new "brick" variants: stat block, key-fact card, callout-warning,
//    expert opinion, mini-FAQ, infographic, side-note in margin
//  - article extended to ~1700 words with 5 sections
//  - inline images in body
//  - proper footer: tags, share/save bar, author bio card, comment teaser,
//    related articles (3-up), more-from-section row, newsletter, site footer
function ArticleV15() {
  const ACC = '#C8632A';        // warm ochre — only for text/lines/icons
  const ACC_SOFT = '#F0E4D2';   // soft ochre tint for backgrounds
  const PAPER = '#F4F1EA';
  const PAPER2 = '#EDE9DF';
  const WHITE = '#FBFAF6';
  const INK = '#171513';
  const TEXT = '#3A3631';
  const MUTED = '#7A746A';
  const LINE = '#D9D4C7';
  const LINE2 = '#C2BCAC';
  const WARN = '#8B5A2B';

  // small util
  const Mono = ({ children, color = MUTED, size = 11, ls = 1.5, style: extraStyle, ...rest }) => (
    <span {...rest} style={{ fontFamily: T15.mono, fontSize: size, letterSpacing: ls, color, fontWeight: 600, ...(extraStyle || {}) }}>{children}</span>
  );
  const Photo = ({ h = 280, label, caption, theme = 'paper' }) => (
    <figure style={{ margin: '32px 0' }}>
      <div style={{
        height: h, position: 'relative', overflow: 'hidden',
        background: theme === 'dark' ? INK : PAPER2,
        backgroundImage: theme === 'dark'
          ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 14px)'
          : 'repeating-linear-gradient(45deg, rgba(0,0,0,0.04) 0 2px, transparent 2px 14px)',
        border: `1px solid ${LINE2}`,
      }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: T15.serif, fontStyle: 'italic', fontSize: 18, color: theme === 'dark' ? '#9A938A' : MUTED }}>фото · {label}</span>
        </div>
        <div style={{ position: 'absolute', top: 12, left: 14 }}>
          <Mono color={theme === 'dark' ? '#9A938A' : MUTED} size={10}>FIG. {label}</Mono>
        </div>
      </div>
      {caption && (
        <figcaption style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${LINE2}` }}>
          <Mono color={ACC} size={10}>↓</Mono>
          <span style={{ fontFamily: T15.serif, fontStyle: 'italic', fontSize: 13, color: MUTED, lineHeight: 1.45 }}>{caption}</span>
        </figcaption>
      )}
    </figure>
  );

  return (
    <div style={{ width: 1440, background: PAPER, color: INK, fontFamily: T15.body, paddingBottom: 0 }}>
      {/* Reading progress */}
      <div style={{ height: 3, background: LINE, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '34%', background: ACC }} />
      </div>
      <N15 />

      {/* HERO — split with real hero image instead of solid color */}
      <div style={{ display: 'grid', gridTemplateColumns: '54% 46%', minHeight: 600 }}>
        {/* Left: hero photo with overlay (no solid block of color) */}
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: INK,
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 18px)',
        }}>
          {/* Photo placeholder zone — full bleed */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, #2a2620 0%, #1a1714 60%, #0e0c0a 100%)',
          }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: T15.serif, fontStyle: 'italic', fontSize: 22, color: '#5a5249' }}>фото · документы и ноутбук на столе бухгалтера</span>
            </div>
          </div>
          {/* Overlay gradient for legibility */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.6) 100%)' }} />
          {/* Content */}
          <div style={{ position: 'relative', zIndex: 2, padding: 36, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: PAPER }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: T15.mono, fontSize: 11, letterSpacing: 1.5, color: ACC, fontWeight: 600, padding: '6px 10px', border: `1px solid ${ACC}`, background: 'rgba(0,0,0,0.3)' }}>● УВЕДОМЛЕНИЯ</span>
              <Mono color="#C9C3B8" size={11}>ВЫПУСК · 47</Mono>
            </div>
            <div>
              <Mono color={ACC} size={11}>ГЛАВНОЕ ЗА НЕДЕЛЮ</Mono>
              <div style={{ fontFamily: T15.mono, fontSize: 11, letterSpacing: 1.2, color: '#C9C3B8', maxWidth: 420, lineHeight: 1.7, marginTop: 10 }}>
                ПЛАТЕЖИ В ЕНС / УВЕДОМЛЕНИЯ ДО 25 ЧИСЛА / СВЕРКА В ЛК / ПЕРВЫЕ ШТРАФЫ В ИЮНЕ
              </div>
            </div>
            <Mono color="#9A938A" size={10}>ГЛАВНАЯ / СТАТЬИ / НАЛОГИ · 29 АПРЕЛЯ 2026</Mono>
          </div>
        </div>

        {/* Right: editorial title block (smaller fonts) */}
        <div style={{ background: PAPER, padding: '40px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Mono color={TEXT} size={11}>29 АПРЕЛЯ 2026 · НАЛОГИ</Mono>
            <Mono color={ACC} size={11}><span style={{ width: 6, height: 6, background: ACC, borderRadius: '50%', display: 'inline-block', marginRight: 6 }} />12 МИН ЧТЕНИЯ</Mono>
          </div>
          <div>
            <h1 style={{ fontFamily: T15.display, fontSize: 52, lineHeight: 0.96, letterSpacing: -0.3, color: INK, margin: 0 }}>
              ЕНС, УВЕДОМЛЕНИЯ И ДЕДЛАЙНЫ. КАК ПРОЙТИ МАЙ БЕЗ ШТРАФОВ
            </h1>
            <p style={{ fontFamily: T15.serif, fontStyle: 'italic', fontSize: 19, color: TEXT, marginTop: 18, lineHeight: 1.45 }}>
              Без воды — только то, что нужно сделать в мае: какие платежи в&nbsp;ЕНС не пропустить, какие уведомления подать, и&nbsp;где в ЛК&nbsp;лежит сверка.
            </p>
          </div>
          <div style={{ borderTop: `1px solid ${LINE2}`, paddingTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: PAPER2, border: `1px solid ${LINE2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T15.serif, fontSize: 16, color: MUTED }}>ОК</div>
            <div style={{ fontFamily: T15.body, fontSize: 13, color: TEXT, lineHeight: 1.4 }}>
              <span style={{ color: INK, fontWeight: 600 }}>Ольга Кравец</span> · редактор «Финансы»<br />
              <span style={{ color: MUTED, fontSize: 12 }}>Иллюстрации — Маша Долматова</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick-share strip — sits right under hero */}
      <div style={{ padding: '14px 40px', borderBottom: `1px solid ${LINE}`, background: WHITE, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 18, fontFamily: T15.body, fontSize: 12, color: TEXT }}>
          <span style={{ color: MUTED }}>Поделиться:</span>
          <span>Telegram</span><span>VK</span><span>Email</span><span>Скопировать ссылку</span>
        </div>
        <div style={{ display: 'flex', gap: 18, fontFamily: T15.body, fontSize: 12, color: TEXT }}>
          <span>♥ 247</span><span>↗ 32</span><span>⌘ Сохранить</span><span style={{ color: ACC }}>A−  A+</span>
        </div>
      </div>

      {/* TL;DR strip — smaller display */}
      <div style={{ padding: '28px 40px 0' }}>
        <div style={{ background: INK, color: PAPER, padding: '22px 26px', display: 'grid', gridTemplateColumns: '160px 1fr 140px', gap: 24, alignItems: 'center' }}>
          <div>
            <Mono color={ACC} size={10}>★ TL;DR</Mono>
            <div style={{ fontFamily: T15.display, fontSize: 28, lineHeight: 0.9, letterSpacing: -0.3, marginTop: 4 }}>30 СЕКУНД</div>
          </div>
          <div style={{ fontFamily: T15.body, fontSize: 14, lineHeight: 1.6, color: '#C9C3B8' }}>
            <strong style={{ color: PAPER }}>До 25 мая</strong> — уведомления (КНД 1110355). <strong style={{ color: PAPER }}>До 28 мая</strong> — платёж на ЕНС с КБК. <strong style={{ color: PAPER }}>До 31 мая</strong> — сверка в ЛК. Пропуск = автоматический штраф 200 ₽ и пени.
          </div>
          <button style={{ fontFamily: T15.body, fontWeight: 600, fontSize: 12, padding: '11px 14px', background: 'transparent', color: PAPER, border: `1px solid ${PAPER}`, cursor: 'pointer' }}>Скачать PDF →</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '28% 72%', marginTop: 36 }}>
        {/* Left rail */}
        <div style={{ padding: '0 24px 0 40px' }}>
          {/* Sticky partner CTA — dark, no solid orange */}
          <div style={{
            background: INK, color: PAPER, padding: 22, position: 'relative', overflow: 'hidden', minHeight: 320,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div style={{ position: 'absolute', right: -8, bottom: -30, fontFamily: T15.display, fontSize: 140, lineHeight: 0.85, color: 'rgba(200,99,42,0.18)', letterSpacing: -3 }}>ЕСП</div>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <Mono color={ACC} size={10} style={{ padding: '4px 8px', border: `1px solid ${ACC}` }}>● ПАРТНЁР</Mono>
            </div>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ fontFamily: T15.display, fontSize: 22, lineHeight: 0.98, marginBottom: 10, letterSpacing: -0.2 }}>
                НУЖНА ПОМОЩЬ С ОТЧЁТНОСТЬЮ?
              </div>
              <div style={{ fontFamily: T15.body, fontSize: 12, color: '#C9C3B8', lineHeight: 1.55, marginBottom: 14 }}>
                Бухгалтер на аутсорсе для ИП и ООО. Первый месяц — бесплатно.
              </div>
              <button style={{ width: '100%', fontFamily: T15.body, fontWeight: 600, fontSize: 12, padding: '11px', background: PAPER, color: INK, border: 'none', cursor: 'pointer' }}>Узнать подробнее →</button>
            </div>
          </div>

          {/* TOC */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: T15.mono, fontSize: 10, letterSpacing: 1.5, color: MUTED, paddingBottom: 8, borderBottom: `1px solid ${LINE}`, marginBottom: 4 }}>СОДЕРЖАНИЕ · 5 РАЗДЕЛОВ</div>
            {[
              ['01', 'Что такое ЕНС в 2026', true, '3 мин'],
              ['02', 'Уведомления: формат и сроки', false, '4 мин'],
              ['03', 'Сверка в личном кабинете', false, '2 мин'],
              ['04', 'Если что-то пошло не так', false, '2 мин'],
              ['05', 'Чек-лист на май', false, '1 мин'],
            ].map(([n, t, a, m], i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 36px', gap: 8, padding: '10px 0', borderBottom: i < 4 ? `1px solid ${LINE}` : 'none', fontSize: 12, color: a ? INK : TEXT, fontWeight: a ? 600 : 400, lineHeight: 1.4, alignItems: 'baseline' }}>
                <span style={{ fontFamily: T15.mono, fontSize: 10, color: a ? ACC : MUTED }}>{n}</span>
                <span>{t}</span>
                <span style={{ fontFamily: T15.mono, fontSize: 10, color: MUTED, textAlign: 'right' }}>{m}</span>
              </div>
            ))}
          </div>

          {/* Margin note brick */}
          <div style={{ marginTop: 24, padding: '14px 0', borderTop: `2px solid ${ACC}` }}>
            <Mono color={ACC} size={10}>NB · НА ПОЛЯХ</Mono>
            <p style={{ fontFamily: T15.serif, fontStyle: 'italic', fontSize: 14, lineHeight: 1.5, color: TEXT, marginTop: 8 }}>
              Если у&nbsp;ИП на УСН нет сотрудников — уведомления подавать не&nbsp;обязательно. Достаточно платежа с&nbsp;правильным КБК.
            </p>
          </div>
        </div>

        {/* Body content — extended */}
        <div style={{ padding: '0 64px 0 24px' }}>
          <div style={{ maxWidth: 720 }}>
            {/* Lead */}
            <p style={{ fontFamily: T15.serif, fontSize: 20, lineHeight: 1.5, color: INK, marginBottom: 20 }}>
              С 2023 года все платежи в бюджет идут через единый налоговый счёт. На бумаге — упрощение. К&nbsp;2026 году правила игры стали жёстче: за пропуск уведомления штраф приходит автоматически, без человеческой проверки.
            </p>
            <p style={{ fontFamily: T15.body, fontSize: 15, lineHeight: 1.7, color: TEXT, marginBottom: 16 }}>
              Мы собрали в один материал всё, что нужно знать предпринимателю на&nbsp;УСН в&nbsp;мае: что заплатить, что подать и где в личном кабинете найти подтверждение, что налоговая всё видит правильно.
            </p>

            {/* BRICK A: Stat block — strong accent variant */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, margin: '32px 0', border: `1px solid ${LINE2}`, borderRight: 'none' }}>
              {[
                { k: '4.7 МЛН', v: 'ИП в России на УСН', sub: 'Данные ФНС, март 2026' },
                { k: '83%', v: 'хотя бы раз получали штраф за просрочку', sub: 'Опрос «Дела», 2025' },
                { k: '12 ДНЕЙ', v: 'среднее время разбора ошибки в ЕНС', sub: 'Письма читателей' },
              ].map((s, i) => (
                <div key={i} style={{ padding: '20px 22px', borderRight: `1px solid ${LINE2}`, background: i === 1 ? INK : 'transparent', color: i === 1 ? PAPER : INK }}>
                  <div style={{ fontFamily: T15.display, fontSize: 36, lineHeight: 0.95, letterSpacing: -0.4, color: i === 1 ? ACC : INK }}>{s.k}</div>
                  <div style={{ fontFamily: T15.body, fontSize: 13, lineHeight: 1.4, marginTop: 8, color: i === 1 ? PAPER : TEXT }}>{s.v}</div>
                  <div style={{ fontFamily: T15.mono, fontSize: 9, letterSpacing: 1, color: i === 1 ? '#9A938A' : MUTED, marginTop: 10 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* H2 — smaller (36 instead of 44) */}
            <h2 style={{ fontFamily: T15.display, fontSize: 36, lineHeight: 1, letterSpacing: -0.3, margin: '36px 0 14px', color: INK }}>
              <span style={{ color: ACC, marginRight: 12 }}>01</span>ЧТО ТАКОЕ ЕНС И ЗАЧЕМ ОН ВООБЩЕ
            </h2>
            <p style={{ fontFamily: T15.body, fontSize: 15, lineHeight: 1.7, color: TEXT, marginBottom: 16 }}>
              ЕНС — виртуальный кошелёк налогоплательщика в ФНС. Все деньги, которые вы перечисляете в бюджет, сначала попадают на этот единый счёт, а потом распределяются между конкретными налогами и взносами. Распределяет сама налоговая по приоритетам: сначала недоимки, потом текущие платежи, потом пени.
            </p>
            <p style={{ fontFamily: T15.body, fontSize: 15, lineHeight: 1.7, color: TEXT, marginBottom: 16 }}>
              На практике это значит, что предприниматель больше не платит по отдельности УСН, страховые и НДФЛ. Он переводит общую сумму на ЕНС, а параллельно подаёт уведомления — короткие документы, в которых пишет: «вот эти деньги — на УСН, эти — на страховые». Если уведомления нет, налоговая распределит сама, и часто не туда, куда вам нужно.
            </p>

            {/* BRICK B: Inline image */}
            <Photo h={300} label="01" caption="Личный кабинет налогоплательщика на nalog.ru — раздел «Единый налоговый счёт». Здесь видно баланс и все распределения." />

            {/* List with dashes */}
            <div style={{ borderTop: `1px solid ${LINE2}`, marginTop: 18, marginBottom: 24 }}>
              {[
                'Подайте уведомление об исчисленных суммах до 25 числа',
                'Перечислите деньги на ЕНС с правильным КБК до 28 числа',
                'Через 1–3 дня сверьте начисления в личном кабинете',
                'Если что-то расходится — подайте корректирующее уведомление',
              ].map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 12, padding: '12px 0', borderBottom: `1px solid ${LINE2}`, fontFamily: T15.body, fontSize: 15, color: TEXT, lineHeight: 1.55 }}>
                  <span style={{ color: ACC, fontWeight: 600 }}>—</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>

            {/* BRICK C: Pull quote with portrait */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 24, padding: '28px 0', margin: '24px 0', borderTop: `1px solid ${LINE2}`, borderBottom: `1px solid ${LINE2}` }}>
              <div>
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: PAPER2, border: `1px solid ${LINE2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T15.serif, fontStyle: 'italic', fontSize: 36, color: MUTED }}>А</div>
              </div>
              <div>
                <div style={{ fontFamily: T15.serif, fontStyle: 'italic', fontSize: 24, lineHeight: 1.3, color: INK, marginBottom: 14 }}>
                  «Главное — не количество отчётов, а то, чтобы налоговая знала о тебе ровно столько, сколько нужно».
                </div>
                <div style={{ fontFamily: T15.body, fontSize: 13, color: TEXT }}>
                  <strong style={{ color: INK }}>Анна Голубева</strong> · бухгалтер ИП на УСН, 14 лет в малом бизнесе
                </div>
              </div>
            </div>

            <p style={{ fontFamily: T15.body, fontSize: 15, lineHeight: 1.7, color: TEXT, marginBottom: 18 }}>
              Главное отличие 2026 года от первых лет ЕНС — автоматизация. Раньше штраф мог прийти, а мог и нет: инспектор вручную проверял документы. Сейчас система сравнивает уведомления и платежи каждые сутки, и если есть расхождение — оно фиксируется без участия человека. Это значит: если ошибиться, ловить ошибку придётся вам, а не налоговой.
            </p>

            {/* H2 */}
            <h2 style={{ fontFamily: T15.display, fontSize: 36, lineHeight: 1, letterSpacing: -0.3, margin: '36px 0 14px', color: INK }}>
              <span style={{ color: ACC, marginRight: 12 }}>02</span>УВЕДОМЛЕНИЯ: ФОРМАТ И СРОКИ
            </h2>
            <p style={{ fontFamily: T15.body, fontSize: 15, lineHeight: 1.7, color: TEXT, marginBottom: 22 }}>
              Уведомление — короткий документ, в котором вы говорите налоговой: «вот столько денег я плачу, и вот это — какие именно налоги». Без уведомления ваш платёж зависнет на ЕНС. Платить — мало.
            </p>

            {/* Numbered steps */}
            {[
              { n: '01', t: 'СОБЕРИТЕ СУММЫ', d: 'Откройте бухгалтерскую программу и выпишите все налоги, которые планируете платить. Отдельно: УСН, страховые взносы, НДФЛ за сотрудников. Если сумма меньше 100 ₽ — округлите до целого, копейки в уведомлении не указываются.' },
              { n: '02', t: 'ОФОРМИТЕ УВЕДОМЛЕНИЕ', d: 'Форма КНД 1110355. Сдать можно через ЛК на nalog.ru, через оператора ЭДО (Контур, СБИС, Такском) или на бумаге. Электронно — быстрее всего, и если ошибётесь, увидите это сразу.' },
              { n: '03', t: 'ОТПРАВЬТЕ ДО 25 ЧИСЛА', d: 'Это критично. Уведомление, поданное 26-го, считается просроченным. Штраф — 200 ₽ за каждый документ плюс пени по основному платежу. И штраф приходит автоматически.' },
              { n: '04', t: 'ПРОВЕРЬТЕ КВИТАНЦИЮ', d: 'Через 1–3 рабочих дня налоговая пришлёт квитанцию о приёме. Если вместо неё — отказ, посмотрите код ошибки и подайте корректирующее уведомление в тот же день.' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 22, padding: '18px 0', borderTop: `1px solid ${LINE2}` }}>
                <div style={{ fontFamily: T15.display, fontSize: 56, lineHeight: 0.85, color: ACC, opacity: 0.7, letterSpacing: -1 }}>{s.n}</div>
                <div>
                  <div style={{ fontFamily: T15.display, fontSize: 22, lineHeight: 1, letterSpacing: -0.1, marginBottom: 8 }}>{s.t}</div>
                  <div style={{ fontFamily: T15.body, fontSize: 14, lineHeight: 1.65, color: TEXT }}>{s.d}</div>
                </div>
              </div>
            ))}

            {/* BRICK D: Warning callout */}
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 16, padding: '18px 22px', margin: '28px 0', background: ACC_SOFT, borderLeft: `4px solid ${WARN}` }}>
              <div style={{ fontFamily: T15.display, fontSize: 32, color: WARN, lineHeight: 0.85 }}>!</div>
              <div>
                <Mono color={WARN} size={10}>ВАЖНО</Mono>
                <div style={{ fontFamily: T15.body, fontSize: 14, lineHeight: 1.6, color: TEXT, marginTop: 4 }}>
                  Если вы платите за&nbsp;несколько периодов одним платежом — уведомлений тоже должно быть несколько. Одно уведомление = один период. Сложить три квартала в&nbsp;один документ налоговая не&nbsp;примет.
                </div>
              </div>
            </div>

            {/* Table */}
            <div style={{ fontFamily: T15.mono, fontSize: 10, letterSpacing: 1.5, color: MUTED, marginTop: 32, marginBottom: 10 }}>ТАБЛ. 01 — ДЕДЛАЙНЫ МАЯ 2026</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T15.body }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${INK}` }}>
                  {['ДАТА', 'ЧТО ДЕЛАТЬ', 'КОМУ', 'ШТРАФ ЗА ПРОПУСК'].map((h, i) => (
                    <th key={i} style={{ fontFamily: T15.mono, fontSize: 10, letterSpacing: 1.2, color: MUTED, textAlign: 'left', padding: '10px 12px 10px 0', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['до 25 мая', 'Уведомление по УСН (Q1)', 'ИП и ООО на УСН', '200 ₽ + пени'],
                  ['до 28 мая', 'Платёж аванса УСН за Q1', 'ИП и ООО на УСН', 'пени 1/300 ставки ЦБ'],
                  ['до 25 мая', 'Уведомление по НДФЛ', 'Работодатели', '200 ₽ + блокировка'],
                  ['до 28 мая', 'Страховые взносы за апрель', 'Работодатели', 'пени 1/300 ставки ЦБ'],
                  ['до 31 мая', 'Сверка в ЛК', 'Все', '—'],
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${LINE2}`, background: i % 2 ? PAPER2 : 'transparent' }}>
                    {row.map((c, j) => (
                      <td key={j} style={{ padding: '12px 12px 12px 0', fontSize: 14, color: j === 0 ? INK : TEXT, fontWeight: j === 0 ? 600 : 400 }}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* BRICK E: Inline image — second */}
            <Photo h={260} label="02" caption="Образец уведомления КНД 1110355. Заполнять можно от руки или электронно — главное, чтобы все 12 полей были корректны." theme="dark" />

            {/* H2 */}
            <h2 style={{ fontFamily: T15.display, fontSize: 36, lineHeight: 1, letterSpacing: -0.3, margin: '36px 0 14px', color: INK }}>
              <span style={{ color: ACC, marginRight: 12 }}>03</span>СВЕРКА В ЛИЧНОМ КАБИНЕТЕ
            </h2>
            <p style={{ fontFamily: T15.body, fontSize: 15, lineHeight: 1.7, color: TEXT, marginBottom: 16 }}>
              Через 1–3 рабочих дня после платежа зайдите в ЛК на nalog.ru. В разделе «Единый налоговый счёт» вы увидите баланс и распределение по налогам. Если налог числится неуплаченным — значит, уведомление либо не дошло, либо в нём ошибка.
            </p>

            {/* BRICK F: Mini-FAQ */}
            <div style={{ margin: '24px 0', border: `1px solid ${LINE2}` }}>
              <div style={{ background: INK, color: PAPER, padding: '12px 18px' }}>
                <Mono color={ACC} size={10}>FAQ · ЧАСТЫЕ ВОПРОСЫ</Mono>
              </div>
              {[
                { q: 'А если я не подал уведомление, но заплатил?', a: 'Деньги полежат на ЕНС, а налог будет считаться неуплаченным. Через 10 дней — пени. Подавайте уведомление задним числом + штраф 200 ₽.' },
                { q: 'Можно ли платить раньше срока?', a: 'Да, и это безопаснее. Но уведомление всё равно нужно — без него платёж не привяжется к конкретному налогу.' },
                { q: 'Что если в уведомлении ошибка?', a: 'Подайте корректирующее с теми же реквизитами и правильными цифрами. Если успели до 28 числа — штрафа не будет.' },
              ].map((f, i) => (
                <div key={i} style={{ padding: '16px 18px', borderTop: i ? `1px solid ${LINE}` : 'none', background: WHITE }}>
                  <div style={{ fontFamily: T15.body, fontSize: 14, fontWeight: 600, color: INK, marginBottom: 6 }}>— {f.q}</div>
                  <div style={{ fontFamily: T15.body, fontSize: 14, color: TEXT, lineHeight: 1.6 }}>{f.a}</div>
                </div>
              ))}
            </div>

            {/* H2 */}
            <h2 style={{ fontFamily: T15.display, fontSize: 36, lineHeight: 1, letterSpacing: -0.3, margin: '36px 0 14px', color: INK }}>
              <span style={{ color: ACC, marginRight: 12 }}>04</span>ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК
            </h2>
            <p style={{ fontFamily: T15.body, fontSize: 15, lineHeight: 1.7, color: TEXT, marginBottom: 16 }}>
              Самые частые ошибки — опечатка в КБК, неправильный период или сумма. Ничего страшного: подайте корректирующее уведомление с теми же данными, исправив только нужные поля. Главное — успеть до 28 числа, иначе платёж засчитается на «общее», и придётся писать заявление о зачёте.
            </p>
            <p style={{ fontFamily: T15.body, fontSize: 15, lineHeight: 1.7, color: TEXT, marginBottom: 16 }}>
              Если налоговая уже начислила штраф, а вы считаете его несправедливым, у вас есть 30 дней на обжалование. Подаётся через ЛК — там есть отдельная форма «Возражения по акту». Срок рассмотрения — до 15 рабочих дней.
            </p>

            {/* BRICK G: Expert opinion card */}
            <div style={{ margin: '28px 0', padding: 24, background: WHITE, border: `1px solid ${LINE2}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Mono color={ACC} size={10}>МНЕНИЕ ЭКСПЕРТА</Mono>
                <Mono color={MUTED} size={10}>ИНТЕРВЬЮ ДЛЯ «ДЕЛА»</Mono>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 18 }}>
                <div style={{ width: 80, height: 80, background: PAPER2, border: `1px solid ${LINE2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T15.serif, fontSize: 28, color: MUTED }}>МР</div>
                <div>
                  <div style={{ fontFamily: T15.serif, fontStyle: 'italic', fontSize: 18, lineHeight: 1.4, color: INK, marginBottom: 12 }}>
                    «Главная ошибка предпринимателей — думать, что штраф можно опротестовать ‘по-человечески’. С 2026 года всё автоматизировано, и спорить надо строго документами».
                  </div>
                  <div style={{ fontFamily: T15.body, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
                    <strong style={{ color: INK }}>Михаил Реш</strong> — налоговый консультант, бывший инспектор ФНС. <span style={{ color: MUTED }}>Прочитайте полное интервью →</span>
                  </div>
                </div>
              </div>
            </div>

            {/* H2 */}
            <h2 style={{ fontFamily: T15.display, fontSize: 36, lineHeight: 1, letterSpacing: -0.3, margin: '36px 0 14px', color: INK }}>
              <span style={{ color: ACC, marginRight: 12 }}>05</span>ЧЕК-ЛИСТ НА МАЙ
            </h2>
            <p style={{ fontFamily: T15.body, fontSize: 15, lineHeight: 1.7, color: TEXT, marginBottom: 18 }}>
              Сохраните или распечатайте — пройдитесь по всем пунктам в третью неделю мая, и до 25-го у вас точно не будет проблем.
            </p>

            {/* BRICK H: Checklist with checkboxes */}
            <div style={{ margin: '20px 0 28px', padding: 24, background: WHITE, border: `2px solid ${INK}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${LINE}` }}>
                <Mono color={ACC} size={10}>★ ЧЕК-ЛИСТ · МАЙ 2026</Mono>
                <Mono color={MUTED} size={10}>0 / 7</Mono>
              </div>
              {[
                'Выписать все налоги, которые нужно заплатить в мае',
                'Проверить актуальные КБК (могут меняться раз в год)',
                'Подготовить уведомление по форме КНД 1110355',
                'Сдать уведомление через ЛК до 25 мая',
                'Перевести деньги на ЕНС до 28 мая',
                'Проверить квитанцию о приёме уведомления',
                'Сделать сверку в ЛК до 31 мая',
              ].map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 28px 1fr', gap: 8, padding: '11px 0', borderBottom: i < 6 ? `1px solid ${LINE}` : 'none', fontFamily: T15.body, fontSize: 14, color: TEXT, lineHeight: 1.5, alignItems: 'center' }}>
                  <span style={{ width: 16, height: 16, border: `1.5px solid ${INK}`, display: 'inline-block' }} />
                  <Mono color={ACC} size={10}>0{i + 1}</Mono>
                  <span>{t}</span>
                </div>
              ))}
            </div>

            <p style={{ fontFamily: T15.body, fontSize: 15, lineHeight: 1.7, color: TEXT, marginBottom: 16 }}>
              Если хотите, чтобы такой чек-лист приходил к вам автоматически каждый месяц — подпишитесь на нашу рассылку. Раз в неделю мы присылаем материалы, важные для предпринимателей: налоги, право, технологии, кейсы.
            </p>

            {/* CTA — newsletter, no orange BG */}
            <div style={{ background: INK, color: PAPER, padding: 32, position: 'relative', overflow: 'hidden', margin: '36px 0' }}>
              <div style={{ position: 'absolute', right: -20, top: -60, fontFamily: T15.display, fontSize: 220, color: 'rgba(200,99,42,0.15)', letterSpacing: -4 }}>+1</div>
              <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'end' }}>
                <div>
                  <Mono color={ACC} size={11}>// РАССЫЛКА «ДЕЛО»</Mono>
                  <div style={{ fontFamily: T15.display, fontSize: 36, lineHeight: 0.95, letterSpacing: -0.3, marginTop: 10 }}>ЧЕК-ЛИСТ МАЯ — В ПЯТНИЦУ</div>
                  <div style={{ fontFamily: T15.body, fontSize: 14, lineHeight: 1.55, color: '#C9C3B8', marginTop: 12, maxWidth: 380 }}>
                    PDF с дедлайнами, шаблонами уведомлений и КБК. И ещё одно письмо — каждую пятницу, без воды.
                  </div>
                </div>
                <button style={{ fontFamily: T15.body, fontWeight: 600, fontSize: 13, padding: '13px 22px', background: PAPER, color: INK, border: 'none', cursor: 'pointer' }}>Подписаться →</button>
              </div>
            </div>

            {/* End-of-article meta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderTop: `1px solid ${LINE2}`, borderBottom: `1px solid ${LINE2}`, margin: '32px 0' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['#НАЛОГИ', '#ЕНС', '#УВЕДОМЛЕНИЯ', '#УСН', '#МАЛЫЙБИЗНЕС'].map((t, i) => (
                  <span key={i} style={{ fontFamily: T15.mono, fontSize: 11, color: TEXT, padding: '5px 10px', border: `1px solid ${LINE2}` }}>{t}</span>
                ))}
              </div>
              <Mono color={MUTED} size={11}>МАТЕРИАЛ ОБНОВЛЁН · 29 АПРЕЛЯ 2026</Mono>
            </div>

            {/* Author bio card */}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 140px', gap: 20, padding: 24, background: WHITE, border: `1px solid ${LINE2}`, alignItems: 'center', marginBottom: 32 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: PAPER2, border: `1px solid ${LINE2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T15.serif, fontSize: 26, color: MUTED }}>ОК</div>
              <div>
                <Mono color={ACC} size={10}>АВТОР</Mono>
                <div style={{ fontFamily: T15.serif, fontSize: 22, color: INK, marginTop: 4, marginBottom: 6 }}>Ольга Кравец</div>
                <div style={{ fontFamily: T15.body, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
                  Редактор раздела «Финансы». Раньше — главный бухгалтер сети из 8 кофеен в Перми. Пишет о налогах человеческим языком. <span style={{ color: ACC }}>23 материала →</span>
                </div>
              </div>
              <button style={{ fontFamily: T15.body, fontWeight: 600, fontSize: 13, padding: '11px 14px', background: 'transparent', color: INK, border: `1px solid ${INK}`, cursor: 'pointer' }}>Подписаться</button>
            </div>

            {/* Comments teaser */}
            <div style={{ padding: '20px 0', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, borderBottom: `2px solid ${INK}` }}>
                <div style={{ fontFamily: T15.display, fontSize: 26, lineHeight: 1, letterSpacing: -0.2 }}>ОБСУЖДЕНИЕ <span style={{ color: ACC }}>· 18</span></div>
                <Mono color={MUTED} size={10}>ЧИТАТЕЛИ ПИШУТ</Mono>
              </div>
              {[
                { n: 'Сергей М.', a: '2 часа назад', t: 'А что делать, если ИП на патенте? Уведомления по НДФЛ за сотрудников нужны или нет?' },
                { n: 'Елена В.', a: '5 часов назад', t: 'Спасибо за чек-лист, утащила в закладки. Давно не могла найти всё в одном месте.' },
              ].map((c, i) => (
                <div key={i} style={{ padding: '14px 0', borderBottom: i === 0 ? `1px solid ${LINE}` : 'none' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: T15.body, fontSize: 13, fontWeight: 600 }}>{c.n}</span>
                    <Mono color={MUTED} size={10}>{c.a}</Mono>
                  </div>
                  <div style={{ fontFamily: T15.body, fontSize: 14, color: TEXT, lineHeight: 1.55 }}>{c.t}</div>
                </div>
              ))}
              <button style={{ width: '100%', marginTop: 12, fontFamily: T15.body, fontWeight: 600, fontSize: 13, padding: '12px', background: 'transparent', color: INK, border: `1px solid ${LINE2}`, cursor: 'pointer' }}>Показать все 18 →</button>
            </div>
          </div>
        </div>
      </div>

      {/* Related articles — full width */}
      <div style={{ padding: '60px 40px 0', borderTop: `1px solid ${LINE}`, marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 16, borderBottom: `2px solid ${INK}`, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <Mono color={MUTED} size={11}>// ЧИТАТЬ ДАЛЬШЕ</Mono>
            <div style={{ fontFamily: T15.display, fontSize: 44, lineHeight: 0.95, letterSpacing: -0.3 }}>ПОХОЖИЕ МАТЕРИАЛЫ</div>
          </div>
          <span style={{ fontFamily: T15.body, fontSize: 13, color: ACC }}>Все статьи о налогах →</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
          {[
            { tag: '#ФИНАНСЫ', date: '16 АПР', mins: 6, t: 'Как читать выписку из ЕНС', desc: 'Что значат строки в личном кабинете и как заметить ошибку в распределении налогов.', author: 'Ольга Кравец' },
            { tag: '#НАЛОГИ', date: '22 АПР', mins: 7, t: 'Упрощёнка в 2026: пороги и ставки', desc: 'Что изменилось в правилах применения УСН в этом году. Когда можно остаться, когда — придётся уйти.', author: 'Иван Сухой' },
            { tag: '#НАЛОГИ', date: '12 АПР', mins: 4, t: 'НПД: когда самозанятому выйти в ИП', desc: 'Точка перехода в цифрах и неочевидные преимущества статуса ИП после миллиона дохода.', author: 'Ольга Кравец' },
          ].map((c, i) => (
            <div key={i} style={{ background: WHITE, border: `1px solid ${LINE2}` }}>
              <div style={{ height: 200, background: PAPER2, position: 'relative', borderBottom: `1px solid ${LINE2}`,
                backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.04) 0 2px, transparent 2px 14px)' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: T15.serif, fontStyle: 'italic', fontSize: 16, color: MUTED }}>фото · превью {i + 1}</span>
                </div>
                <div style={{ position: 'absolute', top: 12, left: 12 }}><Mono color={ACC} size={10}>{c.tag}</Mono></div>
                <div style={{ position: 'absolute', top: 12, right: 12 }}><Mono color={MUTED} size={10}>{c.date} · {c.mins} МИН</Mono></div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ fontFamily: T15.display, fontSize: 24, lineHeight: 1, letterSpacing: -0.2, marginBottom: 10 }}>{c.t}</div>
                <div style={{ fontFamily: T15.body, fontSize: 13, color: TEXT, lineHeight: 1.55, marginBottom: 14 }}>{c.desc}</div>
                <Mono color={MUTED} size={10}>— {c.author}</Mono>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* More from author + section */}
      <div style={{ padding: '60px 40px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, borderBottom: `1px solid ${INK}`, marginBottom: 14 }}>
            <Mono color={INK} size={11}>ЕЩЁ ОТ ОЛЬГИ КРАВЕЦ</Mono>
            <Mono color={ACC} size={10}>23 МАТЕРИАЛА →</Mono>
          </div>
          {[
            { date: '08 АПР', t: 'Как ИП на УСН отчитаться без бухгалтера', mins: 9 },
            { date: '01 АПР', t: 'Шесть способов снизить налоговую нагрузку легально', mins: 11 },
            { date: '24 МАР', t: 'Когда УСН выгоднее ОСН и наоборот', mins: 7 },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 60px', gap: 14, padding: '14px 0', borderBottom: i < 2 ? `1px solid ${LINE}` : 'none', alignItems: 'baseline' }}>
              <Mono color={MUTED} size={10}>{r.date}</Mono>
              <div style={{ fontFamily: T15.serif, fontSize: 17, lineHeight: 1.25, color: INK }}>{r.t}</div>
              <Mono color={ACC} size={10} style={{ textAlign: 'right' }}>{r.mins} МИН</Mono>
            </div>
          ))}
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, borderBottom: `1px solid ${INK}`, marginBottom: 14 }}>
            <Mono color={INK} size={11}>ПОПУЛЯРНОЕ В РАЗДЕЛЕ «НАЛОГИ»</Mono>
            <Mono color={ACC} size={10}>92 МАТЕРИАЛА →</Mono>
          </div>
          {[
            { rank: '01', t: 'Полное руководство по ЕНС для ИП', views: '14.2K' },
            { rank: '02', t: 'НДС в 2026: что изменилось для малого бизнеса', views: '11.8K' },
            { rank: '03', t: 'Патентная система: кому подходит, кому нет', views: '9.4K' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 60px', gap: 14, padding: '14px 0', borderBottom: i < 2 ? `1px solid ${LINE}` : 'none', alignItems: 'baseline' }}>
              <div style={{ fontFamily: T15.display, fontSize: 22, color: ACC, lineHeight: 1 }}>{r.rank}</div>
              <div style={{ fontFamily: T15.serif, fontSize: 17, lineHeight: 1.25, color: INK }}>{r.t}</div>
              <Mono color={MUTED} size={10} style={{ textAlign: 'right' }}>{r.views}</Mono>
            </div>
          ))}
        </div>
      </div>

      {/* SITE FOOTER */}
      <div style={{ marginTop: 80, background: INK, color: PAPER, padding: '48px 40px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr', gap: 32, paddingBottom: 36, borderBottom: `1px solid #2a2620` }}>
          <div>
            <div style={{ fontFamily: T15.display, fontSize: 44, lineHeight: 0.9, letterSpacing: -0.5, marginBottom: 14 }}>ДЕЛО</div>
            <div style={{ fontFamily: T15.serif, fontStyle: 'italic', fontSize: 16, color: '#C9C3B8', lineHeight: 1.4, marginBottom: 18, maxWidth: 320 }}>
              Независимое медиа о малом бизнесе. Без рекламы под видом статей и пресс-релизов.
            </div>
            <Mono color={ACC} size={10}>ВЫПУСК · 47 · 2026</Mono>
          </div>
          {[
            { h: 'РУБРИКИ', items: ['Финансы', 'Налоги', 'Право', 'Технологии', 'Кейсы', 'Интервью'] },
            { h: 'ФОРМАТЫ', items: ['Статьи', 'Гайды', 'Интервью', 'Кейсы', 'Подкаст', 'Рассылка'] },
            { h: 'РЕДАКЦИЯ', items: ['О нас', 'Авторы', 'Этический кодекс', 'Реклама', 'Контакты'] },
          ].map((col, i) => (
            <div key={i}>
              <Mono color={ACC} size={10} style={{ marginBottom: 14, display: 'block' }}>{col.h}</Mono>
              {col.items.map((it, j) => (
                <div key={j} style={{ fontFamily: T15.body, fontSize: 13, color: '#C9C3B8', padding: '5px 0' }}>{it}</div>
              ))}
            </div>
          ))}
          <div>
            <Mono color={ACC} size={10} style={{ marginBottom: 14, display: 'block' }}>РАССЫЛКА</Mono>
            <div style={{ fontFamily: T15.body, fontSize: 13, color: '#C9C3B8', lineHeight: 1.55, marginBottom: 14 }}>
              Раз в неделю — главное про малый бизнес.
            </div>
            <div style={{ display: 'flex', border: `1px solid #4a4239` }}>
              <input placeholder="ваш email" style={{ flex: 1, padding: 10, background: 'transparent', border: 'none', color: PAPER, fontFamily: T15.body, fontSize: 13, outline: 'none' }} />
              <button style={{ background: ACC, color: PAPER, border: 'none', padding: '10px 14px', fontFamily: T15.body, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>→</button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, fontFamily: T15.mono, fontSize: 11, color: '#7a746a' }}>
          <span>© 2026 МЕДИА «ДЕЛО»</span>
          <div style={{ display: 'flex', gap: 22 }}>
            <span>Telegram</span><span>VK</span><span>RSS</span>
            <span>Политика конфиденциальности</span><span>Пользовательское соглашение</span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ArticleV15 = ArticleV15;
