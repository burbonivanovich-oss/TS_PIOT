# Как добавить контент

Пошаговые инструкции для каждого типа контента в проекте.

## Статья (коллекция `blog`)

1. Создайте файл `src/content/blog/YYYY-MM-DD-slug.md`. Дата в имени —
   формальность для сортировки в файловом менеджере; на URL влияет только
   `slug` (всё имя файла без расширения = id записи).
2. Frontmatter:

   ```yaml
   ---
   title: "Заголовок"
   description: "Описание для SERP, до 160 символов."
   pubDate: "YYYY-MM-DD"
   updatedDate: "YYYY-MM-DD"   # необязательно — поднимает «свежесть» в листингах
   tags:
     - тег1
     - тег2
   categories:
     - ts-piot   # или markirovka, zakonodatelstvo
   draft: false
   seo:
     keywords:
       - целевой ключ
   ---
   ```

3. **`heroImage` указывать не обязательно.** Без него `BlogPost.astro`
   подставляет в `og:image` автогенерируемую `/og/<slug>.png` (см. [og-images.md](og-images.md)).
4. Теги указываются на русском, с пробелами и заглавными — slug формируется
   автоматически (`tagSlug` в `src/utils/tags.ts`).
5. После публикации страница появится на `/blog/<slug>/`, попадёт в архив
   `/blog/`, в категории `/category/<категория>/` и в каждый тег `/tag/<slug>/`.

### Связи между постами

- **«Читайте также»** генерируется автоматически в `BlogPost.astro`. Скоринг:
  совпадение тегов ×2, совпадение категорий ×1. Если хотите, чтобы определённые
  посты ссылались друг на друга — давайте им общие теги.
- **Внутренние ссылки** в теле статьи — относительные (`/blog/...`,
  `/category/...`, `/slovar/#тс-пиот`).

## Термин (коллекция `glossary`)

Создайте `src/content/glossary/<slug>.md`. Slug — латинский, дефис-разделённый
(используется в имени файла, не в URL — на URL идёт `termSlug` от `term`).

```yaml
---
term: "ТС ПИоТ"
aliases:
  - "техническое средство получения информации о товаре"
summary: "Краткое определение для DefinedTerm JSON-LD и SERP."
category: "ts-piot"   # необязательно: ts-piot, markirovka, zakonodatelstvo
relatedLinks:
  - label: "Категория: ТС ПИоТ"
    url: "/category/ts-piot/"
---

Тело — развёрнутое определение в Markdown. 1–2 абзаца.
```

После сборки термин появится на `/slovar/` под буквой первой Cyrillic-буквы
`term`. Якорь — `#<termSlug(term)>`. Сортировка алфавитная.

## Pillar-страница категории (коллекция `pillars`)

`src/content/pillars/<slug>.md`. Имя файла **должно совпадать** со slug
категории из `CATEGORIES` в `src/consts.ts`.

```yaml
---
title: "Заголовок pillar (если отличается от fullTitle категории)"
summary: "1–2 предложения для description в meta и hero-блока."
keyDates:
  - date: "28.12.2025"
    event: "Описание события."
faq:
  - question: "Вопрос?"
    answer: "Ответ."
---

Тело pillar в Markdown — 3–4 абзаца контекста: что это, кому, как и почему.
```

Что делает шаблон `category/[category].astro`:

1. Хлебные крошки и H1 (из `meta.fullTitle`).
2. Лид (`pillar.data.summary` или `meta.description`).
3. Тело pillar (`Content` из render).
4. Блок «Ключевые сроки» (если есть `keyDates`).
5. FAQ-аккордеон (если есть `faq`) + `FAQPage` JSON-LD.
6. Список постов категории (отсортированных по `pubDate desc`).

Если файла pillar нет — шаблон работает в fallback-режиме: показывает hero
из CATEGORIES и сразу список постов.

## Сценарий калькулятора штрафов

Файл `src/data/penalties.ts`, массив `SCENARIOS`. Это единственный источник:
страница `/kalkulyator-shtrafov/` рендерит form, список и FAQ из этого массива.

```ts
{
  id: 'unique-id',
  label: 'Что произошло (для select)',
  short: 'Краткое описание (для блока "Все учтённые сценарии")',
  article: 'ст. X.Y КоАП РФ',
  calc: {
    type: 'fixed',
    ip:    { min: 5000, max: 15000 },
    legal: { min: 50000, max: 300000 },
  },
  // или для процентного штрафа:
  // calc: {
  //   type: 'percent',
  //   ip:    { minPct: 25, maxPct: 50, floor: 10000 },
  //   legal: { minPct: 75, maxPct: 100, floor: 30000 },
  // },
  confiscation: true,        // показывает плашку «+ конфискация»
  note: 'Дополнительное пояснение под результатом.',
}
```

При обновлении сумм:

1. Сверьте с действующей редакцией КоАП на pravo.gov.ru.
2. Проверьте, не противоречите ли уже опубликованным постам:
   `grep -nE '14\.5|15\.12' src/content/blog/`. Если расходитесь —
   обновите соответствующие посты в одном коммите с калькулятором.

## Категория (новая)

Если действительно нужна **четвёртая** категория (а не сателлит существующей):

1. Добавьте запись в `CATEGORIES` (`src/consts.ts`):
   ```ts
   'new-slug': {
     title: 'Краткое имя',
     fullTitle: 'Полное имя для H1',
     description: 'Описание ...',
   },
   ```
2. Расширьте enum в `src/content.config.ts` для коллекций `pillars`
   (поле `category` пока не используется напрямую, но в `glossary`
   есть `category`-enum) и `glossary`.
3. Создайте `src/content/pillars/new-slug.md` с базовым intro/keyDates/FAQ.
4. По желанию — добавьте пункт в `NAV_LINKS`.
5. После сборки появится `/category/new-slug/`.

## Чего лучше не делать

- Не создавайте `<h1>` внутри тела статьи — он один на страницу, в шаблоне.
- Не указывайте абсолютные URL во внутренних ссылках — только относительные.
- Не дублируйте посты под близкие запросы — обновляйте существующие
  (`updatedDate` в frontmatter).
- Не правьте маршруты в `astro.config.mjs` — оставьте `trailingSlash: 'always'`.
