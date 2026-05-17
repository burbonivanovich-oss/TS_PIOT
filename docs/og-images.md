# Изображения для статей и OG-обложки

## Логика использования изображений

В проекте три типа изображений с разным назначением и разными нейросетями:

| Тип | Поле frontmatter | Путь | Нейросеть | Когда меняется |
|---|---|---|---|---|
| **Preview** | `previewImage` | `public/images/preview/{slug}.jpg` | FLUX (OpenRouter) | На каждую статью |
| **Hero** | `heroImage` | `public/images/hero/{slug}.jpg` | FLUX (OpenRouter) | На каждую статью |
| **OG фон** | — | `public/og-backgrounds/{cat}.jpg` | FLUX или любая (выбор) | При смене стиля |

### Где что показывается

```
Карточка на /blog/, главной, категориях
  └── previewImage (верхняя часть карточки, 16:9)
      └── если нет → карточка без изображения

Страница статьи /blog/{slug}/
  └── heroImage (шапка поста, над заголовком)
      └── если нет → шапка без изображения

og:image (соцсети, Telegram, WhatsApp)
  └── heroImage если есть
      └── иначе → /og/{slug}.png (Satori, текст + OG фон категории)
```

### Почему одна платформа (OpenRouter) для обоих типов

**Gemini для превью** (`google/gemini-3.1-flash-image-preview`) — дефолтная модель
для preview и hero. Editorial-иллюстрации в едином стиле, тёмный фон.
Сменить: `PREVIEW_MODEL=...` или `HERO_MODEL=...` через workflow inputs или CLI.

### Автоматизация

Два отдельных workflow: **Generate Hero Images** (hero) и **Generate Preview Pool**
(превью пула по категориям). Оба запускаются вручную через `workflow_dispatch`.

---

В проекте два типа изображений (подробнее ниже):

| Тип | Путь | Размер | Назначение |
|---|---|---|---|
| **Preview + Hero** | `public/images/{preview,hero}/{slug}.jpg` | 1200×630 | Карточки и шапка статьи |
| **OG** | `/og/{slug}.png` (runtime) | 1200×630 | og:image для соцсетей и мессенджеров |

Hero — AI-иллюстрация, генерируется один раз и хранится как статический файл.
OG — текстовая обложка, генерируется на лету через Satori при каждом запросе
(или при сборке). Если у поста нет `heroImage`, `BlogPost.astro` подставляет
OG-картинку и в `og:image`.

---

## Hero-изображения для статей

### Как прописать в статье

Добавьте в frontmatter после `pubDate`:

```yaml
heroImage: "/images/hero/2026-01-15-chto-takoe-ts-piot.jpg"
```

Если поле отсутствует — в шапке статьи и в `og:image` подставится
автоматически сгенерированная OG-картинка.

### Генерация через GitHub Actions (рекомендуется)

**Actions → Generate Hero Images → Run workflow**

| Параметр | Значение |
|---|---|
| `slug` пусто | Генерировать для всех статей без `heroImage` (кроме черновиков) |
| `slug = 2026-01-15-chto-takoe-ts-piot` | Только одна статья |

Workflow:
1. Устанавливает зависимости (`npm ci`)
2. Запускает `scripts/generate-hero-images.mjs`
3. Сохраняет PNG/JPG в `public/images/hero/`
4. Прописывает `heroImage:` во frontmatter статьи
5. Коммитит и пушит в `main`

Через ~2–3 минуты после запуска изображения появятся в репозитории.

**Требования:**
- Секрет `OPENROUTER_API_KEY` в настройках репозитория (Settings → Secrets → Actions)

### Генерация локально

```bash
OPENROUTER_API_KEY=... node scripts/generate-hero-images.mjs          # все без hero
OPENROUTER_API_KEY=... SLUG=2026-01-15-chto-takoe-ts-piot node ...    # одна статья
OPENROUTER_API_KEY=... HERO_MODEL=google/gemini-3.1-flash-image-preview node ...  # другая модель
```

### Модель и промпты

По умолчанию `google/gemini-3.1-flash-image-preview`.
Переопределяется через `HERO_MODEL`.

Промпт формируется автоматически по заголовку и категории статьи:

