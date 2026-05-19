# Open Graph для Telegram

Telegram использует Open Graph для генерации превью при шеринге ссылок.
Если превью не появляется или показывает только URL без картинки —
причина обычно в одной из шести типовых ошибок.

## Что должно быть в `<head>` (есть в `src/components/BaseHead.astro`)

| Тег | Значение | Telegram-требование |
|---|---|---|
| `og:type` | `website` или `article` | обязателен |
| `og:title` | до 70 символов | обязателен |
| `og:description` | 140–160 символов | желателен |
| `og:url` | абсолютный URL | обязателен |
| `og:image` | абсолютный URL, PNG/JPG/WEBP | **обязателен, НЕ SVG** |
| `og:image:secure_url` | то же что og:image | желателен |
| `og:image:type` | `image/png`, `image/jpeg`, `image/webp` | желателен |
| `og:image:width` | 1200 | желателен |
| `og:image:height` | 630 | желателен |
| `og:image:alt` | краткое описание | желателен |

## Известные подводные камни

1. **SVG не работает.** До 2026-05-19 у нас `og-default.svg` стоял
   дефолтом — Telegram игнорировал. Заменён на `og-default.png`.
2. **Image must be ≥ 250×250 и ≤ 5 MB.** Наши Satori-PNG 1200×630
   укладываются.
3. **HTTPS обязателен.** На локалке (`http://localhost:4321`) превью не
   проверишь — деплоить на etiketka.media.
4. **Кеш Telegram.** После первой проверки TG кеширует превью на ~6 часов.
   Для повторной проверки — добавить `?v=2` в URL или подождать.
5. **og:image должен быть доступен без cookies/auth.** Проверь что
   `/og-default.png` и `/og/<slug>.png` отвечают 200 без редиректов.
6. **Twitter Card.** TG читает `summary_large_image` как дополнение
   к OG. Не помешает (есть в BaseHead).

## Как проверить

### Через `@WebpageBot` в самом Telegram

1. Открыть [@WebpageBot](https://t.me/WebpageBot) в Telegram.
2. Прислать ему ссылку: `https://etiketka.media/blog/<slug>/`
3. Бот ответит структурированно: «Title», «Description», «Image» —
   видно сразу, что подхватилось.

### Через chat preview (без бота)

1. Открыть любой чат (можно «Saved Messages»).
2. Вставить ссылку, **не отправлять**. TG покажет preview под полем ввода.
3. Если preview не появляется — что-то не так с мета-тегами или og:image.

### Через curl + facebook OG parser

```bash
curl -s "https://etiketka.media/blog/<slug>/" | \
  grep -Eo '<meta property="og:[^"]+" content="[^"]+"'
```

Должны быть все теги из таблицы выше.

### Через opengraph.xyz

[opengraph.xyz](https://www.opengraph.xyz/) — визуально показывает превью
для TG, FB, LinkedIn, Twitter в одном окне.

## Где смотреть на сайте

* `src/components/BaseHead.astro` — глобальные OG-теги.
* `src/layouts/BlogPost.astro` — переопределение для блог-статей
  (`heroImage` либо автоген `/og/<slug>.png`).
* `src/pages/og/[slug].png.ts` — Satori генератор PNG 1200×630.
* `public/og-default.png` — fallback для не-блог страниц.
* `public/og-backgrounds/` — категорийные фоны для Satori.

## Чек-лист перед публикацией статьи

- [ ] `heroImage` существует ИЛИ `/og/<slug>.png` отвечает 200
- [ ] og:image не SVG (только PNG/JPG/WEBP)
- [ ] og:title до 70 символов
- [ ] og:description в районе 140–160
- [ ] При вставке ссылки в @WebpageBot превью корректное

Если что-то из этого не выполняется — `/analyze-article` в категории
«Техника» снизит балл.
