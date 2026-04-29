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

## Возможности и ограничения Satori

Satori поддерживает ограниченное подмножество CSS. Скрипт
`scripts/explore-satori.mjs` генерирует PNG-превью для всех шаблонов без
полного Astro-билда — запускайте его при итерации над дизайном.

**Поддерживается:**
- `display:flex` (flexbox целиком: direction, align, justify, gap, flex:1, wrap, shrink)
- `backgroundImage`: `linear-gradient`, `radial-gradient`, `repeating-linear-gradient`
- `backgroundImage`: `url(data:image/png;base64,...)` — data URI для растровых фонов
- `borderRadius`, `border` (color, width, style)
- `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight`, `textTransform`
- `color`, `backgroundColor`, `opacity`
- `padding`, `margin`, `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`
- `writingMode` (вертикальный текст — `vertical-rl`)
- `img` с `src` в виде data URI или внешнего https-URL

**Не поддерживается:**
- `boxShadow` (игнорируется без ошибки)
- `display:grid`
- `position: absolute/fixed` (поддержка ограничена)
- `clip-path`, `filter`, `backdropFilter`
- `textOverflow: ellipsis` — обрезку делайте в JS до передачи строки
- `@font-face` — шрифты только через API `fonts` в опциях Satori

## AI-фоны для обложек

Наиболее выразительный способ улучшить обложки — использовать нейросетевой
фон под каждую категорию. Satori принимает base64 data URI в `backgroundImage`,
поэтому схема простая:

1. Сгенерируйте PNG-фоны (1200×630 или 16:9) в любом инструменте.
2. Сохраните как `public/og-backgrounds/<категория>.png`:
   - `ts-piot.png` — синяя тема
   - `markirovka.png` — зелёная тема
   - `zakonodatelstvo.png` — янтарная тема
3. В `src/pages/og/[slug].png.ts` загрузите и подставьте:

```ts
const bgPath = `./public/og-backgrounds/${cat}.png`;
const bgDataUri = fs.existsSync(bgPath)
  ? `data:image/png;base64,${fs.readFileSync(bgPath).toString('base64')}`
  : null;

// В разметке — фон + полупрозрачный оверлей для читаемости текста:
// background: bgDataUri ? `url(${bgDataUri})` : '#0d0d0d'
// Поверх — div с background: rgba(0,0,0,0.65)
```

### Инструменты для генерации фонов

| Инструмент | Доступ | Примечание |
|---|---|---|
| Gemini Imagen 4 | Платный API (ai.dev) | Скрипт готов: `scripts/generate-og-backgrounds.mjs` |
| Midjourney | Discord-подписка | Экспортировать как PNG 1280×720+ |
| ChatGPT / DALL-E 3 | Платный OpenAI | «dark abstract texture, no text, 16:9» |
| Stable Diffusion | Локально / бесплатно | ComfyUI или Automatic1111 |

**Советы по промптам** (для любого генератора):
```
Dark abstract [blue/green/amber] texture background, very low contrast,
subtle [circuit lines / data matrix fragments / marble texture],
photorealistic, 16:9, no text, no people, no logos,
suitable as overlay background for white typography
```

### Gemini API (ключ уже настроен)

`GEMINI_API_KEY` задан в `.claude/settings.local.json` (не в git).
Текстовые модели (`gemini-2.5-flash`, `gemini-2.0-flash`) работают на free tier.
Imagen 4 и Flash Image (генерация картинок) требуют платного тарифа.

Для генерации фонов через Gemini после апгрейда:
```bash
node scripts/generate-og-backgrounds.mjs
```

## Превью без полного билда

```bash
node scripts/preview-og.mjs         # текущий шаблон, 4 варианта
node scripts/explore-satori.mjs     # 6 альтернативных шаблонов
```

Результаты сохраняются в `scripts/og-previews/` (в git не попадают).

## Тестирование через Astro-билд

```bash
npm run build
open dist/og/<slug>.png   # любой пост; на Linux — xdg-open
```

Если PNG почти пустой / без текста / показывает «NO GLYPH» — проверьте
порядок шрифтов в `fonts`-массиве и `font-family` в шаблоне.
