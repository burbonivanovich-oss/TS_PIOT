# Этикетка — инструкции для Claude Code

## О проекте

Информационный портал для малого и среднего бизнеса РФ. Тематика:

- **ТС ПИоТ** — техническое средство получения информации о товаре,
  программный модуль для онлайн-кассы (обязателен с 01.07.2026).
- **Маркировка «Честный знак»** — категории, сроки, штрафы.
- **Изменения в законодательстве** — налоги, ЭДО, КЭДО, ЕНС/ЕНП, проверки.

Цель — органический поисковый трафик из Яндекса и Google по
информационным запросам МСБ.

## Стек

- **Astro 5** (статическая генерация, MDX, sitemap, RSS).
- Контент в `src/content/blog/` (Markdown/MDX).
- Развёртывание на **GitHub Pages** через GitHub Actions
  (`deploy-gh-pages.yml`).
- Все тексты только на русском (`lang="ru"`, локаль `ru-RU`).

## Документация (где что искать)

| Файл | Что внутри |
|---|---|
| **`docs/operations.md`** | Карта подсистем, ритуалы, что делать когда что-то горит. Запустить `health-check.mjs` — единый отчёт состояния |
| **`docs/content-rules.md`** | Правила контента, frontmatter, SEO, стиль речи, паразиты, соцпосты |
| **`docs/tools.md`** | Инструментарий QA (factcheck, /blog), OpenRouter, скрипты, технические особенности |
| **`docs/SECRETS.md`** | Все секреты GitHub: что есть, как получить, как обновлять |
| `docs/architecture.md` | Маршруты, коллекции, компоненты, утилиты |
| `docs/content-types.md` | Как добавить статью, термин, pillar, сценарий |
| `docs/images.md` | Hero/preview/OG/WebP, Satori, шрифты |
| `docs/search.md` | Pagefind: индексация и кастомизация |
| `docs/analytics.md` | GSC + Метрика + Вебмастер + дашборд `/dashboard/` |
| `docs/metrika.md` | Цели Метрики через Management API |
| `docs/wordstat.md` | Wordstat API, частотность ключей |
| `docs/factcheck.md` | Pipeline проверки фактов, классы A/B/C |
| `docs/editorial-policy.md` | Редполитика, классы решений |
| `docs/competitor-benchmark-kontur.md` | Бенчмарк против Контура: что перенять, фактические риски, оценка стиля |
| `docs/content-formats-roadmap.md` | Roadmap интерактивных форматов |
| `docs/blocks-roadmap.md` | Roadmap блоков сайта: текущие + отобранные из лабораторных прототипов |
| `docs/cpa-storefront-roadmap.md` | Roadmap витрины продуктов Контура: лид-формы с тегом, раздел `/produkty/`, бандлы, фаза заявок |

## Структура файлов

```
docs/                           # Техническая документация (см. таблицу выше)
public/
├── fonts/                      # woff для Satori (НЕ удалять)
├── og-backgrounds/             # фоны для OG-картинок по категориям
└── images/{hero,preview,flagship}/  # картинки статей и флагмана
src/
├── components/                 # Header, Footer, BaseHead, FormattedDate, Picture, ...
│   └── interactive/            # F26 — встраиваемые в MDX интерактивные блоки
├── consts.ts                   # SITE_TITLE, NAV_LINKS, CATEGORIES (источник истины)
├── content/
│   ├── blog/                   # YYYY-MM-DD-slug.md(x) — публикуемые статьи
│   ├── pillars/                # ts-piot.md, markirovka.md, …
│   ├── glossary/               # <term>.md — термины словаря
│   └── wiki/                   # research, контент-планы, заметки (без маршрутов)
│       └── social/             # социальные черновики
├── content.config.ts           # Схемы коллекций
├── data/
│   ├── penalties.ts            # Сценарии для калькулятора штрафов
│   ├── cpa-banners.ts          # CPA-баннеры (источник истины)
│   ├── markingCalendar.ts      # Данные для календаря маркировки
│   ├── analytics/              # GSC + Метрика + Вебмастер → articles.json
│   ├── metrika/goals.json      # Декларативные цели Метрики
│   ├── ord-config.json         # Креативы для ОРД Яндекса
│   └── wordstat/               # Кеш Wordstat API
├── layouts/BlogPost.astro      # Шаблон статьи + JSON-LD + Читайте также
├── pages/                      # Маршруты (blog, category, tag, dashboard, scenario, …)
├── styles/global.css           # Дизайн-токены --pink, --lime, --sand, --dark
└── utils/
    ├── url.ts                  # u() — оборачивает пути в base (GitHub Pages)
    ├── tags.ts                 # tagSlug, collectTags, pluralPosts
    ├── track.ts                # window.ym('reachGoal') обёртка
    └── glossary.ts             # termSlug, firstLetter, alphabetOrder
```

