# Инструменты, скрипты и автоматизация

Полный справочник по тулчейну. Что куда писать при изменении —
в конце документа («Документация изменений»).

## QA-инструментарий

### Фактчек — `/factcheck <slug>`

Свой стек проверки фактов (без плагина claude-blog, который в
облачном эфемерном контейнере не выживает между сессиями).

- **`scripts/factcheck/extract-claims.mjs`** извлекает claims
  (даты, штрафы, ст. КоАП/УК/НК, номера ПП/Приказов/ФЗ, ссылки).
- **Скилл `/factcheck <slug>`** сверяет каждый claim с
  первоисточником через WebSearch/WebFetch, опираясь на
  `src/data/factcheck/sources.json`.
- **Скилл `/factcheck-batch [--count N] [--filter <topic>]`** —
  пакетный прогон 8–16 статей через параллельный subagent
  dispatch (×6 ускорение vs `/factcheck` по одной).
- **`scripts/factcheck/audit-npa-references.mjs`** — регрессионный
  аудит упоминаний НПА против `sources.json.npaWhitelist`. Флаг
  `--strict` для CI.
- **Решения** принимаются по `docs/editorial-policy.md` — классы
  A/B/C.
- **Результат:** `src/data/factcheck/results/<slug>.json` + маркер
  `.claude/factchecked/<slug>` с датой.

### Гейты публикации

- **`/analyze-article <slug>`** — оценка 0–100 по 6 категориям
  перед публикацией. Обязательный шаг в `/release-article` Шаг 1.
  Блокер если балл < 70 / маркер фактчека старше 180 дней /
  NPA-audit или check-blog-links упали.
- **Pre-commit hook** (`scripts/git-hooks/`) — блокирует `git
  commit` статьи с `draft: false` без маркера
  `.claude/factchecked/<slug>`. Установка:
  `bash scripts/git-hooks/install.sh`.

**Используется обязательно** перед `draft: false` в workflow
создания статьи. Подробности — `docs/factcheck.md`,
`docs/factcheck-history.md`, `docs/editorial-policy.md`.

### Расширенный QA: плагин claude-blog (опционально)

