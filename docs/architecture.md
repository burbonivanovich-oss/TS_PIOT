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
| `/kalendar-markirovki/` | `src/pages/kalendar-markirovki.astro` | Календарь маркировки |
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
- `/sitemap.xml` — карта сайта (кастомный `src/pages/sitemap.xml.ts`)
- `/pagefind/*` — индекс Pagefind (генерируется после `astro build`)

## Контент-коллекции (`src/content.config.ts`)

| Коллекция | Папка | Публичные URL | Зачем |
|---|---|---|---|
| `blog` | `src/content/blog/` | `/blog/<slug>/` | Статьи |
| `pillars` | `src/content/pillars/` | внутри `/category/<slug>/` | Контент-блок и FAQ для категории |
| `glossary` | `src/content/glossary/` | `/slovar/#<term-slug>` | Термины словаря |
| `wiki` | `src/content/wiki/` | — | Редакционные заметки, контент-планы, социальные черновики (не публикуются) |

## Источники истины

| Данные | Файл | Ключ |
|---|---|---|
| Категории (slug, название, цвет) | `src/consts.ts` | `CATEGORIES` |
| Навигация | `src/consts.ts` | `NAV_LINKS` |
| Sidebar-баннер (дайджест) | `src/consts.ts` | `SIDEBAR_BANNER` |
| Инлайн-подписка | `src/consts.ts` | `INLINE_SUBSCRIBE` |
| CPA-баннеры (партнёрские/редакционные) | `src/data/cpa-banners.ts` | `CPA_BANNERS`, `CATEGORY_DEFAULT_CPA` |
| Сценарии калькулятора штрафов | `src/data/penalties.ts` | `SCENARIOS` |
| Данные календаря маркировки | `src/data/markingCalendar.ts` | `MARKING_CALENDAR` |

## Компоненты

