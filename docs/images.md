# Система изображений

В проекте три типа изображений, все генерируются через OpenRouter и
оптимизируются в WebP. OG-обложки рендерит Satori на лету при сборке.

## Логика использования

| Тип | Поле frontmatter | Путь | Назначение |
|---|---|---|---|
| **Preview** | `previewImage` | `public/images/preview/{slug}.jpg` | Карточки в листингах |
| **Hero** | `heroImage` | `public/images/hero/{slug}.jpg` | Шапка статьи + og:image |
| **OG** | — (автоматически) | `/og/{slug}.png` (Satori at build) | og:image если нет heroImage |
| **OG-фоны** | — | `public/og-backgrounds/{cat}.jpg` | Фон для Satori OG |

```
Карточка на /blog/, главной, категориях
  └── previewImage (16:9)
      └── если нет → poolPreview() из пула /images/preview/{cat}-{0..2}.jpg

Страница статьи /blog/{slug}/
  └── heroImage (шапка над заголовком)
      └── если нет → /og/{slug}.png

og:image (Telegram, WhatsApp, Twitter)
  └── heroImage если есть
      └── иначе → /og/{slug}.png (Satori, текст + OG-фон категории)
```

---

## WebP-оптимизация

Все `.jpg`/`.png` в `public/images/{hero,flagship,preview}/` автоматически
конвертируются в `.webp` рядом скриптом `scripts/optimize-images.mjs`.
Размер падает на 60–95% (зависит от исходного качества).

На сайте — `<Picture>` (`src/components/Picture.astro`) и обёртка
`<picture>` в `BlogFilter.tsx`: рендерят `<source srcset=*.webp>` +
`<img src=*.jpg>` fallback. Браузеры с поддержкой WebP (95%+) забирают
сжатую версию, остальные — оригинал. SEO работает как раньше.

Запуск:
- Автоматически — шаг «Optimize images to WebP» в каждом workflow
  генерации (hero / flagship / backfill).
- Локально: `node scripts/optimize-images.mjs`. ENV: `FORCE=1` для
  перезаписи, `QUALITY=82` для смены качества, `DIRS=hero,flagship`
  для подмножества.

После прогона на 108 файлах: **67.7 МБ → 13.4 МБ (−80%)**.

---

## Превью-пул

Набор из **15 файлов** (3 варианта × 5 категорий), сгенерированных
один раз и переиспользуемых. Плоская графика с иконкой категории
на фоне бренда — читается чётко на карточке ~300 px.

Путь: `public/images/preview/{category}-{0,1,2}.jpg`

**Как карточка выбирает изображение** (в `BlogFilter.tsx` функция `poolPreview(post)`):
1. Если `previewImage` задан в frontmatter — используется он (override).
2. Иначе: `n = slugHash(post.id) % 3` → `/images/preview/{category}-{n}.jpg`.

Хэш детерминирован: одна статья всегда получает один и тот же вариант.

**Запуск:** Actions → **Generate Preview Pool** → Run workflow.

| Параметр | Описание |
|---|---|
| `category` | Только одна категория (пусто = все 5) |
| `force` | `true` — перегенерировать существующие |

---

## Hero-изображения

Уникальное редакционное фото под каждую статью. Генерируется один
раз (1376×768) и сохраняется в `public/images/hero/{slug}.jpg`.
После постобработки sharpen — 2752×1536 для retina.
Путь прописывается в frontmatter: `heroImage: "/images/hero/{slug}.jpg"`.

**Запуск:** Actions → **Generate Hero Images** → Run workflow.

| Параметр | Описание |
|---|---|
| `slug` | Конкретная статья (пусто = все без hero) |
| `limit` | Максимум статей за запуск (0 = без лимита) |

Скрипт пропускает статьи с уже прописанным `heroImage`.

**Локальный запуск:**
```bash
OPENROUTER_API_KEY=... node scripts/generate-hero-images.mjs
OPENROUTER_API_KEY=... SLUG=2026-01-15-chto-takoe-ts-piot node ...
OPENROUTER_API_KEY=... HERO_MODEL=google/gemini-2.5-flash-image node ...
```

**Промпты для hero** — `docs/image-prompts.md`. Там описаны:
- `STYLE_SUFFIX` (резкость, текст, точность устройств)
- словарь `DEV` с визуальными профилями ККТ-моделей

---

## Постобработка: резкость (`sharpen-heroes.mjs`)

Gemini Image склонна к мягкому AI-блюру. После генерации применяется
`scripts/sharpen-heroes.mjs`:

