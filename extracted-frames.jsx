/* global React */
// Extracted frames from article-v15 — surfaced as standalone artboards
// per Karen's feedback ("выдели в отдельный фрейм")

const TX = window.DELO_TOKENS;

const ACC = '#C8632A';
const ACC_SOFT = '#F0E4D2';
const PAPER = '#F4F1EA';
const PAPER2 = '#EDE9DF';
const WHITE = '#FBFAF6';
const INK = '#171513';
const TEXT = '#3A3631';
const MUTED = '#7A746A';
const LINE = '#D9D4C7';
const LINE2 = '#C2BCAC';

const Mono = ({ children, color = MUTED, size = 11, ls = 1.5, style: extraStyle, ...rest }) => (
  <span {...rest} style={{ fontFamily: TX.mono, fontSize: size, letterSpacing: ls, color, fontWeight: 600, ...(extraStyle || {}) }}>{children}</span>
);

// Caption above each extracted frame, so it's clear what we're looking at
const FrameLabel = ({ n, t, d }) => (
  <div style={{ padding: '24px 40px 18px', background: '#EDE9DF', borderBottom: `1px solid ${LINE2}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
      <Mono color={ACC} size={10}>// EXTRACTED FRAME · {n}</Mono>
      <Mono color={MUTED} size={10}>ИЗ СТАТЬИ V1.5</Mono>
    </div>
    <div style={{ fontFamily: TX.display, fontSize: 30, lineHeight: 1, letterSpacing: -0.2, color: INK }}>{t}</div>
    <div style={{ fontFamily: TX.serif, fontStyle: 'italic', fontSize: 14, color: MUTED, marginTop: 6 }}>{d}</div>
  </div>
);

// =================================================================
// FRAME 01 — HERO (split-screen photo + editorial title)
// =================================================================
function FrameHero() {
  return (
    <div style={{ width: 1440, background: PAPER, fontFamily: TX.body }}>
      <FrameLabel n="01" t="ШАПКА СТАТЬИ" d="Editorial split-screen: фото с оверлеем слева, заголовочный блок справа. Высота 600px." />
      <div style={{ display: 'grid', gridTemplateColumns: '54% 46%', minHeight: 600 }}>
        <div style={{
          position: 'relative', overflow: 'hidden', background: INK,
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 18px)',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, #2a2620 0%, #1a1714 60%, #0e0c0a 100%)',
          }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: TX.serif, fontStyle: 'italic', fontSize: 22, color: '#5a5249' }}>фото · документы и ноутбук на столе бухгалтера</span>
            </div>
          </div>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.6) 100%)' }} />
          <div style={{ position: 'relative', zIndex: 2, padding: 36, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: PAPER }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: TX.mono, fontSize: 11, letterSpacing: 1.5, color: ACC, fontWeight: 600, padding: '6px 10px', border: `1px solid ${ACC}`, background: 'rgba(0,0,0,0.3)' }}>● УВЕДОМЛЕНИЯ</span>
              <Mono color="#C9C3B8" size={11}>ВЫПУСК · 47</Mono>
            </div>
            <div>
              <Mono color={ACC} size={11}>ГЛАВНОЕ ЗА НЕДЕЛЮ</Mono>
              <div style={{ fontFamily: TX.mono, fontSize: 11, letterSpacing: 1.2, color: '#C9C3B8', maxWidth: 420, lineHeight: 1.7, marginTop: 10 }}>
                ПЛАТЕЖИ В ЕНС / УВЕДОМЛЕНИЯ ДО 25 ЧИСЛА / СВЕРКА В ЛК / ПЕРВЫЕ ШТРАФЫ В ИЮНЕ
              </div>
            </div>
            <Mono color="#9A938A" size={10}>ГЛАВНАЯ / СТАТЬИ / НАЛОГИ · 29 АПРЕЛЯ 2026</Mono>
          </div>
        </div>
        <div style={{ background: PAPER, padding: '40px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Mono color={TEXT} size={11}>29 АПРЕЛЯ 2026 · НАЛОГИ</Mono>
            <Mono color={ACC} size={11}><span style={{ width: 6, height: 6, background: ACC, borderRadius: '50%', display: 'inline-block', marginRight: 6 }} />12 МИН ЧТЕНИЯ</Mono>
          </div>
          <div>
            <h1 style={{ fontFamily: TX.display, fontSize: 52, lineHeight: 0.96, letterSpacing: -0.3, color: INK, margin: 0 }}>
              ЕНС, УВЕДОМЛЕНИЯ И ДЕДЛАЙНЫ. КАК ПРОЙТИ МАЙ БЕЗ ШТРАФОВ
            </h1>
            <p style={{ fontFamily: TX.serif, fontStyle: 'italic', fontSize: 19, color: TEXT, marginTop: 18, lineHeight: 1.45 }}>
              Без воды — только то, что нужно сделать в мае: какие платежи в&nbsp;ЕНС не пропустить, какие уведомления подать, и&nbsp;где в ЛК&nbsp;лежит сверка.
            </p>
          </div>
          <div style={{ borderTop: `1px solid ${LINE2}`, paddingTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: PAPER2, border: `1px solid ${LINE2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TX.serif, fontSize: 16, color: MUTED }}>ОК</div>
            <div style={{ fontFamily: TX.body, fontSize: 13, color: TEXT, lineHeight: 1.4 }}>
              <span style={{ color: INK, fontWeight: 600 }}>Ольга Кравец</span> · редактор «Финансы»<br />
              <span style={{ color: MUTED, fontSize: 12 }}>Иллюстрации — Маша Долматова</span>
            </div>
          </div>
        </div>
      </div>
      {/* Quick-share strip */}
      <div style={{ padding: '14px 40px', borderBottom: `1px solid ${LINE}`, background: WHITE, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 18, fontFamily: TX.body, fontSize: 12, color: TEXT }}>
          <span style={{ color: MUTED }}>Поделиться:</span>
          <span>Telegram</span><span>VK</span><span>Email</span><span>Скопировать ссылку</span>
        </div>
        <div style={{ display: 'flex', gap: 18, fontFamily: TX.body, fontSize: 12, color: TEXT }}>
          <span>♥ 247</span><span>↗ 32</span><span>⌘ Сохранить</span><span style={{ color: ACC }}>A−  A+</span>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// FRAME 02 — TL;DR strip
// =================================================================
function FrameTLDR() {
  return (
    <div style={{ width: 1440, background: PAPER, fontFamily: TX.body, paddingBottom: 40 }}>
      <FrameLabel n="02" t="БЛОК TL;DR" d="«30 секунд» — суммирующая полоса сразу под hero. Тёмная плашка, акцент только на цифрах и иконке." />
      <div style={{ padding: '40px 40px 0' }}>
        <div style={{ background: INK, color: PAPER, padding: '22px 26px', display: 'grid', gridTemplateColumns: '160px 1fr 140px', gap: 24, alignItems: 'center' }}>
          <div>
            <Mono color={ACC} size={10}>★ TL;DR</Mono>
            <div style={{ fontFamily: TX.display, fontSize: 28, lineHeight: 0.9, letterSpacing: -0.3, marginTop: 4 }}>30 СЕКУНД</div>
          </div>
          <div style={{ fontFamily: TX.body, fontSize: 14, lineHeight: 1.6, color: '#C9C3B8' }}>
            <strong style={{ color: PAPER }}>До 25 мая</strong> — уведомления (КНД 1110355). <strong style={{ color: PAPER }}>До 28 мая</strong> — платёж на ЕНС с КБК. <strong style={{ color: PAPER }}>До 31 мая</strong> — сверка в ЛК. Пропуск = автоматический штраф 200 ₽ и пени.
          </div>
          <button style={{ fontFamily: TX.body, fontWeight: 600, fontSize: 12, padding: '11px 14px', background: 'transparent', color: PAPER, border: `1px solid ${PAPER}`, cursor: 'pointer' }}>Скачать PDF →</button>
        </div>
      </div>

      {/* Variations row — show that the same block scales for different content */}
      <div style={{ padding: '28px 40px 0' }}>
        <Mono color={MUTED} size={10}>ВАРИАЦИИ — ДЛЯ РАЗНЫХ ТИПОВ СТАТЕЙ</Mono>
        <div style={{ marginTop: 12, display: 'grid', gap: 14 }}>
          {/* Variation A — гайд */}
          <div style={{ background: WHITE, border: `1px solid ${LINE2}`, borderLeft: `4px solid ${ACC}`, padding: '18px 22px', display: 'grid', gridTemplateColumns: '160px 1fr', gap: 24, alignItems: 'center' }}>
            <div>
              <Mono color={ACC} size={10}>★ ГАЙД</Mono>
              <div style={{ fontFamily: TX.display, fontSize: 24, lineHeight: 0.95, letterSpacing: -0.2, marginTop: 4, color: INK }}>ЧТО ПОЛУЧИТЕ</div>
            </div>
            <div style={{ fontFamily: TX.body, fontSize: 14, lineHeight: 1.6, color: TEXT }}>
              Пошаговый сценарий регистрации ИП за 1 день, список 7 документов, шаблоны заявлений. Подходит для всех регионов.
            </div>
          </div>
          {/* Variation B — кейс */}
          <div style={{ background: WHITE, border: `1px solid ${LINE2}`, padding: '18px 22px', display: 'grid', gridTemplateColumns: '160px 1fr 140px', gap: 24, alignItems: 'center' }}>
            <div>
              <Mono color={INK} size={10}>● КЕЙС</Mono>
              <div style={{ fontFamily: TX.display, fontSize: 24, lineHeight: 0.95, letterSpacing: -0.2, marginTop: 4, color: INK }}>ИТОГИ</div>
            </div>
            <div style={{ fontFamily: TX.body, fontSize: 14, lineHeight: 1.6, color: TEXT }}>
              Оборот вырос на <strong>+38%</strong> за 6 месяцев. CAC снизился с 1 200 ₽ до 740 ₽. Главный канал — рассылка по базе.
            </div>
            <div style={{ fontFamily: TX.mono, fontSize: 11, color: MUTED, textAlign: 'right' }}>
              Кофейня «Тёплый»<br />Пермь, 2025
            </div>
          </div>
          {/* Variation C — мнение */}
          <div style={{ background: ACC_SOFT, padding: '18px 22px', borderLeft: `4px solid ${ACC}`, display: 'grid', gridTemplateColumns: '160px 1fr', gap: 24, alignItems: 'center' }}>
            <div>
              <Mono color={ACC} size={10}>✦ КОЛОНКА</Mono>
              <div style={{ fontFamily: TX.display, fontSize: 24, lineHeight: 0.95, letterSpacing: -0.2, marginTop: 4, color: INK }}>МНЕНИЕ</div>
            </div>
            <div style={{ fontFamily: TX.serif, fontStyle: 'italic', fontSize: 16, lineHeight: 1.5, color: INK }}>
              «Главное — не количество отчётов, а то, чтобы налоговая знала о тебе ровно столько, сколько нужно».
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// FRAME 03 — Article footer (related + author + comments + site footer)
// =================================================================
function FrameArticleFooter() {
  return (
    <div style={{ width: 1440, background: PAPER, fontFamily: TX.body }}>
      <FrameLabel n="03" t="ФУТЕР СТАТЬИ" d="Связка элементов после материала: теги, автор, обсуждение, похожие статьи, ещё от автора + site footer." />

      {/* End-of-article meta */}
      <div style={{ padding: '32px 40px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderTop: `1px solid ${LINE2}`, borderBottom: `1px solid ${LINE2}` }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['#НАЛОГИ', '#ЕНС', '#УВЕДОМЛЕНИЯ', '#УСН', '#МАЛЫЙБИЗНЕС'].map((t, i) => (
              <span key={i} style={{ fontFamily: TX.mono, fontSize: 11, color: TEXT, padding: '5px 10px', border: `1px solid ${LINE2}` }}>{t}</span>
            ))}
          </div>
          <Mono color={MUTED} size={11}>МАТЕРИАЛ ОБНОВЛЁН · 29 АПРЕЛЯ 2026</Mono>
        </div>

        {/* Author bio card */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 140px', gap: 20, padding: 24, background: WHITE, border: `1px solid ${LINE2}`, alignItems: 'center', marginTop: 24 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: PAPER2, border: `1px solid ${LINE2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TX.serif, fontSize: 26, color: MUTED }}>ОК</div>
          <div>
            <Mono color={ACC} size={10}>АВТОР</Mono>
            <div style={{ fontFamily: TX.serif, fontSize: 22, color: INK, marginTop: 4, marginBottom: 6 }}>Ольга Кравец</div>
            <div style={{ fontFamily: TX.body, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
              Редактор раздела «Финансы». Раньше — главный бухгалтер сети из 8 кофеен в Перми. Пишет о налогах человеческим языком. <span style={{ color: ACC }}>23 материала →</span>
            </div>
          </div>
          <button style={{ fontFamily: TX.body, fontWeight: 600, fontSize: 13, padding: '11px 14px', background: 'transparent', color: INK, border: `1px solid ${INK}`, cursor: 'pointer' }}>Подписаться</button>
        </div>

        {/* Comments teaser */}
        <div style={{ padding: '28px 0 0', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, borderBottom: `2px solid ${INK}` }}>
            <div style={{ fontFamily: TX.display, fontSize: 26, lineHeight: 1, letterSpacing: -0.2 }}>ОБСУЖДЕНИЕ <span style={{ color: ACC }}>· 18</span></div>
            <Mono color={MUTED} size={10}>ЧИТАТЕЛИ ПИШУТ</Mono>
          </div>
          {[
            { n: 'Сергей М.', a: '2 часа назад', t: 'А что делать, если ИП на патенте? Уведомления по НДФЛ за сотрудников нужны или нет?' },
            { n: 'Елена В.', a: '5 часов назад', t: 'Спасибо за чек-лист, утащила в закладки. Давно не могла найти всё в одном месте.' },
          ].map((c, i) => (
            <div key={i} style={{ padding: '14px 0', borderBottom: i === 0 ? `1px solid ${LINE}` : 'none' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontFamily: TX.body, fontSize: 13, fontWeight: 600 }}>{c.n}</span>
                <Mono color={MUTED} size={10}>{c.a}</Mono>
              </div>
              <div style={{ fontFamily: TX.body, fontSize: 14, color: TEXT, lineHeight: 1.55 }}>{c.t}</div>
            </div>
          ))}
          <button style={{ width: '100%', marginTop: 12, fontFamily: TX.body, fontWeight: 600, fontSize: 13, padding: '12px', background: 'transparent', color: INK, border: `1px solid ${LINE2}`, cursor: 'pointer' }}>Показать все 18 →</button>
        </div>
      </div>

      {/* Related articles */}
      <div style={{ padding: '50px 40px 0', borderTop: `1px solid ${LINE}`, marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 16, borderBottom: `2px solid ${INK}`, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <Mono color={MUTED} size={11}>// ЧИТАТЬ ДАЛЬШЕ</Mono>
            <div style={{ fontFamily: TX.display, fontSize: 44, lineHeight: 0.95, letterSpacing: -0.3 }}>ПОХОЖИЕ МАТЕРИАЛЫ</div>
          </div>
          <span style={{ fontFamily: TX.body, fontSize: 13, color: ACC }}>Все статьи о налогах →</span>
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
                  <span style={{ fontFamily: TX.serif, fontStyle: 'italic', fontSize: 16, color: MUTED }}>фото · превью {i + 1}</span>
                </div>
                <div style={{ position: 'absolute', top: 12, left: 12 }}><Mono color={ACC} size={10}>{c.tag}</Mono></div>
                <div style={{ position: 'absolute', top: 12, right: 12 }}><Mono color={MUTED} size={10}>{c.date} · {c.mins} МИН</Mono></div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ fontFamily: TX.display, fontSize: 24, lineHeight: 1, letterSpacing: -0.2, marginBottom: 10 }}>{c.t}</div>
                <div style={{ fontFamily: TX.body, fontSize: 13, color: TEXT, lineHeight: 1.55, marginBottom: 14 }}>{c.desc}</div>
                <Mono color={MUTED} size={10}>— {c.author}</Mono>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* More from author + section */}
      <div style={{ padding: '50px 40px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
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
              <div style={{ fontFamily: TX.serif, fontSize: 17, lineHeight: 1.25, color: INK }}>{r.t}</div>
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
              <div style={{ fontFamily: TX.display, fontSize: 22, color: ACC, lineHeight: 1 }}>{r.rank}</div>
              <div style={{ fontFamily: TX.serif, fontSize: 17, lineHeight: 1.25, color: INK }}>{r.t}</div>
              <Mono color={MUTED} size={10} style={{ textAlign: 'right' }}>{r.views}</Mono>
            </div>
          ))}
        </div>
      </div>

      {/* SITE FOOTER */}
      <div style={{ marginTop: 60, background: INK, color: PAPER, padding: '48px 40px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr', gap: 32, paddingBottom: 36, borderBottom: `1px solid #2a2620` }}>
          <div>
            <div style={{ fontFamily: TX.display, fontSize: 44, lineHeight: 0.9, letterSpacing: -0.5, marginBottom: 14 }}>ДЕЛО</div>
            <div style={{ fontFamily: TX.serif, fontStyle: 'italic', fontSize: 16, color: '#C9C3B8', lineHeight: 1.4, marginBottom: 18, maxWidth: 320 }}>
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
                <div key={j} style={{ fontFamily: TX.body, fontSize: 13, color: '#C9C3B8', padding: '5px 0' }}>{it}</div>
              ))}
            </div>
          ))}
          <div>
            <Mono color={ACC} size={10} style={{ marginBottom: 14, display: 'block' }}>РАССЫЛКА</Mono>
            <div style={{ fontFamily: TX.body, fontSize: 13, color: '#C9C3B8', lineHeight: 1.55, marginBottom: 14 }}>
              Раз в неделю — главное про малый бизнес.
            </div>
            <div style={{ display: 'flex', border: `1px solid #4a4239` }}>
              <input placeholder="ваш email" style={{ flex: 1, padding: 10, background: 'transparent', border: 'none', color: PAPER, fontFamily: TX.body, fontSize: 13, outline: 'none' }} />
              <button style={{ background: ACC, color: PAPER, border: 'none', padding: '10px 14px', fontFamily: TX.body, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>→</button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, fontFamily: TX.mono, fontSize: 11, color: '#7a746a' }}>
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

Object.assign(window, { FrameHero, FrameTLDR, FrameArticleFooter });
