# Проверка среды Claude Code (04.09.2026)

Диагностика удалённой среды claude.ai/code: может ли она работать с
репозиторием `burbonivanovich-oss/TS_PIOT`.

## Рабочая копия

- Стартовый каталог сессии: `/home/user` — **пустой**, репозитория не было
  (`git remote -v` → `fatal: not a git repository`).
- Репозиторий подключён к сессии и склонирован вручную:
  `git clone --depth 1 https://github.com/burbonivanovich-oss/ts_piot /home/user/ts_piot`
  — **успешно**, 11 089 файлов, shallow (`--depth 1`).
- Путь рабочей копии: `/home/user/ts_piot`
- Клон сделан по адресу `.../ts_piot` (нижний регистр); GitHub отвечает
  редиректом `This repository moved` на канонический
  `https://github.com/burbonivanovich-oss/TS_PIOT.git`. На работу это не
  влияет — fetch и push проходят, но remote стоит поправить на канонический
  URL, чтобы убрать предупреждение.

## Git

```
$ git remote -v
origin	https://github.com/burbonivanovich-oss/ts_piot (fetch)
origin	https://github.com/burbonivanovich-oss/ts_piot (push)
```

- Ветка при клонировании: `main`
- Последний коммит: `9eb2d61 Аудит: что закрыто во второй заход и что осталось за владельцем (#64)`
- `git status` — чисто, изменений нет.
- Версия git: 2.43.0
- Идентичность коммитов: `Claude <noreply@anthropic.com>`

## Инструменты

- `node -v` → **v22.22.2**
- `npm -v` → 10.9.7
- `node scripts/content/plan-run.mjs --count=1 --json` — **работает**,
  без `npm install`. Выдал корректный JSON:
  `quota: 22`, `alreadyScheduled: 2`, `planPending: 136`,
  первый элемент — `2026-09-07-markirovka-tabaka-novye-proverki-2026`.

## Права на push

**Есть.** Пуш прошёл с первой попытки, без `git pull --rebase`:

```
$ git push -u origin claude/env-check-04-09
remote: This repository moved. Please use the new location:
remote:   https://github.com/burbonivanovich-oss/TS_PIOT.git
To https://github.com/burbonivanovich-oss/ts_piot
 * [new branch]      claude/env-check-04-09 -> claude/env-check-04-09
branch 'claude/env-check-04-09' set up to track 'origin/claude/env-check-04-09'.
PUSH_EXIT=0
```

Строки про `This repository moved` — не ошибка, а информационный редирект
(см. выше). Код возврата 0, ветка создана на origin.

## Вывод

Среда полностью работоспособна для этого репозитория: клон, чтение,
скрипты проекта на node и push в origin — всё доступно.

Единственная особенность: репозитория **нет** в стартовом каталоге сессии,
его нужно подключать и клонировать в начале каждой новой сессии
(`/home/user/ts_piot`). Клон shallow (`--depth 1`) — для `git log`, `blame`
или `bisect` понадобится `git fetch --depth=1000 origin main`.
