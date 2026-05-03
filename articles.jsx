/* global React, DELO_TOKENS, DeloNav, DeloTag */
const T4 = window.DELO_TOKENS;
const Nav4 = window.DeloNav;
const Tag4 = window.DeloTag;

// ARTICLES INDEX — magazine-style listing with filters
function Articles() {
  return (
    <div style={{ width: 1440, background: T4.paper, color: T4.ink, fontFamily: T4.body, paddingBottom: 80 }}>
      <Nav4 />

      {/* Page header */}
      <div style={{ padding: '60px 48px 40px', borderBottom: `1px solid ${T4.gray300}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: T4.mono, fontSize: 11, letterSpacing: 1.5, color: T4.gray500, marginBottom: 16 }}>ГЛАВНАЯ / СТАТЬИ</div>
            <div style={{ fontFamily: T4.display, fontSize: 200, lineHeight: 0.85, letterSpacing: -3 }}>
              ВСЁ<span style={{ color: T4.pink }}>.</span>
            </div>
            <div style={{ fontFamily: T4.serif, fontStyle: 'italic', fontSize: 28, color: T4.gray700, marginTop: 12 }}>411 материалов о практике небольшого бизнеса</div>
          </div>
          <div style={{ display: 'flex', gap: 0, border: `1px solid ${T4.gray300}` }}>
            <input placeholder="Поиск по статьям..." style={{ width: 280, padding: '12px 16px', border: 'none', fontFamily: T4.body, fontSize: 14, background: 'transparent', outline: 'none' }} />
            <button style={{ background: T4.ink, color: T4.paper, border: 'none', padding: '0 18px', fontFamily: T4.mono, fontSize: 12, letterSpacing: 1, cursor: 'pointer' }}>⌕</button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', borderBottom: `1px solid ${T4.gray300}` }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontFamily: T4.mono, fontSize: 11, letterSpacing: 1.2, color: T4.gray500, marginRight: 12 }}>РАЗДЕЛ:</span>
          {[
            { name: 'Все', count: 411, active: true },
            { name: 'Финансы', count: 147 },
            { name: 'Налоги', count: 92 },
            { name: 'Право', count: 64 },
            { name: 'Технологии', count: 108 },
            { name: 'Кейсы', count: 38 },
          ].map((f, i) => (
            <span key={i} style={{
              fontFamily: T4.body, fontSize: 13, fontWeight: 500, padding: '8px 14px',
              background: f.active ? T4.ink : 'transparent',
              color: f.active ? T4.paper : T4.ink,
              border: f.active ? 'none' : `1px solid ${T4.gray300}`, cursor: 'pointer',
            }}>
              {f.name}<span style={{ marginLeft: 8, color: f.active ? T4.gray300 : T4.gray500, fontFamily: T4.mono, fontSize: 11 }}>{f.count}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontFamily: T4.mono, fontSize: 11, letterSpacing: 1.2, color: T4.gray500 }}>СОРТ:</span>
          <span style={{ fontFamily: T4.body, fontSize: 13, fontWeight: 600 }}>Сначала новые ↓</span>
        </div>
      </div>

      {/* Featured row — 2 large */}
      <div style={{ padding: '40px 48px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32, marginBottom: 60 }}>
          <div>
            <div style={{
              height: 380, background: T4.ink, color: T4.paper, padding: 36, position: 'relative', overflow: 'hidden',
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div style={{ position: 'absolute', right: -20, bottom: -100, fontFamily: T4.display, fontSize: 380, color: T4.pink, letterSpacing: -6 }}>ЕНС</div>
              <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 8 }}>
                <Tag4 color="lime">★ ГЛАВНОЕ</Tag4>
                <Tag4 color="pink">#НАЛОГИ</Tag4>
              </div>
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ fontFamily: T4.display, fontSize: 64, lineHeight: 0.92, letterSpacing: -0.5 }}>
                  ЕНС, УВЕДОМЛЕНИЯ И ДЕДЛАЙНЫ. КАК НЕ ЗАЛИПНУТЬ В МАЕ
                </div>
                <div style={{ fontFamily: T4.mono, fontSize: 11, letterSpacing: 1, color: T4.gray300, marginTop: 14 }}>29 АПРЕЛЯ · 12 МИН · ОЛЬГА КРАВЕЦ</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { tag: '#ТЕХ', tc: 'lime', t: 'КЭДО В МАЛОМ БИЗНЕСЕ: КЕЙС ИЗ ЦЕХА В ТУЛЕ', meta: '27 АПР · 9 МИН' },
              { tag: '#ПРАВО', tc: 'pink', t: 'ОФЕРТА В ИНТЕРНЕТ-МАГАЗИНЕ: 7 ОШИБОК', meta: '26 АПР · 6 МИН' },
            ].map((c, i) => (
              <div key={i} style={{ flex: 1, background: i === 0 ? T4.lime : T4.paper, padding: 24, position: 'relative', border: i === 1 ? `1px solid ${T4.ink}` : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Tag4 color={i === 0 ? 'ink' : c.tc}>{c.tag}</Tag4>
                <div>
                  <div style={{ fontFamily: T4.display, fontSize: 32, lineHeight: 0.95, letterSpacing: -0.3 }}>{c.t}</div>
                  <div style={{ fontFamily: T4.mono, fontSize: 10, letterSpacing: 1, color: T4.gray700, marginTop: 12 }}>{c.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of articles */}
      <div style={{ padding: '0 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 28, paddingBottom: 14, borderBottom: `2px solid ${T4.ink}` }}>
          <div style={{ fontFamily: T4.display, fontSize: 40, lineHeight: 0.9, letterSpacing: -0.3 }}>АРХИВ — АПРЕЛЬ 2026</div>
          <span style={{ fontFamily: T4.mono, fontSize: 11, letterSpacing: 1, color: T4.gray500 }}>34 МАТЕРИАЛА</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, marginBottom: 60 }}>
          {[
            { tag: '#ФИНАНСЫ', tc: 'outline', date: '25 АПР', read: '5 МИН', t: 'СЧЁТ-ФАКТУРА БЕЗ НДС: НУЖЕН ИЛИ НЕТ', author: 'О. Кравец', desc: 'Когда ИП на упрощёнке всё-таки обязан выставить счёт-фактуру.' },
            { tag: '#ИНТЕРВЬЮ', tc: 'ink', date: '24 АПР', read: '11 МИН', t: '«КОГДА У ТЕБЯ ОДИН СОТРУДНИК — ОН ВАЖНЕЕ КЛИЕНТА»', author: 'Редакция', desc: 'Разговор с владелицей кофейни о найме первого человека.' },
            { tag: '#НАЛОГИ', tc: 'pink', date: '22 АПР', read: '7 МИН', t: 'УПРОЩЁНКА В 2026: ПОРОГИ, СТАВКИ, ПЕРЕХОДЫ', author: 'О. Кравец', desc: 'Что изменилось в правилах применения УСН в этом году.' },
            { tag: '#ПРАВО', tc: 'pink', date: '20 АПР', read: '8 МИН', t: 'ТРУДОВОЙ ИЛИ ГПХ: ЧТО ВЫБРАТЬ ДЛЯ КОМАНДЫ ИЗ 5', author: 'И. Сухой', desc: 'Сравнение двух форматов и риски, о которых обычно не говорят.' },
            { tag: '#ТЕХ', tc: 'lime', date: '18 АПР', read: '13 МИН', t: 'СБИС, КОНТУР ИЛИ ТАКСКОМ: КАК ВЫБРАТЬ ОПЕРАТОРА ЭДО', author: 'М. Лонг', desc: 'Сравнили три популярных сервиса по цене, удобству и поддержке.' },
            { tag: '#ФИНАНСЫ', tc: 'outline', date: '16 АПР', read: '6 МИН', t: 'КАК ЧИТАТЬ ВЫПИСКУ ИЗ ЕНС', author: 'О. Кравец', desc: 'Что значат строки в личном кабинете и как заметить ошибку до штрафа.' },
            { tag: '#КЕЙС', tc: 'ink', date: '14 АПР', read: '14 МИН', t: 'КАК ОТКРЫТЬ КОФЕЙНЮ В РЕГИОНЕ И НЕ ПРОГОРЕТЬ ЗА ГОД', author: 'А. Реш', desc: 'Цифры, ошибки и решения от владельца сети из трёх точек в Перми.' },
            { tag: '#НАЛОГИ', tc: 'pink', date: '12 АПР', read: '4 МИН', t: 'НПД: КОГДА САМОЗАНЯТОМУ ВЫГОДНО ВЫЙТИ В ИП', author: 'О. Кравец', desc: 'Точка перехода в цифрах и список преимуществ ИП.' },
            { tag: '#ТЕХ', tc: 'lime', date: '10 АПР', read: '10 МИН', t: 'ЧАТ-БОТ ДЛЯ ПОДДЕРЖКИ КЛИЕНТОВ ЗА ВЫХОДНЫЕ', author: 'М. Лонг', desc: 'Гайд: как собрать рабочего бота на готовых блоках за 2 дня.' },
          ].map((a, i) => (
            <div key={i} style={{ paddingBottom: 24, borderBottom: `1px solid ${T4.gray300}` }}>
              <div style={{
                height: 200, marginBottom: 16, position: 'relative', overflow: 'hidden',
                background: i % 4 === 0 ? T4.ink : i % 4 === 1 ? T4.lime : i % 4 === 2 ? T4.pink : T4.gray100,
                backgroundImage: i % 4 < 2 ? 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)' : 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0,0,0,0.03) 8px, rgba(0,0,0,0.03) 9px)',
                backgroundSize: '24px 24px',
              }}>
                {i % 4 === 0 && (
                  <div style={{ position: 'absolute', right: -6, bottom: -36, fontFamily: T4.display, fontSize: 160, color: T4.pink, letterSpacing: -4, lineHeight: 0.85 }}>{a.tag.replace('#','')}</div>
                )}
                <div style={{ position: 'absolute', top: 12, left: 12 }}><Tag4 color={a.tc}>{a.tag}</Tag4></div>
                <div style={{ position: 'absolute', bottom: 12, right: 12, fontFamily: T4.mono, fontSize: 10, letterSpacing: 1, color: i % 4 === 0 ? T4.gray300 : T4.gray700 }}>{a.date} · {a.read}</div>
              </div>
              <div style={{ fontFamily: T4.display, fontSize: 28, lineHeight: 0.95, letterSpacing: -0.2 }}>{a.t}</div>
              <div style={{ fontFamily: T4.body, fontSize: 13, color: T4.gray700, lineHeight: 1.5, marginTop: 10 }}>{a.desc}</div>
              <div style={{ fontFamily: T4.mono, fontSize: 10, letterSpacing: 1, color: T4.gray500, marginTop: 12 }}>— {a.author}</div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0', borderTop: `1px solid ${T4.gray300}` }}>
          <span style={{ fontFamily: T4.mono, fontSize: 11, letterSpacing: 1, color: T4.gray500 }}>СТРАНИЦА 1 ИЗ 28</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {['1', '2', '3', '...', '28'].map((p, i) => (
              <span key={i} style={{
                fontFamily: T4.body, fontSize: 14, fontWeight: 600, padding: '10px 14px', minWidth: 40, textAlign: 'center',
                background: i === 0 ? T4.ink : 'transparent', color: i === 0 ? T4.paper : T4.ink, cursor: 'pointer',
              }}>{p}</span>
            ))}
            <span style={{ fontFamily: T4.body, fontSize: 14, fontWeight: 600, padding: '10px 18px', border: `1px solid ${T4.ink}`, marginLeft: 8 }}>След. →</span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Articles = Articles;
