# Runbook: остановка, восстановление, смена владельца

Локальные процедуры для оператора. Host-specific команды (systemd, cron, каталоги
конкретного сервера) появятся в AP-P0-19/AP-P0-14. До тех пор все команды
запускаются из корня репозитория.

## 1. Остановить контур

1. Отключить расписание: cron/таймер scheduler'а **или** GitHub Actions —
   Actions → autopilot → «Disable workflow».
2. Дождаться завершения активного прохода: `node autopilot/scripts/run.mjs latest`.
   Пока стадия `gated` свежая, а процесс жив, новый запуск ждёт (lock).
3. Проверить, что никто не держит lock: `cat data/.autopilot.lock`.
   Если файла нет — контур остановлен.

Правило: **один мутирующий исполнитель**. Второй scheduler включается только
после отключения первого (шаг 6).

## 2. Диагностика состояния

```bash
node autopilot/scripts/state.mjs get          # слоты, карантин, темп
node autopilot/scripts/health-check.mjs       # согласованность writing/inFlight/orders
node autopilot/scripts/run.mjs latest         # последний проход и его стадии
node autopilot/scripts/preflight.mjs          # полный набор предпосылок
node autopilot/scripts/metrics.mjs            # почему темп не выполнен
```

## 3. Аварийное снятие блокировки

Только если владелец мёртв. Команда сама откажется, если процесс жив:

```bash
node autopilot/scripts/state.mjs unlock --force --by "$USER"
```

Событие пишется в `autopilot/data/lock-events.jsonl` (`force-unlock`). Если остался
`reap`-файл мёртвого перехватчика, `unlock` снимает и его.

## 4. Восстановить согласованность

Если health-check показал `writing без активного слота`:

```bash
node autopilot/scripts/backlog.mjs reconcile   # writing без слота → planned
node autopilot/scripts/health-check.mjs        # проверить, что blocker ушёл
```

`reconcile` не трогает активные слоты `state.inFlight` и выполняется под lock.

## 5. Резервная копия и откат

```bash
# Создать копию состояния (включая runs/), с манифестом sha256 и HEAD
node autopilot/scripts/backup.mjs create --from autopilot/data --to /backups/state-$(date -u +%Y%m%dT%H%M%SZ)

# Проверить копию
node autopilot/scripts/backup.mjs verify --backup <каталог>

# Восстановить в sandbox и убедиться, что файлы совпадают
node autopilot/scripts/backup.mjs restore --backup <каталог> --to /tmp/restore-data
```

Порядок отката контента и состояния:

1. Остановить контур (раздел 1).
2. Восстановить `autopilot/data/` из проверенной копии.
3. `git -C <contentRoot> log --oneline -5` — найти последний хороший коммит.
4. `git -C <contentRoot> revert <sha>` (не `reset --hard` на живом репозитории).
5. `node autopilot/scripts/preflight.mjs`, затем `node autopilot/scripts/health-check.mjs`.
6. Возобновить расписание.

Восстановление без выполненного `verify` не считается откатом.

## 6. Смена scheduler

1. Отключить старый scheduler, убедиться, что lock снят.
2. Включить новый (Codex automation / GitHub Actions — ровно один).
3. Проверить инвентарь: `autopilot/data/lock-events.jsonl` не должен содержать двух
   активных владельцев в одно время; `node autopilot/scripts/run.mjs list` — проходы не
   дублируются.
4. Прогнать один `plan` и один `settle`, сверить `autopilot/data/report-<дата>.json`.

## 7. Уведомления

```bash
node autopilot/scripts/notify.mjs            # решение: молчать/сообщить/recovery
```

Уведомление отправляется только при новом или изменившемся отказе и при
восстановлении; повтор одного и того же состояния молчит.

## 8. Что оператор делает руками

- Меняет пороги в `config/autopilot.config.json` (каждый ключ проверяется схемой).
- Дополняет `autopilot/data/seeds.json`, когда `refill` добавил 0 тем.
- Разбирает карантин: `node autopilot/scripts/state.mjs get`; вернуть тему в работу нельзя,
  пока она в карантине — решение принимается изменением seeds/порогов.
- Реагирует на остановку: конфиг сломан, корпус недоступен, карантин > 10,
  норма недостижима третий проход подряд.
