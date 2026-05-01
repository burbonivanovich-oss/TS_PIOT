# Регламент.Бизнес — инструкции для Claude Code

## О проекте

Информационный портал для малого и среднего бизнеса РФ. Тематика:
- **ТС ПИоТ** — техническое средство получения информации о товаре, программный
  модуль для онлайн-кассы (обязателен с 28.12.2025).
- **Маркировка «Честный знак»** — категории, сроки, штрафы.
- **Изменения в законодательстве** — налоги, ЭДО, КЭДО, ЕНС/ЕНП, проверки.

**Цели:**
1. Органический трафик из Яндекса и Google по информационным запросам МСБ.
2. Монетизация через CPA-партнёрство с Контур.Партнёр (продукты СКБ Контур).

## Стек

- Astro 5 (статическая генерация, MDX, sitemap, RSS, paginate()).
- Контент в `src/content/blog/` (Markdown/MDX).
- Развёртывание на Vercel (`vercel.json` сконфигурирован).
- React-компоненты для интерактивных блоков (BlogFilter, PenaltyCalculator).
- Pagefind для поиска по сайту.
- Все тексты только на русском языке (`lang="ru"`, локаль `ru-RU`).

## Структура файлов

```
docs/
├── architecture.md        # Карта маршрутов, коллекций, dataflow
├── content-types.md       # Как добавить статью, термин, pillar, сценарий
├── og-images.md           # Satori/Resvg, шрифты, шаблон обложек
└── search.md              # Pagefind: индексация и кастомизация

public/
├── fonts/                 # Шрифты для OG-картинок и интерфейса (НЕ удалять)
├── og-default.svg         # Фолбэк-обложка
└── favicon.svg, robots.txt

scripts/
├── check-ai-markers.mjs   # Детектор AI-маркеров (regex + LLM через OpenRouter)
├── check-seo.mjs          # SEO-чеклист P0/P1 перед публикацией
├── check-stale-content.mjs # Поиск статей старше N месяцев без обновления
├── generate-hero-images.mjs # Генерация hero-изображений через OpenRouter (FLUX)
├── hooks/pre-commit       # Git-хук: SEO P0 + factcheck-маркер (установить через install-hooks.sh)
└── install-hooks.sh       # Установка git-хуков

src/
├── components/
│   ├── BaseHead.astro      # Мета-теги, OG, JSON-LD (Organization, WebSite, SearchAction)
│   ├── Header.astro        # Навигация с бургер-меню
│   ├── Footer.astro
│   ├── FormattedDate.astro
│   ├── HeaderLink.astro
│   ├── BlogFilter.tsx      # Фильтр статей (React, client:load)
│   ├── PenaltyCalculator.tsx
│   ├── MarkingCalendar.tsx
│   ├── ProductCard.astro   # Карточка CPA-продукта
│   └── AffiliatesBlock.astro # Секция «Рекомендуемые инструменты»
├── consts.ts               # SITE_TITLE, NAV_LINKS, CATEGORIES (источник истины)
├── content/
│   ├── blog/               # YYYY-MM-DD-slug.md — публикуемые статьи
│   ├── pillars/            # ts-piot.md, markirovka.md, zakonodatelstvo.md
│   ├── glossary/           # <term>.md — термины словаря
│   └── wiki/               # research, контент-планы, редакционные заметки
├── content.config.ts       # Схемы коллекций blog, pillars, glossary, wiki
├── data/
│   ├── penalties.ts        # Сценарии калькулятора штрафов
│   └── affiliates.ts       # CPA-каталог Контур + дефолты по категориям
├── layouts/BlogPost.astro  # Шаблон статьи: JSON-LD, TOC, sidebar-реклама, «Читайте также»
├── pages/
│   ├── index.astro         # Главная (WebPage + speakable JSON-LD)
│   ├── about.astro, about/avtor.astro, privacy.astro, 404.astro
│   ├── search.astro        # /search/ (Pagefind UI)
│   ├── blog/[...page].astro  # Пагинация /blog/, /blog/2/ (paginate(), pageSize=12)
│   ├── blog/[...slug].astro  # Страница статьи
│   ├── category/[category].astro  # pillar + FAQ + посты + JSON-LD
│   ├── tag/[tag].astro, tags/index.astro
│   ├── slovar/index.astro
│   ├── kalkulyator-shtrafov.astro
│   ├── kalendar-markirovki.astro
│   ├── og/[slug].png.ts    # Автогенерация OG-картинок (Satori + Resvg)
│   ├── sitemap.xml.ts      # Динамический sitemap (статьи + пагинация + теги)
│   └── rss.xml.js
├── styles/global.css       # Дизайн-токены --accent, --gray-*
└── utils/
    ├── tags.ts             # tagSlug, collectTags, pluralPosts
    └── glossary.ts         # termSlug, firstLetter, alphabetOrder
```

