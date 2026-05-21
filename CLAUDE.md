# Этикетка — инструкции для Claude Code

## О проекте

Информационный портал для малого и среднего бизнеса РФ. Тематика:
- **ТС ПИоТ** — техническое средство получения информации о товаре, программный
  модуль для онлайн-кассы (обязателен с 01.07.2026).
- **Маркировка «Честный знак»** — категории, сроки, штрафы.
- **Изменения в законодательстве** — налоги, ЭДО, КЭДО, ЕНС/ЕНП, проверки.

Цель — органический поисковый трафик из Яндекса и Google по информационным
запросам МСБ.

## Стек

- Astro 5 (статическая генерация, MDX, sitemap, RSS).
- Контент в `src/content/blog/` (Markdown/MDX).
- Развёртывание на GitHub Pages через GitHub Actions (`deploy-gh-pages.yml`).
- Все тексты только на русском языке (`lang="ru"`, локаль `ru-RU`).

## Структура файлов

```
docs/                           # Техническая документация для разработчиков
├── architecture.md             # Карта маршрутов, коллекций, dataflow
├── content-types.md            # Как добавить статью, термин, pillar, сценарий
├── images.md                   # Satori/Resvg, шрифты, шаблон обложек
└── search.md                   # Pagefind: индексация и кастомизация

public/
├── fonts/inter-*.woff, commissioner-*.woff, geologica-*.woff  # Шрифты для OG-картинок (НЕ удалять)
├── og-default.svg              # Фолбэк-обложка
└── favicon.svg, robots.txt

src/
├── components/                 # Header, Footer, BaseHead, FormattedDate, HeaderLink.astro,
│                               # BlogFilter.tsx, MarkingCalendar.tsx, PenaltyCalculator.tsx
│   └── interactive/            # F26 — встраиваемые в MDX интерактивные блоки
│                               # (планируется в Спринте A — см. docs/content-formats-roadmap.md)
├── consts.ts                   # SITE_TITLE, NAV_LINKS, CATEGORIES, INLINE_SUBSCRIBE (источник истины)
├── content/
│   ├── blog/                   # YYYY-MM-DD-slug.md — публикуемые статьи
│   ├── pillars/                # ts-piot.md, markirovka.md, zakonodatelstvo.md, kkt.md, egais.md
│   ├── glossary/               # <term>.md — термины словаря
│   ├── social/                 # социальные черновики (2026-05-01 и новее)
│   └── wiki/                   # research, контент-планы, редакционные заметки
│       └── social/             # социальные черновики (старый путь)
├── content.config.ts           # Схемы коллекций blog, pillars, glossary, wiki
├── data/
│   ├── penalties.ts            # Сценарии для калькулятора штрафов
│   ├── cpa-banners.ts          # CPA-баннеры для BlogPost
│   ├── markingCalendar.ts      # Данные для календаря маркировки
│   └── wordstat/               # Кеш Wordstat API (см. docs/wordstat.md)
│       ├── keys.json           # точечный кеш по seo.keywords (контур A)
│       ├── snapshots/          # дневные снепшоты keys.json
│       └── discoveries/        # weekly trend discovery (контур B)
│           ├── seeds.json      # 162 широких seed-а
│           ├── <YYYY-MM-DD>/   # дневная выгрузка топ-2000 на каждый seed
│           └── diffs/          # markdown-отчёты NEW/RISING/FALLING/DROPPED
├── layouts/BlogPost.astro      # Шаблон статьи + «Читайте также» + JSON-LD
├── pages/
│   ├── index.astro, about.astro, about/avtor.astro, privacy.astro, 404.astro
│   ├── search.astro            # /search/ (Pagefind UI)
│   ├── blog/[...slug].astro, blog/index.astro
│   ├── category/[category].astro   # pillar + FAQ + посты
│   ├── tag/[tag].astro, tags/index.astro
│   ├── slovar/index.astro      # глоссарий с якорями
│   ├── kalkulyator-shtrafov.astro  # калькулятор штрафов
│   ├── kalendar-markirovki.astro   # календарь маркировки
│   ├── og/[slug].png.ts        # автогенерация OG-картинок
│   └── rss.xml.js
├── styles/global.css           # Дизайн-токены --pink, --lime, --sand, --dark
└── utils/
    ├── url.ts                  # u() — оборачивает пути в base (GitHub Pages)
    ├── tags.ts                 # tagSlug, collectTags, pluralPosts
    └── glossary.ts             # termSlug, firstLetter, alphabetOrder
```

