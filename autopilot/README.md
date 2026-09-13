# Автопилот — автономный контент-контур

Производит контент без согласований: сам выбирает темы, отсекает дубли, пишет,
переписывает старое и держит перелинковку. Цель — **200 статей в месяц**.

Переработка `K_Editor`: там цикл шёл через редактора в Google Drive и упирался
в скорость вычитки (~26 статей в месяц). Здесь человеческие шлюзы заменены
детерминированными гейтами — см. таблицу отличий в [AGENTS.md](AGENTS.md).

## Запуск

```bash
node autopilot/scripts/health-check.mjs      # состояние контура, начинать отсюда
```

Один суточный проход:

```bash
node autopilot/scripts/pipeline.mjs plan     # наряды на день → data/orders.json
# написание статей по нарядам — /auto-write и /auto-rewrite
node autopilot/scripts/pipeline.mjs settle   # гейты, публикация, перелинковка, счётчики
```

Отдельные подсистемы:

```bash
node autopilot/scripts/preflight.mjs                   # обязательная проверка перед мутацией
node autopilot/scripts/backlog.mjs refill              # пополнить очередь тем
node autopilot/scripts/dedupe.mjs check --title "..."  # проверить тему на дубль
node autopilot/scripts/dedupe.mjs scan                 # взаимные дубли корпуса
node autopilot/scripts/rewrite-queue.mjs build         # что переписывать
node autopilot/scripts/interlink.mjs graph             # сироты и тупики
node autopilot/scripts/interlink.mjs apply             # расставить ссылки
node autopilot/scripts/gates.mjs check --slug <slug>   # проверить статью
node autopilot/scripts/source-check.mjs status         # свежесть evidence первоисточников
node autopilot/scripts/metrics.mjs                     # почему темп не выполнен
node autopilot/scripts/run.mjs latest                  # стадии последнего прохода
node autopilot/scripts/notify.mjs                      # нужно ли уведомление
node autopilot/scripts/backup.mjs create --from data --to <dir>  # копия состояния
node autopilot/scripts/state.mjs get                   # слоты, карантин, темп
npm test
```

Остановка, аварийное снятие блокировки, восстановление и смена scheduler —
в [docs/runbook.md](docs/runbook.md).

## Настройка

`autopilot/config/autopilot.config.json` — единственное место с порогами и нормами:

```jsonc
{
  "contentRoot": "..",             // корень сайта TS_PIOT (родитель autopilot/)
  "security": {
    "strictContentRoot": true,     // запрет писать в чужой checkout (AP-P0-04)
    "expectedRemote": "TS_PIOT",
    "allowedBranches": ["main", "codex/*", "autopilot/*"],
    "buildCheck": true             // перед публикацией собирать сайт (AP-P0-16)
  },
  "throughput": { "monthlyTarget": 200, "maxParallelWriting": 8 },
  "mix": { "new": 0.75, "rewrite": 0.25 },
  "dedupe": { "containmentBlock": 0.72, "keywordOverlapBlock": 0.7 },
  "gates": { "minScore": 70, "requireFactcheck": true },
  "publish": { "autoPublish": true }
}
```

`contentRoot` указывает на корень сайта; данные движка лежат в `autopilot/data`.
Путь к контенту можно переопределить переменной `CONTENT_ROOT`, но в production
`strictContentRoot` отвергнет чужой checkout. Для песочницы нужен отдельный
конфиг без strict:

```bash
AUTOPILOT_CONFIG=/tmp/sandbox.config.json CONTENT_ROOT=/tmp/sandbox node autopilot/scripts/interlink.mjs apply --dry
```

`autopilot/data/seeds.json` — сущности, намерения, сегменты аудитории и календарь НПА.
Из них генератор собирает темы. Когда бэклог перестаёт пополняться, дополнять
нужно этот файл.

## Первый запуск на новом проекте

1. Указать `contentRoot` в конфиге.
2. `node autopilot/scripts/health-check.mjs` — убедиться, что корпус читается.
3. `node autopilot/scripts/dedupe.mjs scan` — увидеть, что уже пересекается.
4. `node autopilot/scripts/interlink.mjs apply --dry` — посмотреть, что движок хочет
   вставить, до того как он это сделает.
5. `node autopilot/scripts/backlog.mjs refill` — наполнить очередь тем.
6. `node autopilot/scripts/pipeline.mjs plan` — первые наряды.
7. Поставить рутины на расписание (см. [AGENTS.md](AGENTS.md)).

## Документация

| Файл | Что внутри |
|---|---|
| [AGENTS.md](AGENTS.md) | Источник правды: принципы, архитектура, рутины, отличия от Editor |
| [docs/operations.md](docs/operations.md) | Что делать, когда сломалось |
| [docs/runbook.md](docs/runbook.md) | Остановка, lock, backup/restore, смена scheduler |
| [docs/decisions.md](docs/decisions.md) | Почему пороги и правила именно такие |
| `.agents/skills/` | Процедуры Codex: `auto-day`, `auto-write`, `auto-rewrite`, `auto-audit` |

## Требования

Node.js ≥ 20. Зависимостей нет и не должно появиться: контур обязан
запускаться в любом раннере без установки пакетов.
