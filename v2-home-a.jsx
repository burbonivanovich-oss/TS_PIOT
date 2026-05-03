/* global React, DELO_TOKENS, DeloNav, DeloTag */
const TV = window.DELO_TOKENS;

// V2 palette — restrained, single accent per variant
const V2 = {
  ink: '#171513',
  paper: '#F4F1EA',
  paper2: '#EDE9DF',
  white: '#FBFAF6',
  line: '#D9D4C7',
  line2: '#C2BCAC',
  text: '#3A3631',
  muted: '#7A746A',
  // Single accents (one per variant)
  green: '#2E5D4A',   // forest green — calm trust
  amber: '#A8651C',   // amber — warm, paper
  blue:  '#1F3A8A',   // deep blue — institutional
  display: '"Bebas Neue", "Oswald", sans-serif',
  body: '"Inter Tight", -apple-system, sans-serif',
  serif: '"Instrument Serif", Georgia, serif',
  mono: '"JetBrains Mono", monospace',
};

// Compact, low-key nav
function NavV2({ accent }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 40px', borderBottom: `1px solid ${V2.line}`,
      fontFamily: V2.body, color: V2.ink, background: V2.paper,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: V2.display, fontSize: 26, lineHeight: 1, letterSpacing: -0.5 }}>ДЕЛО</span>
        <span style={{ fontFamily: V2.mono, fontSize: 10, letterSpacing: 1, color: V2.muted }}>·медиа</span>
      </div>
      <div style={{ display: 'flex', gap: 24, fontFamily: V2.body, fontSize: 13, color: V2.text }}>
        <span style={{ borderBottom: `2px solid ${accent}`, paddingBottom: 2 }}>Главное</span>
        <span>Финансы</span>
        <span>Налоги</span>
        <span>Право</span>
        <span>Технологии</span>
        <span style={{ color: V2.muted }}>Кейсы</span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
        <span style={{ color: V2.muted, fontFamily: V2.mono, letterSpacing: 0.5 }}>⌕</span>
        <button style={{
          fontFamily: V2.body, fontWeight: 600, fontSize: 12, padding: '8px 14px',
          background: V2.ink, color: V2.paper, border: 'none', cursor: 'pointer',
        }}>Подписаться</button>
      </div>
    </div>
  );
}

// Reading-time badge
const ReadBadge = ({ mins, accent }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: V2.mono, fontSize: 11, letterSpacing: 0.3, color: accent, fontWeight: 600,
  }}>
    <span style={{ width: 6, height: 6, background: accent, borderRadius: '50%' }} />
    {mins} мин
  </span>
);