## Frontmatter-шаблон (полный)

```yaml
---
title: "Заголовок: что и почему"          # ≤ 75 символов (лимит Яндекса)
description: "Краткое описание для SERP." # 140–160 символов
pubDate: "YYYY-MM-DD"
updatedDate: "YYYY-MM-DD"                 # при обновлении
tags:
  - тег1
  - тег2                                  # 4–7 тегов, строчные
categories:
  - ts-piot                               # или markirovka, zakonodatelstvo
draft: false
seo:
  keywords:
    - целевой ключ 1
    - целевой ключ 2
faq:                                      # опционально — генерирует FAQPage JSON-LD
  - question: "Вопрос?"
    answer: "Ответ."
affiliates:                               # опционально — переопределяет дефолт по категории
  - kontur-ofd
  - kontur-market
---
```

Если `affiliates` не указан — CPA-блок и sidebar показывают дефолт по первой категории
из `CATEGORY_DEFAULT_AFFILIATES` в `src/data/affiliates.ts`.

## Монетизация (CPA Контур.Партнёр)

Каталог продуктов и ставки — `src/data/affiliates.ts`. Там же:
- `AFFILIATE_PRODUCTS` — 20 продуктов с `commission` (₽) и `commissionRate` (%)
- `CATEGORY_DEFAULT_AFFILIATES` — дефолты для трёх основных категорий
- `CLUSTER_AFFILIATES` — рекомендации для 12 подкластеров (ЕГАИС, ВЭД, госзакупки и т.д.)

**Текущие дефолты по категориям:**
- `ts-piot` → Контур.ОФД + Контур.Маркет (Маркет включает кассу)
- `markirovka` → Контур.Маркировка + Контур.Маркет
- `zakonodatelstvo` → Контур.Экстерн «Учётный» + Контур.КЭДО

**Где отображается реклама:**
1. `AffiliatesBlock` — секция «Рекомендуемые инструменты» в конце статьи (2 карточки)
2. Sticky sidebar — компактная карточка слева от текста на экранах > 1080px

**Важно:** все CPA-ссылки должны иметь `rel="sponsored noopener noreferrer"` —
уже проставлено в компонентах. Дисклеймер о партнёрской комиссии выводится автоматически.

**Перед запуском:** заменить placeholder URL в `affiliates.ts` на реальные ссылки
из личного кабинета Контур.Партнёр. Эльба и ЕГАИС помечены `commission: 0` —
уточнить ставки.

## Правила контента

- **Длина:** 1500–2500 слов для опорных статей, 800–1500 для сателлитов.
- **Структура:** лид → 5–7 H2-секций → FAQ → заключение со ссылками.
- **Внутренние ссылки:** минимум 3 на каждую статью.
- **Tags:** 4–7 штук, строчные, по делу.
- **Источники:** факты и нормы — со ссылкой на НПА в тексте.
- **Правовая оговорка:** дисклеймер автоматически добавляется через `BlogPost.astro`.

## SEO — что реализовано

Весь SEO настроен автоматически через компоненты. Ничего вручную прописывать не надо.

