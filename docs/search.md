# Поиск: Pagefind

Статический поисковый индекс, собирается после `astro build`. Без бэкенда —
работает на любом статическом хостинге.

## Команды

В `package.json`:

```json
"build": "astro build && pagefind --site dist"
```

После сборки Pagefind создаёт:

- `dist/pagefind/pagefind-ui.js` и `pagefind-ui.css` — UI-виджет
- `dist/pagefind/pagefind.js` — runtime-API
- `dist/pagefind/index/` и `dist/pagefind/fragment/` — индексы и фрагменты

Vercel кэширует эти ассеты как иммутабельные (см. `vercel.json`).

## Что попадает в индекс

Pagefind переходит в режим «индексировать только элементы с
`data-pagefind-body`», как только хотя бы одна страница помечена этим
атрибутом. У нас он стоит на `<article>` в `src/layouts/BlogPost.astro` —
поэтому **в выдаче только посты**, а не категории, теги, словарь или
калькулятор.

В каждой статье дополнительно помечены `data-pagefind-ignore`:

- блок навигации (хлебные крошки)
- aside «Читайте также»

Это нужно, чтобы заголовки соседних статей не попадали в результаты как
текст текущей.

### Как добавить тип в индекс

Если вы хотите, чтобы термины глоссария или pillar-страницы тоже находились:

1. В `src/pages/slovar/index.astro` (или `category/[category].astro`)
   добавьте `data-pagefind-body` на основной контейнер контента.
2. Пересоберите. Pagefind проиндексирует и эти страницы.
3. По желанию — добавьте `data-pagefind-meta="type:..."` для фильтрации
   результатов по типу.

## Страница поиска `/search/`

Файл `src/pages/search.astro`. Подключает `pagefind-ui.js` через
`<script src="/pagefind/pagefind-ui.js" is:inline>`, инициализирует
`PagefindUI` с русскими переводами.

### Поддержка `?q=...`

После инициализации UI проверяет URL:

```js
const params = new URLSearchParams(window.location.search);
const q = params.get('q');
if (q) ui.triggerSearch(q);
```

Это совместимо с `WebSite.SearchAction` JSON-LD (см. `BaseHead.astro`),
который заявлен поисковикам через `target: "/search/?q={search_term_string}"`.

### Кастомные стили

CSS-переменные UI заданы в `<style>` страницы:

```css
.search-widget {
  --pagefind-ui-primary: var(--accent);
  --pagefind-ui-text: rgb(var(--gray-dark));
  --pagefind-ui-background: #fff;
  --pagefind-ui-border: rgb(var(--gray-light));
  --pagefind-ui-tag: var(--accent-soft);
  --pagefind-ui-border-radius: 10px;
  ...
}
```

Полный список переменных — в [Pagefind UI Styling](https://pagefind.app/docs/ui/#customising-the-styles).

## Как добавить фильтры по категории

Pagefind поддерживает фильтры через `data-pagefind-filter`. Чтобы добавить
фильтр по категории постов:

1. В `BlogPost.astro` рядом с `<article data-pagefind-body>` добавьте,
   например, скрытый span:

   ```astro
   <span data-pagefind-filter="Категория" hidden>{categoryMeta?.title}</span>
   ```

2. В `search.astro` в `PagefindUI` опциях:

   ```js
   showFilters: true,
   filters: ['Категория'],
   ```

3. Пересоберите — в UI появится сайдбар с фильтрами.

## Когда индекс не обновляется

Если запустили `astro build` напрямую (без Pagefind), `dist/pagefind/`
останется от предыдущей сборки или будет пустым. Признаки:

- На `/search/` ничего не находится.
- В консоли браузера: `PagefindUI not defined` или `Failed to fetch /pagefind/pagefind.js`.

Решение — `npm run build` (выполнит обе команды).

## Локальная отладка

```bash
npm run build
npm run preview      # http://localhost:4321/search/
```

`astro dev` Pagefind не обслуживает (индекс существует только после билда).
Для проверки поиска используйте `preview` после `build`.
