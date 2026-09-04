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
- **Контент.** Сколько статей, у скольких нет factcheck-маркера.
- **Конвейер.** Запас публикаций в днях: < 3 дней — красный, сайт
  вот-вот замолчит. Плюс черновики, заблокированные шлюзом качества.
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
| Написание статей (автопилот) | Routine на claude.ai/code, понедельник | `docs/autopilot.md` |
| Картинки к черновикам | `content-images-batch.yml`, push черновиков | `docs/autopilot.md` |
| Публикация (auto-publish) | `auto-publish.yml`, cron 4× в день | `docs/autopilot.md` |
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
| Статьи не выходят | `node scripts/content/queue-status.mjs` | Очередь черновиков пуста → запустить Routine «Этикетка — черновики» на claude.ai/code. Есть черновики, но они не выпускаются → смотреть `.claude/blocked/<slug>`: там причина отказа шлюза. `docs/autopilot.md` |
| Черновики есть, картинок нет | Actions → **Картинки — пакетный прогон** → logs | OPENROUTER_API_KEY есть? Баланс не кончился? Прогон можно запустить руками |
| Красные прогоны «pages build and deployment» на каждый коммит бота | Actions → «pages build and deployment» → шаг «Build with Jekyll» | В Settings → Pages источник стоит «Deploy from a branch»: GitHub гоняет Jekyll по исходникам и падает на frontmatter `.astro`. Переключить Source на «GitHub Actions» — сайт деплоит только `deploy-gh-pages.yml`. Пока не переключено, ничего не ломается, но каждый пуш шлёт письмо об ошибке |
| Workflow показывает прогоны с именем файла (`.github/workflows/x.yml`) и падает мгновенно на каждый push | Actions → этот прогон: логов нет | Файл workflow не парсится как YAML, cron никогда не сработает. Проверить локально: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/x.yml','utf8'))"`. Типичная причина — `${{ }}` внутри флоу-словаря `with: { ref: ${{ github.ref }} }`; писать блочным стилем |
| Routine отработала «успешно», а черновиков нет | `git log origin/main`, `src/content/wiki/autopilot-log.md`, стоимость прогона в карточке сессии | Так дважды выглядела одна и та же поломка: **в среде Routine нет рабочей копии репозитория**, сессия стартует в пустом каталоге и все команды задания падают. Проверить, что промпт начинается с шага 0 (`git clone … && cd`) — см. `docs/autopilot.md`. Признак именно этой поломки: прогон длинный и дорогой, а в репозитории нет ни коммитов, ни веток, ни PR. Бот-пуши в `main` не запускают деплой — сайт обновится по cron в 08:00 МСК |

## Регулярные ритуалы

| Когда | Что |
|---|---|
| Перед мержем PR | `node scripts/health-check.mjs` |
| Понедельник утром | Открыть `/dashboard/` — позиции и трафик за неделю |
| Раз в месяц | Проверить срок жизни Yandex OAuth-токенов в `docs/SECRETS.md` |
| Раз в месяц | Прочитать `src/content/wiki/autopilot-log.md` и выборочно 2–3 статьи, вышедшие автоматически |
| Раз в квартал | Архивировать выполненные задачи из `backlog.md`, прогнать `/maintain-content` |
