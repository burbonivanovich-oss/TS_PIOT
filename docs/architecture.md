# Архитектура «Регламент.Бизнес»

Карта проекта: что где лежит, какие маршруты генерируются, как они связаны.
Обновляйте этот файл при появлении новых маршрутов или коллекций.

## Маршруты

### Статические страницы

| URL | Файл | Назначение |
|---|---|---|
| `/` | `src/pages/index.astro` | Главная: hero, карточки рубрик, последние 6 постов |
| `/about/` | `src/pages/about.astro` | О проекте |
| `/privacy/` | `src/pages/privacy.astro` | Политика конфиденциальности |
| `/404` | `src/pages/404.astro` | Кастомная 404 (`noindex`) |
| `/search/` | `src/pages/search.astro` | Pagefind UI |
| `/slovar/` | `src/pages/slovar/index.astro` | Глоссарий с алфавитной группировкой и якорями |
| `/kalkulyator-shtrafov/` | `src/pages/kalkulyator-shtrafov.astro` | Калькулятор штрафов |
| `/tags/` | `src/pages/tags/index.astro` | Облако тегов |

### Динамические шаблоны

| URL | Файл | Источник | Что делает |
|---|---|---|---|
| `/blog/` | `src/pages/blog/index.astro` | коллекция `blog` | Архив всех постов |
| `/blog/<slug>/` | `src/pages/blog/[...slug].astro` | коллекция `blog` | Через `BlogPost.astro` |
| `/category/<slug>/` | `src/pages/category/[category].astro` | `CATEGORIES` + коллекция `pillars` | Pillar-контент + FAQ + посты рубрики |
| `/tag/<slug>/` | `src/pages/tag/[tag].astro` | теги в постах | Список постов по тегу |
| `/og/<slug>.png` | `src/pages/og/[slug].png.ts` | коллекция `blog` | Satori-сгенерированная PNG-обложка |

### Служебные эндпоинты

- `/rss.xml` — фид через `@astrojs/rss` (`src/pages/rss.xml.js`)
- `/sitemap-index.xml` — карта сайта от `@astrojs/sitemap`
- `/pagefind/*` — индекс Pagefind (генерируется после `astro build`)

## Контент-коллекции (`src/content.config.ts`)

| Коллекция | Папка | Публичные URL | Зачем |
|---|---|---|---|
| `blog` | `src/content/blog/` | `/blog/<slug>/` | Статьи |
| `pillars` | `src/content/pillars/` | внутри `/category/<slug>/` | Контент-блок и FAQ для категории |
| `glossary` | `src/content/glossary/` | `/slovar/#<term-slug>` | Термины словаря |
| `wiki` | `src/content/wiki/` | — | Редакционные заметки, контент-планы (не публикуются) |

## Источники истины

- **Категории.** `CATEGORIES` в `src/consts.ts`. При добавлении категории обязательно:
  1. Добавьте запись в `CATEGORIES`.
  2. Создайте `src/content/pillars/<slug>.md`.
  3. По желанию — обновите `NAV_LINKS` для появления в шапке.
  4. Обновите enum `category` в `glossary` и `pillars` schemas, если нужно ссылаться на новую категорию.
- **Сценарии калькулятора.** `src/data/penalties.ts`.
- **Навигация.** `NAV_LINKS` в `src/consts.ts`. Шапка и футер берут данные оттуда.

## Утилиты

- `src/utils/tags.ts`
  - `tagSlug(tag: string): string` — кириллический slug из тега.
  - `collectTags(posts)` — `{ slug → { name, posts[] } }` со всеми тегами.
  - `pluralPosts(count)` — «материал/материала/материалов».
- `src/utils/glossary.ts`
  - `termSlug(term)` — slug для якоря.
  - `firstLetter(term)` — буква для группировки.
  - `alphabetOrder(a, b)` — компаратор для сортировки русско-английских букв.

## Build pipeline

```
npm run build
  ├─ astro build          # генерация HTML/PNG/RSS/sitemap
  └─ pagefind --site dist # индексирование статей в /pagefind/
```

`astro build` сам по себе **не запускает Pagefind**. Команда `npm run build`
зашита в `vercel.json` (`buildCommand`), поэтому деплой работает корректно.

Native-зависимости:

- `@resvg/resvg-js` — нативный binding для конвертации SVG → PNG в OG-эндпоинте.
- `pagefind` — Rust-бинарь индексатора.

Шрифты в `public/fonts/inter-*.woff` нужны на этапе сборки (`fs.readFileSync`
в OG-эндпоинте). **Не удаляйте их**, иначе сборка упадёт с `ENOENT`.

## JSON-LD на страницах

| Страница | Используемые типы |
|---|---|
| Все страницы | `Organization`, `WebSite` (через `BaseHead.astro`) |
| `/blog/<slug>/` | `Article`, `BreadcrumbList` |
| `/category/<slug>/` | `CollectionPage`, `BreadcrumbList`, `FAQPage` (если в pillar есть FAQ) |
| `/tag/<slug>/` | `CollectionPage`, `BreadcrumbList` |
| `/slovar/` | `BreadcrumbList`, `DefinedTermSet` |
| `/kalkulyator-shtrafov/` | `WebApplication`, `BreadcrumbList`, `FAQPage` |

## Дизайн-токены

CSS-переменные в `src/styles/global.css`:

- `--accent: #1d4ed8` — основной фирменный синий
- `--accent-dark: #1e3a8a`
- `--accent-soft: #dbeafe`
- `--black: 15, 23, 42` (rgb-числа)
- `--gray: 100, 116, 139`
- `--gray-light: 226, 232, 240`
- `--gray-dark: 30, 41, 59`
- `--box-shadow` — общая тень

Используйте только их — не вводите новые цвета без обновления токенов.