## Правила контента

- **Длина опорных статей** 1500–2500 слов. Сателлитов — 800–1500.
- **Структура:** короткий лид (что и зачем), 4–6 H2-секций, FAQ, заключение
  со ссылками на смежные материалы.
- **Внутренние ссылки:** минимум 3 на каждую статью.
- **Tags:** 4–7 штук, лоркейс, по делу.
- **Categories:** одна основная из `CATEGORIES` в `src/consts.ts` (`ts-piot`,
  `markirovka`, `zakonodatelstvo`, `kkt`, `egais`).
- **Источники:** факты, цифры и нормы — со ссылкой на первоисточник в драфте
  (НПА, разъяснения ведомств, «Честный знак»). Голословных утверждений быть
  не должно.
- **Дата:** ставим `pubDate`. При обновлении — `updatedDate`.
- **Правовая оговорка:** публикуем не как юридическую консультацию, а как
  информационный материал — об этом написано в `BlogPost.astro`.

## Frontmatter-шаблон

```yaml
---
title: "Заголовок: что и почему"
description: "Краткое описание для SERP, до 160 символов."
pubDate: "YYYY-MM-DD"
updatedDate: "YYYY-MM-DD"   # опционально
reviewDate: "YYYY-MM-DD"    # опционально — плановая дата следующей проверки фактов
tags:
  - тег1
  - тег2
categories:
  - ts-piot   # или markirovka, zakonodatelstvo, kkt, egais
draft: false
seo:
  keywords:
    - целевой ключ 1
    - целевой ключ 2
---
```

## SEO-требования

- Целевой ключ — в title, первом абзаце и хотя бы одном H2.
- `description` 140–160 символов, с ключом и ценностным крючком.
- Семантическая разметка `Article` + `BreadcrumbList` подставляется автоматически
  через `BlogPost.astro`. Тексты `articleSection` и `keywords` берутся из
  frontmatter.
- Канонический URL — автоматически. Использовать `seo.canonical` только если
  материал — копия другого источника.
- Изображения: `heroImage` в формате 2:1, ≥ 1200×600 — **необязателен**. Если
  не указан, для `og:image` автоматически подставляется PNG, сгенерированная
  через Satori (`/og/<slug>.png`). Подробности — `docs/images.md`.
- Внутренние ссылки — относительные (`/blog/...`, `/category/...`).

## Workflow создания статьи

1. Тема выбирается по контент-плану (`src/content/wiki/content-plan-2026.md`)
   либо подтягивается из weekly Wordstat diff через `/find-topics`
   (NEW/RISING фразы за неделю → кандидаты в план; см. `docs/wordstat.md`).
2. Запускается `/new-post "<тема>"` — пайплайн с агентом research → writer →
   seo-optimizer → social-media-manager (все четыре шага за один запрос).
3. Статья сохраняется как `src/content/blog/YYYY-MM-DD-slug.md` с `draft: true`.
4. Социальные черновики сохраняются как `src/content/wiki/social/YYYY-MM-DD-slug.md`
   с `status: draft`.
5. **Проверка фактов:** `/factcheck <slug>`. Скилл извлекает даты, штрафы,
   ст. КоАП, ссылки на НПА и сверяет с первоисточниками. Решения по
   `docs/editorial-policy.md` (классы A/B/C). При критических расхождениях
   статья остаётся в `draft: true`. После проверки — маркер
   `.claude/factchecked/<slug>`.
6. После успешного фактчека — `draft: false`, `status: ready` в социальных.
7. Билд `npm run build`, ручной просмотр на dev (`npm run dev`).
8. Деплой коммитом в основную ветку (GitHub Actions → GitHub Pages).

## Социальные черновики

Хранятся в `src/content/wiki/social/` (канонический путь) или
`src/content/social/` (используется для постов 2026-05-01). Формат — один файл на статью.

```
src/content/wiki/social/
  YYYY-MM-DD-slug.md   ← черновики для всех платформ
```

### Frontmatter