```
Editorial photo illustration for a Russian business article.
Topic: "{title}".
Visual style: {стиль категории}, very dark background (90% dark),
subtle abstract composition, photorealistic, cinematic lighting,
16:9 aspect ratio, no text, no people, no logos,
suitable for white typography overlay
```

Стили по категориям (`scripts/generate-hero-images.mjs`, `CAT_STYLE`):

| Категория | Стиль |
|---|---|
| `ts-piot` | deep navy blue, electric blue accents, circuit board patterns, digital technology |
| `markirovka` | deep forest green, teal accents, barcode and data matrix patterns, logistics |
| `zakonodatelstvo` | dark charcoal, warm amber gold accents, marble texture, formal documents |

Чтобы изменить стиль — отредактируйте `CAT_STYLE` в скрипте и перегенерируйте.

---

## OG-фоны для категорий

OG-картинки получают окрашенный фон в цвет категории. Чтобы заменить
процедурный градиент на AI-текстуру — используйте workflow OG Backgrounds.

**Actions → Generate OG Backgrounds → Run workflow**

Выберите модель из выпадающего списка:

| Группа | Модели | Цена |
|---|---|---|
| FLUX (OpenRouter) | `flux-1-schnell` (бесплатно), `flux-1-1-pro`, `flux-2-max` и др. | $0–$0.06/img |
| OpenAI (OpenRouter) | `gpt-image-1`, `dall-e-3` | ~$0.04/img |
| Stability (OpenRouter) | `stable-diffusion-3-5-large` | ~$0.035/img |
| Ideogram / Recraft | `ideogram-v3`, `recraft-v3` | ~$0.03–$0.08/img |
| Gemini Imagen 4 | `google/imagen-4-fast`, `google/imagen-4-ultra` | платный Google AI |
| Gemini Flash Image | `google/gemini-3.1-flash-image-preview` | ~$0.045/img |

Workflow сохраняет файлы `public/og-backgrounds/{ts-piot,markirovka,zakonodatelstvo}.jpg`
и коммитит в `main`.

**Требования:**
- Секрет `OPENROUTER_API_KEY` для моделей без префикса `google/`
- Секрет `GEMINI_API_KEY` (платный) для моделей с префиксом `google/`

### Ручная замена фонов

Любое изображение 1200×630 (или пропорциональное 16:9) подойдёт.
Сохраните как JPEG в `public/og-backgrounds/`:

```
public/og-backgrounds/ts-piot.jpg
public/og-backgrounds/markirovka.jpg
public/og-backgrounds/zakonodatelstvo.jpg
```

Рекомендации по промпту для любого генератора:
```
Dark abstract [blue/green/amber] background, very low contrast,
subtle [circuit board / barcode fragments / marble texture],
photorealistic, 16:9, no text, no people, no logos,
suitable as background for white typography overlay
```

> **Важно:** Satori встраивает фон как base64 data URI. PNG 757 KB → Satori
> зависает. Используйте JPEG quality 75–80 (< 20 KB). Скрипт компрессии:
> `node scripts/compress-og-backgrounds.mjs`.

---

## OG-картинки: технические детали (Satori)

Логика генерации: `src/pages/og/[slug].png.ts`

Каждый пост получает `/og/{slug}.png` на этапе сборки:

1. `getStaticPaths` обходит `blog` (только `draft: false`)
2. Разметка строится как строка → `html()` из `satori-html` → `satori()` → SVG
3. SVG → PNG через `@resvg/resvg-js` (Rust native)
4. Возвращается как `Response` с `Cache-Control: immutable`

### Шрифты

OG-картинки используют ту же пару, что и сайт — Commissioner (заголовок) + Geologica (тело).
Один subset не покрывает кириллицу + латиницу, поэтому подключены четыре набора:

| Имя в Satori | Файл | Покрытие |
|---|---|---|
| `Commissioner` | `public/fonts/commissioner-regular.woff` / `commissioner-bold.woff` | а-я, А-Я (заголовок) |
| `Geologica` | `public/fonts/geologica-regular.woff` / `geologica-bold.woff` | а-я, А-Я (тело) |
| `InterLat` | `public/fonts/inter-latin-regular.woff` | a-z, 0-9, ASCII |
| `InterLatExt` | `public/fonts/inter-latin-ext-regular.woff` | «», —, ё, диакритика |

