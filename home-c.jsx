/* global React, DELO_TOKENS, DeloNav, DeloTag */
const T3 = window.DELO_TOKENS;
const Nav3 = window.DeloNav;
const Tag3 = window.DeloTag;

// Variant C — DARK MODERN / Acid B2B
function HomeC() {
  return (
    <div style={{ width: 1440, background: T3.ink, color: T3.paper, fontFamily: T3.body, paddingBottom: 80,
      backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
      backgroundSize: '48px 48px',
    }}>
      <Nav3 dark />

      {/* Hero — full bleed dark with giant typo */}
      <div style={{ padding: '60px 48px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* huge bg word */}
        <div style={{
          position: 'absolute', top: 40, left: -30, fontFamily: T3.display,
          fontSize: 520, lineHeight: 0.85, color: 'rgba(255,255,255,0.03)', letterSpacing: -6, pointerEvents: 'none',
        }}>BUSINESS</div>

        <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginTop: 40 }}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 36 }}>
              <Tag3 color="lime">МЕДИА · 2026</Tag3>
              <span style={{ fontFamily: T3.mono, fontSize: 11, letterSpacing: 1.2, color: T3.gray300, padding: '6px 0' }}>1 МАЯ / 26 000 ПОДПИСЧИКОВ</span>
            </div>
            <div style={{ fontFamily: T3.display, fontSize: 184, lineHeight: 0.82, letterSpacing: -2, color: T3.paper }}>
              ПРАКТИКА.<br />
              <span style={{ color: T3.lime }}>НЕ</span> ТЕОРИЯ.
            </div>
            <div style={{ marginTop: 32, fontFamily: T3.body, fontSize: 17, lineHeight: 1.5, color: T3.gray300, maxWidth: 480 }}>
              Журнал для тех, кто строит дело сам. Налоги, законы, технологии и истории — без воды и ритуальных оборотов.
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
              <button style={{ fontFamily: T3.body, fontWeight: 600, fontSize: 14, padding: '14px 22px', background: T3.pink, color: T3.ink, border: 'none', cursor: 'pointer' }}>Читать главное →</button>
              <button style={{ fontFamily: T3.body, fontWeight: 600, fontSize: 14, padding: '14px 22px', background: 'transparent', color: T3.paper, border: `1px solid ${T3.paper}`, cursor: 'pointer' }}>Подписаться на email</button>
            </div>
          </div>

          {/* Right: featured card */}
          <div style={{ background: T3.paper, color: T3.ink, padding: 32, position: 'relative', overflow: 'hidden', alignSelf: 'start' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, background: T3.pink, padding: '8px 14px', fontFamily: T3.mono, fontSize: 11, letterSpacing: 1.2, fontWeight: 600 }}>★ ГЛАВНОЕ</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, marginTop: 16 }}>
              <Tag3 color="outline">#НАЛОГИ</Tag3>
              <span style={{ fontFamily: T3.mono, fontSize: 10, letterSpacing: 1.2, color: T3.gray500, padding: '6px 0' }}>29 АПР · 12 МИН</span>
            </div>
            <div style={{ fontFamily: T3.display, fontSize: 64, lineHeight: 0.92, letterSpacing: -0.5 }}>
              ЕНС, УВЕДОМЛЕНИЯ И ДЕДЛАЙНЫ. КАК НЕ ЗАЛИПНУТЬ В МАЕ
            </div>
            <div style={{ fontFamily: T3.body, fontSize: 14, color: T3.gray700, lineHeight: 1.5, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T3.gray300}` }}>
              По шагам: что заплатить, что подать, и где взять подтверждения.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <div style={{ fontFamily: T3.body, fontSize: 13, color: T3.gray700 }}>
                <span style={{ color: T3.ink, fontWeight: 600 }}>Ольга Кравец</span> · редактор
              </div>
              <span style={{ fontFamily: T3.display, fontSize: 28, color: T3.ink }}>→</span>
            </div>
          </div>
        </div>
      </div>

      {/* Three highlights — sharp grid */}
      <div style={{ padding: '0 48px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 32, paddingBottom: 16, borderBottom: `1px solid rgba(255,255,255,0.15)` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontFamily: T3.mono, fontSize: 11, letterSpacing: 1.5, color: T3.gray300 }}>// СВЕЖЕЕ</span>
            <div style={{ fontFamily: T3.display, fontSize: 56, lineHeight: 0.9, letterSpacing: -0.5 }}>НА ЭТОЙ НЕДЕЛЕ</div>
          </div>
          <span style={{ fontFamily: T3.mono, fontSize: 11, letterSpacing: 1, color: T3.gray300 }}>ВСЕ МАТЕРИАЛЫ →</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, border: `1px solid rgba(255,255,255,0.15)` }}>
          {[
            { tag: '#ТЕХ', tagColor: 'lime', accent: T3.lime, num: '01', date: '27 АПР · 9 МИН', title: 'КЭДО В МАЛОМ БИЗНЕСЕ: ЧТО МЕНЯЕТСЯ', desc: 'Кейс из производственного цеха в Туле — что внедрили и сколько стоило.' },
            { tag: '#ПРАВО', tagColor: 'pink', accent: T3.pink, num: '02', date: '26 АПР · 6 МИН', title: 'ОФЕРТА В ИНТЕРНЕТ-МАГАЗИНЕ: 7 ОШИБОК', desc: 'Чем отличается публичная оферта от договора, и что обычно забывают вписать.' },
            { tag: '#ФИНАНСЫ', tagColor: 'outline', accent: T3.paper, num: '03', date: '25 АПР · 5 МИН', title: 'СЧЁТ-ФАКТУРА БЕЗ НДС: НУЖЕН ИЛИ НЕТ', desc: 'Когда ИП на упрощёнке всё-таки обязан выставить счёт-фактуру.' },
          ].map((c, i) => (
            <div key={i} style={{
              padding: 28, borderRight: i < 2 ? `1px solid rgba(255,255,255,0.15)` : 'none',
              minHeight: 380, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', right: -10, top: -30, fontFamily: T3.display, fontSize: 200, color: 'rgba(255,255,255,0.04)', letterSpacing: -4 }}>{c.num}</div>
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <Tag3 color={c.tagColor === 'outline' ? 'ink' : c.tagColor}>{c.tag}</Tag3>
                  <span style={{ fontFamily: T3.mono, fontSize: 10, letterSpacing: 1, color: T3.gray300, padding: '6px 0' }}>{c.date}</span>
                </div>
              </div>
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ width: 32, height: 4, background: c.accent, marginBottom: 16 }} />
                <div style={{ fontFamily: T3.display, fontSize: 36, lineHeight: 0.95, letterSpacing: -0.3 }}>{c.title}</div>
                <div style={{ fontFamily: T3.body, fontSize: 13, color: T3.gray300, lineHeight: 1.5, marginTop: 12 }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Topics with stats */}
      <div style={{ padding: '0 48px 80px' }}>
        <div style={{ background: T3.paper, color: T3.ink, padding: '48px 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 36 }}>
            <div style={{ fontFamily: T3.display, fontSize: 80, lineHeight: 0.9, letterSpacing: -0.5 }}>4 РАЗДЕЛА.<br />411 МАТЕРИАЛОВ.</div>
            <div style={{ fontFamily: T3.body, fontSize: 14, color: T3.gray700, maxWidth: 320, lineHeight: 1.5 }}>
              Темы, которые волнуют каждого, кто принимает решения в малом бизнесе. Без поверхностного — только то, что нужно в работе.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: `1px solid ${T3.gray300}` }}>
            {[
              { num: '01', name: 'Финансы', count: '147', dot: T3.pink },
              { num: '02', name: 'Налоги', count: '92', dot: T3.lime },
              { num: '03', name: 'Право', count: '64', dot: T3.blue },
              { num: '04', name: 'Технологии', count: '108', dot: T3.ink },
            ].map((s, i) => (
              <div key={i} style={{ padding: '24px 20px', borderRight: i < 3 ? `1px solid ${T3.gray300}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontFamily: T3.mono, fontSize: 10, letterSpacing: 1.2, color: T3.gray500 }}>{s.num}</span>
                  <span style={{ width: 8, height: 8, background: s.dot, borderRadius: '50%' }} />
                </div>
                <div style={{ fontFamily: T3.display, fontSize: 56, lineHeight: 0.9, letterSpacing: -0.5 }}>{s.count}</div>
                <div style={{ fontFamily: T3.body, fontSize: 14, color: T3.gray700, marginTop: 6 }}>{s.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div style={{ padding: '0 48px' }}>
        <div style={{
          border: `1px solid rgba(255,255,255,0.15)`, padding: '60px 48px', position: 'relative', overflow: 'hidden',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'end',
        }}>
          <div style={{ position: 'absolute', right: -20, top: -100, fontFamily: T3.display, fontSize: 380, color: T3.lime, opacity: 0.95, letterSpacing: -6 }}>+1</div>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ fontFamily: T3.mono, fontSize: 10, letterSpacing: 1.5, color: T3.lime, marginBottom: 12 }}>// РАССЫЛКА</div>
            <div style={{ fontFamily: T3.display, fontSize: 96, lineHeight: 0.88, letterSpacing: -1 }}>ЧЕТВЕРГ.<br />УТРО.</div>
          </div>
          <div style={{ position: 'relative', zIndex: 2, maxWidth: 420 }}>
            <div style={{ fontFamily: T3.body, fontSize: 15, color: T3.gray300, lineHeight: 1.5, marginBottom: 20 }}>
              Одно письмо в неделю с главным. Без спама и продаж в лоб. 26 000 предпринимателей уже читают.
            </div>
            <div style={{ display: 'flex', gap: 0 }}>
              <input placeholder="email@вашбизнес.рф" style={{ flex: 1, background: 'transparent', border: `1px solid ${T3.gray300}`, color: T3.paper, padding: '14px 16px', fontFamily: T3.body, fontSize: 14, outline: 'none' }} />
              <button style={{ fontFamily: T3.body, fontWeight: 600, fontSize: 13, padding: '0 22px', background: T3.lime, color: T3.ink, border: 'none', cursor: 'pointer' }}>Подписаться</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.HomeC = HomeC;
