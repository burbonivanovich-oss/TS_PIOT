# Этикетка — инструкции для Claude Code

## О проекте

Информационный портал для малого и среднего бизнеса РФ. Тематика:
- **ТС ПИоТ** — техническое средство получения информации о товаре, программный
  модуль для онлайн-кассы (обязателен с 28.12.2025).
- **Маркировка «Честный знак»** — категории, сроки, штрафы.
- **Изменения в законодательстве** — налоги, ЭДО, КЭДО, ЕНС/ЕНП, проверки.

Цель — органический поисковый трафик из Яндекса и Google по информационным
запросам МСБ.

## Стек

- Astro 5 (статическая генерация, MDX, sitemap, RSS).
- Контент в `src/content/blog/` (Markdown/MDX).
- Развёртывание на Vercel (`vercel.json` сконфигурирован).
- Все тексты только на русском языке (`lang="ru"`, локаль `ru-RU`).

## Структура файлов

```
docs/                           # Техническая документация для разработчиков
├── architecture.md             # Карта маршрутов, коллекций, dataflow
├── content-types.md            # Как добавить статью, термин, pillar, сценарий
├── og-images.md                # Satori/Resvg, шрифты, шаблон обложек
└── search.md                   # Pagefind: индексация и кастомизация

public/
├── fonts/inter-*.woff          # Шрифты для OG-картинок (НЕ удалять)
├── og-default.svg              # Фолбэк-обложка
└── favicon.svg, robots.txt

src/
├── components/                 # Header, Footer, BaseHead, FormattedDate
├── consts.ts                   # SITE_TITLE, NAV_LINKS, CATEGORIES (источник истины)
├── content/
│   ├── blog/                   # YYYY-MM-DD-slug.md — публикуемые статьи
│   ├── pillars/                # ts-piot.md, markirovka.md, zakonodatelstvo.md
│   ├── glossary/               # <term>.md — термины словаря
│   └── wiki/                   # research, контент-планы, редакционные заметки
├── content.config.ts           # Схемы коллекций blog, pillars, glossary, wiki
├── data/penalties.ts           # Сценарии для калькулятора штрафов
├── layouts/BlogPost.astro      # Шаблон статьи + «Читайте также» + JSON-LD
├── pages/
│   ├── index.astro, about.astro, privacy.astro, 404.astro
│   ├── search.astro            # /search/ (Pagefind UI)
│   ├── blog/[...slug].astro, blog/index.astro
│   ├── category/[category].astro   # pillar + FAQ + посты
│   ├── tag/[tag].astro, tags/index.astro
│   ├── slovar/index.astro      # глоссарий с якорями
│   ├── kalkulyator-shtrafov.astro  # калькулятор штрафов
│   ├── og/[slug].png.ts        # автогенерация OG-картинок
│   └── rss.xml.js
├── styles/global.css           # Дизайн-токены --accent, --gray-*
└── utils/
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
  `markirovka`, `zakonodatelstvo`).
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
  - ts-piot   # или markirovka, zakonodatelstvo
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
  через Satori (`/og/<slug>.png`). Подробности — `docs/og-images.md`.
- Внутренние ссылки — относительные (`/blog/...`, `/category/...`).

## Workflow создания статьи

1. Тема выбирается по контент-плану (`src/content/wiki/content-plan-2026.md`).
2. Запускается `/new-post "<тема>"` — пайплайн с агентом research → writer →
   seo-optimizer → social-media-manager (все четыре шага за один запрос).
3. Статья сохраняется как `src/content/blog/YYYY-MM-DD-slug.md` с `draft: true`.
4. Социальные черновики сохраняются как `src/content/wiki/social/YYYY-MM-DD-slug.md`
   с `status: draft` (структура — см. ниже).
5. После проверки фактов (даты, нормы, ссылки на НПА) — `draft: false` в статье,
   `status: ready` в социальных черновиках.
6. Билд `npm run build`, ручной просмотр на dev (`npm run dev`).
7. Деплой коммитом в основную ветку (Vercel подхватывает).

## Социальные черновики

Хранятся в `src/content/wiki/social/`. Формат — один файл на статью.

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

## Расширенный инструментарий (claude-blog)

Установлен плагин [claude-blog](https://github.com/AgriciDaniel/claude-blog) —
20 скиллов для углублённой работы с контентом. Живут в `~/.claude/skills/`.

### Контроль качества (запускать после написания)

- `/blog analyze <file>` — оценка 0–100 по 6 категориям (качество, SEO, E-E-A-T,
  техника, AI-цитируемость). Детектирует AI-текст.
- `/blog seo-check <file>` — быстрый SEO-чеклист: title, meta, H2, внутренние
  ссылки, alt, schema.
- `/blog factcheck <file>` — извлекает все числа и нормы, идёт по источникам,
  ставит confidence 0.0–1.0. **Особенно важно для НПА и штрафов.**
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

- Активный залог, прямые формулировки, минимум канцелярита.
- Никаких эмодзи, кликбейта, восклицательных знаков.
- Числа — цифрами; сроки — конкретно (28.12.2025, не «в конце 2025»).
- Юридические термины используем точно: «контрольно-кассовая техника» (а не
  «кассовый аппарат»), «универсальный передаточный документ», «налогоплательщик
  УСН» и т.п.
- Сокращения раскрываем при первом упоминании: ТС ПИоТ → расшифровать,
  УКЭП → расшифровать.

## OpenRouter и нейросетевые возможности

`OPENROUTER_API_KEY` — единственный ключ для генерации изображений статей.
Настраивается в `.claude/settings.local.json` (gitignored) или передаётся
через переменную окружения при запуске скриптов.

### Генерация изображений статей (OpenRouter + FLUX)

Оба типа изображений генерируются через один ключ:

| Скрипт | Переменные | Назначение |
|---|---|---|
| `generate-preview-images.mjs` | `OPENROUTER_API_KEY`, `FLUX_MODEL` | Превью для карточек |
| `generate-hero-images.mjs` | `OPENROUTER_API_KEY`, `HERO_MODEL` | Шапка статьи |

Модель по умолчанию для обоих — `black-forest-labs/flux-1-schnell` (бесплатно).
Сменить: `HERO_MODEL=black-forest-labs/flux-1-1-pro`.

Запуск всего сразу через GitHub Actions:
**Actions → Generate Article Images → Run workflow** (секрет `OPENROUTER_API_KEY`).

### AI-фоны для OG-обложек

Satori поддерживает `backgroundImage: url(data:image/png;base64,...)`, поэтому
нейросетевые фоны можно подключить без изменения архитектуры:

1. Сгенерировать PNG-текстуры (1200×630, тёмные, без текста) — через OpenRouter
   (`generate-og-backgrounds-openrouter.mjs`) или локально без API
   (`generate-og-backgrounds-local.mjs`).
2. Сохранить как `public/og-backgrounds/{ts-piot,markirovka,zakonodatelstvo}.jpg`.
3. Файлы уже лежат в репозитории.

Подробности — `docs/og-images.md`.

### Gemini API (опционально)

Если есть `GEMINI_API_KEY` с платным тарифом — используется только для OG-фонов
через `generate-og-backgrounds.mjs` (Imagen 4). Для статейных изображений
Gemini больше не нужен.

### Вспомогательные скрипты (scripts/)

| Скрипт | Назначение |
|---|---|
| `preview-og.mjs` | Рендерит текущий OG-шаблон для 4 тестовых заголовков |
| `explore-satori.mjs` | Генерирует 6 альтернативных шаблонов для сравнения |
| `generate-og-backgrounds-local.mjs` | Процедурные SVG-фоны без API-ключей |
| `generate-og-backgrounds-openrouter.mjs` | AI-фоны через OpenRouter (FLUX) |

Запуск: `node scripts/<имя>.mjs`. Результаты в `scripts/og-previews/` (gitignored).

## Технические особенности (фундаментально)

Эти вещи легко не заметить — учитывайте при любых изменениях.

### Сборка
- Команда: `astro build && pagefind --site dist`. **Не запускайте `astro build` напрямую** — иначе поисковый индекс не обновится. Команда зашита в `npm run build`.
- На Vercel выполняется `npm run build` (см. `vercel.json`).
- Native-зависимости: `@resvg/resvg-js` (бинарник для PNG). Если перенесёте проект — проверьте поддержку платформы.

### Маршруты и коллекции
- Контент-коллекции с публичными URL: `blog`, `pillars`, `glossary`. `wiki` — внутренняя, без маршрутов.
- Новый тег в frontmatter поста автоматически создаёт страницу `/tag/<slug>/` и попадает в `/tags/`. Никаких ручных изменений не требуется.
- Slug тегов — кириллица, нормализация в `src/utils/tags.ts` (`tagSlug`).
- Slug категорий = id pillar-файла. Чтобы добавить категорию, обновите `CATEGORIES` в `consts.ts` и создайте `src/content/pillars/<slug>.md`.

### OG-картинки
- Для каждого поста автогенерируется PNG 1200×630 через Satori + Resvg (см. `src/pages/og/[slug].png.ts`). Шрифты — `public/fonts/inter-*.woff`.
- В frontmatter поста `heroImage` **необязателен** — без него `BlogPost.astro` подставит `/og/<slug>.png` в `og:image`.
- Если меняете шаблон обложки — учитывайте, что fontsource-subsets разные (cyrillic, latin, latin-ext) подключаются под разными именами для fallback. Подробности — `docs/og-images.md`.

### Поиск
- Pagefind индексирует только элементы с атрибутом `data-pagefind-body`. Сейчас он стоит на `<article>` в `BlogPost.astro` — поэтому в выдаче только посты, а не категории/теги/словарь.
- Навигация и блок «Читайте также» помечены `data-pagefind-ignore`, чтобы не разбавлять индекс.
- Если хотите, чтобы pillar-страницы или термины глоссария тоже искались — добавьте `data-pagefind-body` на нужный контейнер. Подробности — `docs/search.md`.

### «Читайте также»
- В `BlogPost.astro` ниже текста статьи рендерится 3 связанных поста. Скоринг: совпадение тегов ×2, совпадение категорий ×1. Блок прячется при отсутствии совпадений.

### Калькулятор штрафов
- Данные сценариев — `src/data/penalties.ts`. Это единственный источник истины: страница `/kalkulyator-shtrafov/` рендерит и список, и форму, и FAQ из этого массива.
- При изменениях КоАП обновляйте сценарии **здесь и параллельно сверьте** с упоминаниями штрафов в постах (`grep -nE '14\.5|15\.12' src/content/blog/`).

### Документация по подсистемам
- `docs/architecture.md` — общая карта маршрутов и dataflow.
- `docs/content-types.md` — пошаговые инструкции «как добавить новую статью / термин / pillar / сценарий».
- `docs/og-images.md` — детали Satori-шаблона и работы со шрифтами.
- `docs/search.md` — Pagefind: что индексируется, как добавить фильтры, как кастомизировать UI.

## Чего НЕ публикуем

- Прямую коммерческую рекламу решений (не делаем «купи это ПО»).
- Контент без проверки на действующие нормативные акты.
- Статьи с целевым запросом, под который уже есть материал в кластере, —
  обновляем существующий, а не плодим дубли.
