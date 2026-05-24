# Этикетка

Информационный портал для малого и среднего бизнеса РФ. Тематика:

- **ТС ПИоТ** — техническое средство получения информации о товаре,
  программный модуль для онлайн-кассы (обязателен с 01.07.2026).
- **Маркировка «Честный знак»** — категории, сроки, штрафы.
- **Изменения в законодательстве** — налоги, ЭДО, КЭДО, ЕНС/ЕНП, проверки.

Цель — органический поисковый трафик из Яндекса и Google по
информационным запросам МСБ. Домен — `etiketka-media.ru`.

## Стек

- **Astro 5** — статическая генерация, MDX, sitemap, RSS.
- **React 19** — интерактивные компоненты на страницах (калькуляторы,
  чек-листы, симуляторы).
- **TypeScript** — конфиги и компоненты.
- **GitHub Actions + GitHub Pages** — сборка и деплой (`deploy-gh-pages.yml`).
- **Claude Code** — агенты (`.claude/agents/`) и команды (`.claude/commands/`)
  для контент-цикла.
- **OpenRouter** — Nano Banana (Gemini 3.1 Flash Image) для hero-картинок,
  Satori + Resvg для OG-картинок.

## Запуск

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # сборка в dist/
npm run preview  # просмотр собранной версии
node scripts/health-check.mjs   # сводка состояния проекта (15+ проверок)
```

## Структура

```
.claude/
  agents/        research-specialist, content-writer, seo-optimizer, social-media-manager
  commands/      /create-article, /release-article, /factcheck, /factcheck-batch,
                 /analyze-article, /maintain-content, /plan-content, /find-topics,
                 /check-ai, /new-post
  factchecked/   маркеры пройденного факт-чека (по slug)

src/
  components/    Header, Footer, BaseHead, FormattedDate, Picture, Search и др.
    interactive/ Sprint A–C интерактивные блоки для MDX
  consts.ts      источник истины: SITE_TITLE, NAV_LINKS, CATEGORIES
  content/
    blog/        YYYY-MM-DD-slug.md(x) — публикуемые статьи
    pillars/     ts-piot.md, markirovka.md и др. — флагман-материалы
    glossary/    <term>.md — словарь
    wiki/        research, контент-планы, заметки
      social/    черновики соцпостов (Telegram / VK / Дзен / Email)
    social/      старая колодка соцпостов (с суффиксом -social)
  content.config.ts  схемы коллекций
  data/
    penalties.ts        сценарии для калькулятора штрафов
    cpa-banners.ts      CPA-баннеры (источник истины) + категория → дефолт
    ord-erids.json      erid-токены Яндекс.ОРД для каждого баннера
    markingCalendar.ts  данные календаря маркировки
    analytics/          GSC + Метрика + Вебмастер → articles.json
    metrika/goals.json  декларативные цели Метрики (sync через Management API)
    wordstat/           кеш Wordstat API
  layouts/BlogPost.astro     шаблон статьи + JSON-LD + Читайте также
  pages/                     blog, category, tag, dashboard, scenario, instrumenty, zakon-2026
  styles/global.css          дизайн-токены: --pink, --lime, --sand, --dark
  utils/                     url, tags, posts (publishedPosts helper), track, glossary

scripts/                     health-check, social-to-docs, generate-hero-images,
                             generate-og-backgrounds, generate-flagship-illustrations,
                             metrika-sync-goals, wordstat-fetch, analytics-refresh, ord-register
.github/workflows/           auto-publish, deploy-gh-pages, generate-hero-images,
                             hero-backfill-daily, wordstat-weekly, analytics-refresh,
                             metrika-sync-goals, index-notify, social-to-docs,
                             ord-sync, embeddings-monthly

public/
  fonts/                     woff для Satori
  og-backgrounds/            фоны OG по категориям
  images/{hero,preview,flagship}/  картинки статей
