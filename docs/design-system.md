# Дизайн-система Этикетки

Документ описывает токены, компоненты и архитектуру страницы статьи.
Живой предпросмотр: `design-preview-3.html` (4 вкладки: Статья / Редакция / Компоненты / Токены).

---

## Цветовые токены

| Название       | Hex       | Применение |
|---|---|---|
| `--dark`       | `#111111` | Header, footer, тёмные блоки, текст заголовков |
| `--pink`       | `#E8175D` | Акцент: hover кнопок, нумерация FAQ, TOC-граница |
| `--lime`       | `#C8F500` | Логотип-точка, badge «Актуально», чеклист-граница, eyebrow баннера |
| `--sand`       | `#EDE8DF` | Фон страницы, hero info panel, светлые кнопки |
| `--sand-light` | `#F6F4F0` | Hover-состояния, TOC bg, «helpful» блок |
| `--white`      | `#FFFFFF` | Карточки, FAQ items, prose |

### Категориальные цвета (hero-фон и border related-cards)

| Категория         | Цвет фона | Цвет текста |
|---|---|---|
| `ts-piot`         | `#111`    | `#fff` |
| `markirovka`      | `#E8175D` | `#fff` |
| `zakonodatelstvo` | `#C8F500` | `#111` |

---

## Типографика

- **Bebas Neue** — заголовки h1–h3, логотип, uppercase-кнопки, related h3.
  Подключается через Google Fonts CDN в `BaseHead.astro`.
- **Inter** (local woff) — тело текста, UI-подписи.
  Файлы: `public/fonts/inter-*.woff`.

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

**Элементы правой колонки (justify-content: space-between):**

1. `nav.art-hero-breadcrumbs` — Главная / Статьи / [категория]
2. `.art-hero-top` — badges row:
   - `span.art-updated-badge` (lime) — «Актуально на [updatedDate]» (только при наличии `updatedDate`)
   - `span.art-pubdate` — «· опубл. [pubDate]» (серый, только при наличии updatedDate)
   - `span.art-verified-badge` (чёрный) — «✓ Проверено»
   - `a.art-hero-hash` (розовый) — первый тег статьи
3. `h1.art-h1` — заголовок (Bebas Neue, 3.2rem)
4. `.art-hero-bottom` (border-top: 2px solid #111) — `p.art-lead` (description)

### Body — сетка 28/72

```
┌────────────┬────────────────────────────┐
│  28fr      │  72fr                      │
│  Sidebar   │  Content                   │
│            │                            │
│  sticky    │  tags → TOC → prose →      │
│  banner    │  checklist/FAQ →           │
│            │  subscribe → share →       │
│            │  helpful → related →       │
│            │  prev/next → cta → footer  │
└────────────┴────────────────────────────┘
```

**Sticky banner** (`position: sticky; top: calc(56px + 16px)`):
- Данные из `SIDEBAR_BANNER` в `consts.ts`
- Визуальный блок 16:9 с категориальным фоном и большой буквой (opacity 0.18)
- Структура: eyebrow (lime) → title → description → CTA-кнопка (pink)

### Блоки контентной колонки

| Блок | Описание |
|---|---|
| `art-tags` | Пилюли тегов, ссылки `/tag/<slug>/` |
| `toc` (`<details>`) | Только при ≥3 H2/H3 заголовков |
| `.prose` | `<slot/>` — контент MDX |
| `inline-subscribe` | Форма подписки; данные из `INLINE_SUBSCRIBE` в `consts.ts` |
| `art-share` | Telegram + ВКонтакте; URL из canonical |
| `helpful` | «Была ли полезна?»; ответ в `localStorage` по pathname |
| `related` | 3 поста; scoring: теги ×2, категории ×1 |
| `post-nav` | Предыдущая / следующая по дате |
| `art-cta` | «Остались вопросы?» → `mailto:hello@etiketka.media` |
| `art-foot` | Правовая оговорка |

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
- Кнопка «Сбросить» — очищает localStorage и снимает все галочки
- Выполненные пункты: зачёркивание + opacity 0.5

---

## Страница редакции (`/about/avtor/`)

- SVG-аватар с инициалами «ЭМ» (тёмный фон `#111`, лаймовый текст `#C8F500`, Bebas Neue)
- Карточка автора: тёмный блок, имя / роль / email
- Контактная форма: имя + email + textarea + submit
- `action="mailto:hello@etiketka.media" method="get"` — клиентская, без бэкенда

---

## Источники истины

| Данные | Файл |
|---|---|
| Заголовок, описание, URL сайта | `src/consts.ts` → `SITE_TITLE`, `SITE_URL` |
| Навигация | `src/consts.ts` → `NAV_LINKS` |
| Sidebar баннер | `src/consts.ts` → `SIDEBAR_BANNER` |
| Inline-подписка | `src/consts.ts` → `INLINE_SUBSCRIBE` |
| Категории (названия, цвета) | `src/consts.ts` → `CATEGORIES` |
| Сценарии штрафов | `src/data/penalties.ts` |

---

## Changelog

### 2026-05-03 — Редизайн страницы статьи и новые компоненты

#### Новые компоненты

| Файл | Что добавлено |
|---|---|
| `src/components/FAQ.astro` | Аккордеон с FAQPage JSON-LD schema для Яндекса/Google |
| `src/components/Checklist.astro` | Интерактивный чеклист с сохранением в localStorage |

#### `src/layouts/BlogPost.astro` — полный редизайн

| Элемент | Было | Стало |
|---|---|---|
| Hero | Плоский заголовок H1 + мета | Hero 58/42: тёмная зона слева, песочная справа |
| Хлебные крошки | Отсутствовали | В hero, над badges row |
| Badge «Актуально на» | Отсутствовал | Лаймовый chip при наличии `updatedDate` |
| Badge «Проверено» | Отсутствовал | Постоянный тёмный chip |
| Sidebar | Отсутствовал | Sticky 28% с баннером-дайджестом |
| Форма подписки | Отсутствовала | Inline-блок после prose |
| Кнопки «Поделиться» | Отсутствовали | Telegram + ВКонтакте |
| «Была ли полезна?» | Отсутствовал | Виджет с localStorage-персистентностью |
| Навигация статей | Отсутствовала | Prev/Next по хронологии |
| CTA к редакции | Отсутствовал | Блок «Остались вопросы?» + mailto |
| Прогресс-бар | Отсутствовал | Pink 3px fixed top |
| Кнопка «Наверх» | Отсутствовала | Fixed bottom-right, появляется при scrollY > 400 |
| CSS-переменные | `var(--accent)`, `rgb(var(--gray))` — сломаны | Заменены на hex-токены дизайн-системы |

#### `src/consts.ts`

- Добавлен `SIDEBAR_BANNER` — единственный источник текста для sidebar-баннера
- Добавлен `INLINE_SUBSCRIBE` — единственный источник для inline-формы подписки

#### `src/pages/about/avtor.astro`

| Было | Стало |
|---|---|
| Текстовый placeholder вместо аватара | SVG-аватар с инициалами «ЭМ» |
| Простая ссылка `mailto:` | Форма с полями name / email / textarea |
| `var(--gray-*)` переменные | Hex-токены `#999`, `#555` и т.д. |

#### `src/components/Header.astro`

| Было | Стало |
|---|---|
| 5+ ссылок в nav → перенос на 2 строки | 4 ссылки: Статьи / ТС ПИоТ / Маркировка / Законодательство |
| — | `flex-wrap: nowrap` + `white-space: nowrap` |
