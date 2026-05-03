/* global React */
const { useState } = React;

// ============================================================
// ДЕЛО — Design System
// Independent media for small business
// ============================================================

const TOKENS = {
  // Colors
  ink: '#0E0E0E',          // near-black
  paper: '#F6F4EE',        // warm paper
  white: '#FFFFFF',
  pink: '#FF4D7E',         // accent — primary
  lime: '#D8FF3D',         // accent — secondary
  blue: '#3D5BFF',         // accent — tertiary
  gray900: '#1A1A1A',
  gray700: '#3D3D3D',
  gray500: '#7A7872',
  gray300: '#C9C6BD',
  gray200: '#E2DFD6',
  gray100: '#EDEAE2',

  // Type
  display: '"Bebas Neue", "Oswald", "Arial Narrow", sans-serif',
  body: '"Inter Tight", "Inter", -apple-system, sans-serif',
  serif: '"Instrument Serif", Georgia, serif',
  mono: '"JetBrains Mono", "IBM Plex Mono", monospace',
};

const Swatch = ({ color, name, value, dark }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{
      background: color,
      height: 96,
      border: '1px solid rgba(0,0,0,0.08)',
      display: 'flex',
      alignItems: 'flex-end',
      padding: 10,
      color: dark ? '#fff' : TOKENS.ink,
      fontFamily: TOKENS.mono,
      fontSize: 10,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    }}>{value}</div>
    <div style={{ fontFamily: TOKENS.body, fontSize: 12, color: TOKENS.gray700 }}>{name}</div>
  </div>
);

