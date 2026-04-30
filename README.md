# Регламент.Бизнес

Информационный портал для малого и среднего бизнеса РФ. Тематика: ТС ПИоТ,
маркировка «Честный знак», изменения в законодательстве (налоги, ЭДО, КЭДО,
проверки).

Сайт построен на [Astro](https://astro.build), контент — Markdown/MDX.
Автоматизация подготовки статей реализована через Claude Code-агентов
(адаптированный шаблон [klaude-blog](https://github.com/nickwinder/klaude-blog))
с расширением [claude-blog](https://github.com/AgriciDaniel/claude-blog) —
20 дополнительных скиллов для аудита, AI-цитируемости и здоровья блога.

## Стек

- **Astro 5** (статическая генерация, MDX, sitemap, RSS).
- **TypeScript** для конфигов и компонентов.
- **Vercel** для деплоя (`vercel.json` сконфигурирован).
- **Claude Code** агенты в `.claude/agents/` и команды в `.claude/commands/`.

## Запуск

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # сборка в dist/
npm run preview  # просмотр собранной версии
```

## Структура

```
.claude/
  agents/        # research-specialist, content-writer, seo-optimizer, social-media-manager
  commands/      # /new-post, /research-topic, /optimize-seo, /content-pipeline и др.
  templates/     # шаблон поста
  research/      # research-брифы (gitignored)
  social/        # драфты постов в соцсети (gitignored)

~/.claude/skills/  # claude-blog: /blog write, analyze, geo, audit, factcheck и др. (глобальные)

src/
  components/    # BaseHead, Header, Footer, FormattedDate, HeaderLink
  content/
    blog/        # YYYY-MM-DD-slug.md
    wiki/        # контент-планы, заметки редакции
  consts.ts      # источник истины для брендинга и категорий
  layouts/       # BlogPost.astro
  pages/
    index.astro
    about.astro
    privacy.astro
    blog/[...slug].astro
    blog/index.astro
    category/[category].astro
  styles/global.css

public/
  robots.txt
  favicon.svg
  og-default.svg
```

## Создание новой статьи

1. Открой контент-план: `src/content/wiki/content-plan-2026.md`.
2. Запусти команду в Claude Code: `/new-post "<тема>"`.
3. Проверь факты: `/blog factcheck <файл>` — все цифры с confidence score.
4. Проверь AI-цитируемость: `/blog geo <файл>` — оценка под ChatGPT/Perplexity.
5. После снятия `draft: true` — коммит в feature-ветку.
6. Перед публикацией — `/optimize-seo post standard <slug>` для SEO-аудита.

См. также `CLAUDE.md` для подробных правил контента.

## SEO

Уже настроено:

- `<title>`, `<meta description>`, OG, Twitter Cards.
- JSON-LD `Organization`, `WebSite`, `Article`, `BreadcrumbList`.
- Sitemap по адресу `/sitemap-index.xml`.
- RSS-лента `/rss.xml`.
- `robots.txt` с указанием `Sitemap` и `Host`.

После деплоя:

1. Добавить сайт в [Яндекс.Вебмастер](https://webmaster.yandex.ru) и
   [Google Search Console](https://search.google.com/search-console).
2. Подать `sitemap-index.xml` в обе системы.
3. Подключить Яндекс.Метрику и Google Analytics 4.
4. Заполнить `<meta name="yandex-verification">` и `google-site-verification`
   в `src/components/BaseHead.astro` (placeholder уже подготовлен).

## Деплой

Конфиг `vercel.json` готов. После создания проекта в Vercel:

1. Привязать репозиторий GitHub.
2. Указать Production Branch.
3. Прописать домен `reglament-biznes.ru` (или ваш) и DNS-записи.
4. В `astro.config.mjs` и `src/consts.ts` поменять `site` на финальный URL.

## Лицензия

Шаблон основан на klaude-blog (MIT). Плагин claude-blog (MIT).
Контент — © Регламент.Бизнес.