| Элемент | Где |
|---|---|
| Article JSON-LD (headline, datePublished, dateModified, wordCount, author, publisher, image, articleSection) | `BlogPost.astro` |
| BreadcrumbList JSON-LD | `BlogPost.astro`, `category/[category].astro` |
| FAQPage JSON-LD | `BlogPost.astro` (если `faq:` в frontmatter), `category/[category].astro` (из pillar) |
| CollectionPage + ItemList JSON-LD | `blog/[...page].astro` (страница 1), `category/[category].astro` |
| WebPage + speakable JSON-LD | `index.astro` |
| Organization + WebSite + SearchAction JSON-LD | `BaseHead.astro` (все страницы) |
| rel="prev"/"next" | `blog/[...page].astro` |
| Canonical | автоматически в `BaseHead.astro` |
| robots meta (index/noindex) | `BaseHead.astro` |
| Sitemap (статьи + пагинация + теги + категории) | `sitemap.xml.ts` |
| Cache-Control (fonts, /_astro, /pagefind, /og) | `vercel.json` |
| Security headers | `vercel.json` |
| Font preload (geologica-regular + commissioner-bold) | `BaseHead.astro` |

**Известные gap'ы (не реализованы):**
- Publisher logo PNG (сейчас SVG — Google rich results не отображает логотип)
- `previewImage` в frontmatter — тип `z.string()`, не оптимизируется через Sharp

## Workflow создания статьи

1. Тема из `src/content/wiki/content-plan-2026.md`.
2. `/new-post "<тема>"` — пайплайн research → writer → seo-optimizer.
3. Драфт: `src/content/blog/YYYY-MM-DD-slug.md` с `draft: true`.
4. Проверка фактов → `/blog factcheck <файл>` → создать `.claude/factchecked/<slug>`.
5. Проверка AI-маркеров → `node scripts/check-ai-markers.mjs <файл>` (скор ≤ 5).
6. `draft: false` → `npm run build` → проверка на `npm run dev`.
7. Деплой коммитом (pre-commit хук проверяет SEO P0 и factcheck-маркер автоматически).

## Мультиканальный пайплайн

После публикации статьи `/new-post` автоматически готовит четыре версии контента.
Файл: `.claude/social/YYYY-MM-DD-slug.md`

| Канал | Формат | Особенности |
|---|---|---|
| Сайт | Полная статья 1500–2500 слов | Основная версия |
| Дзен | Уникальный текст 3000–5000 знаков | Другой угол, другая структура H2 |
| Telegram | 700–900 знаков | Тезисы + одна ссылка |
| VK | 1500–3000 знаков | Hero-image, 3–5 хэштегов, одна ссылка |

## Контроль качества

### Pre-commit хук (`.git/hooks/pre-commit`)
Запускается автоматически при `git commit`. Блокирует публикацию если:
- SEO P0-ошибки: title > 75 символов, description < 100 или > 165, нет категорий,
  нет seo.keywords, нет внутренних ссылок.
- Отсутствует файл `.claude/factchecked/<slug>` (подтверждение проверки фактов).

Установка: `bash scripts/install-hooks.sh`

### AI-маркеры (`scripts/check-ai-markers.mjs`)
```bash
node scripts/check-ai-markers.mjs src/content/blog/<файл>.md
node scripts/check-ai-markers.mjs <файл> --llm          # + проверка через LLM
node scripts/check-ai-markers.mjs <файл> --threshold=5  # порог (дефолт 6)
```
Скор ≤ 5 — публиковать. 6–8 — переписать фрагменты. 9–10 — переписать статью.

### Устаревший контент (`scripts/check-stale-content.mjs`)
```bash
node scripts/check-stale-content.mjs          # статьи без обновления > 6 мес.
node scripts/check-stale-content.mjs --months=3
```

## Генерация изображений

