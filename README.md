# Пайплайн статьи «от идеи до статьи»

Эта ветка — **изолированный блок контент-пайплайна** проекта «Этикетка»,
вынесенный из основного репозитория. Здесь остаётся только то, что отвечает
за работу над статьёй: от идеи и планирования до готового черновика,
факт-чека, публикации и последующего аудита. Presentation-слой сайта
(Astro-страницы, компоненты, layouts, стили, публичные ассеты, сборка) удалён.

Полные правила контента, стиля и frontmatter — в `CLAUDE.md` и `docs/`.

## Четыре процесса

Пайплайн разбит на четыре последовательных процесса. Каждый — отдельная
slash-команда в `.claude/commands/`.

| # | Процесс | Команда | Что делает |
|---|---|---|---|
| 1 | Планирование | `/plan-content` | Мониторинг новостей, анализ пробелов, приоритеты, обновление контент-плана и календаря |
| 2 | Создание | `/create-article` | Полный цикл создания статьи со шлюзами качества — от темы до готового черновика (`draft: true`) |
| 3 | Публикация | `/release-article` | Перелинковка, выпуск, соцсети, индексация |
| 4 | Аудит | `/maintain-content` | Периодическая проверка актуальности опубликованных статей |

## Состав блока

```
.claude/
├── commands/        # 21 slash-команда: планирование, создание, QA, публикация, аудит
├── agents/          # research-specialist → content-writer → seo-optimizer → social-media-manager
├── templates/       # шаблоны, используемые командами
├── research/        # research-brief'ы (артефакты /create-article)
├── social/          # соц-черновики
└── factchecked/     # маркеры пройденного факт-чека
docs/                # операционные инструкции пайплайна (content-rules, tools, factcheck, editorial-policy, …)
scripts/             # автоматизация: factcheck, audit, wordstat, analytics, metrika, генерация изображений, git-hooks
src/
├── content/         # контент, над которым работает пайплайн (blog, pillars, glossary, wiki)
├── data/            # данные пайплайна (factcheck sources, wordstat, analytics, audit)
├── consts.ts        # SITE_TITLE, NAV_LINKS, CATEGORIES — источник истины
└── content.config.ts# схемы коллекций контента
.github/workflows/   # авто-публикация, weekly Wordstat, аналитика, генерация hero, индексация, ОРД
CLAUDE.md            # правила проекта и workflow создания статьи
```

## Ключевые команды и агенты

**Идея → тема**
- `/find-topics`, `/plan-content`, `/research-topic`, `/content-calendar`,
  `/cluster-gaps`, `/demand-watch`, `/monitor-rss`, `/monitor-competitors`

**Тема → черновик**
- `/create-article` (со шлюзами) или `/new-post` (быстрый черновик)
- Агенты: `research-specialist` → `content-writer` → `seo-optimizer` → `social-media-manager`

**Черновик → качество**
- `/factcheck`, `/factcheck-batch`, `/analyze-article`, `/check-ai`, `/optimize-seo`

**Черновик → публикация → аудит**
- `/release-article`, затем `/maintain-content`

## Workflow (кратко)

1. Тема — из контент-плана (`src/content/wiki/content-plan-2026.md`) или из
   weekly Wordstat diff через `/find-topics`.
2. `/create-article "<тема>"` — пайплайн research → writer → seo → social со
   шлюзами качества. Результат: `src/content/blog/YYYY-MM-DD-slug.md`,
   `draft: true`.
3. `/factcheck <slug>` и `/analyze-article <slug>` — проверки перед выпуском.
4. `/release-article <slug>` — публикация, перелинковка, соцсети, индексация.
5. `/maintain-content` — периодический аудит опубликованного.

Подробности — в `CLAUDE.md` (раздел «Workflow создания статьи») и `docs/tools.md`.
