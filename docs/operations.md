# Операционная карта проекта

Этот файл — единая точка входа когда непонятно, что с проектом
происходит. Запустил утилиту → видишь, что в порядке, а где
горит. Дальше — по ссылкам в более детальную документацию.

## Ежедневная проверка состояния

```bash
node scripts/health-check.mjs
```

Проходит по 15+ ключевым проверкам и выдаёт цветной отчёт:
- ✓ зелёный — всё штатно
- ⚠ жёлтый — внимание, не критично
- ✗ красный — нужно чинить

Что проверяется:
- **Контент.** Сколько статей, сколько черновиков, сколько с
  будущим pubDate, у скольких нет factcheck-маркера.
- **Соцпосты.** Покрытие блог-статей черновиками для Telegram/
  VK/Дзен. Если пропуски > 10% — fail.
- **Workflows.** Все ли упомянутые в workflow скрипты реально
  существуют (битые ссылки = красный).
- **Билд.** `npm run build` проходит чисто?
- **Sitemap.** Нет ли утечки будущих статей в sitemap (это давало
  404 в GSC).
- **Метрика.** Сколько целей в `goals.json`. Лимит 200, при 180+
  — предупреждение.
- **ОРД.** У всех креативов в `ord-config.json` есть erid?
- **Hero-картинки.** WebP-версии есть для всех JPG?
- **Документация.** На месте ли ключевые `docs/*.md`?

JSON-вывод для пайплайнов:
```bash
node scripts/health-check.mjs --json
```

Strict-режим для CI (exit 1 при любом красном):
```bash
node scripts/health-check.mjs --strict
```

## Карта систем

| Подсистема | Где запускается | Документация |
|---|---|---|
| Публикация (auto-publish) | `auto-publish.yml`, cron 4× в день | `CLAUDE.md` Workflow |
| Деплой | `deploy-gh-pages.yml` | `docs/architecture.md` |
| Hero-картинки | `generate-hero-images.yml`, ручной | `docs/images.md` |
| Hero-backfill | `hero-backfill-daily.yml`, cron 00:00 МСК | `docs/images.md` |
| OG-фоны | `generate-og-backgrounds.yml`, ручной | `docs/images.md` |
| Иллюстрации флагмана | `generate-flagship-illustrations.yml`, ручной | `docs/images.md` |
| Wordstat (тренды ключей) | `wordstat-weekly.yml`, cron понедельник | `docs/wordstat.md` |
| Аналитика (GSC/Метрика/Вебмастер) | `analytics-refresh.yml`, cron понедельник | `docs/analytics.md` |
| Цели Метрики | `metrika-sync-goals.yml`, push на goals.json | `docs/metrika.md` |
| Индексация (IndexNow + Google) | `index-notify.yml`, после деплоя | `docs/analytics.md` |
| Соцпосты → Google Docs | `social-to-docs.yml`, push на social/ | `docs/SECRETS.md` GOOGLE_DOCS_KEY |
| ОРД-креативы | `ord-sync.yml`, push на ord-config.json | `src/content/wiki/cpa-products.md` |
| Embeddings (similarity) | `embeddings-monthly.yml`, cron 1 числа | `docs/architecture.md` |

## Карта команд (slash-skills)

| Команда | Что делает | Когда |
|---|---|---|
| `/plan-content` | Контент-план + календарь | Раз в месяц |
| `/find-topics` | Темы из Wordstat-diff и пробелов | Перед новым материалом |
| `/create-article <тема>` | Полный цикл draft с гейтами | Каждая новая статья |
| `/factcheck <slug>` | Проверка фактов в одной статье | Перед `draft: false` |
| `/factcheck-batch` | Пакетная проверка 8–16 статей | Раз в неделю/при добавлении пачки |
| `/analyze-article <slug>` | Финальная оценка 0–100 | В `/release-article` |
| `/release-article <slug>` | Публикация: гейты, перелинковка, соцпосты, индексация | Когда статья готова |
| `/maintain-content` | Аудит и обновление старых статей | Раз в неделю |
| `/check-ai <slug>` | Детектор AI-маркеров | По подозрению |

Подробнее по каждой команде — `.claude/commands/*.md` и
`docs/tools.md` раздел «QA-инструментарий».

## Pre-commit гейты (локально)

При `git commit` срабатывают:
1. **factcheck-guard** — статья с `draft: false` должна иметь
   маркер `.claude/factchecked/<slug>`
2. **social-guard** — статья с `draft: false` должна иметь
   соцпосты в `src/content/wiki/social/<slug>.md` или
   `src/content/social/<slug>-social.md`

Установка хуков (один раз):
```bash
bash scripts/git-hooks/install.sh
```

Bypass (срочные правки):
```bash
SKIP_FACTCHECK_GUARD=1 git commit ...
SKIP_SOCIAL_GUARD=1 git commit ...
```

## Если что-то горит

| Симптом | Куда смотреть | Что делать |
|---|---|---|
| Билд упал в GitHub Actions | Actions → последний прогон → logs | Локально `npm run build`, поправить ошибку |
| Workflow не запустился | Actions → таб конкретного workflow → история | Триггер настроен? Секреты заполнены? |
| 401/403 в analytics-refresh | logs последнего прогона | OAuth токен Yandex истёк (раз в год). `docs/SECRETS.md` |
| 404 на новых URL в GSC | dist/sitemap.xml | Утечка future статей? Прогнать `health-check.mjs` |
| Соцпосты не появились в Google Docs | logs `social-to-docs.yml` | Папка расшарена с service-account? `docs/SECRETS.md` |
| Hero-картинка не сгенерилась | logs `auto-publish.yml` или `hero-backfill-daily.yml` | OPENROUTER_API_KEY есть? Баланс не кончился? |
| Cron перестал срабатывать | Actions → конкретный workflow → история | GitHub отключает cron при отсутствии активности 60 дней. Любой push в main возобновляет |

## Регулярные ритуалы

| Когда | Что |
|---|---|
| Перед мержем PR | `node scripts/health-check.mjs` |
| Понедельник утром | Открыть `/dashboard/` — позиции и трафик за неделю |
| Раз в месяц | Проверить срок жизни Yandex OAuth-токенов в `docs/SECRETS.md` |
| Раз в квартал | Архивировать выполненные задачи из `backlog.md`, прогнать `/maintain-content` |
