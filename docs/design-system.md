# Дизайн-система

Источник истины — `src/styles/global.css` и `src/consts.ts`.
Компоненты: `src/components/`.

---

## Цветовые токены

Определены в `:root` в `global.css`. Используются через `var()` и `rgb(var())`.

```css
--accent:      #1d4ed8   /* синий — основной акцент */
--accent-dark: #1e3a8a   /* синий тёмный — hover на ссылках */
--accent-soft: #dbeafe   /* синий мягкий — фон тегов, callout */

--black:      15, 23, 42   /* почти чёрный — заголовки */
--gray-dark:  30, 41, 59   /* тёмно-серый — основной текст */
--gray:      100, 116, 139 /* средний серый — вторичный текст */
--gray-light: 226, 232, 240 /* светло-серый — рамки, делители */
```

Тени:
```css
--box-shadow:
  0 2px 6px rgba(15,23,42,.08),
  0 8px 24px rgba(15,23,42,.05),
  0 16px 32px rgba(15,23,42,.04);
```

### Акценты по категориям

Используются в карточках, OG-обложках, AI-иллюстрациях:

| Категория | HEX | Применение |
|---|---|---|
| ТС ПИоТ | `#1d4ed8` (navy/blue) | Тег, фон иллюстраций, OG-фон |
| Маркировка | `#16a34a` (forest green) | Тег, фон иллюстраций, OG-фон |
| Законодательство | `#d97706` (amber) | Тег, фон иллюстраций, OG-фон |

---

## Типографика

### Текущая пара шрифтов

| Роль | Шрифт | Применение |
|---|---|---|
| Заголовки (h1–h6) | **Commissioner** | Гуманистический гротеск, кириллица |
| Основной текст | **Geologica** | Переменный sans-serif, кириллица |
| Fallback (UI-элементы) | Inter → system-ui | Мелкие числа, даты, кнопки хедера |

Оба шрифта подключены через `@font-face` в `global.css`. Исходники — `@fontsource`:

```
public/fonts/
  commissioner-regular.woff   ← @fontsource/commissioner, cyrillic 400
  commissioner-bold.woff      ← @fontsource/commissioner, cyrillic 700
  geologica-regular.woff      ← @fontsource/geologica, cyrillic 400
  geologica-bold.woff         ← @fontsource/geologica, cyrillic 700
  inter-latin-regular.woff    ← @fontsource/inter, latin 400 (fallback)
  inter-latin-bold.woff       ← @fontsource/inter, latin 700 (fallback)
  inter-latin-ext-regular.woff ← @fontsource/inter, latin-ext 400 (fallback)
  inter-latin-ext-bold.woff    ← @fontsource/inter, latin-ext 700 (fallback)
```

```
Базовый размер:  19px (desktop), 18px (≤720px)
Line-height:     1.65
Letter-spacing:  -0.01em (заголовки)
```

### Как сменить шрифт

1. Установить пакет: `npm install @fontsource/<name>`
2. Скопировать woff-файлы в `public/fonts/`:
   ```bash
   cp node_modules/@fontsource/<name>/files/<name>-cyrillic-400-normal.woff public/fonts/<name>-regular.woff
   cp node_modules/@fontsource/<name>/files/<name>-cyrillic-700-normal.woff public/fonts/<name>-bold.woff
   ```
3. Обновить `@font-face` в `src/styles/global.css`
4. Поменять `font-family` на `body {}` (текст) или `h1...h6 {}` (заголовки)
5. Обновить массив `fonts` в `src/pages/og/[slug].png.ts`
6. Обновить этот файл (`docs/design-system.md`)

**Шкала заголовков:**

| Тег | Размер desktop | Размер mobile (≤720px) |
|---|---|---|
| h1 | 2.4rem | 1.9rem |
| h2 | 1.75rem | 1.4rem |
| h3 | 1.35rem | 1.35rem |
| h4 | 1.1rem | 1.1rem |

---

## Сетка и отступы

```
Контентная ширина:  max-width 1100px, margin: auto
Основной паддинг:   2.5em 1em 3em (desktop), 1.2em 1em 2em (mobile)
Брейкпоинт:        720px (основной контент), 820px (навигация)
```