- Апскейл 2× через Lanczos3 (1376×768 → 2752×1536)
- Unsharp mask (`sigma 1.2, m2 2.5`)
- Mozjpeg `q88` с chroma subsampling 4:4:4

```bash
# Все hero сразу (с бэкапом оригиналов в public/images/hero/_orig/)
BACKUP=1 node scripts/sharpen-heroes.mjs

# Только один файл
FILE=2026-05-01-kak-vybrat node scripts/sharpen-heroes.mjs

# Посмотреть, что будет сделано
DRY_RUN=1 node scripts/sharpen-heroes.mjs

# Только sharpen без апскейла
NO_UPSCALE=1 node scripts/sharpen-heroes.mjs
```

Папка `_orig/` в `.gitignore`. **Идемпотентно не работает**: повторный
запуск на уже обработанном файле снова умножит размер на 2. После
повторной генерации `FORCE=1` запускать `sharpen-heroes.mjs` только
для свежесгенерированного slug.

---

## OG-картинки через Satori

Логика: `src/pages/og/[slug].png.ts`. Каждый пост получает
`/og/{slug}.png` на этапе сборки:

1. `getStaticPaths` обходит `blog` (только `draft: false`)
2. Разметка строится как строка → `html()` из `satori-html` → `satori()` → SVG
3. SVG → PNG через `@resvg/resvg-js` (Rust native)
4. Возвращается как `Response` с `Cache-Control: immutable`

### Шрифты

OG-картинки используют ту же пару, что и сайт — Commissioner
(заголовок) + Geologica (тело). Один subset не покрывает кириллицу +
латиницу, поэтому подключены четыре набора:

| Имя в Satori | Файл | Покрытие |
|---|---|---|
| `Commissioner` | `public/fonts/commissioner-{regular,bold}.woff` | Кириллица (заголовок) |
| `Geologica` | `public/fonts/geologica-{regular,bold}.woff` | Кириллица (тело) |
| `InterLat` | `public/fonts/inter-latin-regular.woff` | a-z, 0-9, ASCII |
| `InterLatExt` | `public/fonts/inter-latin-ext-regular.woff` | «», —, ё, диакритика |

В шаблоне заголовок получает `font-family: 'Commissioner', 'InterLat', 'InterLatExt'`,
остальной текст — `'Geologica', 'InterLat', 'InterLatExt'`. Satori
идёт по fallback-цепочке для каждого глифа.

Если видите `NO GLYPH` — проверьте порядок шрифтов в массиве `fonts`
и строку `font-family` в шаблоне.

Восстановить шрифты из node_modules:
```bash
cp node_modules/@fontsource/commissioner/files/commissioner-cyrillic-400-normal.woff  public/fonts/commissioner-regular.woff
cp node_modules/@fontsource/commissioner/files/commissioner-cyrillic-700-normal.woff  public/fonts/commissioner-bold.woff
cp node_modules/@fontsource/geologica/files/geologica-cyrillic-400-normal.woff        public/fonts/geologica-regular.woff
cp node_modules/@fontsource/geologica/files/geologica-cyrillic-700-normal.woff        public/fonts/geologica-bold.woff
cp node_modules/@fontsource/inter/files/inter-latin-400-normal.woff                   public/fonts/inter-latin-regular.woff
cp node_modules/@fontsource/inter/files/inter-latin-700-normal.woff                   public/fonts/inter-latin-bold.woff
cp node_modules/@fontsource/inter/files/inter-latin-ext-400-normal.woff               public/fonts/inter-latin-ext-regular.woff
cp node_modules/@fontsource/inter/files/inter-latin-ext-700-normal.woff               public/fonts/inter-latin-ext-bold.woff
```

### Ограничения Satori

**Работает:**
- `display:flex` полностью (direction, align, justify, gap, wrap, shrink)
- `backgroundImage`: градиенты и `url(data:image/...;base64,...)`
- `borderRadius`, `border`, `opacity`
- `img` с data URI или https-URL
- `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight`

**Не работает:**
- `position: absolute` — вместо него вкладывайте flex-контейнеры
- `boxShadow`, `filter`, `backdropFilter`, `clip-path` — игнорируются
- `display:grid`
- Эмодзи — используйте SVG-фигуры или текстовые символы
- `textOverflow: ellipsis` — обрезайте строку в JS до передачи

**Сборка разметки:**
```ts
// Правильно: строка → html()
const markup = html(`<div style="display:flex">...</div>`);

// Неправильно: интерполяция HTML внутри тегового литерала
// html`<div>${"<span>текст</span>"}` — экранируется и попадает как текст
```

