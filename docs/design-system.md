# Дизайн-система Этикетки

Документ описывает токены, компоненты и архитектуру страницы статьи.

---

## Цветовые токены

| Название       | Hex       | Применение |
|---|---|---|
| `dark`         | `#111111` | Header, footer, тёмные блоки |
| `pink`         | `#9E2B4F` | Акцент: hover, нумерация FAQ, share-кнопки, CTA-кнопки |
| `lime`         | `#AFCC00` | Badge «Актуально», чеклист, eyebrow CPA, категория маркировки |
| `sand`         | `#EDE8DF` | Фон страницы, hero info panel |
| `sand-light`   | `#F6F4F0` | Hover-состояния, TOC bg |
| `white`        | `#FFFFFF` | Карточки, FAQ items, prose |

> **Логотип (точка)** — `#E8175D`. Это единственное место, где используется исходный ярко-малиновый.
> Везде в UI: `#9E2B4F` (тёмно-малиновый) и `#AFCC00` (приглушённый лайм).

Все токены — hex-литералы. CSS-переменные (`var(--accent)`, `rgb(var(--gray))`)
в проекте **не используются** — они удалены в мае 2026.

### Категориальные цвета

Источник истины — `CAT_COLORS` в `src/consts.ts`.

| Категория         | Фон (`bg`) | Буква (`letterColor`) | Тег-фон | Тег-текст |
|---|---|---|---|---|
| `ts-piot`         | `#111`     | `#AFCC00` (lime)      | `#111`  | `#fff`    |
| `markirovka`      | `#9E2B4F`  | `#fff`                | `#9E2B4F` | `#fff`  |
| `zakonodatelstvo` | `#AFCC00`  | `#111`                | `#AFCC00` | `#111`  |
| `kkt`             | `#111`     | `#AFCC00` (lime)      | `#111`  | `#fff`    |
| `egais`           | `#111`     | `#AFCC00` (lime)      | `#111`  | `#fff`    |

`bg` — фон большой буквы-аббревиатуры в «Читайте также» и CPA-блоке.
`letterColor` — цвет самой буквы. Используется в: hero статьи, CPA-баннер, карточки «Читайте также».

---

## Типографика

- **Bebas Neue** — заголовки h1–h3, логотип, uppercase-метки.
  Подключается через Google Fonts CDN в `BaseHead.astro`.
- **Inter** (local woff) — тело текста, UI-подписи.
  Файлы: `public/fonts/inter-*.woff`. Не удалять — нужны при сборке OG.

---

## Страница статьи (`BlogPost.astro`)

### Hero — сетка 58/42

```
┌─────────────────────┬──────────────────┐
│  58fr               │  42fr            │
│  Тёмная зона        │  Песочная зона   │
│                     │                  │
│  [cat badge]        │  breadcrumbs     │
│                     │  badges row      │
│  большая буква      │  H1              │
│  (opacity 0.15)     │  ─────────────   │
│                     │  lead (italic)   │
└─────────────────────┴──────────────────┘
height: calc(100vh - 56px), min-height: 480px
```

**Правая колонка (justify-content: space-between):**

1. `nav.art-hero-breadcrumbs` — Главная / Статьи / [категория]
2. `.art-hero-top` — badges row:
   - `span.art-updated-badge` (lime) — «Актуально на [updatedDate]» (только при наличии `updatedDate`)
   - `span.art-hero-readtime` — время чтения (серый)