---

## Компоненты

### Header (`src/components/Header.astro`)

- Sticky top, белый фон, `border-bottom: 1px solid rgba(15,23,42,.08)`
- Логотип: `Р·Б` — синий квадрат `gradient(#1d4ed8 → #0ea5e9)`, `border-radius: 0.4rem`
- Ссылки: подчёркивание `border-bottom: 3px solid --accent` на активной
- Mobile (≤820px): гамбургер-меню, навигация раскрывается вниз

### Footer (`src/components/Footer.astro`)

- Тёмный фон: `gradient(#0f172a → #111827)`
- 4 колонки в сетке `auto-fit, minmax(220px, 1fr)`
- Текст: `#cbd5e1` основной, `#94a3b8` второстепенный
- Правовая оговорка: материалы — информационный характер, не юридическая консультация

### Карточка статьи

```
┌─────────────────────┐
│   previewImage      │  16:9, object-fit:cover
│   (если есть)       │  zoom ×1.03 при hover
├─────────────────────┤
│ [Категория]         │  badge — accent-soft bg, accent color
│ Заголовок           │  1.15rem, --black
│ Описание            │  0.93rem, --gray-dark
│ дата                │  0.83rem, --gray
└─────────────────────┘
border: 1px --gray-light, border-radius: 10px
hover: border --accent, box-shadow
```

Компоненты: `BlogFilter.tsx` (`/blog/`), `index.astro` (главная).

### Callout-блоки (`.callout`)

```html
<div class="callout">Важная информация</div>
<div class="callout callout--warn">Предупреждение</div>
```

| Вариант | Цвет полосы | Фон |
|---|---|---|
| `.callout` | `--accent` (#1d4ed8) | `--accent-soft` (#dbeafe) |
| `.callout--warn` | `#f59e0b` (amber) | `#fef3c7` |

### Blockquote

Синяя левая полоса 4px, фон `rgba(accent, 0.04)`, `font-size: 1.05em`.

### Таблицы

Полная ширина, `border-collapse: collapse`, th с фоном `rgba(--gray-light, 0.5)`.
`font-size: 0.95rem`.

### Кнопки (страницы статей и главная)

```css
.btn          /* base: inline-block, padding, border-radius: 8px */
.btn-primary  /* bg: --accent, color: white */
.btn-ghost    /* border: --gray-light, color: --gray-dark */
```

---

## OG-обложки (1200×630)

Генерируются через Satori + Resvg в `src/pages/og/[slug].png.ts`.

- Фон: AI-текстура из `public/og-backgrounds/{category}.jpg` или градиент категории
- Тёмный оверлей `rgba(0,0,0,0.60)` для читаемости текста
- Левая вертикальная полоса 8px цвета категории
- Шрифты: Commissioner (заголовок) + Geologica (тело) + InterLat + InterLatExt (латинский fallback)

Подробности — `docs/og-images.md`.

---

## AI-иллюстрации

Два типа на каждую статью:

| Тип | Нейросеть | Стиль |
|---|---|---|
| Preview (карточка) | FLUX via OpenRouter | Bold flat editorial, единый стиль |
| Hero (шапка статьи) | FLUX via OpenRouter | Фотореалистичный, тематический |

Промпты и логика генерации — `docs/og-images.md`, `docs/article-cards.md`.

---

## Что менять где

| Задача | Файл |
|---|---|
| Цветовые токены | `src/styles/global.css` (`:root`) |
| Акценты категорий | `src/consts.ts` (добавить hex в `CATEGORIES`) + скрипты |
| Навигация | `src/consts.ts` (`NAV_LINKS`) |
| Шрифт | `global.css` (`@font-face`) + `public/fonts/` + `src/pages/og/[slug].png.ts` |
| Карточки статей | `src/components/BlogFilter.tsx`, `src/pages/index.astro` |
| OG-шаблон | `src/pages/og/[slug].png.ts` |
| Стиль AI-превью | `scripts/generate-preview-images.mjs` (`BASE_STYLE`, `CAT_STYLE`) |
| Стиль AI-hero | `scripts/generate-hero-images.mjs` (`CAT_STYLE`) |
