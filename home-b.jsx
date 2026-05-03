/* global React, DELO_TOKENS, DeloNav, DeloTag */
const T2 = window.DELO_TOKENS;
const Nav2 = window.DeloNav;
const Tag2 = window.DeloTag;

// Variant B — TYPOGRAPHIC LIST / Substack-meets-Brutalist
function HomeB() {
  return (
    <div style={{ width: 1440, background: T2.paper, color: T2.ink, fontFamily: T2.body, paddingBottom: 80 }}>
      <Nav2 />

      {/* Tickers */}
      <div style={{ background: T2.lime, color: T2.ink, padding: '8px 0', overflow: 'hidden', whiteSpace: 'nowrap', borderBottom: `1px solid ${T2.ink}` }}>
        <div style={{ fontFamily: T2.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', display: 'flex', gap: 32, padding: '0 48px' }}>
          <span>★ НОВОЕ: ИЗМЕНЕНИЯ В НАЛОГЕ НА ПРОФ.ДОХОД</span>
          <span>·</span>
          <span>ФНС ОБНОВИЛА ФОРМАТ УВЕДОМЛЕНИЙ</span>
          <span>·</span>
          <span>МАЛЫЙ БИЗНЕС: 73% ИСПОЛЬЗУЮТ ЭДО</span>
          <span>·</span>
          <span>★ НОВОЕ: ИЗМЕНЕНИЯ В НАЛОГЕ</span>
        </div>
      </div>

      {/* Hero — typographic */}
      <div style={{ padding: '80px 48px 60px', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 48, alignItems: 'end' }}>
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
              <Tag2 color="ink">ВЫПУСК 47</Tag2>
              <span style={{ fontFamily: T2.mono, fontSize: 11, letterSpacing: 1.2, color: T2.gray500, padding: '6px 0' }}>1 МАЯ 2026 / Г. МОСКВА</span>
            </div>
            <div style={{ fontFamily: T2.display, fontSize: 240, lineHeight: 0.82, letterSpacing: -3 }}>
              <span>ДЕЛО</span><span style={{ color: T2.pink }}>.</span><br />
              <span style={{ color: T2.gray500 }}>ИЗ </span>
              <span>ПЕРВЫХ</span><br />
              <span style={{ color: T2.gray500 }}>РУК.</span>
            </div>
          </div>
          <div style={{ paddingBottom: 24 }}>
            <div style={{ fontFamily: T2.serif, fontStyle: 'italic', fontSize: 24, lineHeight: 1.2, color: T2.gray700, marginBottom: 16 }}>
              Независимое медиа о практике небольшого бизнеса.
            </div>
            <div style={{ fontFamily: T2.body, fontSize: 14, color: T2.gray700, lineHeight: 1.55 }}>
              Финансы, налоги, право и технологии — для тех, кто принимает решения сам. Каждую неделю — новые материалы от практиков.
            </div>
          </div>
        </div>
      </div>

      {/* Featured — split horizontal */}
      <div style={{ padding: '0 48px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: `1px solid ${T2.ink}` }}>
          <div style={{
            background: T2.ink, color: T2.paper, padding: 40, position: 'relative', overflow: 'hidden', minHeight: 420,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div style={{ position: 'absolute', right: -30, bottom: -100, fontFamily: T2.display, fontSize: 380, lineHeight: 0.85, color: T2.pink, letterSpacing: -6 }}>ЕНС</div>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <Tag2 color="lime">★ ГЛАВНОЕ</Tag2>
                <Tag2 color="pink">#НАЛОГИ</Tag2>
              </div>
              <div style={{ fontFamily: T2.mono, fontSize: 11, letterSpacing: 1.2, color: T2.gray300 }}>29 АПРЕЛЯ 2026 · 12 МИН ЧТЕНИЯ</div>
            </div>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ fontFamily: T2.display, fontSize: 80, lineHeight: 0.92, letterSpacing: -0.5 }}>
                ЕНС, УВЕДОМЛЕНИЯ И ДЕДЛАЙНЫ. КАК НЕ ЗАЛИПНУТЬ В МАЕ
              </div>
            </div>
          </div>
          <div style={{ background: T2.paper, padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: T2.serif, fontStyle: 'italic', fontSize: 32, lineHeight: 1.25, color: T2.ink, marginBottom: 24 }}>
                «Налоговая знает о тебе всё. Главное — чтобы то, что она знает, совпадало с тем, что у тебя в учёте».
              </div>
              <div style={{ fontFamily: T2.body, fontSize: 15, color: T2.gray700, lineHeight: 1.55 }}>
                Разобрали по шагам: какие платежи в ЕНС не пропустить, какие уведомления подать в этом месяце, как читать сверку и где в ЛК скрыта вся информация.
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: T2.gray200, border: `1px solid ${T2.gray300}` }} />
                <div>
                  <div style={{ fontFamily: T2.body, fontSize: 13, fontWeight: 600 }}>Ольга Кравец</div>
                  <div style={{ fontFamily: T2.mono, fontSize: 10, letterSpacing: 1, color: T2.gray500 }}>РЕДАКТОР · ФИНАНСЫ</div>
                </div>
              </div>
              <button style={{ fontFamily: T2.body, fontWeight: 600, fontSize: 13, padding: '14px 22px', background: T2.ink, color: T2.paper, border: 'none', cursor: 'pointer', letterSpacing: 0.3 }}>Читать материал →</button>
            </div>
          </div>
        </div>
      </div>

      {/* Latest list — typographic */}
      <div style={{ padding: '40px 48px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 0, paddingBottom: 16, borderBottom: `2px solid ${T2.ink}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontFamily: T2.mono, fontSize: 11, letterSpacing: 1.5, color: T2.gray500 }}>// СВЕЖЕЕ</span>
            <div style={{ fontFamily: T2.display, fontSize: 56, lineHeight: 0.9, letterSpacing: -0.5 }}>ЛЕНТА</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ВСЕ', 'ФИНАНСЫ', 'НАЛОГИ', 'ПРАВО', 'ТЕХ'].map((t, i) => (
              <span key={i} style={{
                fontFamily: T2.mono, fontSize: 11, letterSpacing: 1, padding: '6px 12px',
                background: i === 0 ? T2.ink : 'transparent',
                color: i === 0 ? T2.paper : T2.ink,
                border: i === 0 ? 'none' : `1px solid ${T2.gray300}`,
              }}>{t}</span>
            ))}
          </div>
        </div>

        {[
          { num: '01', date: '28 АПР', read: '6 МИН', tag: '#ПРАВО', tagColor: 'pink', title: 'ОФЕРТА В ИНТЕРНЕТ-МАГАЗИНЕ: 7 ОШИБОК ИЗ 10', author: 'Иван Сухой', desc: 'Чем отличается публичная оферта от обычного договора, и какие пункты обычно забывают.' },
          { num: '02', date: '27 АПР', read: '9 МИН', tag: '#ТЕХ', tagColor: 'lime', title: 'КЭДО В МАЛОМ БИЗНЕСЕ: ЧТО МЕНЯЕТСЯ ДЛЯ КОМПАНИИ ИЗ 12 ЧЕЛОВЕК', author: 'Мария Лонг', desc: 'Кейс из производственного цеха в Туле. Что внедрили, сколько заплатили, и зачем.' },
          { num: '03', date: '25 АПР', read: '5 МИН', tag: '#ФИНАНСЫ', tagColor: 'outline', title: 'СЧЁТ-ФАКТУРА БЕЗ НДС — НУЖЕН ИЛИ НЕТ В 2026', author: 'Ольга Кравец', desc: 'Когда ИП на упрощёнке всё-таки обязан выставить счёт-фактуру и что в ней писать.' },
          { num: '04', date: '24 АПР', read: '11 МИН', tag: '#ИНТЕРВЬЮ', tagColor: 'ink', title: '«КОГДА У ТЕБЯ ОДИН СОТРУДНИК — ОН ВАЖНЕЕ, ЧЕМ КЛИЕНТ»', author: 'Редакция', desc: 'Разговор с владелицей кофейни о найме первого человека и о том, как не сломаться об роль работодателя.' },
          { num: '05', date: '22 АПР', read: '7 МИН', tag: '#НАЛОГИ', tagColor: 'pink', title: 'УПРОЩЁНКА В 2026: ПОРОГИ, СТАВКИ, ПЕРЕХОДЫ', author: 'Ольга Кравец', desc: 'Что изменилось в правилах применения УСН в этом году, и кому пора задуматься о переходе на ОСНО.' },
        ].map((row, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '60px 100px 80px 1fr 200px 60px',
            gap: 24, padding: '32px 0', borderBottom: `1px solid ${T2.gray300}`,
            alignItems: 'baseline',
          }}>
            <div style={{ fontFamily: T2.mono, fontSize: 13, color: T2.gray500, letterSpacing: 0.5 }}>{row.num}.</div>
            <div style={{ fontFamily: T2.mono, fontSize: 11, letterSpacing: 1, color: T2.gray500 }}>{row.date}<br /><span style={{ color: T2.gray300 }}>{row.read}</span></div>
            <div><Tag2 color={row.tagColor} size={10}>{row.tag}</Tag2></div>
            <div>
              <div style={{ fontFamily: T2.display, fontSize: 36, lineHeight: 0.95, letterSpacing: -0.3 }}>{row.title}</div>
              <div style={{ fontFamily: T2.body, fontSize: 14, color: T2.gray700, lineHeight: 1.5, marginTop: 10, maxWidth: 580 }}>{row.desc}</div>
            </div>
            <div style={{ fontFamily: T2.body, fontSize: 13, color: T2.gray700 }}>{row.author}</div>
            <div style={{ fontFamily: T2.display, fontSize: 24, color: T2.gray300, textAlign: 'right' }}>→</div>
          </div>
        ))}
      </div>

      {/* Authors block */}
      <div style={{ padding: '80px 48px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 32, paddingBottom: 16, borderBottom: `1px solid ${T2.gray300}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontFamily: T2.mono, fontSize: 11, letterSpacing: 1.5, color: T2.gray500 }}>// РЕДАКЦИЯ</span>
            <div style={{ fontFamily: T2.display, fontSize: 56, lineHeight: 0.9, letterSpacing: -0.5 }}>КТО ПИШЕТ</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {[
            { name: 'Ольга Кравец', role: 'Финансы и налоги', count: '34 материала' },
            { name: 'Иван Сухой', role: 'Право и договоры', count: '21 материал' },
            { name: 'Мария Лонг', role: 'Технологии', count: '47 материалов' },
            { name: 'Антон Реш', role: 'Кейсы и интервью', count: '18 материалов' },
          ].map((a, i) => (
            <div key={i} style={{ paddingTop: 16, borderTop: `2px solid ${T2.ink}` }}>
              <div style={{ height: 200, background: T2.gray100, marginBottom: 14, position: 'relative', overflow: 'hidden',
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0,0,0,0.04) 8px, rgba(0,0,0,0.04) 9px)' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T2.mono, fontSize: 10, color: T2.gray500 }}>портрет</div>
              </div>
              <div style={{ fontFamily: T2.display, fontSize: 32, lineHeight: 0.95 }}>{a.name.toUpperCase()}</div>
              <div style={{ fontFamily: T2.body, fontSize: 13, color: T2.gray700, marginTop: 4 }}>{a.role}</div>
              <div style={{ fontFamily: T2.mono, fontSize: 10, letterSpacing: 1, color: T2.gray500, marginTop: 6 }}>{a.count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.HomeB = HomeB;