### Локальный просмотр

```bash
npm run dev  # OG-картинки доступны по /og/<slug>.png
```

---

## OG-фоны для категорий

OG-картинки получают окрашенный фон под цвет категории. Чтобы заменить
процедурный градиент на AI-текстуру — используется workflow.

**Запуск:** Actions → **Generate OG Backgrounds** → Run workflow.

Выберите модель из выпадающего списка (~25 моделей: FLUX, Imagen,
Gemini, Stable Diffusion, Recraft, Ideogram, OpenAI). Дефолт —
`black-forest-labs/flux-1-schnell` (бесплатно).

Workflow сохраняет `public/og-backgrounds/{ts-piot,markirovka,zakonodatelstvo}.jpg`
и коммитит в `main`.

**Требования:**
- Секрет `OPENROUTER_API_KEY` (для большинства моделей)
- Секрет `GEMINI_API_KEY` (платный, для моделей с префиксом `google/`)

### Ручная замена фонов

Любое изображение 1200×630 (или 16:9) подойдёт. Сохраните как JPEG
в `public/og-backgrounds/`:

```
public/og-backgrounds/ts-piot.jpg
public/og-backgrounds/markirovka.jpg
public/og-backgrounds/zakonodatelstvo.jpg
```

Промпт для любого генератора:
```
Dark abstract [blue/green/amber] background, very low contrast,
subtle [circuit board / barcode fragments / marble texture],
photorealistic, 16:9, no text, no people, no logos,
suitable as background for white typography overlay
```

> **Важно:** Satori встраивает фон как base64 data URI. PNG 757 KB →
> Satori зависает. Используйте JPEG quality 75–80 (< 20 KB). Скрипт
> компрессии: `node scripts/compress-og-backgrounds.mjs`.

---

## Модели и ключи

| Скрипт | Переменная модели | Дефолт |
|---|---|---|
| `generate-preview-images.mjs` | `PREVIEW_MODEL` | `google/gemini-3.1-flash-image-preview` |
| `generate-hero-images.mjs` | `HERO_MODEL` | `google/gemini-3.1-flash-image-preview` |
| `generate-og-backgrounds-gemini.mjs` | `GEMINI_MODEL` | `imagen-4.0-generate-001` |
| `generate-og-backgrounds-openrouter.mjs` | `MODEL` | переменная workflow input |

Ключи в **GitHub Secrets** репозитория:
- `OPENROUTER_API_KEY` — preview, hero, flagship-illustrations, og-backgrounds
- `GEMINI_API_KEY` — опционально для Imagen 4 через прямой Google API

Локально ключи не обязательны — все скрипты штатно запускаются через Actions.

---

## Структура файлов

```
public/images/
├── preview/          ← пул превью (15 файлов, не трогать вручную)
├── hero/             ← hero под каждую статью
└── flagship/         ← иллюстрации флагмана /kak-rabotaet-ts-piot/
public/og-backgrounds/  ← фоны для Satori OG
public/fonts/         ← woff для Satori (4 пары шрифтов)

scripts/
├── generate-preview-images.mjs        ← генерация пула
├── generate-hero-images.mjs           ← генерация hero
├── generate-flagship-illustrations.mjs ← 8 шагов флагмана
├── generate-og-backgrounds-gemini.mjs ← OG-фоны через Google
├── generate-og-backgrounds-openrouter.mjs ← OG-фоны через OpenRouter
├── generate-og-backgrounds-local.mjs  ← процедурные SVG-фоны без API
├── sharpen-heroes.mjs                 ← постобработка резкости
├── compress-og-backgrounds.mjs        ← PNG → JPEG перед деплоем
└── optimize-images.mjs                ← jpg/png → webp везде

.github/workflows/
├── generate-preview-pool.yml
├── generate-hero-images.yml
├── hero-backfill-daily.yml            ← cron 00:00 МСК, догенерация
├── generate-flagship-illustrations.yml
└── generate-og-backgrounds.yml
```

---

## Добавление новой категории

1. Добавить slug в `src/consts.ts` → `CATEGORIES`
2. Создать `src/content/pillars/{slug}.md`
3. В `scripts/generate-preview-images.mjs` — 3 варианта в `CAT_VARIANTS`
4. В `scripts/generate-hero-images.mjs` — описание в `CAT_STYLE`
5. В `src/components/BlogFilter.tsx` — цвета в `cardBg()`
6. В `src/layouts/BlogPost.astro` — `catAccent`
7. Запустить **Generate Preview Pool** с `category={новый-slug}`
