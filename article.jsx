/* global React, DELO_TOKENS, DeloNav, DeloTag */
const T5 = window.DELO_TOKENS;
const Nav5 = window.DeloNav;
const Tag5 = window.DeloTag;

// ARTICLE PAGE — editorial split-screen, inspired by reference
function Article() {
  return (
    <div style={{ width: 1440, background: T5.paper, color: T5.ink, fontFamily: T5.body, paddingBottom: 80 }}>
      {/* Reading progress bar */}
      <div style={{ height: 4, background: T5.gray200, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '34%', background: T5.pink }} />
      </div>

      <Nav5 />

      {/* HERO — split screen, editorial */}
      <div style={{ display: 'grid', gridTemplateColumns: '58% 42%', minHeight: 720 }}>
        {/* Left dark */}
        <div style={{
          background: T5.ink, color: T5.paper, padding: 36, position: 'relative', overflow: 'hidden',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          {/* Giant decorative */}
          <div style={{
            position: 'absolute', right: -40, bottom: -180, fontFamily: T5.display,
            fontSize: 580, lineHeight: 0.85, color: T5.pink, letterSpacing: -8,
          }}>ЕНС</div>

          {/* Top: tag + likes */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Tag5 color="pink">#УВЕДОМЛЕНИЯ</Tag5>
            <div style={{ fontFamily: T5.mono, fontSize: 11, letterSpacing: 1.2, color: T5.gray300, display: 'flex', gap: 16 }}>
              <span>♥ 247</span>
              <span>↗ 32</span>
            </div>
          </div>

          {/* Center placeholder for hero illustration zone */}
          <div style={{ position: 'relative', zIndex: 2, padding: '80px 0' }}>
            <div style={{ fontFamily: T5.serif, fontStyle: 'italic', fontSize: 22, color: T5.lime, marginBottom: 12 }}>главное за неделю —</div>
            <div style={{ fontFamily: T5.mono, fontSize: 11, letterSpacing: 1.5, color: T5.gray300, maxWidth: 420, lineHeight: 1.6 }}>
              ПЛАТЕЖИ В ЕНС / УВЕДОМЛЕНИЯ ДО 25 ЧИСЛА / СВЕРКА В ЛК / ПЕРВЫЕ ШТРАФЫ — В ИЮНЕ
            </div>
          </div>

          {/* Bottom: breadcrumbs */}
          <div style={{ position: 'relative', zIndex: 2, fontFamily: T5.mono, fontSize: 10, letterSpacing: 1, color: T5.gray300 }}>
            ГЛАВНАЯ / СТАТЬИ / НАЛОГИ
          </div>
        </div>

        {/* Right white */}
        <div style={{
          background: T5.paper, padding: '36px 56px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          {/* Top: date + hashtag */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: T5.mono, fontSize: 11, letterSpacing: 1.2, color: T5.gray700 }}>29 АПРЕЛЯ 2026</span>
            <span style={{ fontFamily: T5.mono, fontSize: 11, letterSpacing: 1.2, color: T5.gray700 }}>#НАЛОГИ</span>
          </div>

          {/* Center: title */}
          <div>
            <div style={{ fontFamily: T5.display, fontSize: 80, lineHeight: 0.92, letterSpacing: -0.5 }}>
              ЕНС, УВЕДОМЛЕНИЯ И ДЕДЛАЙНЫ. КАК НЕ ЗАЛИПНУТЬ В МАЕ 2026
            </div>
          </div>

          {/* Bottom: lead */}
          <div style={{ borderTop: `1px solid ${T5.gray300}`, paddingTop: 20 }}>
            <div style={{ fontFamily: T5.body, fontSize: 17, lineHeight: 1.5, color: T5.gray700 }}>
              Разбираем по шагам, как малому бизнесу пройти май без штрафов. Без воды — только то, что нужно сделать в мае: какие платежи в ЕНС не пропустить, какие уведомления подать, и где в личном кабинете лежит сверка.
            </div>
          </div>
        </div>
      </div>

      {/* BODY — after scroll */}
      {/* Section 1: with sticky CTA banner on left */}
      <div style={{ display: 'grid', gridTemplateColumns: '28% 72%', minHeight: 720 }}>
        {/* Left: sticky dark CTA banner */}
        <div style={{ padding: 24, background: T5.paper }}>
          <div style={{
            background: T5.ink, color: T5.paper, padding: 28, position: 'relative', overflow: 'hidden', minHeight: 480,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div style={{ position: 'absolute', right: -10, bottom: -40, fontFamily: T5.display, fontSize: 200, lineHeight: 0.85, color: T5.pink, opacity: 0.95, letterSpacing: -4 }}>ЕСП</div>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <Tag5 color="lime">ПАРТНЁР</Tag5>
            </div>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ fontFamily: T5.display, fontSize: 32, lineHeight: 0.95, marginBottom: 14, letterSpacing: -0.3 }}>
                НУЖНА ПОМОЩЬ С ЕСП И ОТЧЁТНОСТЬЮ?
              </div>
              <div style={{ fontFamily: T5.body, fontSize: 13, color: T5.gray300, lineHeight: 1.5, marginBottom: 20 }}>
                Бухгалтер на аутсорсе для ИП и ООО. Первый месяц — бесплатно.
              </div>
              <button style={{ width: '100%', fontFamily: T5.body, fontWeight: 600, fontSize: 13, padding: '14px 16px', background: T5.paper, color: T5.ink, border: 'none', cursor: 'pointer' }}>Узнать подробнее →</button>
            </div>
          </div>

          {/* Sidebar TOC */}
          <div style={{ marginTop: 24, padding: '4px 0' }}>
            <div style={{ fontFamily: T5.mono, fontSize: 10, letterSpacing: 1.5, color: T5.gray500, paddingBottom: 10, borderBottom: `1px solid ${T5.gray300}`, marginBottom: 8 }}>СОДЕРЖАНИЕ</div>
            {[
              { n: '01', t: 'Что такое ЕНС в 2026', active: true },
              { n: '02', t: 'Уведомления: формат и сроки' },
              { n: '03', t: 'Сверка в личном кабинете' },
              { n: '04', t: 'Если что-то пошло не так' },
              { n: '05', t: 'Чек-лист на май' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 8, padding: '10px 0', borderBottom: i < 4 ? `1px solid ${T5.gray200}` : 'none', fontSize: 13, color: s.active ? T5.ink : T5.gray700, fontWeight: s.active ? 600 : 400, lineHeight: 1.35 }}>
                <span style={{ fontFamily: T5.mono, fontSize: 11, color: s.active ? T5.pink : T5.gray500 }}>{s.n}</span>
                <span>{s.t}</span>
              </div>
            ))}
          </div>

          {/* Author */}
          <div style={{ marginTop: 24, padding: '20px 0', borderTop: `1px solid ${T5.gray300}` }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: T5.gray200, border: `1px solid ${T5.gray300}` }} />
              <div>
                <div style={{ fontFamily: T5.body, fontSize: 13, fontWeight: 600 }}>Ольга Кравец</div>
                <div style={{ fontFamily: T5.mono, fontSize: 10, letterSpacing: 1, color: T5.gray500 }}>РЕДАКТОР · ФИНАНСЫ</div>
              </div>
            </div>
            <div style={{ fontFamily: T5.body, fontSize: 12, color: T5.gray700, lineHeight: 1.5 }}>
              10 лет в бухгалтерии малого бизнеса. Бывший главбух в розничной сети.
            </div>
          </div>
        </div>

        {/* Right: article body */}
        <div style={{ padding: '40px 64px 0 24px', background: T5.paper }}>
          <div style={{ maxWidth: 680 }}>
            {/* Lead paragraph */}
            <p style={{ fontFamily: T5.body, fontSize: 15, lineHeight: 1.75, color: T5.gray700, marginBottom: 16 }}>
              С 2023 года все платежи в бюджет идут через единый налоговый счёт. На бумаге — упрощение. На практике первые два года владельцы малого бизнеса жаловались на потерянные деньги, расхождения и непредсказуемые штрафы. К 2026 году большинство технических багов починили, но правила игры стали жёстче: за пропуск уведомления штраф приходит автоматически.
            </p>
            <p style={{ fontFamily: T5.body, fontSize: 15, lineHeight: 1.75, color: T5.gray700, marginBottom: 16 }}>
              Мы собрали в один материал всё, что нужно знать предпринимателю на УСН в мае: что заплатить, что подать и где в личном кабинете найти подтверждение, что налоговая всё видит правильно.
            </p>

            {/* H2 */}
            <h2 style={{ fontFamily: T5.display, fontSize: 56, lineHeight: 0.95, letterSpacing: -0.5, margin: '44px 0 20px', color: T5.ink }}>
              ЧТО ТАКОЕ ЕНС И ЗАЧЕМ ОН ВООБЩЕ
            </h2>
            <p style={{ fontFamily: T5.body, fontSize: 15, lineHeight: 1.75, color: T5.gray700, marginBottom: 16 }}>
              ЕНС — это виртуальный кошелёк налогоплательщика в ФНС. Все деньги, которые вы перечисляете в бюджет, сначала попадают на этот единый счёт, а потом распределяются между конкретными налогами и взносами. Распределяет сама налоговая по приоритетам: сначала недоимки, потом текущие платежи, потом пени и штрафы.
            </p>

            {/* List with dashes */}
            <div style={{ borderTop: `1px solid ${T5.gray300}`, marginTop: 20, marginBottom: 24 }}>
              {[
                'Подайте уведомление об исчисленных суммах до 25 числа месяца, в котором платите налог',
                'Перечислите деньги на ЕНС с правильным КБК до 28 числа',
                'Через 1–3 дня сверьте начисления в личном кабинете',
                'Если что-то расходится — подайте корректирующее уведомление',
              ].map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 12, padding: '14px 0', borderBottom: `1px solid ${T5.gray300}`, fontFamily: T5.body, fontSize: 15, color: T5.gray700, lineHeight: 1.55 }}>
                  <span>—</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>

            {/* Pull quote / callout */}
            <div style={{ background: T5.gray100, padding: '24px 28px', borderLeft: `4px solid ${T5.ink}`, margin: '28px 0' }}>
              <div style={{ fontFamily: T5.serif, fontStyle: 'italic', fontSize: 24, lineHeight: 1.3, color: T5.ink }}>
                «Главное — не количество отчётов, а то, чтобы налоговая знала о тебе ровно столько, сколько нужно».
              </div>
              <div style={{ fontFamily: T5.mono, fontSize: 11, letterSpacing: 1, color: T5.gray500, marginTop: 14, textTransform: 'uppercase' }}>— АННА Г., БУХГАЛТЕР ИП НА УСН</div>
            </div>

            {/* H2 */}
            <h2 style={{ fontFamily: T5.display, fontSize: 56, lineHeight: 0.95, letterSpacing: -0.5, margin: '44px 0 20px', color: T5.ink }}>
              УВЕДОМЛЕНИЯ: ФОРМАТ И СРОКИ
            </h2>
            <p style={{ fontFamily: T5.body, fontSize: 15, lineHeight: 1.75, color: T5.gray700, marginBottom: 24 }}>
              Уведомление — это короткий документ, в котором вы говорите налоговой: «вот столько денег я плачу, и вот это — какие именно налоги». Без уведомления ваш платёж просто зависнет на ЕНС, а налоги — числятся неуплаченными. Платить — мало.
            </p>

            {/* Numbered steps with big gray digits */}
            <div style={{ marginTop: 12, marginBottom: 32 }}>
              {[
                { n: '01', t: 'СОБЕРИТЕ СУММЫ', d: 'Откройте бухгалтерскую программу или Excel и выпишите все налоги, которые планируете платить в этом месяце. Нужно отдельно: УСН, страховые взносы за себя, НДФЛ за сотрудников.' },
                { n: '02', t: 'ОФОРМИТЕ УВЕДОМЛЕНИЕ', d: 'Форма КНД 1110355 — её можно сдать через личный кабинет на nalog.ru, через оператора ЭДО или на бумаге. Электронно — быстрее всего и без риска опечатки в реквизитах.' },
                { n: '03', t: 'ОТПРАВЬТЕ ДО 25 ЧИСЛА', d: 'Это критично. Уведомление, поданное 26-го, считается просроченным. Штраф — 200 рублей за каждый документ, плюс возможные пени по основному платежу.' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 24, padding: '20px 0', borderTop: `1px solid ${T5.gray300}` }}>
                  <div style={{ fontFamily: T5.display, fontSize: 80, lineHeight: 0.85, color: T5.gray300, letterSpacing: -1 }}>{s.n}</div>
                  <div>
                    <div style={{ fontFamily: T5.display, fontSize: 28, lineHeight: 1, letterSpacing: -0.2, marginBottom: 10 }}>{s.t}</div>
                    <div style={{ fontFamily: T5.body, fontSize: 14, lineHeight: 1.65, color: T5.gray700 }}>{s.d}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div style={{ fontFamily: T5.mono, fontSize: 10, letterSpacing: 1.5, color: T5.gray500, marginTop: 36, marginBottom: 12 }}>ТАБЛ. 01 — ДЕДЛАЙНЫ МАЯ 2026</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T5.body }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${T5.ink}` }}>
                  {['ДАТА', 'ЧТО ДЕЛАТЬ', 'КОМУ', 'ШТРАФ ЗА ПРОПУСК'].map((h, i) => (
                    <th key={i} style={{ fontFamily: T5.mono, fontSize: 10, letterSpacing: 1.2, color: T5.gray500, textTransform: 'uppercase', textAlign: 'left', padding: '12px 12px 12px 0', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['до 25 мая', 'Уведомление по УСН (Q1)', 'ИП и ООО на УСН', '200 ₽ + пени'],
                  ['до 28 мая', 'Платёж аванса УСН за Q1', 'ИП и ООО на УСН', 'пени 1/300 ставки ЦБ'],
                  ['до 25 мая', 'Уведомление по НДФЛ', 'Работодатели', '200 ₽ + блокировка счёта'],
                  ['до 28 мая', 'Страховые взносы за апрель', 'Работодатели', 'пени 1/300 ставки ЦБ'],
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T5.gray300}` }}>
                    {row.map((c, j) => (
                      <td key={j} style={{ padding: '14px 12px 14px 0', fontSize: 14, color: j === 0 ? T5.ink : T5.gray700, fontWeight: j === 0 ? 600 : 400 }}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Inline image / illustration */}
            <div style={{ margin: '40px 0' }}>
              <div style={{
                height: 320, background: T5.lime, position: 'relative', overflow: 'hidden',
                backgroundImage: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T5.display, fontSize: 240, lineHeight: 0.85, color: T5.ink, letterSpacing: -4 }}>−25.05</div>
                <div style={{ position: 'absolute', top: 16, left: 20, fontFamily: T5.mono, fontSize: 11, letterSpacing: 1.2, color: T5.ink }}>ИЛЛ. 01 — КЛЮЧЕВАЯ ДАТА МАЯ</div>
              </div>
              <div style={{ fontFamily: T5.body, fontSize: 12, color: T5.gray500, marginTop: 8, fontStyle: 'italic' }}>Фото / иллюстрация: 25 мая — последний день, когда можно безопасно подать уведомления без последствий.</div>
            </div>

            {/* H2 */}
            <h2 style={{ fontFamily: T5.display, fontSize: 56, lineHeight: 0.95, letterSpacing: -0.5, margin: '12px 0 20px', color: T5.ink }}>
              ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК
            </h2>
            <p style={{ fontFamily: T5.body, fontSize: 15, lineHeight: 1.75, color: T5.gray700, marginBottom: 16 }}>
              Самые частые ошибки — опечатка в КБК, неправильный период или сумма. Ничего страшного: подайте корректирующее уведомление с теми же данными, исправив только нужные поля. Главное — успеть до 28 числа, иначе платёж засчитается на «общее», и придётся писать заявление о зачёте.
            </p>

            {/* CTA dark block */}
            <div style={{ background: T5.ink, color: T5.paper, padding: 36, position: 'relative', overflow: 'hidden', margin: '40px 0' }}>
              <div style={{ position: 'absolute', right: -20, top: -60, fontFamily: T5.display, fontSize: 200, color: 'rgba(255,255,255,0.05)', letterSpacing: -4 }}>+1</div>
              <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'end' }}>
                <div>
                  <div style={{ fontFamily: T5.mono, fontSize: 11, letterSpacing: 1.5, color: T5.lime, marginBottom: 10 }}>// РАССЫЛКА</div>
                  <div style={{ fontFamily: T5.display, fontSize: 44, lineHeight: 0.95, letterSpacing: -0.3 }}>ЧЕК-ЛИСТ НА МАЙ — В РАССЫЛКЕ</div>
                  <div style={{ fontFamily: T5.body, fontSize: 14, color: T5.gray300, lineHeight: 1.5, marginTop: 12 }}>
                    Подпишитесь — пришлём pdf с дедлайнами и шаблонами уведомлений.
                  </div>
                </div>
                <button style={{ fontFamily: T5.body, fontWeight: 600, fontSize: 13, padding: '14px 22px', background: T5.paper, color: T5.ink, border: 'none', cursor: 'pointer' }}>Получить чек-лист →</button>
              </div>
            </div>

            {/* Footer of article */}
            <div style={{ padding: '24px 0', borderTop: `1px solid ${T5.gray300}`, borderBottom: `1px solid ${T5.gray300}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Tag5 color="pink">#НАЛОГИ</Tag5>
                <Tag5 color="outline">#УВЕДОМЛЕНИЯ</Tag5>
                <Tag5 color="outline">#УСН</Tag5>
              </div>
              <div style={{ display: 'flex', gap: 16, fontFamily: T5.body, fontSize: 13, color: T5.gray700 }}>
                <span>♥ 247 нравится</span>
                <span>↗ Поделиться</span>
                <span>⌘ Сохранить</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related articles */}
      <div style={{ padding: '60px 48px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 28, paddingBottom: 16, borderBottom: `2px solid ${T5.ink}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontFamily: T5.mono, fontSize: 11, letterSpacing: 1.5, color: T5.gray500 }}>// ЧИТАТЬ ДАЛЬШЕ</span>
            <div style={{ fontFamily: T5.display, fontSize: 56, lineHeight: 0.9, letterSpacing: -0.5 }}>ПОХОЖИЕ МАТЕРИАЛЫ</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
          {[
            { tag: '#ФИНАНСЫ', tc: 'outline', date: '16 АПР · 6 МИН', t: 'КАК ЧИТАТЬ ВЫПИСКУ ИЗ ЕНС', bg: T5.gray100 },
            { tag: '#НАЛОГИ', tc: 'pink', date: '22 АПР · 7 МИН', t: 'УПРОЩЁНКА В 2026: ПОРОГИ И СТАВКИ', bg: T5.pink },
            { tag: '#НАЛОГИ', tc: 'pink', date: '12 АПР · 4 МИН', t: 'НПД: КОГДА САМОЗАНЯТОМУ ВЫЙТИ В ИП', bg: T5.ink, dark: true },
          ].map((c, i) => (
            <div key={i}>
              <div style={{
                height: 220, background: c.bg, position: 'relative', overflow: 'hidden', marginBottom: 14,
                backgroundImage: c.dark ? 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)' : 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}>
                <div style={{ position: 'absolute', top: 12, left: 12 }}><Tag5 color={c.tc}>{c.tag}</Tag5></div>
                <div style={{ position: 'absolute', bottom: 12, right: 12, fontFamily: T5.mono, fontSize: 10, letterSpacing: 1, color: c.dark ? T5.gray300 : T5.gray700 }}>{c.date}</div>
              </div>
              <div style={{ fontFamily: T5.display, fontSize: 28, lineHeight: 0.95, letterSpacing: -0.2 }}>{c.t}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.Article = Article;