[claude-blog](https://github.com/AgriciDaniel/claude-blog) — внешний
плагин. **В облачном контейнере не сохраняется между сессиями.**
Если работаете локально и хотите им пользоваться — установите
вручную в `~/.claude/skills/`. В облачных сессиях используем свой
`/factcheck`.

**Контроль качества (после написания):**
- `/blog analyze <file>` — оценка 0–100 по 6 категориям (качество,
  SEO, E-E-A-T, техника, AI-цитируемость). Детектирует AI-текст.
- `/blog seo-check <file>` — быстрый SEO-чеклист: title, meta, H2,
  внутренние ссылки, alt, schema.
- `/blog schema <file>` — JSON-LD: BlogPosting + FAQPage +
  BreadcrumbList (дополняет то, что есть в `BlogPost.astro`).
- `/blog factcheck` — **не используем**, есть свой `/factcheck`.

**AI-цитируемость:**
- `/blog geo <file>` — аудит под ChatGPT / Perplexity / Google AI
  Overviews: passage-level citability, Q&A-форматирование, entity
  clarity, robots.txt. Генерирует «citation capsules» — 40–60-словные
  блоки для прямого цитирования.

**Здоровье блога:**
- `/blog audit src/content/blog/` — граф ссылок, сироты, тупики,
  устаревшие посты, каннибализация.
- `/blog cannibalization` — пересечение ключей. Рекомендует MERGE /
  DIFFERENTIATE / CANONICAL.
- `/blog taxonomy` — аудит тегов: тонкие теги, дубли, структура
  кластеров.

**Планирование:**
- `/blog calendar` — редкалендарь с детекцией устаревшего контента.
- `/blog strategy <ниша>` — hub-and-spoke архитектура, 90-дневный
  роадмап.
- `/blog brief <тема>` — SERP-анализ топ конкурентов, outline.
- `/blog outline <тема>` — структура H2/H3 из реальной выдачи.

**Дополнительно:**
- `/blog repurpose <file>` — адаптация под Twitter, LinkedIn,
  YouTube-скрипт, подкаст, email.
- `/blog rewrite <file>` — переписать с сохранением голоса.
- `/blog persona` — управление голосом: 4-мерная шкала NNGroup.

**Требуют Google AI API key:**
- `/blog image` — генерация изображений через Gemini.
- `/blog audio` — аудиоозвучка через Gemini TTS.
- `/blog google` — PageSpeed, Search Console, GA4
  (`/blog google setup`).

---

## OpenRouter и нейросети

`OPENROUTER_API_KEY` хранится в секретах GitHub репозитория.
Локально ключ нигде не прописан и не нужен — все скрипты
генерации запускаются через GitHub Actions. Подробности по всем
секретам — `docs/SECRETS.md`.

### Wordstat (контуры A и B)

Используется в workflow `Wordstat Weekly Refresh`.

- **A. Точечный** — `src/data/wordstat/keys.json` хранит частоты и
  тренды по нашим `seo.keywords` и «Целевому запросу» из
  контент-плана. Используют `/find-topics`, `/cluster-gaps`,
  `/maintain-content`.
- **B. Discovery** — `discoveries/<date>/*.json` хранят топ-2000
  фраз вокруг каждого из 162 широких seed-ов. `diff-snapshots.mjs`
  каждую неделю сравнивает с предыдущим прогоном и пишет в
  `discoveries/diffs/<date>.md` отчёт с NEW/RISING/FALLING/DROPPED.
  `/find-topics` читает свежий diff как главный источник идей для
  новых статей.

**Лимиты API:** 1000 запросов/сутки на токен, 10 req/sec. Бюджет
нашего weekly прогона — ~640 квот. Подробности — `docs/wordstat.md`.

### Генерация изображений (OpenRouter + Nano Banana)

Единственный провайдер — **OpenRouter**.

| Скрипт | Назначение | Модель по умолчанию |
|---|---|---|
| `generate-preview-images.mjs` | Превью для карточек | `google/gemini-3.1-flash-image-preview` |
| `generate-hero-images.mjs` | Hero-изображения статей | `google/gemini-3.1-flash-image-preview` |
| `generate-flagship-illustrations.mjs` | 8 шагов флагмана | `google/gemini-3.1-flash-image-preview` |

**Запуск:**
- **Автоматически** при публикации через `auto-publish.yml` (flip
  `draft: true → false`) — генерит hero для выпущенной статьи.
- **Cron-сейфти** через `hero-backfill-daily.yml` (00:00 МСК,
  ≤ 10 статей/день) — догенеряет hero для статей опубликованных
  в обход auto-publish.
- **Вручную** GitHub Actions → **Generate Hero Images** → **Run
  workflow** (`limit: 0` для всех без hero).

Сменить модель: переменные `PREVIEW_MODEL` / `HERO_MODEL` в
workflow inputs.

### AI-фоны для OG-обложек

Satori поддерживает `backgroundImage: url(data:image/png;base64,...)`,
нейросетевые фоны подключаются без изменения архитектуры:

1. Сгенерировать PNG-текстуры 1200×630 (тёмные, без текста) —
   через OpenRouter (`generate-og-backgrounds-openrouter.mjs`),
   Gemini (`generate-og-backgrounds-gemini.mjs`) или локально без
   API (`generate-og-backgrounds-local.mjs`).
2. Сохранить как `public/og-backgrounds/{ts-piot,markirovka,zakonodatelstvo}.jpg`.

**Важно:** PNG ≥ 700 KB заставит Satori зависнуть. JPEG quality
75–80 (< 20 KB). Скрипт компрессии: `node scripts/compress-og-backgrounds.mjs`.

Подробности — `docs/images.md`.

### Gemini API (опционально)

Если есть `GEMINI_API_KEY` с платным тарифом — используется только
для OG-фонов через `generate-og-backgrounds-gemini.mjs` (Imagen 4).
Для статейных изображений Gemini больше не нужен.

---

## Вспомогательные скрипты (scripts/)

| Скрипт | Назначение |
|---|---|
| `optimize-images.mjs` | jpg/png → webp для public/images/{hero,flagship,preview} через sharp. Запускается в каждом workflow генерации |
| `generate-og-backgrounds-local.mjs` | Процедурные SVG-фоны без API-ключей |
| `generate-og-backgrounds-openrouter.mjs` | AI-фоны через OpenRouter (Nano Banana, FLUX и др.) |
| `generate-og-backgrounds-gemini.mjs` | AI-фоны через Google Imagen/Gemini Image |
| `generate-flagship-illustrations.mjs` | 8 иллюстраций для флагмана `/kak-rabotaet-ts-piot/` через OpenRouter |
| `sharpen-heroes.mjs` | Постобработка hero: 2× upscale Lanczos3 + Unsharp mask + mozjpeg q88. Ручной запуск |
| `compress-og-backgrounds.mjs` | PNG → JPEG 75–80 для Satori |
| `wordstat/extract-keys.mjs` | Кандидаты из блога + контент-плана |
| `wordstat/fetch.mjs` | /v1/dynamics + /v1/topRequests (контур A) |
| `wordstat/discover.mjs` | Trend discovery: /v1/topRequests на 162 seed-а (контур B) |
| `wordstat/diff-snapshots.mjs` | Сравнение discovery-выгрузок неделя-к-неделе |
| `factcheck/extract-claims.mjs` | Regex-парсер дат/сумм/ст. КоАП |
| `factcheck/audit-npa-references.mjs` | Регрессионный аудит ссылок на НПА |
| `audit/linkgraph.mjs` | Граф перелинковки, сироты, кандидаты на ссылки |
| `audit/embed-articles.mjs` | Embeddings всех статей (Jina v3 / OpenAI), workflow `embeddings-monthly.yml` |
| `audit/similarity.mjs` | Cosine similarity → дубли (≥ 0.92) и близкие пары (≥ 0.80) |
| `metrika/sync-goals.mjs` | Синхронизация декларативных целей с Метрикой через Management API |
| `analytics/fetch-gsc.mjs` | Google Search Console API → клики/показы/позиции |
| `analytics/fetch-metrika-traffic.mjs` | Метрика Stat API → просмотры/визиты/пользователи |
| `analytics/fetch-webmaster.mjs` | Яндекс.Вебмастер API → SQI + топ запросов |
| `analytics/merge.mjs` | GSC + Метрика + Вебмастер + frontmatter → `articles.json` для `/dashboard/` |
| `ord-register.mjs`, `ord-bootstrap.mjs`, `ord-status.mjs` | ОРД Яндекса (рекламные креативы) |

Запуск: `node scripts/<имя>.mjs`. Большинство скриптов запускается
через GitHub Actions, не локально — ключи в Secrets. Локально —
для отладки с `DRY_RUN=1`.

---

## Технические особенности

### Сборка

- **Команда:** `astro build && pagefind --site dist`. **Не
  запускайте `astro build` напрямую** — иначе поисковый индекс
  не обновится. Зашито в `npm run build`.
- В GitHub Actions выполняется `npm run build` (см.
  `.github/workflows/deploy-gh-pages.yml`).
- **Native-зависимости:** `@resvg/resvg-js` (бинарник для PNG),
  `sharp` (WebP-оптимизация). При переносе проекта — проверьте
  поддержку платформы.

### Маршруты и коллекции

- Контент-коллекции с публичными URL: `blog`, `pillars`,
  `glossary`. `wiki` — внутренняя, без маршрутов.
- **Новый тег** в frontmatter поста автоматически создаёт страницу
  `/tag/<slug>/` и попадает в `/tags/`. Никаких ручных изменений
  не требуется.
- Slug тегов — кириллица, нормализация в `src/utils/tags.ts`
  (`tagSlug`).
- **Slug категорий = id pillar-файла.** Чтобы добавить категорию,
  обновите `CATEGORIES` в `consts.ts` и создайте
  `src/content/pillars/<slug>.md`.

### OG-картинки

- Для каждого поста автогенерируется PNG 1200×630 через Satori +
  Resvg (см. `src/pages/og/[slug].png.ts`). Шрифты —
  `public/fonts/` (inter-*, commissioner-*, geologica-*).
- В frontmatter поста `heroImage` **необязателен** — без него
  `BlogPost.astro` подставит `/og/<slug>.png` в `og:image`.
- Если меняете шаблон обложки — учитывайте, что fontsource-subsets
  разные (cyrillic, latin, latin-ext) подключаются под разными
  именами для fallback. Подробности — `docs/images.md`.

### Поиск (Pagefind)

- Индексирует только элементы с `data-pagefind-body`. Сейчас он
  стоит на `<article>` в `BlogPost.astro` — поэтому в выдаче только
  посты, не категории/теги/словарь.
- Навигация и блок «Читайте также» помечены `data-pagefind-ignore`,
  чтобы не разбавлять индекс.
- Если хотите, чтобы pillar-страницы или термины глоссария тоже
  искались — добавьте `data-pagefind-body` на нужный контейнер.
  Подробности — `docs/search.md`.

### «Читайте также»

В `BlogPost.astro` ниже текста статьи рендерится до 4 связанных
постов. Скоринг: совпадение тегов ×2, совпадение категорий ×1.
Блок прячется при отсутствии совпадений.

### Калькулятор штрафов

Данные сценариев — `src/data/penalties.ts`. Единственный источник
истины: страница `/kalkulyator-shtrafov/` рендерит и список, и
форму, и FAQ из этого массива.

При изменениях КоАП обновляйте сценарии **здесь и параллельно
сверьте** с упоминаниями штрафов в постах
(`grep -nE '14\.5|15\.12' src/content/blog/`).

---

## Документация изменений

При изменении компонента, скрипта или паттерна — **обновлять
соответствующий файл в `docs/` в той же PR**. Не накапливать долг.

| Что меняется | Какой doc обновить |
|---|---|
| Новый компонент в `src/components/` | `docs/architecture.md` (таблица «Компоненты») |
| Новый маршрут или коллекция | `docs/architecture.md` (маршруты / коллекции) |
| Скрипты генерации картинок, промпты, `STYLE_SUFFIX`, словарь `DEV` | `docs/image-prompts.md` |
| Скрипты постобработки, пайплайн hero/preview | `docs/images.md` |
| OG-картинки, Satori, шрифты | `docs/images.md` |
| CSS карточек, featured, related | `docs/article-cards.md` |
| Дизайн-токены, цвета, типографика | `docs/design-system.md` |
| Pagefind, индексация | `docs/search.md` |
| Open Graph для Telegram (превью при шеринге) | `docs/og-telegram.md` |
| Wordstat API, частотность ключей, скилл-интеграции | `docs/wordstat.md` |
| Factcheck pipeline, extract-claims, sources.json, audit-npa-references | `docs/factcheck.md` |
| Backfill истории и системные паттерны фактчека | `docs/factcheck-history.md` |
| Post-mortem крупных сессий (что пошло не так / уроки) | `docs/archive/sessions/session-YYYY-MM-DD-postmortem.md` |
| Roadmap новых контент-форматов (#33) | `docs/content-formats-roadmap.md` |
| Редполитика, классы решений в фактчеке | `docs/editorial-policy.md` |
| Аналитика (GSC, Метрика, Вебмастер, дашборд) | `docs/analytics.md` |
| Цели Метрики через API | `docs/metrika.md` |
| Секреты GitHub | `docs/SECRETS.md` |
| Правила контента и стиля | `docs/content-rules.md` |
| Этот файл | `docs/tools.md` |

Если фича не покрыта существующим doc — расширить тот, что ближе
по теме, или завести новый и добавить ссылку в `CLAUDE.md`.