function DSCover() {
  return (
    <div style={{
      width: 1280, height: 720, background: TOKENS.ink, color: TOKENS.paper,
      fontFamily: TOKENS.body, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: 60,
      backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
    }}>
      {/* Giant decorative letters */}
      <div style={{
        position: 'absolute', right: -60, bottom: -120,
        fontFamily: TOKENS.display, fontSize: 720, lineHeight: 0.85,
        color: TOKENS.pink, opacity: 0.95, letterSpacing: -8,
      }}>ДЕЛО</div>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
        <div style={{ fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.6 }}>
          Design System / v1.0 / 01.05.2026
        </div>
        <div style={{ fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.6 }}>
          Independent B2B media
        </div>
      </div>

      {/* Center mark */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{
          fontFamily: TOKENS.serif, fontStyle: 'italic',
          fontSize: 28, color: TOKENS.lime, marginBottom: 24,
        }}>независимое медиа —</div>
        <div style={{
          fontFamily: TOKENS.display, fontSize: 220, lineHeight: 0.82,
          letterSpacing: -2, color: TOKENS.paper,
        }}>
          ПРАКТИКА<br />
          БИЗНЕСА.
        </div>
        <div style={{
          fontFamily: TOKENS.body, fontSize: 16, fontWeight: 400, marginTop: 28,
          maxWidth: 540, lineHeight: 1.5, color: TOKENS.gray300,
        }}>
          Финансы, налоги, технологии и юридические вопросы — для тех, кто строит дело сам. Без воды, по существу, с характером.
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'flex', gap: 32, position: 'relative', zIndex: 2 }}>
        {[
          ['01', 'Айдентика'],
          ['02', 'Палитра'],
          ['03', 'Типографика'],
          ['04', 'Компоненты'],
        ].map(([num, label]) => (
          <div key={num} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: TOKENS.mono, fontSize: 11, opacity: 0.4 }}>{num}</span>
            <span style={{ fontFamily: TOKENS.body, fontSize: 13, letterSpacing: 0.3 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DSColors() {
  return (
    <div style={{
      width: 1280, height: 880, background: TOKENS.paper, color: TOKENS.ink,
      fontFamily: TOKENS.body, padding: 60, display: 'flex', flexDirection: 'column', gap: 40,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 8 }}>02 / Палитра</div>
          <div style={{ fontFamily: TOKENS.display, fontSize: 96, lineHeight: 0.9, letterSpacing: -1 }}>ЦВЕТА</div>
        </div>
        <div style={{ maxWidth: 400, fontSize: 14, color: TOKENS.gray700, lineHeight: 1.5 }}>
          Тёмный графит и тёплая бумага — основа. Розовый и кислотный лайм — характер: выделяют важное, делают B2B-контент живым и заметным.
        </div>
      </div>

      <div>
        <div style={{ fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${TOKENS.gray300}` }}>База</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Swatch color={TOKENS.ink} name="Чернила / ink" value="#0E0E0E" dark />
          <Swatch color={TOKENS.gray700} name="Графит / gray-700" value="#3D3D3D" dark />
          <Swatch color={TOKENS.gray300} name="Камень / gray-300" value="#C9C6BD" />
          <Swatch color={TOKENS.paper} name="Бумага / paper" value="#F6F4EE" />
        </div>
      </div>

      <div>
        <div style={{ fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${TOKENS.gray300}` }}>Акценты</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Swatch color={TOKENS.pink} name="Розовый / pink — primary" value="#FF4D7E" />
          <Swatch color={TOKENS.lime} name="Лайм / lime — secondary" value="#D8FF3D" />
          <Swatch color={TOKENS.blue} name="Синий / blue — links" value="#3D5BFF" dark />
          <Swatch color={TOKENS.white} name="Белый / pure" value="#FFFFFF" />
        </div>
      </div>

      {/* Usage example bar */}
      <div style={{ display: 'flex', height: 60, marginTop: 12, fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
        <div style={{ flex: 5, background: TOKENS.ink, color: TOKENS.paper, display: 'flex', alignItems: 'center', padding: '0 16px' }}>фон / 50%</div>
        <div style={{ flex: 4, background: TOKENS.paper, color: TOKENS.ink, display: 'flex', alignItems: 'center', padding: '0 16px', border: `1px solid ${TOKENS.gray300}` }}>текст / 40%</div>
        <div style={{ flex: 1, background: TOKENS.pink, color: TOKENS.ink, display: 'flex', alignItems: 'center', padding: '0 16px' }}>акцент 8%</div>
        <div style={{ flex: 0.5, background: TOKENS.lime, color: TOKENS.ink, display: 'flex', alignItems: 'center', padding: '0 12px' }}>2%</div>
      </div>
    </div>
  );
}

function DSType() {
  return (
    <div style={{
      width: 1280, height: 1040, background: TOKENS.paper, color: TOKENS.ink,
      fontFamily: TOKENS.body, padding: 60, display: 'flex', flexDirection: 'column', gap: 36,
    }}>
      <div>
        <div style={{ fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 8 }}>03 / Типографика</div>
        <div style={{ fontFamily: TOKENS.display, fontSize: 96, lineHeight: 0.9, letterSpacing: -1 }}>ШРИФТЫ</div>
      </div>

      {/* Display - Bebas Neue */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32, paddingBottom: 24, borderBottom: `1px solid ${TOKENS.gray300}` }}>
        <div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 6 }}>Display</div>
          <div style={{ fontFamily: TOKENS.body, fontSize: 14, fontWeight: 600 }}>Bebas Neue</div>
          <div style={{ fontFamily: TOKENS.body, fontSize: 12, color: TOKENS.gray500, marginTop: 4 }}>Заголовки, цифры, декор</div>
        </div>
        <div>
          <div style={{ fontFamily: TOKENS.display, fontSize: 140, lineHeight: 0.85, letterSpacing: -1 }}>НАЛОГИ 2026</div>
          <div style={{ fontFamily: TOKENS.display, fontSize: 36, lineHeight: 1, marginTop: 12, color: TOKENS.gray700 }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789</div>
        </div>
      </div>

      {/* Serif accent - Instrument Serif */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32, paddingBottom: 24, borderBottom: `1px solid ${TOKENS.gray300}` }}>
        <div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 6 }}>Accent</div>
          <div style={{ fontFamily: TOKENS.body, fontSize: 14, fontWeight: 600 }}>Instrument Serif</div>
          <div style={{ fontFamily: TOKENS.body, fontSize: 12, color: TOKENS.gray500, marginTop: 4 }}>Курсив, лиды, оттенок</div>
        </div>
        <div>
          <div style={{ fontFamily: TOKENS.serif, fontStyle: 'italic', fontSize: 64, lineHeight: 1, color: TOKENS.gray900 }}>
            «по существу,»
          </div>
          <div style={{ fontFamily: TOKENS.serif, fontSize: 24, marginTop: 12, color: TOKENS.gray700 }}>
            Журнал о практике небольшого бизнеса.
          </div>
        </div>
      </div>

      {/* Body - Inter Tight */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32, paddingBottom: 24, borderBottom: `1px solid ${TOKENS.gray300}` }}>
        <div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 6 }}>Body</div>
          <div style={{ fontFamily: TOKENS.body, fontSize: 14, fontWeight: 600 }}>Inter Tight</div>
          <div style={{ fontFamily: TOKENS.body, fontSize: 12, color: TOKENS.gray500, marginTop: 4 }}>Текст, UI, метаданные</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: TOKENS.body, fontWeight: 700, fontSize: 28, lineHeight: 1.2 }}>H3 — Подзаголовок секции / 28px / 700</div>
          <div style={{ fontFamily: TOKENS.body, fontWeight: 500, fontSize: 18, lineHeight: 1.45, color: TOKENS.gray700 }}>Лид статьи — 18px / 500. Короткий ввод в материал, без воды.</div>
          <div style={{ fontFamily: TOKENS.body, fontWeight: 400, fontSize: 15, lineHeight: 1.65, color: TOKENS.gray700 }}>Body — 15px / 400. Основной текст статей. Высокий межстрочный интервал для длинного чтения, оптимизированы цифры. Поддержка кириллицы и латиницы.</div>
          <div style={{ fontFamily: TOKENS.body, fontSize: 12, color: TOKENS.gray500, letterSpacing: 0.2 }}>Caption — 12px / 400. Подписи, метаданные, сноски.</div>
        </div>
      </div>

      {/* Mono */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32 }}>
        <div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 6 }}>Mono</div>
          <div style={{ fontFamily: TOKENS.body, fontSize: 14, fontWeight: 600 }}>JetBrains Mono</div>
          <div style={{ fontFamily: TOKENS.body, fontSize: 12, color: TOKENS.gray500, marginTop: 4 }}>Метки, теги, дата</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>#НАЛОГИ / 29 АПРЕЛЯ 2026 / 7 МИН</div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 14 }}>{`{ автор: "Ольга К.", раздел: "финансы" }`}</div>
        </div>
      </div>
    </div>
  );
}

