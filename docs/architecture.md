# Архитектура Этикетки

Карта проекта: что где лежит, маршруты, коллекции, dataflow.
Обновляйте при добавлении новых маршрутов, коллекций или источников истины.

## Маршруты

### Статические страницы

| URL | Файл | Назначение |
|---|---|---|
| `/` | `src/pages/index.astro` | Главная: hero, карточки рубрик, последние 6 постов |
| `/about/` | `src/pages/about.astro` | О проекте |
| `/about/avtor/` | `src/pages/about/avtor.astro` | О редакции: экспертиза, принципы, контактная форма |
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

- `/rss.xml` — фид через `@astrojs/rss`
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

| Данные | Файл | Ключ |
|---|---|---|
| Категории (slug, название, цвет) | `src/consts.ts` | `CATEGORIES` |
| Навигация | `src/consts.ts` | `NAV_LINKS` |
| Sidebar-баннер (дайджест) | `src/consts.ts` | `SIDEBAR_BANNER` |
| CPA-баннеры (партнёрские/редакционные) | `src/data/cpa-banners.ts` | `CPA_BANNERS`, `CATEGORY_DEFAULT_CPA` |
| Сценарии калькулятора штрафов | `src/data/penalties.ts` | `SCENARIOS` |

## Компоненты

| Файл | Назначение |
|---|---|
| `src/components/BaseHead.astro` | `<head>`: мета, OG, JSON-LD, шрифты |
| `src/components/Header.astro` | Шапка с навигацией (4 ссылки) |
| `src/components/Footer.astro` | Подвал |
| `src/components/FormattedDate.astro` | Форматирование дат на русском |
| `src/components/FAQ.astro` | FAQ-аккордеон + FAQPage JSON-LD |
| `src/components/Checklist.astro` | Интерактивный чеклист с localStorage |
| `src/components/Callout.astro` | Акцентная врезка (тёмная / светлая) |

## Утилиты

- `src/utils/tags.ts`
  - `tagSlug(tag)` — кириллический slug из тега
  - `collectTags(posts)` — `{ slug → { name, posts[] } }` со всеми тегами
  - `pluralPosts(count)` — «материал/материала/материалов»
- `src/utils/glossary.ts`
  - `termSlug(term)` — slug для якоря
  - `firstLetter(term)` — буква для группировки
  - `alphabetOrder(a, b)` — компаратор для русско-английских букв

## Build pipeline

```
npm run build
  ├─ astro build          # генерация HTML/PNG/RSS/sitemap
  └─ pagefind --site dist # индексирование статей в /pagefind/
```

`astro build` сам по себе **не запускает Pagefind**. Всегда используйте `npm run build`.

Native-зависимости:
- `@resvg/resvg-js` — нативный binding для конвертации SVG → PNG в OG-эндпоинте
- `pagefind` — Rust-бинарь индексатора

Шрифты в `public/fonts/inter-*.woff` нужны при сборке (`fs.readFileSync` в OG-эндпоинте). **Не удаляйте их.**

## JSON-LD на страницах

| Страница | Используемые типы |
|---|---|
| Все страницы | `Organization`, `WebSite` (через `BaseHead.astro`) |
| `/blog/<slug>/` | `Article`, `BreadcrumbList` |
| `/about/avtor/` | `Person`, `BreadcrumbList` |
| `/category/<slug>/` | `CollectionPage`, `BreadcrumbList`, `FAQPage` (если в pillar есть FAQ) |
| `/tag/<slug>/` | `CollectionPage`, `BreadcrumbList` |
| `/slovar/` | `BreadcrumbList`, `DefinedTermSet` |
| `/kalkulyator-shtrafov/` | `WebApplication`, `BreadcrumbList`, `FAQPage` |
| Статьи с `<FAQ>` | `FAQPage` (эмитируется компонентом `FAQ.astro`) |

## Дизайн-токены

Все цвета — hex, без CSS-переменных:

| Токен | Значение | Применение |
|---|---|---|
| dark | `#111` | Header, footer, тёмные блоки |
| pink | `#E8175D` | Акцент: hover, нумерация FAQ, share-кнопки |
| lime | `#C8F500` | Логотип-точка, badge «Актуально», чеклист |
| sand | `#EDE8DF` | Фон страницы, hero info panel |
| sand-light | `#F6F4F0` | Hover, TOC background |
| white | `#FFFFFF` | Карточки, FAQ items, prose |

Категориальные цвета (hero-фон, карточки related):

| Категория | Фон | Текст |
|---|---|---|
| `ts-piot` | `#111` | `#fff` |
| `markirovka` | `#E8175D` | `#fff` |
| `zakonodatelstvo` | `#C8F500` | `#111` |
