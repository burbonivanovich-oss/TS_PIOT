# Система изображений

Сайт использует два типа изображений для статей: **превью** (карточки в листинге)
и **hero** (большое фото в шапке статьи). Генерация — через OpenRouter API
(модель Gemini), запуск — через GitHub Actions.

---

## Превью-пул

### Что это

Набор из **15 файлов** (3 варианта × 5 категорий), сгенерированных один раз
и переиспользуемых для всех статей. Плоская графика с иконкой категории
на фоне цвета бренда — читается чётко на карточке ~300 px.

Путь: `public/images/preview/{category}-{0,1,2}.jpg`

Примеры:
```
public/images/preview/ts-piot-0.jpg
public/images/preview/ts-piot-1.jpg
public/images/preview/ts-piot-2.jpg
public/images/preview/markirovka-0.jpg
...
```

### Как карточка выбирает изображение

В `src/components/BlogFilter.tsx` функция `poolPreview(post)`:
1. Если у статьи задан `previewImage` в frontmatter — используется он (ручной override).
2. Иначе: `n = slugHash(post.id) % 3` → `/images/preview/{category}-{n}.jpg`.

Хэш детерминирован: одна статья всегда получает один и тот же вариант.

### Как запустить генерацию

**Actions → Generate Preview Pool → Run workflow**

| Параметр | Описание | Пример |
|---|---|---|
| `category` | Только одна категория (пусто = все 5) | `markirovka` |
| `force` | `true` — перегенерировать существующие | `true` |

Запускать при: первом деплое, смене дизайна пула, добавлении новой категории.
Статьи при этом **не изменяются**.

### Переопределить модель

Добавьте `PREVIEW_MODEL` в env секции workflow или в inputs при запуске:
```
PREVIEW_MODEL=google/gemini-2.5-flash-image
```

---

## Hero-изображения

### Что это

Уникальное редакционное фото **под каждую статью** (1344×768, 16:9).
Генерируется один раз и сохраняется в `public/images/hero/{slug}.jpg`.
Путь прописывается в frontmatter статьи: `heroImage: "/images/hero/{slug}.jpg"`.

### Как запустить генерацию

**Actions → Generate Hero Images → Run workflow**

| Параметр | Описание | Пример |
|---|---|---|
| `slug` | Конкретная статья (пусто = все без hero) | `2026-01-15-chto-takoe-ts-piot` |
| `limit` | Максимум статей за запуск (0 = без лимита) | `5` |

Скрипт пропускает статьи, у которых уже есть `heroImage` в frontmatter.
Запустите с конкретным `slug`, чтобы перегенерировать одну статью.

### Переопределить модель

```
HERO_MODEL=google/gemini-2.5-flash-image
```

---

## Модели

| Скрипт | Переменная | Дефолт |
|---|---|---|
| Preview pool | `PREVIEW_MODEL` | `google/gemini-3.1-flash-image-preview` |
| Hero | `HERO_MODEL` | `google/gemini-3.1-flash-image-preview` |

Ключ `OPENROUTER_API_KEY` хранится в **GitHub Secrets** репозитория.
Локально ключ не нужен — все скрипты запускаются через Actions.

---

## Структура файлов

```
public/images/
├── preview/          ← пул превью (15 файлов, не трогать вручную)
│   ├── ts-piot-0.jpg
│   ├── ts-piot-1.jpg
│   ├── ts-piot-2.jpg
│   ├── markirovka-0.jpg
│   └── ...
└── hero/             ← hero под каждую статью
    ├── 2026-01-15-chto-takoe-ts-piot.jpg
    └── ...

scripts/
├── generate-preview-images.mjs   ← генерация пула
└── generate-hero-images.mjs      ← генерация hero

.github/workflows/
├── generate-preview-pool.yml     ← Action для пула
└── generate-hero-images.yml      ← Action для hero
```

---

## Добавление новой категории

1. Добавить slug в `src/consts.ts` → `CATEGORIES`.
2. Создать `src/content/pillars/{slug}.md`.
3. В `scripts/generate-preview-images.mjs` добавить 3 варианта в `CAT_VARIANTS`.
4. В `scripts/generate-hero-images.mjs` добавить описание в `CAT_STYLE`.
5. В `src/components/BlogFilter.tsx` добавить цвета в `cardBg()`.
6. В `src/layouts/BlogPost.astro` добавить `catAccent` для новой категории.
7. Запустить **Generate Preview Pool** с `category={новый-slug}`.