function DSComponents() {
  return (
    <div style={{
      width: 1280, height: 980, background: TOKENS.paper, color: TOKENS.ink,
      fontFamily: TOKENS.body, padding: 60, display: 'flex', flexDirection: 'column', gap: 32,
    }}>
      <div>
        <div style={{ fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 8 }}>04 / Компоненты</div>
        <div style={{ fontFamily: TOKENS.display, fontSize: 96, lineHeight: 0.9, letterSpacing: -1 }}>UI-КИРПИЧИКИ</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        {/* Tags */}
        <div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${TOKENS.gray300}` }}>Хэштеги и метки</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1, padding: '6px 10px', background: TOKENS.pink, color: TOKENS.ink, fontWeight: 600 }}>#НАЛОГИ</span>
            <span style={{ fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1, padding: '6px 10px', background: TOKENS.lime, color: TOKENS.ink, fontWeight: 600 }}>#ТЕХ</span>
            <span style={{ fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1, padding: '6px 10px', border: `1px solid ${TOKENS.ink}`, color: TOKENS.ink }}>#ПРАВО</span>
            <span style={{ fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1, padding: '6px 10px', background: TOKENS.ink, color: TOKENS.paper }}>#ИНТЕРВЬЮ</span>
          </div>
        </div>

        {/* Buttons */}
        <div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${TOKENS.gray300}` }}>Кнопки</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button style={{ fontFamily: TOKENS.body, fontWeight: 600, fontSize: 14, padding: '14px 24px', background: TOKENS.ink, color: TOKENS.paper, border: 'none', cursor: 'pointer' }}>Подписаться →</button>
            <button style={{ fontFamily: TOKENS.body, fontWeight: 600, fontSize: 14, padding: '14px 24px', background: 'transparent', color: TOKENS.ink, border: `1px solid ${TOKENS.ink}`, cursor: 'pointer' }}>Все статьи</button>
            <button style={{ fontFamily: TOKENS.body, fontWeight: 600, fontSize: 14, padding: '14px 24px', background: TOKENS.pink, color: TOKENS.ink, border: 'none', cursor: 'pointer' }}>Читать</button>
          </div>
        </div>

        {/* Card */}
        <div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${TOKENS.gray300}` }}>Карточка статьи</div>
          <div style={{ background: TOKENS.white, padding: 20, border: `1px solid ${TOKENS.gray200}` }}>
            <div style={{ height: 140, background: TOKENS.gray200, marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0,0,0,0.04) 8px, rgba(0,0,0,0.04) 9px)' }} />
              <span style={{ position: 'absolute', top: 10, left: 10, fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 1, padding: '4px 8px', background: TOKENS.pink }}>#НАЛОГИ</span>
            </div>
            <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 1.2, color: TOKENS.gray500, marginBottom: 8 }}>29 АПР 2026 · 7 МИН</div>
            <div style={{ fontFamily: TOKENS.display, fontSize: 32, lineHeight: 0.95, letterSpacing: 0 }}>УПРОЩЁНКА В 2026: ЧТО ИЗМЕНИЛОСЬ</div>
          </div>
        </div>

        {/* Pull quote */}
        <div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${TOKENS.gray300}` }}>Цитата / врезка</div>
          <div style={{ background: TOKENS.gray100, padding: '20px 24px', borderLeft: `4px solid ${TOKENS.ink}` }}>
            <div style={{ fontFamily: TOKENS.serif, fontStyle: 'italic', fontSize: 22, lineHeight: 1.3, color: TOKENS.ink }}>
              «Главное — не количество отчётов, а то, чтобы налоговая о тебе знала ровно столько, сколько нужно».
            </div>
            <div style={{ fontFamily: TOKENS.mono, fontSize: 11, letterSpacing: 1, color: TOKENS.gray500, marginTop: 12, textTransform: 'uppercase' }}>— Анна, бухгалтер ИП</div>
          </div>
        </div>

        {/* CTA dark */}
        <div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${TOKENS.gray300}` }}>CTA-блок</div>
          <div style={{ background: TOKENS.ink, color: TOKENS.paper, padding: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -20, top: -30, fontFamily: TOKENS.display, fontSize: 160, opacity: 0.06, letterSpacing: -4 }}>ДЕЛО</div>
            <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 1.5, marginBottom: 8, color: TOKENS.lime }}>// РАССЫЛКА</div>
            <div style={{ fontFamily: TOKENS.display, fontSize: 36, lineHeight: 0.95, marginBottom: 14 }}>ОДНО ПИСЬМО<br />В НЕДЕЛЮ</div>
            <button style={{ fontFamily: TOKENS.body, fontWeight: 600, fontSize: 13, padding: '10px 18px', background: TOKENS.paper, color: TOKENS.ink, border: 'none', cursor: 'pointer' }}>Подписаться →</button>
          </div>
        </div>

        {/* List with dashes */}
        <div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: TOKENS.gray500, marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${TOKENS.gray300}` }}>Список с тире</div>
          <div style={{ borderTop: `1px solid ${TOKENS.gray300}` }}>
            {['Подайте уведомление до 25 числа', 'Сформируйте платёжку с КБК', 'Сверьтесь с ЕНС в личном кабинете'].map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 12, padding: '12px 0', borderBottom: `1px solid ${TOKENS.gray300}`, fontSize: 14, color: TOKENS.gray700 }}>
                <span>—</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.DELO_TOKENS = TOKENS;
window.DSCover = DSCover;
window.DSColors = DSColors;
window.DSType = DSType;
window.DSComponents = DSComponents;
