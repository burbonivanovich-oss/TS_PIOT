/* global React, V2, NavV2, ReadBadge */
const T7 = window.V2;
const NV2 = window.NavV2;
const RB2 = window.ReadBadge;

// === V2 — C: Quiet Editorial — Stripe Press meets Monocle ============
// Single warm amber accent; lots of white space; respect for the reader
function HomeV2C() {
  const A = T7.amber;
  return (
    <div style={{ width: 1440, background: T7.white, color: T7.ink, fontFamily: T7.body, paddingBottom: 80 }}>
      <NV2 accent={A} />

      {/* Hero — quiet, big serif, breathing room */}
      <div style={{ padding: '80px 80px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 80, alignItems: 'end' }}>
          <div>
            <div style={{ fontFamily: T7.mono, fontSize: 11, letterSpacing: 1.5, color: A, marginBottom: 24, fontWeight: 600 }}>
              ВЫПУСК 47 — МАЙ 2026
            </div>
            <div style={{ fontFamily: T7.serif, fontSize: 92, lineHeight: 1, letterSpacing: -1, color: T7.ink }}>
              Меньше шума. <br />
              <em style={{ color: A }}>Больше дела.</em>
            </div>
            <div style={{ fontFamily: T7.body, fontSize: 17, color: T7.text, lineHeight: 1.55, marginTop: 28, maxWidth: 520 }}>
              Журнал для предпринимателя, у которого мало времени и много вопросов. Каждая статья — с указанием времени чтения. Прочитал — закрыл — пошёл работать.
            </div>
          </div>
          <div style={{ borderLeft: `1px solid ${T7.line}`, paddingLeft: 28 }}>
            <div style={{ fontFamily: T7.mono, fontSize: 10, letterSpacing: 1.2, color: T7.muted, marginBottom: 12 }}>СЕГОДНЯ</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                ['09:42', 'Обновили чек-лист на май'],
                ['08:15', 'Вышел разбор ЕНС'],
                ['вчера', 'Кейс из цеха в Туле'],
              ].map(([t, label], i) => (
                <div key={i} style={{ display: 'flex', gap: 14, fontSize: 13 }}>
                  <span style={{ fontFamily: T7.mono, color: T7.muted, width: 50 }}>{t}</span>
                  <span style={{ color: T7.text }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Featured — quiet card */}
      <div style={{ padding: '0 80px 80px' }}>
        <div style={{ paddingTop: 32, borderTop: `1px solid ${T7.line}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 32 }}>
            <div style={{ fontFamily: T7.mono, fontSize: 11, letterSpacing: 1.5, color: T7.muted }}>★ ГЛАВНОЕ ЗА НЕДЕЛЮ</div>
            <RB2 mins={12} accent={A} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 60 }}>
            <div>
              <div style={{ fontFamily: T7.mono, fontSize: 11, letterSpacing: 1, color: A, marginBottom: 14, fontWeight: 600 }}>НАЛОГИ · 29 АПРЕЛЯ</div>
              <div style={{ fontFamily: T7.serif, fontSize: 64, lineHeight: 1.05, letterSpacing: -0.5, color: T7.ink, marginBottom: 24 }}>
                ЕНС, уведомления и&nbsp;дедлайны. Как пройти май без&nbsp;штрафов
              </div>
              <div style={{ fontFamily: T7.body, fontSize: 16, color: T7.text, lineHeight: 1.65, marginBottom: 24 }}>
                Что заплатить, что подать и где в личном кабинете найти подтверждение, что налоговая всё видит правильно. Без догадок.
              </div>
              <button style={{ fontFamily: T7.body, fontSize: 13, fontWeight: 600, padding: '13px 22px', background: T7.ink, color: T7.paper, border: 'none', cursor: 'pointer' }}>Читать материал →</button>
            </div>
            <div style={{
              background: T7.paper2, padding: 32, position: 'relative', overflow: 'hidden',
              backgroundImage: 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T7.display, fontSize: 320, color: A, opacity: 0.18, letterSpacing: -6, lineHeight: 0.85 }}>25.05</div>
              <div style={{ position: 'relative', zIndex: 2, fontFamily: T7.mono, fontSize: 11, letterSpacing: 1, color: T7.muted }}>КЛЮЧЕВАЯ ДАТА МЕСЯЦА</div>
            </div>
          </div>
        </div>
      </div>

      {/* Three columns — calm */}
      <div style={{ padding: '0 80px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 14, borderBottom: `1px solid ${T7.line}`, marginBottom: 32 }}>
          <div style={{ fontFamily: T7.serif, fontSize: 36, color: T7.ink }}>Также на этой неделе</div>
          <span style={{ fontFamily: T7.mono, fontSize: 11, color: T7.muted, letterSpacing: 0.5 }}>СМ. ВСЕ →</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
          {[
            { tag: 'ТЕХНОЛОГИИ', date: '27 АПР', mins: 9, t: 'КЭДО в команде из 12 человек: что меняется', desc: 'Кейс производственного цеха в Туле — что внедрили и сколько вышло. С цифрами и сроками.', author: 'Мария Лонг' },
            { tag: 'ПРАВО', date: '26 АПР', mins: 6, t: 'Оферта в интернет-магазине: 7 ошибок из 10', desc: 'Что забывают вписать чаще всего, и какие пункты делают её несостоятельной в спорах.', author: 'Иван Сухой' },
            { tag: 'ФИНАНСЫ', date: '25 АПР', mins: 5, t: 'Счёт-фактура без НДС: нужен или нет', desc: 'Когда ИП на упрощёнке всё-таки обязан её выставить и что туда писать.', author: 'Ольга Кравец' },
          ].map((c, i) => (
            <div key={i}>
              <div style={{ fontFamily: T7.mono, fontSize: 11, letterSpacing: 1, color: A, fontWeight: 600, marginBottom: 12 }}>{c.tag} · {c.date}</div>
              <div style={{ fontFamily: T7.serif, fontSize: 28, lineHeight: 1.15, color: T7.ink, marginBottom: 12 }}>{c.t}</div>
              <div style={{ fontFamily: T7.body, fontSize: 14, color: T7.text, lineHeight: 1.6, marginBottom: 16 }}>{c.desc}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: `1px solid ${T7.line}` }}>
                <span style={{ fontFamily: T7.body, fontSize: 12, color: T7.muted }}>{c.author}</span>
                <RB2 mins={c.mins} accent={A} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reading paths — for the busy reader */}
      <div style={{ padding: '0 80px 80px' }}>
        <div style={{ background: T7.paper2, padding: 60 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 60, alignItems: 'start' }}>
            <div>
              <div style={{ fontFamily: T7.mono, fontSize: 11, letterSpacing: 1.5, color: A, marginBottom: 12, fontWeight: 600 }}>// МАРШРУТЫ ЧТЕНИЯ</div>
              <div style={{ fontFamily: T7.serif, fontSize: 44, lineHeight: 1.05, color: T7.ink }}>
                Если у вас всего <em style={{ color: A }}>5 минут</em>, <br />
                <em style={{ color: A }}>15 минут</em> или <em style={{ color: A }}>час</em>.
              </div>
              <div style={{ fontFamily: T7.body, fontSize: 14, color: T7.text, lineHeight: 1.5, marginTop: 16 }}>
                Подобрали статьи под ваше время — от самых важных коротких заметок до глубоких разборов.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { time: '5 мин', count: '3 заметки', t: 'Что обязательно знать в мае', desc: 'Дедлайны, ключевые суммы и одна новая форма.' },
                { time: '15 мин', count: '2 разбора', t: 'Главное про ЕНС и УСН в 2026', desc: 'Изменения и практика применения с примерами.' },
                { time: '1 час', count: '5 материалов', t: 'Стратегия: как пересобрать налоговый учёт', desc: 'Полный гид от А до Я для предпринимателя на УСН.' },
              ].map((p, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 24,
                  padding: '20px 0', borderBottom: i < 2 ? `1px solid ${T7.line}` : 'none', alignItems: 'baseline',
                }}>
                  <div>
                    <div style={{ fontFamily: T7.display, fontSize: 36, color: A, lineHeight: 1, letterSpacing: -0.5 }}>{p.time}</div>
                    <div style={{ fontFamily: T7.mono, fontSize: 10, color: T7.muted, marginTop: 2, letterSpacing: 0.5 }}>{p.count}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: T7.serif, fontSize: 22, lineHeight: 1.2, marginBottom: 4 }}>{p.t}</div>
                    <div style={{ fontFamily: T7.body, fontSize: 13, color: T7.text }}>{p.desc}</div>
                  </div>
                  <span style={{ fontFamily: T7.serif, fontSize: 28, color: T7.muted }}>→</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div style={{ padding: '0 80px' }}>
        <div style={{ paddingTop: 40, borderTop: `1px solid ${T7.line}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: T7.mono, fontSize: 11, letterSpacing: 1.5, color: A, marginBottom: 14, fontWeight: 600 }}>// РАССЫЛКА</div>
            <div style={{ fontFamily: T7.serif, fontSize: 44, lineHeight: 1.05, color: T7.ink }}>
              Одно письмо <br />
              в&nbsp;четверг утром.
            </div>
            <div style={{ fontFamily: T7.body, fontSize: 14, color: T7.text, lineHeight: 1.55, marginTop: 14 }}>
              Главное за неделю и чек-лист на следующую. 26 000 предпринимателей читают.
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${T7.ink}`, paddingBottom: 8 }}>
              <input placeholder="email@вашбизнес.рф" style={{ flex: 1, background: 'transparent', border: 'none', color: T7.ink, padding: '8px 0', fontFamily: T7.body, fontSize: 18, outline: 'none' }} />
              <button style={{ fontFamily: T7.body, fontWeight: 600, fontSize: 14, padding: 0, background: 'transparent', color: T7.ink, border: 'none', cursor: 'pointer' }}>Подписаться →</button>
            </div>
            <div style={{ fontFamily: T7.mono, fontSize: 10, letterSpacing: 0.5, color: T7.muted, marginTop: 10 }}>БЕЗ СПАМА · ОТПИСКА В ОДИН КЛИК</div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.HomeV2C = HomeV2C;
