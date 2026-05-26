# Карточки статей

Карточки отображаются в трёх местах: главная страница (`/`), архив блога
(`/blog/`), страницы категорий (`/category/{slug}/`).

## Структура карточки

```
┌─────────────────────────────┐
│                             │
│      previewImage (16:9)    │  ← AI-иллюстрация (Nano Banana)
│                             │
├─────────────────────────────┤
│ [Категория]                 │
│ Заголовок статьи            │
│ Краткое описание            │
│ дата                        │
└─────────────────────────────┘
```

Если `previewImage` не задан — карточка отображается со стилизованным
плейсхолдером `.ph` в цвете категории (radial-градиент + диагональные
полосы). Это нормальное состояние для черновиков или статей, для которых
ещё не запускали генерацию. См. `docs/design-system.md` → «Плейсхолдеры
для отсутствующих изображений».

## Компоненты

| Место | Компонент/файл | Примечание |
|---|---|---|
| `/blog/` | `src/components/BlogFilter.tsx` | React, с фильтрами по категории и тегу |
| `/` (Свежее, featured) | `src/pages/index.astro` → `.fresh-feat` | Статический рендер первой статьи, 16:10 фото |
| `/` (Материалы недели) | `src/pages/index.astro` → `.feed-grid` | 6 карточек 3×2 (статьи 2-7) |
| `/category/{slug}/` | `src/pages/category/[category].astro` | Проверить наличие previewImage |

> Старый featured-блок «1 крупная горизонтальная + 6 равных» с главной
> убран в редизайне мая 2026. См. `docs/design-system.md` → Changelog.

## Frontmatter

```yaml
previewImage: "/images/preview/2026-01-15-chto-takoe-ts-piot.jpg"
```

Путь прописывается автоматически скриптом `scripts/generate-preview-images.mjs`
после генерации. Редактировать вручную не нужно.

## Генерация изображений для карточек

### Автоматически

При пуше `.md` в `main` запускается **Generate Article Images** workflow:

```
src/content/blog/новая-статья.md → push → GitHub Actions
  ├── Nano Banana → public/images/preview/новая-статья.jpg
  │   └── frontmatter ← previewImage: "/images/preview/..."
  └── Nano Banana (OpenRouter) → public/images/hero/новая-статья.jpg
      └── frontmatter ← heroImage: "/images/hero/..."
```

### Вручную (для существующих статей)

**Actions → Generate Article Images → Run workflow**

Параметр `slug`:
- Пусто → генерирует для всех статей без `previewImage` (кроме черновиков)
- `2026-01-15-chto-takoe-ts-piot` → только эта статья

### Скрипт локально

```bash
OPENROUTER_API_KEY=... node scripts/generate-preview-images.mjs
OPENROUTER_API_KEY=... SLUG=2026-01-15-chto-takoe-ts-piot node scripts/generate-preview-images.mjs
```

## Визуальный стиль превью (Nano Banana)

Все превью генерируются в едином editorial-стиле:

```
bold flat editorial illustration, minimalist geometric shapes,
clean vector aesthetic, muted professional color palette,
no text, no people, no faces, no logos,
Tinkoff Journal style, 16:9 aspect ratio
```

Дополнительные элементы по категории:

| Категория | Цвета | Объекты |
|---|---|---|
| `ts-piot` | Navy + electric blue | Касса, QR-код, интерфейс ПО, схема |
| `markirovka` | Forest green + teal | Штрихкод, упаковка, склад |
| `zakonodatelstvo` | Amber + charcoal | Документы, весы, календарь |

Чтобы изменить стиль — отредактируйте `BASE_STYLE` и `CAT_STYLE`
в `scripts/generate-preview-images.mjs` и перегенерируйте через Actions.

## Модель для превью

По умолчанию `google/gemini-3.1-flash-image-preview` (**Nano Banana**) — через OpenRouter.

Чтобы сменить модель — установите env vars:
```bash
PREVIEW_MODEL=black-forest-labs/flux-1-1-pro OPENROUTER_API_KEY=... node scripts/generate-preview-images.mjs
HERO_MODEL=black-forest-labs/flux-1-1-pro OPENROUTER_API_KEY=... node scripts/generate-hero-images.mjs
```

В workflow `generate-hero-images.yml` / `generate-preview-images.yml`
модель не задана жёстко — берётся дефолт из скрипта (`PREVIEW_MODEL` /
`HERO_MODEL`). Если нужна другая модель на постоянной основе —
поменяйте дефолт в начале соответствующего скрипта.

## CSS карточек

**`BlogFilter.tsx`** (архив `/blog/`):

```css
.bf-card a         /* flex-column, overflow:hidden, border-radius:10px */
.bf-card-img       /* aspect-ratio:16/9, overflow:hidden */
.bf-card-img img   /* object-fit:cover, transition:transform */
.bf-card-body      /* padding, flex:1 */
```

**`index.astro`** (главная):

```css
.post-card a        /* flex-column, overflow:hidden */
.post-card-img      /* aspect-ratio:16/9 */
.post-card-img img  /* object-fit:cover */
.post-card-body     /* padding */
```

При наведении картинка слегка увеличивается (`scale(1.03)`).

## Featured-карточка (первая в сетке)

Первая карточка в каждом из трёх мест (главная, `/blog/`, `/category/{slug}/`) рендерится с модификатором `--featured` и занимает всю ширину сетки.

**Layout на десктопе (≥ 960 px):** горизонтальный — картинка слева 58 %, контент справа 42 %. Контент идёт сверху вниз (`justify-content: flex-start`), без вертикального центрирования — чтобы не было пустоты справа от текста.

**Layout на мобиле (< 960 px):** вертикальный, картинка сверху.

CSS-классы:
- На главной: `.post-card--featured` (`src/pages/index.astro`)
- В архиве блога: `.bf-card--featured` (`src/components/BlogFilter.tsx`)
- В категории: `.post-card--featured` (`src/pages/category/[category].astro`)

Все три синхронизированы по размерам (image 58 %, padding 32×36 px, min-height 320 px). При изменении пропорций — править во всех трёх файлах.

## Блок «Читайте также»

В `BlogPost.astro` после статьи рендерится до 4 связанных постов. Скоринг: совпадение тегов ×2, категорий ×1. Адаптивный макет выбирается по количеству:

| Количество | Макет | Описание |
|---|---|---|
| 2 | `A2` | 1×2 — две карточки в строку |
| 3 | `A3` или `B` (по slugCharSum % 2) | 2+1 или 1+2 |
| 4 | `C` | Равная сетка 4×1 на десктопе, 2×2 на узких экранах |

Макет `C` раньше делал первую карточку расширенной (главной + 3 компактных) — это создавало растянутую разметку, поэтому переведён в равную сетку.