| Файл | Назначение |
|---|---|
| `src/components/BaseHead.astro` | `<head>`: мета, OG, JSON-LD, шрифты |
| `src/components/Header.astro` | Шапка с навигацией (4 ссылки) |
| `src/components/HeaderLink.astro` | Ссылка в шапке с active-стилем |
| `src/components/Footer.astro` | Подвал |
| `src/components/FormattedDate.astro` | Форматирование дат на русском |
| `src/components/FAQ.astro` | FAQ-аккордеон + FAQPage JSON-LD |
| `src/components/Checklist.astro` | Интерактивный чеклист с localStorage |
| `src/components/Callout.astro` | Акцентная врезка (тёмная / светлая) |
| `src/components/BlogFilter.tsx` | React-компонент фильтрации/поиска карточек блога |
| `src/components/MarkingCalendar.tsx` | React-компонент календаря маркировки |
| `src/components/PenaltyCalculator.tsx` | React-компонент калькулятора штрафов |
| `src/components/Quiz.tsx` | Ветвящийся квиз для подбора продуктов (ОФД/Эльба/Бухгалтерия/Диадок/Экстерн) — 3–4 вопроса с условным шагом для ИП+Бухгалтерия, открывается из hero на главной |
| `src/components/PopupBanner.tsx` | Всплывающий баннер подписки. Появляется через 60 с после загрузки, закрывается крестиком/оверлеем/CTA. Флаг закрытия — `localStorage.popup_dismissed_v1`. Подключается с `client:load` на `/` |
| `src/components/interactive/` | Интерактивные блоки для встраивания в статьи и лонгриды (F26 из roadmap'а контент-форматов). Цели в Метрике отправляются через `src/utils/track.ts`. |
| `src/components/interactive/DataMatrixDissector.tsx` | Шаг 1 флагмана-симулятора. Разбор кода маркировки DataMatrix на части (GTIN / серийник / GS-разделитель / криптохвост) с интерактивной подсветкой |
| `src/components/interactive/KkmDiagram.tsx` | Шаг 2 флагмана. Касса в разрезе на Hardware (ФН) и Software (6 модулей) зоны, клик по модулю → деталь |
| `src/components/interactive/RequestAnimation.tsx` | Шаг 3 флагмана. Тогл «связь есть/нет» + ползунок «часов без интернета» с порогами 2 ч / 72 ч / >72 ч |
| `src/components/interactive/ResponseBranch.tsx` | Шаг 4 флагмана. Три ветки ответа от ЧЗ (Валиден / Выведен / Нет в системе) с возвратом к основному пути |
| `src/components/interactive/FfdToggle.tsx` | Шаг 5 флагмана. Тогл «до/после 01.07.2026» → теги 1162 vs связка 1163 + 2106 + 1265 (ФФД 1.2) |
| `src/components/interactive/CmStatusToggle.tsx` | Шаг 7 флагмана. Жизненный цикл кода маркировки в ГИС МТ (5 статусов + ветка Заблокирован) |
| `src/components/interactive/ZakonTimeline.tsx` | Трекер изменений 2026 года. Range-фильтр по месяцам + фильтр по 6 категориям. Используется в `/zakon-2026/` |
| `src/components/interactive/UsnNdsCalc.tsx` | Калькулятор УСН + НДС-2026 в статье `nalogi-msb-2026`. Слайдер оборота 1–500 млн ₽, тогл режима УСН, маржа |
| `src/components/interactive/MarkingFineSlider.tsx` | Слайдер штрафа за маркировку (ст. 15.12 ч. 4 КоАП) в статье `shtraf-za-markirovku`. Штраф + конфискация партии |
| `src/components/interactive/ScenarioChecklist.tsx` | Универсальный чек-бокс-симулятор для сценарных гайдов. Прогресс, фазы, localStorage. Используется в `/scenario/kofeynya-za-30-dney/` |
| `src/components/interactive/TsPiotReadinessQuiz.tsx` | Квиз `/test-ts-piot/` с ветвящейся логикой (6 вопросов, скип нерелевантных), персональные рекомендации по приоритетам |
| `src/components/interactive/RoiIpVsOoo.tsx` | ROI-калькулятор: ИП vs ООО на УСН 6% с учётом взносов, ФОТ, НДФЛ с зарплаты и дивидендов, НДС-2026. Используется в `/scenario/perekhod-ip-na-ooo-za-60-dney/` |
| `src/components/interactive/EdoChainPuzzle.tsx` | Drag-and-drop пазл цепочки ЭДО при маркировке (7 карточек). HTML5 drag + кнопки ↑↓ для accessibility. Используется в `/test-tsepochka-edo/` |
| `src/components/FlagshipTeaser.astro` | CSS-анимированный тизер цепочки касса → ОФД → ФНС/ЧЗ. Встроен в `/category/ts-piot/` как вход на флагман-симулятор |

## Утилиты

- `src/utils/url.ts`
  - `u(path)` — оборачивает путь в `BASE_URL` (нужно для GitHub Pages с subpath)
- `src/utils/tags.ts`
  - `tagSlug(tag)` — кириллический slug из тега
  - `collectTags(posts)` — `{ slug → { name, posts[] } }` со всеми тегами
  - `pluralPosts(count)` — «материал/материала/материалов»
- `src/utils/track.ts`
  - `track(event, params?)` — обёртка над `window.ym('reachGoal', …)` для счётчика 109130279
  - `trackOnce(event, params?)` — отправляет цель один раз за сессию (для воронок «дошёл до шага N»)
- `src/utils/glossary.ts`
  - `termSlug(term)` — slug для якоря
  - `firstLetter(term)` — буква для группировки
  - `alphabetOrder(a, b)` — компаратор для русско-английских букв

## Аналитические данные и пайплайны

Не часть продакшен-сборки сайта, но критичны для контент-операций:

| Подсистема | Где | Зачем | Подробности |
|---|---|---|---|
| Wordstat кеш (контур A) | `src/data/wordstat/keys.json` | Частоты `seo.keywords` + content-plan | `docs/wordstat.md` |
| Wordstat discovery (контур B) | `src/data/wordstat/discoveries/` | Trend discovery по 162 seeds, weekly diff | `docs/wordstat.md` |
| Factcheck claims | `src/data/factcheck/claims/<slug>.json` | Извлечённые claims статьи | `docs/factcheck.md` |
| Factcheck results | `src/data/factcheck/results/<slug>.json` | Отчёт проверки + recommendations | `docs/factcheck.md` |
| Factcheck маркеры | `.claude/factchecked/<slug>` | «Эта статья проверена YYYY-MM-DD» | `docs/factcheck.md` |
| Whitelist НПА | `src/data/factcheck/sources.json.npaWhitelist` | Реальные действующие ФЗ/ПП/Приказы — справочник для writer'а и аудита | `docs/factcheck.md` |
| NPA audit | `src/data/factcheck/audit/npa-references.json` | Незнакомые НПА в статьях для ручной верификации | — |
| Linkgraph | `src/data/audit/linkgraph.json` | Граф `slug → outbound[] / inbound[]`, orphans/weak/deadends | — |
| Embeddings | `src/data/audit/embeddings.json` | 1024d вектора статей (Jina v3) | — |
| Similarity | `src/data/audit/similarity.json` + `similarity-report.md` | Cosine top-6 соседей + горячие пары | — |
| Редполитика | `docs/editorial-policy.md` | Классы решений A/B/C для фактчека | — |

Запуск:
- Wordstat — еженедельный workflow `.github/workflows/wordstat-weekly.yml`.
- Embeddings — ежемесячный `.github/workflows/embeddings-monthly.yml` (нужен `JINA_API_KEY` или `OPENAI_API_KEY`).
- Factcheck — скилл `/factcheck <slug>` вручную, на статью.

Скрипты в `scripts/`:
- `scripts/wordstat/{extract-keys,fetch,discover,diff-snapshots}.mjs`
- `scripts/factcheck/extract-claims.mjs` — типы claims: даты, суммы, NPA_KOAP/UK/NK/FZ/FZ_FULL/PP_NUMBERED/PRIKAZ, PERCENT, LINK.
- `scripts/factcheck/audit-npa-references.mjs` — регрессионный аудит против `sources.json.npaWhitelist`. Флаг `--strict` для CI.
- `scripts/audit/embed-articles.mjs` — semantic embeddings (Jina v3 default, OpenAI fallback).
- `scripts/audit/similarity.mjs` — cosine top-6 + отчёт пар по порогам 0.92 / 0.80.
- `scripts/audit/linkgraph.mjs` — граф ссылок, orphans/weak/deadends + кандидаты доноров.
- `scripts/audit/fix-broken-blog-links.mjs` — чинит `/blog/<slug-без-даты>/` → `/blog/<полный-slug>/`. Идемпотентен.
- `scripts/audit/check-blog-links.mjs` — регрессионный CI-чек битых ссылок.
- `scripts/audit/set-review-dates.mjs` — проставляет `reviewDate = pubDate + 90 дней` в статьях без него. Идемпотентен.

## Гейты публикации и git-хуки

Три слоя защиты от ошибок в продакшен-контенте, любой из которых
должен независимо ловить проблему:

1. **`/analyze-article <slug>`** — оценка 0–100 по 6 категориям перед
   публикацией. Обязательный шаг в `/release-article` Шаг 1. Блокер:
   балл < 70 / маркер фактчека старше 180 дней / `audit-npa-references`
   или `check-blog-links` упали. См. `.claude/commands/analyze-article.md`.
2. **Pre-commit hook** — `scripts/git-hooks/pre-commit-factcheck-guard.mjs`
   блокирует `git commit` любой статьи с `draft: false` без маркера
   `.claude/factchecked/<slug>`. Установка: `bash scripts/git-hooks/install.sh`.
   Bypass: `git commit --no-verify` (только с явной причиной).
3. **`research-specialist` gate в `/create-article` Стадия 1** — для
   категорий с НПА writer не запустится без research-brief'а с
   `frontmatter.sources[].verified=true`.

## Внутренние ссылки между статьями

Astro 5 `glob` loader использует **полное имя файла без расширения** как
`id` коллекции и параметр маршрута `/blog/[...slug]`. То есть для
`2026-01-15-chto-takoe-ts-piot.md` рабочий URL — `/blog/2026-01-15-chto-takoe-ts-piot/`,
а короткая форма `/blog/chto-takoe-ts-piot/` ведёт в 404.

Все внутренние ссылки в `src/content/blog/*.md` обязаны использовать
полный slug с датой. Регрессионный чек — `scripts/audit/check-blog-links.mjs`
(падает с exit 1 на любой битой ссылке).

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

Шрифты в `public/fonts/` (inter-*, commissioner-*, geologica-*) нужны при сборке (`fs.readFileSync` в OG-эндпоинте). **Не удаляйте их.**

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
