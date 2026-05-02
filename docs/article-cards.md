# Карточки статей

Карточки отображаются в трёх местах: главная страница (`/`), архив блога
(`/blog/`), страницы категорий (`/category/{slug}/`).

## Структура карточки

```
┌─────────────────────────────┐
│                             │
│      previewImage (16:9)    │  ← AI-иллюстрация от FLUX
│                             │
├─────────────────────────────┤
│ [Категория]                 │
│ Заголовок статьи            │
│ Краткое описание            │
│ дата                        │
└─────────────────────────────┘
```

Если `previewImage` не задан — карточка отображается без изображения
(только текст). Это нормальное состояние для черновиков или статей,
для которых ещё не запускали генерацию.

## Компоненты

| Место | Компонент/файл | Примечание |
|---|---|---|
| `/blog/` | `src/components/BlogFilter.tsx` | React, с фильтрами по категории и тегу |
| `/` (последние 6) | `src/pages/index.astro` | Статический рендер |
| `/category/{slug}/` | `src/pages/category/[category].astro` | Проверить наличие previewImage |

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
  ├── FLUX → public/images/preview/новая-статья.jpg
  │   └── frontmatter ← previewImage: "/images/preview/..."
  └── FLUX (OpenRouter) → public/images/hero/новая-статья.jpg
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

## Визуальный стиль превью (FLUX)

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

По умолчанию `black-forest-labs/flux-1-schnell` (бесплатно через OpenRouter).

Чтобы сменить модель для превью — установите переменную окружения:
```bash
FLUX_MODEL=black-forest-labs/flux-1-1-pro OPENROUTER_API_KEY=... node scripts/generate-preview-images.mjs
```

В workflow модель жёстко не задана, берётся дефолт из скрипта. Если нужна
другая модель на постоянной основе — поменяйте `process.env.FLUX_MODEL ??`
в начале скрипта.

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