В шаблоне заголовок получает `font-family: 'Commissioner', 'InterLat', 'InterLatExt'`,
остальной текст — `font-family: 'Geologica', 'InterLat', 'InterLatExt'`.
Satori идёт по fallback-цепочке для каждого глифа.

Если видите `NO GLYPH` — проверьте порядок шрифтов в массиве `fonts`
и строку `font-family` в шаблоне.

Восстановить шрифты из node_modules:
```bash
# Кириллические (heading + body)
cp node_modules/@fontsource/commissioner/files/commissioner-cyrillic-400-normal.woff  public/fonts/commissioner-regular.woff
cp node_modules/@fontsource/commissioner/files/commissioner-cyrillic-700-normal.woff  public/fonts/commissioner-bold.woff
cp node_modules/@fontsource/geologica/files/geologica-cyrillic-400-normal.woff        public/fonts/geologica-regular.woff
cp node_modules/@fontsource/geologica/files/geologica-cyrillic-700-normal.woff        public/fonts/geologica-bold.woff

# Латинские (fallback для ASCII, цифр, пунктуации)
cp node_modules/@fontsource/inter/files/inter-latin-400-normal.woff      public/fonts/inter-latin-regular.woff
cp node_modules/@fontsource/inter/files/inter-latin-700-normal.woff      public/fonts/inter-latin-bold.woff
cp node_modules/@fontsource/inter/files/inter-latin-ext-400-normal.woff  public/fonts/inter-latin-ext-regular.woff
cp node_modules/@fontsource/inter/files/inter-latin-ext-700-normal.woff  public/fonts/inter-latin-ext-bold.woff
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

### Локальный просмотр без билда

```bash
npm run dev  # OG-картинки доступны по /og/<slug>.png
```

---

## Скрипты (scripts/)

| Скрипт | Назначение |
|---|---|
| `generate-hero-images.mjs` | AI hero-изображения для статей (Nano Banana 2) |
| `generate-og-backgrounds.mjs` | AI фоны для OG через Gemini Imagen |
| `generate-og-backgrounds-openrouter.mjs` | AI фоны через OpenRouter (FLUX и др.) |
| `generate-og-backgrounds-local.mjs` | Процедурные SVG-фоны без внешних API |
| `compress-og-backgrounds.mjs` | PNG → JPEG через sharp (обязательно перед деплоем) |

---

## GitHub Actions workflows

| Workflow | Файл | Триггер | Что делает |
|---|---|---|---|
| Generate Hero Images | `.github/workflows/generate-hero-images.yml` | `workflow_dispatch` | Hero-изображения статей через OpenRouter |
| Generate Preview Pool | `.github/workflows/generate-preview-pool.yml` | `workflow_dispatch` | Превью-пул по категориям (3 варианта × 5 категорий) |
| Generate OG Backgrounds | `.github/workflows/generate-og-backgrounds.yml` | `workflow_dispatch` | Фоны для OG-обложек, 22 модели на выбор |

Все три workflow запускаются вручную через `workflow_dispatch` из UI и работают только от `main`-ветки.

---

## Настройка OPENROUTER_API_KEY

Все изображения (preview, hero, OG-фоны) генерируются через **OpenRouter** единственным ключом.
Gemini/Google-модели (`google/...`) дополнительно требуют `GEMINI_API_KEY`.

### Добавить секрет в репозиторий

1. Открыть **Settings → Secrets and variables → Actions** в репозитории GitHub.
2. Нажать **New repository secret**.
3. Имя: `OPENROUTER_API_KEY`, значение: ключ из [openrouter.ai/keys](https://openrouter.ai/keys).
4. Сохранить.

После этого все три workflow получат ключ автоматически — дополнительных настроек не нужно.

### Запуск генерации вручную

**Actions → Generate Hero Images → Run workflow**

| Поле | Значение |
|---|---|
| `slug` пусто | Генерировать для всех статей без `heroImage` (только `draft: false`) |
| `slug = 2026-05-01-chto-takoe-fn` | Только одна конкретная статья (без `.md`) |

Workflow выполняется ~3–5 минут, после чего коммитит изображения в `main` и прописывает пути во frontmatter.

> **Важно:** черновики (`draft: true`) скипаются скриптом намеренно — изображения
> генерируются только для опубликованных статей.