```yaml
---
title: "Название статьи (копия)"
slug: "YYYY-MM-DD-slug"        # совпадает с именем файла блога
articleUrl: "/blog/slug/"
status: draft                   # draft | ready | posted
createdDate: "YYYY-MM-DD"
---
```

### Структура файла

```markdown
## Telegram

[600–900 знаков, один тезис, без заголовков]

этикетка.рф/blog/<slug>/

---

## VK

[900–1400 знаков, 2–3 абзаца, 3–5 хэштегов в конце]

---

## Дзен

**Заголовок Дзен:** ...

[1000–1500 знаков, storytelling-вводный блок, затем суть]

---

## Email

**Тема:** ...
**Прехедер:** ...

[300–500 знаков основного текста + CTA-кнопка]
```

### Правила тона по платформам

- **Telegram**: сухо и по делу — аудитория читает в ленте, некогда. Первые 2 строки
  должны цеплять без «дорогой читатель». Никаких эмодзи. Последняя строка — всегда
  ссылка на статью: `этикетка.рф/blog/<slug>/`
- **VK**: чуть теплее, можно риторический вопрос в начале. Хэштеги — только
  релевантные (`#маркировка`, `#УСН`, `#онлайнкасса`).
- **Дзен**: алгоритм любит чёткий заголовок-обещание и конкретику в первом абзаце.
  Дублировать H1 статьи нельзя — заголовок должен отличаться.
- **Email**: тема письма — выгода или вопрос ≤ 50 символов. Прехедер раскрывает.
  Один CTA, не два.

## Свой инструментарий контроля качества

### Фактчек — `/factcheck <slug>`

Свой стек проверки фактов (без плагина claude-blog, который в облачном
эфемерном контейнере не выживает между сессиями):

- `scripts/factcheck/extract-claims.mjs` извлекает claims (даты, штрафы,
  ст. КоАП/УК/НК, номера ПП/Приказов/ФЗ, ссылки).
- Скилл `/factcheck <slug>` сверяет каждый claim с первоисточником через
  WebSearch/WebFetch, опираясь на `src/data/factcheck/sources.json`.
- Скилл `/factcheck-batch [--count N] [--filter <topic>]` — пакетный
  прогон 8–16 статей через параллельный subagent dispatch (×6 ускорение
  vs `/factcheck` по одной).
- `scripts/factcheck/audit-npa-references.mjs` — регрессионный аудит
  упоминаний НПА против `sources.json.npaWhitelist`. Флаг `--strict`
  для CI.
- Решения принимаются по `docs/editorial-policy.md` — классы A/B/C.
- Результат: `src/data/factcheck/results/<slug>.json` + маркер
  `.claude/factchecked/<slug>` с датой.

### Гейты публикации

- `/analyze-article <slug>` — оценка 0–100 по 6 категориям перед
  публикацией. Обязательный шаг в `/release-article` Шаг 1. Блокер
  если балл < 70 / маркер фактчека старше 180 дней / NPA-audit или
  check-blog-links упали.
- **Pre-commit hook** (`scripts/git-hooks/`) — блокирует `git commit`
  статьи с `draft: false` без маркера `.claude/factchecked/<slug>`.
  Установка: `bash scripts/git-hooks/install.sh`.

**Используется обязательно** перед `draft: false` в `Workflow создания статьи`
(шаг 5). Подробности — `docs/factcheck.md`, `docs/factcheck-history.md`,
`docs/editorial-policy.md`.

### Расширенный инструментарий (claude-blog, опционально)