docs/                        вся техническая документация (см. таблицу ниже)
```

## Жизненный цикл статьи

| Шаг | Команда | Когда |
|---|---|---|
| 1. План | `/plan-content` | Раз в месяц |
| 2. Темы | `/find-topics` | Перед новым материалом |
| 3. Драфт | `/create-article <тема>` | Полный цикл research → writer → seo → social |
| 4. Факт-чек | `/factcheck <slug>` | Перед `draft: false` |
| 5. Оценка | `/analyze-article <slug>` | В `/release-article` |
| 6. Релиз | `/release-article <slug>` | Гейты, перелинковка, соцпосты, индексация |
| 7. Поддержка | `/maintain-content` | Раз в неделю — аудит старых статей |

Pre-commit гейты:

- **factcheck-guard** — статья с `draft: false` должна иметь маркер
  `.claude/factchecked/<slug>`.
- **social-guard** — статья с `draft: false` должна иметь соцпосты в
  `src/content/wiki/social/<slug>.md` или `src/content/social/<slug>-social.md`.

Установка хуков: `bash scripts/git-hooks/install.sh`.

## Автоматизация

| Подсистема | Workflow | Документация |
|---|---|---|
| Авто-публикация | `auto-publish.yml` (cron 4×/день) | `CLAUDE.md` |
| Деплой | `deploy-gh-pages.yml` | `docs/architecture.md` |
| Hero-картинки | `generate-hero-images.yml`, `hero-backfill-daily.yml` | `docs/images.md` |
| Иллюстрации флагмана | `generate-flagship-illustrations.yml` | `docs/images.md` |
| Wordstat (тренды) | `wordstat-weekly.yml` | `docs/wordstat.md` |
| Аналитика (GSC + Метрика + Вебмастер) | `analytics-refresh.yml` | `docs/analytics.md` |
| Цели Метрики | `metrika-sync-goals.yml` (push на goals.json) | `docs/metrika.md` |
| Индексация (IndexNow + Google) | `index-notify.yml` | `docs/analytics.md` |
| Соцпосты → Google Docs | `social-to-docs.yml` | `docs/SECRETS.md` |
| ОРД-креативы (erid) | `ord-sync.yml` | `src/content/wiki/cpa-products.md` |
| Embeddings (similarity) | `embeddings-monthly.yml` | `docs/architecture.md` |

Все секреты GitHub описаны в `docs/SECRETS.md` (как получить, как обновлять,
сроки истечения).

## Документация

| Файл | Что внутри |
|---|---|
| **`CLAUDE.md`** | Краткие инструкции и правила для Claude Code |
| **`docs/operations.md`** | Карта подсистем, ритуалы, «что делать когда горит» |
| **`docs/content-rules.md`** | Правила контента, frontmatter, SEO, стиль речи, соцпосты |
| **`docs/tools.md`** | Инструментарий QA, OpenRouter, скрипты |
| **`docs/SECRETS.md`** | Все секреты GitHub: что есть, как обновлять |
| `docs/architecture.md` | Маршруты, коллекции, компоненты, утилиты |
| `docs/content-types.md` | Как добавить статью, термин, pillar, сценарий |
| `docs/images.md` | Hero/preview/OG/WebP, Satori, шрифты |
| `docs/search.md` | Pagefind: индексация и кастомизация |
| `docs/analytics.md` | GSC + Метрика + Вебмастер + дашборд `/dashboard/` |
| `docs/metrika.md` | Цели Метрики через Management API |
| `docs/wordstat.md` | Wordstat API, частотность ключей |
| `docs/factcheck.md` | Pipeline проверки фактов, классы A/B/C |
| `docs/editorial-policy.md` | Редполитика, классы решений |
| `docs/content-formats-roadmap.md` | Roadmap интерактивных форматов |

## SEO

Настроено:

- `<title>`, `<meta description>`, OG, Twitter Cards.
- JSON-LD `Organization`, `WebSite`, `Article`, `BreadcrumbList`.
- Sitemap `/sitemap-index.xml` (фильтр опубликованных через `publishedPosts()`).
- RSS-лента `/rss.xml`.
- `robots.txt` с указанием `Sitemap` и `Host`.
- IndexNow для Яндекса + Google Indexing API после деплоя (`index-notify.yml`).
- Verification-теги Яндекс.Вебмастера и GSC — в `src/components/BaseHead.astro`.

Аналитика: дашборд `/dashboard/` показывает позиции и трафик из GSC + Метрики,
синхронизируется `analytics-refresh.yml` раз в неделю.

## Деплой

GitHub Pages через `deploy-gh-pages.yml`. Триггер — push в основную ветку.
Деплой автоматический, без ручных шагов. Custom-домен `etiketka-media.ru`
настроен в `public/CNAME` и DNS-провайдере.

## Реклама и ОРД

Все CPA-баннеры через партнёрскую программу Контура и Диадока. Каждый
рекламный креатив должен иметь erid-токен из Яндекс ОРД (38-ФЗ).

- Источник: `src/data/cpa-banners.ts`.
- erid-токены: `src/data/ord-erids.json` (генерируется `scripts/ord-register.mjs`).
- Соответствие категория → дефолтный CPA: `CATEGORY_DEFAULT_CPA` там же.
- В соцпостах для Дзена обязателен CPA-блок «Что использовать» с erid.

## Лицензия

Шаблон основан на klaude-blog (MIT). Плагин claude-blog (MIT).
Контент — © Этикетка.