**Hero-изображения** генерируются через OpenRouter API (модель FLUX.1-schnell):
```bash
OPENROUTER_API_KEY=<ключ> node scripts/generate-hero-images.mjs
```
Ключ хранится в `.claude/settings.local.json` (gitignored).

**OG-картинки** генерируются автоматически при сборке через Satori + Resvg.
Шрифты для OG — `public/fonts/inter-*.woff`. Подробности — `docs/og-images.md`.

## Технические особенности

### Сборка
- Команда: `npm run build` = `astro build && pagefind --site dist`.
  **Не запускать `astro build` напрямую** — поисковый индекс не обновится.
- Vercel запускает `npm run build` автоматически (см. `vercel.json`).
- Нативные зависимости: `@resvg/resvg-js`. При переносе — проверить платформу.

### Пагинация блога
- Файл: `src/pages/blog/[...page].astro` (заменил `index.astro`).
- Astro `paginate()`, pageSize = 12. Генерирует `/blog/`, `/blog/2/`, `/blog/3/`...
- BlogFilter (React) работает поверх: когда фильтр активен — показывает
  отфильтрованные результаты; когда нет — показывает server-paginated HTML.
- rel="prev"/"next" проставлены в `<head>`.

### Маршруты и коллекции
- Публичные коллекции: `blog`, `pillars`, `glossary`. `wiki` — внутренняя.
- Новый тег в frontmatter автоматически создаёт `/tag/<slug>/` и попадает в `/tags/`.
- Slug категорий = id pillar-файла. Новая категория: обновить `CATEGORIES` в
  `consts.ts` + создать `src/content/pillars/<slug>.md`.

### OG-картинки
- Для каждого поста: `/og/<slug>.png` (1200×630, Satori + Resvg).
- `heroImage` в frontmatter необязателен — без него подставляется OG-картинка.
- Шрифты OG: `public/fonts/inter-*.woff` (НЕ удалять).

### Поиск
- Pagefind индексирует только `data-pagefind-body` → только статьи блога.
- Навигация и «Читайте также» помечены `data-pagefind-ignore`.

### «Читайте также»
- В `BlogPost.astro`: 3 связанных поста. Скоринг: теги ×2, категория ×1.

### Sidebar с рекламой
- В `BlogPost.astro`: CSS Grid (200px sidebar + article), виден на > 1080px.
- Показывает первый продукт из `affiliates` frontmatter или дефолт по категории.
- `position: sticky; top: 72px` — прилипает при скролле.

### Калькулятор штрафов
- Данные: `src/data/penalties.ts` — единственный источник истины.
- При изменениях КоАП: обновить здесь + проверить статьи
  (`grep -nE '14\.5|15\.12' src/content/blog/`).

## Чего НЕ публикуем

- Прямую коммерческую рекламу («купите этот продукт»). CPA — рекомендация, не реклама.
- Контент без проверки на действующие НПА.
- Статьи под запрос, под который уже есть материал — обновляем существующий.
- Факты без ссылок на первоисточник (НПА, письма ведомств, «Честный знак»).

## Чек-лист перед запуском сайта

- [ ] Деплой на Vercel, привязка домена `reglament-biznes.ru`
- [ ] Заменить placeholder CPA-ссылки в `src/data/affiliates.ts`
- [ ] Уточнить ставки Эльба и ЕГАИС в Контур.Партнёр
- [ ] Добавить Яндекс.Метрику (счётчик в `BaseHead.astro`, строка размечена)
- [ ] Добавить Google Analytics 4 (Measurement ID в `BaseHead.astro`)
- [ ] Верификация в Яндекс.Вебмастер + Google Search Console
- [ ] Подать sitemap в обе системы
- [ ] Создать PNG-логотип 600×60 и заменить SVG в JSON-LD publisher.logo
- [ ] Установить pre-commit хук: `bash scripts/install-hooks.sh`
- [ ] Написать минимум 8–10 P0-статей перед запуском
- [ ] Проверить `markirovka.md` и `zakonodatelstvo.md` — заполнены ли `keyDates` и `faq`
