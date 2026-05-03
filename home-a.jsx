/* global React, DELO_TOKENS */
const T = window.DELO_TOKENS;

// Reusable nav
function Nav({ dark }) {
  const fg = dark ? T.paper : T.ink;
  const border = dark ? 'rgba(255,255,255,0.12)' : T.gray300;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '20px 48px', borderBottom: `1px solid ${border}`,
      fontFamily: T.body, color: fg,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: T.display, fontSize: 28, lineHeight: 1, letterSpacing: -0.5 }}>ДЕЛО</span>
        <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 1.2, opacity: 0.5 }}>·медиа</span>
      </div>
      <div style={{ display: 'flex', gap: 28, fontFamily: T.mono, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>
        <span>Финансы</span>
        <span>Налоги</span>
        <span>Право</span>
        <span>Технологии</span>
        <span>Кейсы</span>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontFamily: T.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
        <span style={{ opacity: 0.6 }}>⌕ Поиск</span>
        <button style={{
          fontFamily: T.body, fontWeight: 600, fontSize: 12, padding: '8px 14px',
          background: T.pink, color: T.ink, border: 'none', cursor: 'pointer',
          letterSpacing: 0.3,
        }}>Подписаться →</button>
      </div>
    </div>
  );
}

// Tag pill
const Tag = ({ children, color = 'pink', size = 11 }) => {
  const bg = color === 'pink' ? T.pink : color === 'lime' ? T.lime : color === 'ink' ? T.ink : 'transparent';
  const fg = color === 'ink' ? T.paper : T.ink;
  const border = color === 'outline' ? `1px solid ${T.ink}` : 'none';
  return (
    <span style={{
      fontFamily: T.mono, fontSize: size, letterSpacing: 1, padding: '5px 9px',
      background: bg, color: fg, border, fontWeight: 600, display: 'inline-block',
    }}>{children}</span>
  );
};

