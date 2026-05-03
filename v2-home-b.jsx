/* global React, V2, NavV2, ReadBadge */
const T6 = window.V2;
const NV = window.NavV2;
const RB = window.ReadBadge;

// === V2 — B: Briefing / FT-style — institutional, dense, premium =====
function HomeV2B() {
  const A = T6.blue;
  return (
    <div style={{ width: 1440, background: T6.paper2, color: T6.ink, fontFamily: T6.body, paddingBottom: 80 }}>
      <NV accent={A} />

      {/* Date strip */}
      <div style={{ background: T6.ink, color: T6.paper, padding: '8px 40px', display: 'flex', justifyContent: 'space-between', fontFamily: T6.mono, fontSize: 11, letterSpacing: 0.5 }}>
        <span>ПЯТНИЦА · 1 МАЯ 2026 · ВЫПУСК 47</span>
        <span style={{ color: '#9DB5E8' }}>● ОБНОВЛЕНО 09:42 МСК</span>
      </div>

      {/* Hero — newspaper-like masthead */}
      <div style={{ padding: '36px 40px 24px', borderBottom: `2px solid ${T6.ink}`, textAlign: 'center' }}>
        <div style={{ fontFamily: T6.serif, fontStyle: 'italic', fontSize: 18, color: T6.muted, marginBottom: 8 }}>независимое медиа о практике небольшого бизнеса</div>
        <div style={{ fontFamily: T6.display, fontSize: 200, lineHeight: 0.85, letterSpacing: -3, color: T6.ink }}>ДЕЛО</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, fontFamily: T6.mono, fontSize: 11, color: T6.muted, letterSpacing: 1, marginTop: 12 }}>
          <span>Финансы</span><span>·</span><span>Налоги</span><span>·</span><span>Право</span><span>·</span><span>Технологии</span>
        </div>
      </div>

      {/* Main + 2 columns */}
      <div style={{ padding: '32px 40px 0', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 32 }}>
        {/* Lead story */}
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontFamily: T6.mono, fontSize: 11, color: A, letterSpacing: 1, fontWeight: 600 }}>
            <span>★ ГЛАВНОЕ</span><span style={{ color: T6.muted }}>·</span><span style={{ color: T6.muted }}>НАЛОГИ</span>
          </div>
          <div style={{ fontFamily: T6.serif, fontSize: 60, lineHeight: 1.02, letterSpacing: -0.5, color: T6.ink, marginBottom: 18 }}>
            ЕНС, уведомления и&nbsp;дедлайны: как пройти май без&nbsp;штрафов
          </div>
          <div style={{ fontFamily: T6.body, fontSize: 16, color: T6.text, lineHeight: 1.6, marginBottom: 18, columnCount: 2, columnGap: 28 }}>
            Разбираем по шагам, что заплатить, что подать и где в личном кабинете найти подтверждение, что налоговая всё видит правильно. К 2026 году большинство технических багов починили, но правила игры стали жёстче — за пропуск уведомления штраф приходит автоматически.
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: `1px solid ${T6.line}` }}>
            <div style={{ fontFamily: T6.body, fontSize: 13, color: T6.text }}>
              Ольга Кравец · 29 апреля
            </div>
            <RB mins={12} accent={A} />
          </div>
        </div>

        {/* Column 2 */}
        <div style={{ borderLeft: `1px solid ${T6.line}`, paddingLeft: 28 }}>
          <div style={{ paddingBottom: 18, marginBottom: 18, borderBottom: `1px solid ${T6.line}` }}>
            <div style={{ fontFamily: T6.mono, fontSize: 10, letterSpacing: 1, color: A, marginBottom: 6 }}>ТЕХНОЛОГИИ</div>
            <div style={{ fontFamily: T6.serif, fontSize: 24, lineHeight: 1.15, marginBottom: 8 }}>КЭДО в команде из 12 человек: что меняется</div>
            <div style={{ fontFamily: T6.body, fontSize: 13, color: T6.text, lineHeight: 1.5, marginBottom: 8 }}>Кейс производственного цеха в Туле — что внедрили, сколько вышло.</div>
            <div style={{ display: 'flex', gap: 10, fontFamily: T6.mono, fontSize: 10, color: T6.muted }}>
              <span>М. ЛОНГ</span><span>·</span><span>9 МИН</span>
            </div>
          </div>
          <div>
            <div style={{ fontFamily: T6.mono, fontSize: 10, letterSpacing: 1, color: A, marginBottom: 6 }}>ПРАВО</div>
            <div style={{ fontFamily: T6.serif, fontSize: 24, lineHeight: 1.15, marginBottom: 8 }}>Оферта в интернет-магазине: 7 ошибок из 10</div>
            <div style={{ fontFamily: T6.body, fontSize: 13, color: T6.text, lineHeight: 1.5, marginBottom: 8 }}>Что забывают вписать чаще всего, и какие пункты делают её несостоятельной.</div>
            <div style={{ display: 'flex', gap: 10, fontFamily: T6.mono, fontSize: 10, color: T6.muted }}>
              <span>И. СУХОЙ</span><span>·</span><span>6 МИН</span>
            </div>
          </div>
        </div>

        {/* Column 3 — checklist box */}
        <div style={{ background: T6.ink, color: T6.paper, padding: 24 }}>
          <div style={{ fontFamily: T6.mono, fontSize: 10, letterSpacing: 1, color: '#9DB5E8', marginBottom: 12 }}>★ ЧЕК-ЛИСТ МАЯ</div>
          <div style={{ fontFamily: T6.serif, fontSize: 24, lineHeight: 1.15, marginBottom: 18 }}>4 даты, чтобы&nbsp;пройти май без&nbsp;штрафов</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {[['25.05', 'уведомления'], ['28.05', 'ЕНС'], ['30.05', 'УСН'], ['31.05', 'сверка']].map(([d, t], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.15)', fontSize: 13 }}>
                <span style={{ fontFamily: T6.mono, color: '#9DB5E8' }}>{d}</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
          <button style={{ width: '100%', fontFamily: T6.body, fontSize: 12, fontWeight: 600, padding: '10px', background: T6.paper, color: T6.ink, border: 'none', cursor: 'pointer' }}>Скачать pdf</button>
        </div>
      </div>

      {/* Briefing — what to read this week */}
      <div style={{ padding: '60px 40px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, borderBottom: `2px solid ${T6.ink}`, marginBottom: 0 }}>
          <div style={{ fontFamily: T6.serif, fontSize: 36, color: T6.ink }}>Брифинг недели</div>
          <span style={{ fontFamily: T6.mono, fontSize: 11, color: T6.muted, letterSpacing: 0.5 }}>14 МАТЕРИАЛОВ · ~1 ЧАС НА ВСЁ</span>
        </div>

        {[
          { tag: 'ФИНАНСЫ', date: '25 АПР', mins: 5, t: 'Счёт-фактура без НДС: нужен или нет в 2026', desc: 'Когда ИП на упрощёнке всё-таки обязан её выставить и что в ней писать.', author: 'О. Кравец' },
          { tag: 'ИНТЕРВЬЮ', date: '24 АПР', mins: 11, t: '«Когда у тебя один сотрудник — он важнее, чем клиент»', desc: 'Разговор с владелицей кофейни о найме первого человека.', author: 'Редакция' },
          { tag: 'НАЛОГИ', date: '22 АПР', mins: 7, t: 'Упрощёнка в 2026: пороги, ставки, переходы', desc: 'Что изменилось в правилах применения УСН, и кому пора задуматься о переходе.', author: 'О. Кравец' },
          { tag: 'ПРАВО', date: '20 АПР', mins: 8, t: 'Трудовой или ГПХ: что выбрать для команды из пяти', desc: 'Сравнение двух форматов и риски, о которых обычно не говорят.', author: 'И. Сухой' },
          { tag: 'ТЕХНОЛОГИИ', date: '18 АПР', mins: 13, t: 'СБИС, Контур или Такском: как выбрать оператора ЭДО', desc: 'Сравнили три популярных сервиса по цене, удобству и поддержке.', author: 'М. Лонг' },
        ].map((row, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '110px 110px 1fr 180px 80px',
            gap: 24, padding: '22px 0', borderBottom: `1px solid ${T6.line}`,
            alignItems: 'baseline',
          }}>
            <div style={{ fontFamily: T6.mono, fontSize: 11, letterSpacing: 1, color: A, fontWeight: 600 }}>{row.tag}</div>
            <div style={{ fontFamily: T6.mono, fontSize: 11, color: T6.muted, letterSpacing: 0.5 }}>{row.date}</div>
            <div>
              <div style={{ fontFamily: T6.serif, fontSize: 24, lineHeight: 1.15, color: T6.ink, marginBottom: 6 }}>{row.t}</div>
              <div style={{ fontFamily: T6.body, fontSize: 13, color: T6.text, lineHeight: 1.5 }}>{row.desc}</div>
            </div>
            <div style={{ fontFamily: T6.body, fontSize: 13, color: T6.text }}>{row.author}</div>
            <div style={{ textAlign: 'right' }}><RB mins={row.mins} accent={A} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.HomeV2B = HomeV2B;