## Workflow создания статьи

1. **Тема** — из контент-плана (`src/content/wiki/content-plan-2026.md`)
   или из weekly Wordstat diff через `/find-topics` (NEW/RISING фразы
   за неделю; см. `docs/wordstat.md`).
2. **`/new-post "<тема>"`** — пайплайн с агентом research → writer →
   seo-optimizer → social-media-manager. Все четыре шага за один
   запрос.
3. Статья сохраняется как `src/content/blog/YYYY-MM-DD-slug.md` с
   `draft: true`. Соц-черновики — `src/content/wiki/social/`.
4. **`/factcheck <slug>`** — извлекает даты, штрафы, ст. КоАП,
   ссылки на НПА, сверяет с первоисточниками. Решения по
   `docs/editorial-policy.md`. После проверки — маркер
   `.claude/factchecked/<slug>`. Подробности — `docs/tools.md`.
5. **`/analyze-article <slug>`** — оценка 0–100. Блокер если < 70 /
   маркер старше 180 дней / NPA-audit упал.
6. После успеха — `draft: false`, `status: ready` в соцпостах.
7. Билд `npm run build`, ручной просмотр на dev (`npm run dev`).
8. Деплой коммитом в основную ветку (GitHub Actions → GitHub Pages).

Полные правила контента и стиля — **`docs/content-rules.md`**.
Полная документация инструментов — **`docs/tools.md`**.

## Главные правила (короткая сводка)

- **Длина опорной статьи** 1500–2500 слов; сателлита 800–1500.
- **Активный залог, прямое обращение** к читателю («проверьте»),
  без «предпринимателям необходимо».
- **Никаких** эмодзи, восклицательных знаков, кликбейта.
- **Числа цифрами, даты конкретно** (01.07.2026, не «в середине 2026»).
- **Каждый факт — со ссылкой на первоисточник** в драфте.
- **Минимум 3 ссылки на статьи Контура** (kontur.ru) из `src/data/kontur-links.json`;
  где нет подходящей — текстовая заглушка. На наш `/blog/` не ссылаемся.
- Запрещённые слова: `является`, `каковы`, `следует отметить`,
  `таким образом`, `в данном контексте`, `с точки зрения`,
  `в целях`, `молочка` и т. п. — полный список и замены в
  `docs/content-rules.md`.

## Frontmatter (минимум)

```yaml
---
title: "Заголовок: что и почему"
description: "Краткое описание, до 160 символов."
pubDate: "YYYY-MM-DD"
tags: [тег1, тег2]
categories: [ts-piot]   # или markirovka, zakonodatelstvo, kkt, egais
draft: false
seo:
  keywords: [целевой ключ]
---
```

Полный шаблон с опциональными полями — `docs/content-rules.md`.

## Чего НЕ публикуем

- Прямую коммерческую рекламу решений («купи это ПО»).
- Контент без проверки на действующие нормативные акты.
- Статьи с целевым запросом, под который уже есть материал в
  кластере, — обновляем существующий, а не плодим дубли.

## Когда что обновлять в `docs/`

При изменении компонента, скрипта или паттерна — обновляйте
соответствующий файл в `docs/` в той же PR. Таблица «что куда» —
в `docs/tools.md` (раздел «Документация изменений»).