3. `h1.art-h1` — заголовок (Bebas Neue, 3.2rem)
4. `.art-hero-bottom` (border-top: 2px solid #111) — `p.art-lead` (description)

### Body — сетка 28/72

```
┌────────────┬────────────────────────────┐
│  28fr      │  72fr                      │
│  Sidebar   │  Content                   │
│            │                            │
│  sticky    │  TOC → prose →             │
│  CPA-      │  callouts/checklist/FAQ →  │
│  баннер    │  share →                   │
│            │  CPA-врезка →              │
│            │  «Читайте также»           │
└────────────┴────────────────────────────┘
```

**Sidebar:** `position: sticky; top: calc(56px + 16px)`. Скрывается при ≤1024px.

### Блоки контентной колонки

| Блок | Условие | Описание |
|---|---|---|
| `toc` (`<details>`) | ≥3 заголовков H2/H3 | Оглавление, разворачивается по клику |
| `.prose` | всегда | `<slot/>` — MDX-контент статьи |
| `art-share` | всегда | Telegram + ВКонтакте; URL из canonical |
| `.cpa-block` | всегда | CPA/партнёрский баннер (из `src/data/cpa-banners.ts`) |
| `.related` | ≥2 совпадений | «Читайте также» — адаптивная сетка |
| `art-foot` | всегда | Правовая оговорка |

**Удалены** (не используются): `art-tags`, `inline-subscribe`, `helpful`,
`post-nav` (пред./след. статья), `art-cta` («Остались вопросы?»).

### CPA-блок

Размещается между `art-share` и «Читайте также». Данные — из `src/data/cpa-banners.ts`.

Структура HTML:
```html
<div class="cpa-block">
  <div class="cpa-visual"><!-- abbrev, категориальный фон --></div>
  <div class="cpa-body">
    <span class="cpa-eyebrow"><!-- eyebrow --></span>
    <strong class="cpa-title"><!-- title --></strong>
    <p class="cpa-desc"><!-- description --></p>
  </div>
  <div class="cpa-action">
    <a class="cpa-btn" href="..."><!-- cta --></a>
  </div>
</div>
```

Выбор баннера (в порядке приоритета):
1. `cpa:` в frontmatter статьи
2. `CATEGORY_DEFAULT_CPA[primaryCategory]`
3. `'default-ts-piot'` (запасной)

### «Читайте также» — адаптивные макеты

Берётся до 4 постов (scoring: теги ×2, категории ×1). Макет определяется
детерминированно — без `Math.random()`, иначе SSG не работает.

| Постов | Макет | Логика выбора |
|---|---|---|
| 0–1 | нет блока | скрыт |
| 2 | **A2** — два равных столбца | всегда |
| 3 | **A3** или **B** | `slugCharSum % 2 === 0` → A3, иначе B |
| 4+ | **C** — 1 большая + 3 компактных | всегда |

`slugCharSum` — сумма char codes символов slug текущей статьи. Постоянна для
одной статьи, варьируется между статьями.

**Макет A2** — 2 равных столбца `1fr 1fr`.

**Макет A3** — 2 столбца, левый шире: `3fr 2fr`. Левая карточка крупная
(заголовок 1.4rem, описание), правая — стандартная.

**Макет B** — 2 столбца `2fr 3fr`. Правая карточка крупная.

**Макет C** — grid `3fr 2fr`, первая строка занимает весь левый столбец (`grid-row: span 2`).
Три компактных справа.

### Прогресс-бар и «наверх»

- `#rp-bar` — `position: fixed; top: 0; height: 3px; background: #E8175D`
- `#back-to-top` — `position: fixed; bottom: 24px; right: 24px`; появляется при `scrollY > 400`

### Брейкпойнты

| Ширина   | Изменение |
|---|---|
| `≤1024px` | Sidebar скрыт, контент 100% |
| `≤820px`  | Hero стэкируется (1fr), hero-img: height 280px |
| `≤560px`  | h1: 2rem, уменьшение паддингов |

---

## Компоненты

### `Callout.astro`

Акцентная врезка для выделения ключевых мыслей в теле статьи.

```astro
import Callout from '../../components/Callout.astro';

{/* Тёмный (по умолчанию): чёрный фон, лаймовый акцент */}
<Callout>
  Если статус кода не позволяет продажу, касса обязана заблокировать операцию.
</Callout>

{/* Светлый: песочный фон, розовый акцент */}
<Callout variant="light">
  При повторном нарушении должностное лицо могут дисквалифицировать на срок до двух лет.
</Callout>
```

- `variant?: 'dark' | 'light'` (default: `'dark'`)
- `**жирный**` и `*курсив*` внутри получают цвет акцента
- Декоративная `"` через `::before` (opacity 0.18)

### `FAQ.astro`

```astro
import FAQ from '../../components/FAQ.astro';
<FAQ
  title="Часто задаваемые вопросы"   // опционально
  items={[
    { q: 'Вопрос?', a: 'Ответ.' },
  ]}
/>
```

- Автоматически эмитирует `<script type="application/ld+json">` с FAQPage schema
- `<details name="faq">` — нативный аккордеон (открыт только один элемент)
- Нумерация розовым (Bebas Neue), стрелка-индикатор с CSS transition
- Яндекс и Google показывают FAQ прямо в выдаче при наличии FAQPage schema
- Компонент **необязателен** — не добавляйте его ради галочки. Правила выбора: [content-types.md → FAQ в статье](content-types.md#faq-в-статье)

### `Checklist.astro`

```astro
import Checklist from '../../components/Checklist.astro';
<Checklist
  id="уникальный-id"     // обязателен — ключ для localStorage
  title="Что проверить"  // опционально
  items={[
    'Пункт 1',
    'Пункт 2',
  ]}
/>
```

- Состояние хранится в `localStorage` с ключом `checklist_<id>`
- Прогресс-счётчик «X / N выполнено» обновляется в реальном времени
- Кнопка «Сбросить» очищает localStorage и снимает все галочки
- Выполненные пункты: зачёркивание + opacity 0.5

---

## Страница редакции (`/about/avtor/`)

- SVG-аватар с инициалами «ЭМ» (тёмный фон `#111`, лаймовый текст `#C8F500`, Bebas Neue)
- Карточка автора: тёмный блок, имя / роль / email
- Контактная форма: имя + email + textarea + submit
- `action="mailto:hello@etiketka-media.ru" method="get"` — клиентская, без бэкенда

---

## Источники истины

| Данные | Файл | Ключ |
|---|---|---|
| Заголовок, описание, URL сайта | `src/consts.ts` | `SITE_TITLE`, `SITE_URL` |
| Навигация | `src/consts.ts` | `NAV_LINKS` |
| Категории (slug, название) | `src/consts.ts` | `CATEGORIES` |
| Sidebar баннер | `src/consts.ts` | `SIDEBAR_BANNER` |
| CPA/партнёрские баннеры | `src/data/cpa-banners.ts` | `CPA_BANNERS`, `CATEGORY_DEFAULT_CPA` |
| Сценарии штрафов | `src/data/penalties.ts` | `SCENARIOS` |

---

## Changelog

### 2026-05-03 — Упрощение статьи, адаптивный related, CPA-блок

#### Новые компоненты и данные

| Файл | Что |
|---|---|
| `src/components/Callout.astro` | Акцентная врезка (dark/light), декоративная `"` |
| `src/data/cpa-banners.ts` | Единый источник CPA/партнёрских баннеров |

#### `src/layouts/BlogPost.astro`

**Удалено:**

| Элемент | Причина |
|---|---|
| `art-tags` (пилюли тегов) | Избыточно — теги доступны через `/tags/` |
| `inline-subscribe` (врезка с формой подписки) | Перегружает статью |
| `helpful` («Была ли полезна?») | Нет бэкенда, данные нигде не используются |
| `post-nav` (пред./след. статья) | Низкий CTR, занимает место |
| `art-cta` («Остались вопросы?» + mailto) | Заменён CPA-блоком |

**Добавлено / изменено:**

| Элемент | Стало |
|---|---|
| CPA-блок | Баннер из `src/data/cpa-banners.ts` после `art-share` |
| «Читайте также» | До 4 постов; 4 адаптивных макета (A2/A3/B/C) |
| Hero meta | Только `art-updated-badge` + `art-hero-readtime`; убраны `art-pubdate`, `art-verified-badge`, `art-hero-hash` |
| `content.config.ts` | Добавлено поле `cpa: z.string().optional()` в схему blog |

#### Предыдущий редизайн (2026-05-02)

Добавлены: `FAQ.astro`, `Checklist.astro`, hero 58/42, sidebar sticky,
share-кнопки, прогресс-бар, кнопка «наверх», замена CSS-переменных на hex-токены.
Обновлена страница редакции `/about/avtor/`.