// Variant A — EDITORIAL / Magazine cover
function HomeA() {
  return (
    <div style={{ width: 1440, background: T.paper, color: T.ink, fontFamily: T.body, paddingBottom: 80 }}>
      <Nav />

      {/* Hero — magazine cover style */}
      <div style={{ display: 'grid', gridTemplateColumns: '58% 42%', minHeight: 760 }}>
        {/* Left dark half */}
        <div style={{
          background: T.ink, color: T.paper, padding: 40, position: 'relative', overflow: 'hidden',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          {/* Giant decorative letters */}
          <div style={{
            position: 'absolute', right: -40, bottom: -180, fontFamily: T.display,
            fontSize: 640, lineHeight: 0.85, color: T.pink, letterSpacing: -8,
          }}>ЭВО</div>

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Tag color="pink">#ВЫПУСК 47</Tag>
              <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 1, color: T.gray300, padding: '6px 0' }}>♥ 247</span>
            </div>
            <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 1.5, color: T.gray300 }}>МАЙ — 2026</span>
          </div>

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ fontFamily: T.serif, fontStyle: 'italic', fontSize: 22, color: T.lime, marginBottom: 20 }}>главное за неделю —</div>
            <div style={{ fontFamily: T.display, fontSize: 168, lineHeight: 0.82, letterSpacing: -2, color: T.paper }}>
              ОТЧЁТНОСТЬ<br />
              <span style={{ color: T.lime }}>БЕЗ</span> БОЛИ
            </div>
          </div>

          <div style={{ position: 'relative', zIndex: 2, fontFamily: T.mono, fontSize: 10, letterSpacing: 1, color: T.gray300 }}>
            ГЛАВНАЯ / ВЫПУСК · 47 / МАЙ 2026
          </div>
        </div>

        {/* Right white half */}
        <div style={{
          background: T.paper, padding: '40px 48px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 1.2, color: T.gray500 }}>29 АПРЕЛЯ 2026 · 12 МИН</span>
            <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 1.2, color: T.gray500 }}>#НАЛОГИ</span>
          </div>

          <div>
            <div style={{ fontFamily: T.display, fontSize: 84, lineHeight: 0.92, letterSpacing: -0.5 }}>
              ЕНС, УВЕДОМЛЕНИЯ И ДЕДЛАЙНЫ.<br />
              <span style={{ color: T.gray500 }}>КАК НЕ ЗАЛИПНУТЬ</span><br />
              В МАЕ 2026
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${T.gray300}`, paddingTop: 20 }}>
            <div style={{ fontFamily: T.body, fontSize: 16, lineHeight: 1.5, color: T.gray700, maxWidth: 480 }}>
              Разбираем по шагам, как малому бизнесу пройти май без штрафов: какие платежи в ЕНС не пропустить, какие уведомления подать, и где в личном кабинете лежит сверка.
            </div>
            <div style={{ marginTop: 16, fontFamily: T.body, fontSize: 13, color: T.gray500 }}>
              <span style={{ color: T.ink }}>Ольга Кравец</span> · редактор раздела «Финансы»
            </div>
          </div>
        </div>
      </div>

      {/* Section: this week */}
      <div style={{ padding: '60px 48px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 32, paddingBottom: 16, borderBottom: `1px solid ${T.gray300}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 1.5, color: T.gray500 }}>// 01</span>
            <div style={{ fontFamily: T.display, fontSize: 56, lineHeight: 0.9, letterSpacing: -0.5 }}>НА ЭТОЙ НЕДЕЛЕ</div>
          </div>
          <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 1, color: T.gray500 }}>СМ. ВСЕ →</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 32 }}>
          {/* Big card */}
          <div>
            <div style={{
              height: 360, background: T.gray200, marginBottom: 16, position: 'relative', overflow: 'hidden',
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(0,0,0,0.04) 12px, rgba(0,0,0,0.04) 13px)',
            }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.mono, fontSize: 11, color: T.gray500, letterSpacing: 1 }}>фото / иллюстрация</div>
              <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 8 }}>
                <Tag color="lime">#ТЕХ</Tag>
              </div>
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.gray500, letterSpacing: 1, marginBottom: 8 }}>27 АПРЕЛЯ · 9 МИН</div>
            <div style={{ fontFamily: T.display, fontSize: 56, lineHeight: 0.95, letterSpacing: -0.5 }}>
              КАК МЫ АВТОМАТИЗИРОВАЛИ КАДРОВЫЙ ДОКУМЕНТООБОРОТ В ЦЕХУ ИЗ 12 ЧЕЛОВЕК
            </div>
            <div style={{ fontFamily: T.body, fontSize: 15, color: T.gray700, lineHeight: 1.5, marginTop: 12, maxWidth: 580 }}>
              Кейс из малого производства: что заменили, сколько стоило, и зачем вообще это нужно бизнесу до 30 человек.
            </div>
          </div>

          {/* Mid cards */}
          {[
            { tag: '#ПРАВО', tagColor: 'pink', date: '26 АПР · 6 МИН', title: 'ОФЕРТА В ИНТЕРНЕТ-МАГАЗИНЕ: 7 ОШИБОК ИЗ 10' },
            { tag: '#ФИНАНСЫ', tagColor: 'outline', date: '25 АПР · 5 МИН', title: 'СЧЁТ-ФАКТУРА БЕЗ НДС — НУЖЕН ИЛИ НЕТ' },
          ].map((c, i) => (
            <div key={i}>
              <div style={{
                height: 220, background: T.gray100, marginBottom: 16, position: 'relative', overflow: 'hidden',
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 11px)',
              }}>
                <div style={{ position: 'absolute', top: 12, left: 12 }}><Tag color={c.tagColor}>{c.tag}</Tag></div>
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.gray500, letterSpacing: 1, marginBottom: 6 }}>{c.date}</div>
              <div style={{ fontFamily: T.display, fontSize: 30, lineHeight: 0.95, letterSpacing: 0 }}>{c.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Topics row */}
      <div style={{ padding: '80px 48px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 32, paddingBottom: 16, borderBottom: `1px solid ${T.gray300}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 1.5, color: T.gray500 }}>// 02</span>
            <div style={{ fontFamily: T.display, fontSize: 56, lineHeight: 0.9, letterSpacing: -0.5 }}>РАЗДЕЛЫ</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: T.gray300, border: `1px solid ${T.gray300}` }}>
          {[
            { num: '01', title: 'ФИНАНСЫ', count: '147 материалов', bg: T.paper, accent: T.pink },
            { num: '02', title: 'НАЛОГИ', count: '92 материала', bg: T.lime, accent: T.ink },
            { num: '03', title: 'ПРАВО', count: '64 материала', bg: T.paper, accent: T.blue },
            { num: '04', title: 'ТЕХНОЛОГИИ', count: '108 материалов', bg: T.ink, accent: T.lime, dark: true },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, padding: 28, height: 240, position: 'relative', color: s.dark ? T.paper : T.ink }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 1.5, color: s.dark ? T.gray300 : T.gray500 }}>{s.num}</div>
              <div style={{ fontFamily: T.display, fontSize: 56, lineHeight: 0.9, letterSpacing: -0.5, marginTop: 80 }}>{s.title}</div>
              <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 1, color: s.dark ? T.gray300 : T.gray500, marginTop: 8 }}>{s.count}</div>
              <div style={{ position: 'absolute', bottom: 28, right: 28, width: 12, height: 12, background: s.accent, borderRadius: '50%' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Newsletter strip */}
      <div style={{ padding: '80px 48px 0' }}>
        <div style={{
          background: T.ink, color: T.paper, padding: '60px 48px', position: 'relative', overflow: 'hidden',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40,
        }}>
          <div style={{ position: 'absolute', right: -40, bottom: -120, fontFamily: T.display, fontSize: 480, lineHeight: 0.85, color: T.pink, opacity: 0.95, letterSpacing: -8 }}>ДЕЛО</div>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 1.5, color: T.lime, marginBottom: 12 }}>// РАССЫЛКА</div>
            <div style={{ fontFamily: T.display, fontSize: 96, lineHeight: 0.88, letterSpacing: -1 }}>ОДНО ПИСЬМО.<br />ЧЕТВЕРГ. УТРО.</div>
          </div>
          <div style={{ position: 'relative', zIndex: 2, alignSelf: 'end', maxWidth: 380 }}>
            <div style={{ fontFamily: T.body, fontSize: 15, color: T.gray300, lineHeight: 1.5, marginBottom: 24 }}>
              Главное за неделю: налоги, законы, кейсы, технологии. Без воды и спама. 26 000 подписчиков уже читают.
            </div>
            <div style={{ display: 'flex', gap: 0, border: `1px solid ${T.gray300}` }}>
              <input placeholder="email@вашбизнес.рф" style={{ flex: 1, background: 'transparent', border: 'none', color: T.paper, padding: '14px 16px', fontFamily: T.body, fontSize: 14, outline: 'none' }} />
              <button style={{ fontFamily: T.body, fontWeight: 600, fontSize: 13, padding: '0 22px', background: T.paper, color: T.ink, border: 'none', cursor: 'pointer', letterSpacing: 0.3 }}>Подписаться</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.HomeA = HomeA;
window.DeloNav = Nav;
window.DeloTag = Tag;
