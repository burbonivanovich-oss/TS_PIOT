# OG-картинки: автогенерация через Satori + Resvg

Каждая статья получает уникальную обложку 1200×630 px, генерируемую на
этапе сборки. Файл логики — `src/pages/og/[slug].png.ts`.

## Как это работает

1. `getStaticPaths` обходит коллекцию `blog` (только `draft: false`) и
   для каждого поста создаёт endpoint `/og/<id>.png`.
2. `GET` собирает HTML-разметку обложки, передаёт в Satori — получает SVG.
3. SVG конвертируется в PNG через `@resvg/resvg-js` (нативный Rust-бинарь).
4. PNG возвращается как `Response` с `Content-Type: image/png` и
   `Cache-Control: public, max-age=31536000, immutable`.
5. В `BlogPost.astro` используется как fallback, если у поста нет
   `heroImage` в frontmatter:

   ```ts
   const ogImage = heroImage ?? (currentSlug ? `/og/${currentSlug}.png` : undefined);
   ```

Vercel дополнительно кэширует `/pagefind/*` (см. `vercel.json`); для `/og/*`
Cache-Control приходит из самого Response.

## Шрифты

Главное и неочевидное: один шрифт-subset не покрывает кириллицу + латиницу +
пунктуацию. Поэтому в `fonts` Satori передаются **три набора с разными
именами**, чтобы движок умел fallback'ить:

| Имя для Satori | Файл | Что покрывает |
|---|---|---|
| `InterCyr` | `public/fonts/inter-regular.woff` (cyrillic subset) | а-я, А-Я |
| `InterLat` | `public/fonts/inter-latin-regular.woff` | a-z, 0-9, ASCII пунктуация |
| `InterLatExt` | `public/fonts/inter-latin-ext-regular.woff` | «», —, ё и пр. диакритика |

В CSS `font-family: 'InterCyr', 'InterLat', 'InterLatExt'`. Satori сначала
ищет глиф в первом, не находит — идёт во второй и т.д.

Если бы все шрифты имели одно имя `Inter`, Satori брал бы только первый и
выводил `NO GLYPH` для всех остальных символов.

### Откуда берутся файлы

При установке `@fontsource/inter` файлы копируются в `public/fonts/` командами:

```bash
cp node_modules/@fontsource/inter/files/inter-cyrillic-400-normal.woff public/fonts/inter-regular.woff
cp node_modules/@fontsource/inter/files/inter-cyrillic-700-normal.woff public/fonts/inter-bold.woff
cp node_modules/@fontsource/inter/files/inter-latin-400-normal.woff public/fonts/inter-latin-regular.woff
cp node_modules/@fontsource/inter/files/inter-latin-700-normal.woff public/fonts/inter-latin-bold.woff
cp node_modules/@fontsource/inter/files/inter-latin-ext-400-normal.woff public/fonts/inter-latin-ext-regular.woff
cp node_modules/@fontsource/inter/files/inter-latin-ext-700-normal.woff public/fonts/inter-latin-ext-bold.woff
```

Файлы в репозитории — копии, не симлинки. При смене шрифта обновите все шесть.

## Шаблон обложки

Markup собирается как **строка** через интерполяцию, потом передаётся в
`html(string)` (функция `satori-html`):

```ts
const markupString = `
  <div style="display:flex; flex-direction:column; height:100%; width:100%; ...">
    ...
  </div>
`;
const markup = html(markupString);
```

**Важно для Satori:**

- Каждый элемент с двумя и более детьми обязан иметь `display:flex` (или
  `display:grid`). Без этого Satori выбрасывает ошибку.
- Не используйте `html` как tagged template literal с интерполяцией HTML
  внутри — `${"<div>...</div>"}` экранируется и попадает в картинку как
  буквальный текст. Собирайте строку, потом парсите.
- Все строки нужно экранировать (HTML entities) — есть утилита `escapeHtml`
  внутри файла.

## Когда добавляют OG для категорий и тегов

Сейчас OG генерируется **только для постов**. Для категорий и тегов в
`og:image` подставляется `/og-default.svg` (через `BaseHead.astro`).

Если нужна автогенерация для других типов:

1. Создайте `src/pages/og/category-[category].png.ts` или
   `src/pages/og/tag-[tag].png.ts`.
2. В соответствующем шаблоне страницы (`category/[category].astro`,
   `tag/[tag].astro`) передавайте в `<BaseHead image={...} />` ссылку
   на нужный endpoint.
3. Учитывайте, что для тегов URL содержит кириллицу — Astro построит
   путь правильно, но при ссылке в `og:image` нужен `encodeURIComponent`.

## Тестирование локально

```bash
npm run build
open dist/og/<slug>.png   # любой пост; на Linux — xdg-open
```

Если PNG почти пустой / без текста / показывает «NO GLYPH» — проверьте
порядок шрифтов в `fonts`-массиве и `font-family` в шаблоне.