В CLAUDE.md ниже описаны команды плагина [claude-blog](https://github.com/AgriciDaniel/claude-blog).
**Внимание:** в облачном эфемерном контейнере плагин не сохраняется между
сессиями. Если вы работаете локально и хотите им пользоваться — установите
вручную в `~/.claude/skills/`. В облачных сессиях используем свой `/factcheck`.

### Контроль качества (запускать после написания)

- `/blog analyze <file>` — оценка 0–100 по 6 категориям (качество, SEO, E-E-A-T,
  техника, AI-цитируемость). Детектирует AI-текст.
- `/blog seo-check <file>` — быстрый SEO-чеклист: title, meta, H2, внутренние
  ссылки, alt, schema.
- `/blog factcheck <file>` — старая команда из claude-blog. **Не используем** —
  есть свой `/factcheck`.
- `/blog schema <file>` — генерирует JSON-LD: BlogPosting + FAQPage +
  BreadcrumbList. Дополняет то, что уже есть в `BlogPost.astro`.

### AI-цитируемость (новый канал трафика)

- `/blog geo <file>` — аудит под ChatGPT / Perplexity / Google AI Overviews:
  passage-level citability, Q&A-форматирование, entity clarity, robots.txt.
  Генерирует «citation capsules» — 40–60-словные блоки для прямого цитирования.

### Здоровье блога (запускать при росте контента)

- `/blog audit src/content/blog/` — полный аудит: граф ссылок, сироты,
  тупики, устаревшие посты, каннибализация.
- `/blog cannibalization src/content/blog/` — пересечение ключей между
  постами. Рекомендует MERGE / DIFFERENTIATE / CANONICAL.
- `/blog taxonomy` — аудит тегов: тонкие теги, дубли, структура кластеров.

### Планирование

- `/blog calendar` — редкалендарь с детекцией устаревшего контента и
  freshness-циклами.
- `/blog strategy <ниша>` — hub-and-spoke архитектура, 90-дневный роадмап,
  карта AI citation surfaces.
- `/blog brief <тема>` — SERP-анализ топ конкурентов, outline, внутренние
  ссылки, word count.
- `/blog outline <тема>` — структура H2/H3 из реальной выдачи.

### Дополнительно

- `/blog repurpose <file>` — адаптация под Twitter, LinkedIn, YouTube-скрипт,
  подкаст, email.
- `/blog rewrite <file>` — переписать пост с сохранением голоса, обновить
  статистику, добавить FAQ.
- `/blog persona` — управление голосом: 4-мерная шкала NNGroup.

### Требуют настройки (Google AI API key — бесплатно)

- `/blog image` — генерация изображений через Gemini.
- `/blog audio` — аудиоозвучка через Gemini TTS.
- `/blog google` — PageSpeed, Search Console, GA4 (`/blog google setup`).

## Стиль речи

### Основные принципы

- Активный залог, прямые формулировки, минимум канцелярита.
- Никаких эмодзи, кликбейта, восклицательных знаков.
- Числа — цифрами; сроки — конкретно (01.07.2026, не «в середине 2026»).
- Прямое обращение к читателю: «проверьте», «настройте», «подайте» — не
  «предпринимателям необходимо» или «следует».
- Аудитория — занятый предприниматель: каждое предложение должно давать
  информацию, а не разгонять контекст.

### Термины

- Юридические термины используем точно: «контрольно-кассовая техника» (а не
  «кассовый аппарат»), «универсальный передаточный документ», «налогоплательщик
  УСН» и т.п.
- Разговорные термины, которые аудитория реально использует, — допустимы:
  «вейпы» (не «электронные системы доставки никотина»), «касса» в бытовом
  контексте. Но не «молочка» — пишем «молочная продукция».
- Сокращения раскрываем при первом упоминании: ТС ПИоТ, УКЭП, ГИС МТ, 54-ФЗ.
- «Честный знак» — всегда в кавычках; «система маркировки «Честный знак»» при
  первом упоминании, далее просто ««Честный знак»».

### Структура статьи

- **Лид** — конкретный факт или вопрос, не «X является важным инструментом».
- **H2-заголовки** — тема, не вопрос. «Сроки подачи уведомлений», а не
  «Каковы сроки подачи уведомлений?». Форма «Каков/Каковы/Что такое» — запрещена.
- **Заключение / Итог** — только если добавляет новое (шаги «что делать прямо
  сейчас»). Раздел, который повторяет лид — удалять.
- Горизонтальные разделители `---` внутри тела статьи — не использовать;
  они дробят текст в сборник FAQ.

### Запрещённые слова и обороты

Запускать перед публикацией:
```
grep -rni "является\|каковы\|каков \|следует отметить\|необходимо отметить\|таким образом,\|в данном контексте\|выглядит следующим образом\|с точки зрения\|предпринимателям стоит\|предпринимателям необходимо\|в целях\|осуществляет\|осуществляется\|насыщен" src/content/blog/
```

| Паразит | Замена |
|---|---|
| `является` | активный глагол или тире: «X — это Y» |
| `осуществляет/осуществляется` | делает / передаёт / проводит |
| `следует/необходимо отметить` | удалить, сказать прямо |
| `таким образом,` | удалить вводное слово |
| `в данном контексте` | удалить |
| `выглядит следующим образом` | удалить, поставить двоеточие |
| `с точки зрения` | переформулировать конкретно |
| `предпринимателям стоит/необходимо` | прямое обращение: «проверьте» |
| `в целях` | `чтобы` |
| `насыщенный` (о периоде) | назвать конкретно, что именно изменилось |
| `молочка` | `молочная продукция` |

## OpenRouter и нейросетевые возможности

**`OPENROUTER_API_KEY` хранится в секретах GitHub репозитория** (`burbonivanovich-oss/TS_PIOT → Settings → Secrets → OPENROUTER_API_KEY`).
Локально ключ нигде не прописан и не нужен — все скрипты генерации запускаются через GitHub Actions.

**`WORDSTAT_OAUTH_TOKEN`** — там же, OAuth с `oauth.yandex.ru`. Используется в
workflow `Wordstat Weekly Refresh`. Два контура:

- **A. Точечный** — `keys.json` хранит частоты и тренды по нашим
  `seo.keywords` и «Целевому запросу» из контент-плана. Используют
  `/find-topics`, `/cluster-gaps`, `/maintain-content`.
- **B. Discovery** — `discoveries/<date>/*.json` хранят топ-2000 фраз вокруг
  каждого из 162 широких seed-ов. `diff-snapshots.mjs` каждую неделю
  сравнивает с предыдущим прогоном и пишет в `discoveries/diffs/<date>.md`
  отчёт с NEW/RISING/FALLING/DROPPED. `/find-topics` читает свежий diff как
  главный источник идей для новых статей.

Лимиты API: 1000 запросов/сутки на токен, 10 req/sec. Бюджет нашего
weekly прогона — ~640 квот. Подробности — `docs/wordstat.md`.

**Не предлагать пользователю прописывать ключ вручную.** Стандартный способ запуска — Actions.

### Генерация изображений (OpenRouter + Nano Banana)

Единственный провайдер — **OpenRouter**. Together.ai не используется.

| Скрипт | Назначение | Модель по умолчанию |
|---|---|---|
| `generate-preview-images.mjs` | Превью для карточек | `google/gemini-3.1-flash-image-preview` |
| `generate-hero-images.mjs` | Hero-изображения статей | `google/gemini-3.1-flash-image-preview` |
| `test-pool-generation.mjs` | Тест 3 изображений из пула с выводом стоимости | `google/gemini-3.1-flash-image-preview` |

**Запуск:**
- **Автоматически** при публикации через `auto-publish.yml` (flip `draft: true → false`) — генерит hero для выпущенной статьи.
- **Cron-сейфти** через `hero-backfill-daily.yml` (00:00 МСК, ≤ 10 статей/день) — догенеряет hero для статей опубликованных в обход auto-publish (batch-коммит `draft: false`).
- **Вручную** GitHub Actions → **Generate Hero Images** → **Run workflow** (для срочной массовой генерации, ставить `limit: 0` для всех без hero).

Сменить модель: переменные окружения `PREVIEW_MODEL` / `HERO_MODEL` в workflow inputs.

### AI-фоны для OG-обложек

Satori поддерживает `backgroundImage: url(data:image/png;base64,...)`, поэтому
нейросетевые фоны можно подключить без изменения архитектуры:

1. Сгенерировать PNG-текстуры (1200×630, тёмные, без текста) — через OpenRouter
   (`generate-og-backgrounds-openrouter.mjs`) или локально без API
   (`generate-og-backgrounds-local.mjs`).
2. Сохранить как `public/og-backgrounds/{ts-piot,markirovka,zakonodatelstvo}.jpg`.
3. Файлы уже лежат в репозитории.

Подробности — `docs/images.md`.

### Gemini API (опционально)

Если есть `GEMINI_API_KEY` с платным тарифом — используется только для OG-фонов
через `generate-og-backgrounds.mjs` (Imagen 4). Для статейных изображений
Gemini больше не нужен.

### Вспомогательные скрипты (scripts/)

| Скрипт | Назначение |
|---|---|
| `optimize-images.mjs` | jpg/png → webp для public/images/{hero,flagship,preview} через sharp. Запускается в каждом workflow генерации |
| `generate-og-backgrounds-local.mjs` | Процедурные SVG-фоны без API-ключей |
| `generate-og-backgrounds-openrouter.mjs` | AI-фоны через OpenRouter (Nano Banana, можно переопределить FLUX и др.) |
| `generate-og-backgrounds-gemini.mjs` | AI-фоны через Google Imagen/Gemini Image |
| `generate-flagship-illustrations.mjs` | 8 иллюстраций для флагмана `/kak-rabotaet-ts-piot/` через OpenRouter |
| `sharpen-heroes.mjs` | Постобработка hero: 2× upscale Lanczos3 + Unsharp mask + mozjpeg q88. Ручной запуск |
| `compress-og-backgrounds.mjs` | PNG → JPEG 75–80 для Satori (он зависает на PNG ≥ 700 KB) |
| `wordstat/extract-keys.mjs` | Собирает кандидатов из блога + контент-плана |
| `wordstat/fetch.mjs` | Точечно тянет /v1/dynamics + /v1/topRequests (контур A) |
| `wordstat/discover.mjs` | Trend discovery: /v1/topRequests на 162 широких seed-а (контур B) |
| `wordstat/diff-snapshots.mjs` | Сравнивает discovery-выгрузки неделя-к-неделе |
| `factcheck/extract-claims.mjs` | Regex-парсер дат/сумм/ст. КоАП из статей |
| `factcheck/audit-npa-references.mjs` | Регрессионный аудит ссылок на НПА против whitelist |
| `audit/linkgraph.mjs` | Граф внутренней перелинковки, поиск сирот, кандидаты на ссылки |
| `audit/embed-articles.mjs` | Семантические embeddings всех статей (Jina v3 / OpenAI). Запуск — workflow `embeddings-monthly.yml`, нужен `JINA_API_KEY` или `OPENAI_API_KEY` |
| `audit/similarity.mjs` | Cosine similarity на embeddings.json. Отчёт: возможные дубли (≥ 0.92) и близкие пары (≥ 0.80) — для перелинковки и каннибализации |
| `metrika/sync-goals.mjs` | Синхронизирует декларативный `src/data/metrika/goals.json` с целями Метрики через Management API. Подробности — `docs/metrika.md` |
| `analytics/fetch-gsc.mjs` | Google Search Console API → клики/показы/позиции по URL. OAuth2 refresh_token |
| `analytics/fetch-metrika-traffic.mjs` | Метрика Stat API → просмотры/визиты/пользователи по URL. Тот же `METRIKA_OAUTH_TOKEN` |
| `analytics/fetch-webmaster.mjs` | Яндекс.Вебмастер API → SQI + топ-запросов. Свой `WEBMASTER_OAUTH_TOKEN` |
| `analytics/merge.mjs` | Сливает GSC + Метрика + Вебмастер + frontmatter в `src/data/analytics/articles.json` для дашборда `/dashboard/` |
| `ord-register.mjs`, `ord-bootstrap.mjs`, `ord-status.mjs` | Регистрация рекламных креативов в ОРД Яндекса по `src/data/ord-config.json` |

Запуск: `node scripts/<имя>.mjs`. Большинство скриптов запускается через
GitHub Actions, а не локально — ключи лежат в Secrets. Локальный
запуск — для отладки с `DRY_RUN=1`. Подробности по аналитике —
`docs/analytics.md`, по Метрике — `docs/metrika.md`, по изображениям —
`docs/images.md`.
Wordstat-скрипты пишут в `src/data/wordstat/` — там же лежит весь кеш.

## Технические особенности (фундаментально)

Эти вещи легко не заметить — учитывайте при любых изменениях.

### Сборка
- Команда: `astro build && pagefind --site dist`. **Не запускайте `astro build` напрямую** — иначе поисковый индекс не обновится. Команда зашита в `npm run build`.
- В GitHub Actions выполняется `npm run build` (см. `.github/workflows/deploy-gh-pages.yml`).
- Native-зависимости: `@resvg/resvg-js` (бинарник для PNG). Если перенесёте проект — проверьте поддержку платформы.

### Маршруты и коллекции
- Контент-коллекции с публичными URL: `blog`, `pillars`, `glossary`. `wiki` — внутренняя, без маршрутов.
- Новый тег в frontmatter поста автоматически создаёт страницу `/tag/<slug>/` и попадает в `/tags/`. Никаких ручных изменений не требуется.
- Slug тегов — кириллица, нормализация в `src/utils/tags.ts` (`tagSlug`).
- Slug категорий = id pillar-файла. Чтобы добавить категорию, обновите `CATEGORIES` в `consts.ts` и создайте `src/content/pillars/<slug>.md`.

### OG-картинки
- Для каждого поста автогенерируется PNG 1200×630 через Satori + Resvg (см. `src/pages/og/[slug].png.ts`). Шрифты — `public/fonts/` (inter-*, commissioner-*, geologica-*).
- В frontmatter поста `heroImage` **необязателен** — без него `BlogPost.astro` подставит `/og/<slug>.png` в `og:image`.
- Если меняете шаблон обложки — учитывайте, что fontsource-subsets разные (cyrillic, latin, latin-ext) подключаются под разными именами для fallback. Подробности — `docs/images.md`.

### Поиск
- Pagefind индексирует только элементы с атрибутом `data-pagefind-body`. Сейчас он стоит на `<article>` в `BlogPost.astro` — поэтому в выдаче только посты, а не категории/теги/словарь.
- Навигация и блок «Читайте также» помечены `data-pagefind-ignore`, чтобы не разбавлять индекс.
- Если хотите, чтобы pillar-страницы или термины глоссария тоже искались — добавьте `data-pagefind-body` на нужный контейнер. Подробности — `docs/search.md`.

### «Читайте также»
- В `BlogPost.astro` ниже текста статьи рендерится до 4 связанных постов. Скоринг: совпадение тегов ×2, совпадение категорий ×1. Блок прячется при отсутствии совпадений.

### Калькулятор штрафов
- Данные сценариев — `src/data/penalties.ts`. Это единственный источник истины: страница `/kalkulyator-shtrafov/` рендерит и список, и форму, и FAQ из этого массива.
- При изменениях КоАП обновляйте сценарии **здесь и параллельно сверьте** с упоминаниями штрафов в постах (`grep -nE '14\.5|15\.12' src/content/blog/`).

## Документация изменений

При изменении компонента, скрипта или паттерна — **обновлять соответствующий файл в `docs/` в той же PR**. Не накапливать долг.

| Что меняется | Какой doc обновить |
|---|---|
| Новый компонент в `src/components/` | `docs/architecture.md` (таблица «Компоненты») |
| Новый маршрут или коллекция | `docs/architecture.md` (маршруты / коллекции) |
| Скрипты генерации картинок, промпты, `STYLE_SUFFIX`, словарь `DEV` | `docs/image-prompts.md` |
| Скрипты постобработки, пайплайн hero/preview | `docs/images.md` |
| CSS карточек, featured, related | `docs/article-cards.md` |
| Дизайн-токены, цвета, типографика | `docs/design-system.md` |
| Pagefind, индексация | `docs/search.md` |
| OG-картинки, Satori | `docs/images.md` |
| Open Graph для Telegram (превью при шеринге) | `docs/og-telegram.md` |
| Wordstat API, частотность ключей, скилл-интеграции | `docs/wordstat.md` |
| Factcheck pipeline, extract-claims, sources.json, audit-npa-references | `docs/factcheck.md` |
| Backfill истории и системные паттерны фактчека | `docs/factcheck-history.md` |
| Post-mortem крупных сессий (что пошло не так / уроки) | `docs/session-YYYY-MM-DD-postmortem.md` |
| Roadmap новых контент-форматов (#33) | `docs/content-formats-roadmap.md` |
| Редполитика, классы решений в фактчеке | `docs/editorial-policy.md` |
| Крупные кросс-функциональные сессии (PR-ревью) | `CHANGELOG.md` в корне (короткий swod) |

Если фича не покрыта существующим doc — расширить тот, что ближе по теме, или завести новый и добавить ссылку в `CLAUDE.md`.

## Чего НЕ публикуем

- Прямую коммерческую рекламу решений (не делаем «купи это ПО»).
- Контент без проверки на действующие нормативные акты.
- Статьи с целевым запросом, под который уже есть материал в кластере, —
  обновляем существующий, а не плодим дубли.