// === V2 — A: Утилитарная (Reuters-meets-Stripe Press) ============
function HomeV2A() {
  const A = V2.green;
  return (
    <div style={{ width: 1440, background: V2.paper, color: V2.ink, fontFamily: V2.body, paddingBottom: 80 }}>
      <NavV2 accent={A} />

      {/* Hero — strong promise of time */}
      <div style={{ padding: '40px 40px 32px', borderBottom: `1px solid ${V2.line}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 40, alignItems: 'end' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, fontFamily: V2.mono, fontSize: 11, color: V2.muted, letterSpacing: 0.5 }}>
              <span>ВЫПУСК · 47</span>
              <span>·</span>
              <span>1 МАЯ 2026</span>
              <span>·</span>
              <span style={{ color: A }}>● ОБНОВЛЕНО СЕГОДНЯ</span>
            </div>
            <div style={{ fontFamily: V2.serif, fontSize: 64, lineHeight: 1.05, color: V2.ink, letterSpacing: -0.5, maxWidth: 820 }}>
              Главное за неделю для предпринимателя — <em style={{ color: A }}>за пять минут</em>.
            </div>
            <div style={{ fontFamily: V2.body, fontSize: 16, color: V2.text, lineHeight: 1.55, marginTop: 18, maxWidth: 660 }}>
              Налоги, законы и технологии для малого бизнеса — без воды и драматизма. Прочитал — закрыл — пошёл работать.
            </div>
          </div>
          <div style={{ background: V2.white, border: `1px solid ${V2.line}`, padding: 20 }}>
            <div style={{ fontFamily: V2.mono, fontSize: 10, letterSpacing: 1, color: V2.muted, marginBottom: 8 }}>★ ЧЕК-ЛИСТ МАЯ</div>
            <div style={{ fontFamily: V2.serif, fontSize: 22, lineHeight: 1.2, marginBottom: 14 }}>
              4 даты, чтобы пройти май без штрафов.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {['до 25 мая — уведомления', 'до 28 мая — ЕНС', 'до 30 мая — авансы УСН', 'весь май — сверка ЛК'].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: V2.text, alignItems: 'center' }}>
                  <span style={{ width: 14, height: 14, border: `1px solid ${V2.line2}`, display: 'inline-block' }} />
                  {t}
                </div>
              ))}
            </div>
            <button style={{ width: '100%', fontFamily: V2.body, fontSize: 13, fontWeight: 600, padding: '11px', background: A, color: V2.paper, border: 'none', cursor: 'pointer' }}>Скачать pdf →</button>
          </div>
        </div>
      </div>

      {/* Main read — single hero article */}
      <div style={{ padding: '40px 40px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 40 }}>
          <div>
            <div style={{
              height: 380, background: V2.ink, position: 'relative', overflow: 'hidden',
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              padding: 28, color: V2.paper, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: V2.mono, fontSize: 11, letterSpacing: 1, color: A }}>★ ГЛАВНОЕ</span>
                <span style={{ fontFamily: V2.mono, fontSize: 11, letterSpacing: 0.5, color: V2.line2 }}>29 АПР · 12 МИН</span>
              </div>
              <div style={{ position: 'absolute', right: -20, bottom: -30, fontFamily: V2.display, fontSize: 240, color: 'rgba(255,255,255,0.06)', letterSpacing: -4, lineHeight: 0.85 }}>ЕНС</div>
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ fontFamily: V2.serif, fontSize: 56, lineHeight: 1.05, letterSpacing: -0.5 }}>
                  ЕНС, уведомления и&nbsp;дедлайны. Как пройти май без&nbsp;штрафов
                </div>
              </div>
            </div>
            <div style={{ paddingTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: V2.body, fontSize: 13, color: V2.text }}>
                <span style={{ color: V2.ink, fontWeight: 600 }}>Ольга Кравец</span> · редактор раздела «Финансы»
              </div>
              <ReadBadge mins={12} accent={A} />
            </div>
          </div>

          {/* Sidebar list */}
          <div>
            <div style={{ fontFamily: V2.mono, fontSize: 11, letterSpacing: 1, color: V2.muted, paddingBottom: 12, borderBottom: `1px solid ${V2.line}` }}>
              ТАКЖЕ НА ЭТОЙ НЕДЕЛЕ
            </div>
            {[
              { tag: 'право', date: '28 АПР', mins: 6, t: 'Оферта в интернет-магазине: 7 ошибок из 10', desc: 'Что забывают вписать чаще всего, и какие пункты делают её несостоятельной.' },
              { tag: 'технологии', date: '27 АПР', mins: 9, t: 'КЭДО в команде из 12 человек: что меняется', desc: 'Кейс производственного цеха в Туле — что внедрили и сколько вышло.' },
              { tag: 'финансы', date: '25 АПР', mins: 5, t: 'Счёт-фактура без НДС: нужен или нет', desc: 'Когда ИП на упрощёнке всё-таки обязан её выставить.' },
            ].map((c, i) => (
              <div key={i} style={{ padding: '20px 0', borderBottom: i < 2 ? `1px solid ${V2.line}` : 'none' }}>
                <div style={{ display: 'flex', gap: 12, fontFamily: V2.mono, fontSize: 11, letterSpacing: 0.5, color: V2.muted, marginBottom: 8 }}>
                  <span style={{ color: A, textTransform: 'uppercase' }}>{c.tag}</span>
                  <span>·</span>
                  <span>{c.date}</span>
                  <span>·</span>
                  <span>{c.mins} мин</span>
                </div>
                <div style={{ fontFamily: V2.serif, fontSize: 22, lineHeight: 1.2, color: V2.ink, marginBottom: 6 }}>{c.t}</div>
                <div style={{ fontFamily: V2.body, fontSize: 13, color: V2.text, lineHeight: 1.5 }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TL;DR strip — for the busy reader */}
      <div style={{ padding: '60px 40px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 14, borderBottom: `1px solid ${V2.line}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: V2.mono, fontSize: 11, color: V2.muted, letterSpacing: 1 }}>// 30 СЕКУНД</span>
            <div style={{ fontFamily: V2.serif, fontSize: 36, color: V2.ink }}>Если совсем нет времени</div>
          </div>
          <span style={{ fontFamily: V2.mono, fontSize: 11, color: V2.muted, letterSpacing: 0.5 }}>5 материалов · 30 сек на чтение</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, marginTop: 24, border: `1px solid ${V2.line}`, background: V2.white }}>
          {[
            { num: '01', t: 'Уведомления в ЕНС — до 25 числа. После — штраф 200₽ + пени.', tag: 'налоги' },
            { num: '02', t: 'Самозанятому пора в ИП после 1.5 млн дохода в год.', tag: 'налоги' },
            { num: '03', t: 'Оферта без раздела о возврате = ничтожна. Особенно для опт. поставок.', tag: 'право' },
            { num: '04', t: 'КЭДО окупается в команде от 8 человек, не раньше.', tag: 'технологии' },
            { num: '05', t: 'Сверку с ФНС лучше делать 2–3 числа: данные обновлены.', tag: 'финансы' },
          ].map((s, i) => (
            <div key={i} style={{ padding: 22, borderRight: i < 4 ? `1px solid ${V2.line}` : 'none', minHeight: 220, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontFamily: V2.display, fontSize: 56, lineHeight: 0.85, color: V2.line2, marginBottom: 16 }}>{s.num}</div>
              <div style={{ fontFamily: V2.serif, fontSize: 18, lineHeight: 1.3, color: V2.ink, flex: 1 }}>{s.t}</div>
              <div style={{ fontFamily: V2.mono, fontSize: 10, letterSpacing: 1, color: A, textTransform: 'uppercase', marginTop: 16 }}>→ {s.tag}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sections — calm, list-like */}
      <div style={{ padding: '60px 40px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {[
            { num: '01', name: 'Финансы', count: '147 материалов', desc: 'Учёт, отчётность, банки, выплаты.' },
            { num: '02', name: 'Налоги', count: '92 материала', desc: 'УСН, НПД, ЕНС, проверки и штрафы.' },
            { num: '03', name: 'Право', count: '64 материала', desc: 'Договоры, споры, ответственность.' },
            { num: '04', name: 'Технологии', count: '108 материалов', desc: 'ЭДО, КЭДО, автоматизация рутины.' },
          ].map((s, i) => (
            <div key={i} style={{ paddingTop: 20, borderTop: `2px solid ${V2.ink}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <span style={{ fontFamily: V2.mono, fontSize: 11, color: V2.muted, letterSpacing: 1 }}>{s.num}</span>
                <span style={{ fontFamily: V2.mono, fontSize: 11, color: V2.muted, letterSpacing: 0.5 }}>{s.count}</span>
              </div>
              <div style={{ fontFamily: V2.serif, fontSize: 36, lineHeight: 1, color: V2.ink, marginBottom: 8 }}>{s.name}</div>
              <div style={{ fontFamily: V2.body, fontSize: 13, color: V2.text, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Newsletter — restrained */}
      <div style={{ padding: '60px 40px 0' }}>
        <div style={{ background: V2.ink, color: V2.paper, padding: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: V2.mono, fontSize: 10, letterSpacing: 1, color: A, marginBottom: 12 }}>// РАССЫЛКА</div>
            <div style={{ fontFamily: V2.serif, fontSize: 44, lineHeight: 1.05, marginBottom: 12 }}>
              Одно письмо в&nbsp;четверг утром.
            </div>
            <div style={{ fontFamily: V2.body, fontSize: 14, color: V2.line2, lineHeight: 1.5 }}>
              Главное за неделю и чек-лист на следующую. 26 000 предпринимателей читают.
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', gap: 0 }}>
              <input placeholder="email@вашбизнес.рф" style={{ flex: 1, background: 'transparent', border: `1px solid ${V2.line2}`, color: V2.paper, padding: '13px 14px', fontFamily: V2.body, fontSize: 14, outline: 'none' }} />
              <button style={{ fontFamily: V2.body, fontWeight: 600, fontSize: 13, padding: '0 22px', background: V2.paper, color: V2.ink, border: 'none', cursor: 'pointer' }}>Подписаться</button>
            </div>
            <div style={{ fontFamily: V2.mono, fontSize: 10, letterSpacing: 0.5, color: V2.line2, marginTop: 10 }}>БЕЗ СПАМА · ОТПИСКА В ОДИН КЛИК</div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.V2 = V2;
window.NavV2 = NavV2;
window.ReadBadge = ReadBadge;
window.HomeV2A = HomeV2A;
