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
  commands/      /create-article, /release-article, /publish-article, /factcheck,
                 /factcheck-batch, /analyze-article, /maintain-content, /plan-content,
                 /content-calendar, /content-pipeline, /find-topics, /cluster-gaps,
                 /research-topic, /optimize-seo, /check-ai, /update-template,
                 /monitor-competitors, /monitor-rss, /demo-automation, /new-post
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
    ord-config.json     конфиг ОРД-креативов для регистрации
    ord-erids.json      erid-токены Яндекс.ОРД (выход scripts/ord-register.mjs)
    markingCalendar.ts  данные календаря маркировки
    analytics/          GSC + Метрика + Вебмастер → articles.json
    audit/              отчёты health-check и других аудит-скриптов
    factcheck/          история фактчека
    metrika/goals.json  декларативные цели Метрики (sync через Management API)
    wordstat/           кеш Wordstat API
  layouts/BlogPost.astro     шаблон статьи + JSON-LD + Читайте также
  pages/                     blog, category, tag, dashboard, scenario, instrumenty,
                             slovar, search, zakon-2026, kak-rabotaet-ts-piot (флагман),
                             kalkulyator-shtrafov, kalendar-markirovki,
                             og/[slug].png.ts (Satori), sitemap.xml.ts, rss.xml.js
  styles/global.css          дизайн-токены: --pink, --lime, --sand, --dark
  utils/                     url, tags, posts (publishedPosts helper), track, glossary

scripts/                     health-check, social-to-docs, audit-social-coverage,
                             check-ai-markers, check-seo, check-stale-content,
                             generate-hero-images, generate-og-backgrounds-* (gemini,
                             local, openrouter), generate-preview-images,
                             generate-flagship-illustrations, optimize-images,
                             sharpen-heroes, compress-og-backgrounds,
                             metrika-sync-goals (в workflow), google-index, indexnow,
                             ord-register, ord-bootstrap, ord-status,
                             export-dzen, release-next-draft, install-hooks.sh

.github/workflows/           auto-publish, deploy-gh-pages, generate-hero-images,
                             generate-og-backgrounds, generate-preview-pool,
                             generate-flagship-illustrations, hero-backfill-daily,
                             wordstat-weekly, analytics-refresh, metrika-sync-goals,
                             index-notify, social-to-docs, ord-sync, ord-bootstrap,
                             ord-status, embeddings-monthly

public/
  fonts/                     woff для Satori
  og-backgrounds/            фоны OG по категориям
  images/{hero,preview,flagship}/  картинки статей
  CNAME                      etiketka-media.ru
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

Установка хуков: `bash scripts/install-hooks.sh`.

## Автоматизация

| Подсистема | Workflow | Документация |
|---|---|---|
| Авто-публикация | `auto-publish.yml` (cron 4×/день) | `CLAUDE.md` |
| Деплой | `deploy-gh-pages.yml` | `docs/architecture.md` |
| Hero-картинки | `generate-hero-images.yml`, `hero-backfill-daily.yml` | `docs/images.md` |
| OG-фоны | `generate-og-backgrounds.yml` | `docs/images.md` |
| Preview-пул | `generate-preview-pool.yml` | `docs/images.md` |
| Иллюстрации флагмана | `generate-flagship-illustrations.yml` | `docs/images.md` |
| Wordstat (тренды) | `wordstat-weekly.yml` | `docs/wordstat.md` |
| Аналитика (GSC + Метрика + Вебмастер) | `analytics-refresh.yml` | `docs/analytics.md` |
| Цели Метрики | `metrika-sync-goals.yml` (push на goals.json) | `docs/metrika.md` |
| Индексация (IndexNow + Google) | `index-notify.yml` | `docs/analytics.md` |
| Соцпосты → Google Docs | `social-to-docs.yml` | `docs/SECRETS.md` |
| ОРД-креативы (erid) | `ord-sync.yml`, `ord-bootstrap.yml`, `ord-status.yml` | `docs/SECRETS.md` |
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
| `docs/factcheck-history.md` | История прогонов и решений по фактчеку |
| `docs/editorial-policy.md` | Редполитика, классы решений |
| `docs/content-formats-roadmap.md` | Roadmap интерактивных форматов |
| `docs/article-cards.md` | Карточки статей: поля, превью, hero |
| `docs/design-system.md` | Дизайн-токены, цвета, шрифты |
| `docs/image-prompts.md` | Промпты для генерации картинок (Nano Banana) |
| `docs/og-telegram.md` | OG-картинки и превью для Telegram |

## SEO

Настроено:

- `<title>`, `<meta description>`, OG, Twitter Cards.
- JSON-LD `Organization`, `WebSite`, `Article`, `BreadcrumbList`.
- Sitemap `/sitemap.xml` (фильтр опубликованных через `publishedPosts()`).
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

## Флагманские и интерактивные страницы

- `/kak-rabotaet-ts-piot/` — флагман по ТС ПИоТ: 6 интерактивных
  компонентов + AI-иллюстрации, прогрев аудитории под срок 01.07.2026.
- `/kalkulyator-shtrafov/` — расчёт штрафа по выбранному сценарию (КоАП).
- `/kalendar-markirovki/` — таймлайн сроков по категориям маркировки.
- `/zakon-2026/` — трекер изменений законодательства 2025–2026.
- `/instrumenty/` — каталог всех интерактивных инструментов сайта.
- `/dashboard/` — внутренний дашборд (позиции, трафик, факт-чек статус).

React-компоненты для встраивания в MDX — в `src/components/interactive/`
(Sprint A: симулятор ТС ПИоТ, калькуляторы; Sprint B: ROI ИП→ООО,
quiz готовности, кейс кофейни; Sprint C: EdoChainPuzzle, и др.).

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
