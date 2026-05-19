---
title: "Цели в Яндекс.Метрике для флагмана и калькуляторов Спринта A"
createdDate: "2026-05-19"
lastModified: "2026-05-19"
type: reference
status: draft
tags:
  - ts-piot
  - interactive
  - sprint-a
  - metrika
---

# Цели в Яндекс.Метрике для флагмана и калькуляторов Спринта A

> **Статус: автоматизировано через Management API**, 2026-05-19.
> Источник истины переехал в `src/data/metrika/goals.json`,
> синхронизатор — `scripts/metrika/sync-goals.mjs`, документация
> — `docs/metrika.md`. Чек-лист ниже сохранён как справочник:
> что именно отслеживаем и зачем.
>
> Чтобы цели появились на счётчике 109130279, нужно прописать
> `METRIKA_OAUTH_TOKEN` в секреты GitHub и запустить workflow
> `Metrika — Sync Goals` сначала в DRY_RUN, потом боевой.

## Флагман-симулятор `/kak-rabotaet-ts-piot/`

### Воронка «прошёл до конца»

- [ ] `flagship-ts-piot-step-0-reached` — открыл страницу
- [ ] `flagship-ts-piot-step-1-reached` — Шаг 1: DataMatrix
- [ ] `flagship-ts-piot-step-2-reached` — Шаг 2: модули кассы
- [ ] `flagship-ts-piot-step-3-reached` — Шаг 3: запрос в ЧЗ
- [ ] `flagship-ts-piot-step-4-reached` — Шаг 4: ответ от ЧЗ
- [ ] `flagship-ts-piot-step-5-reached` — Шаг 5: тег 1163/2106
- [ ] `flagship-ts-piot-step-6-reached` — Шаг 6: ОФД
- [ ] `flagship-ts-piot-step-7-reached` — Шаг 7: статус в ЧЗ
- [ ] `flagship-ts-piot-completed` — дочитал до конца

В Метрике из этих 9 целей можно собрать составной отчёт
«Воронка» — увидим, на каком шаге читатель уходит.

### Интеракции внутри шагов

- [ ] `flagship-ts-piot-dm-gtin-explored` — кликнул на GTIN в Шаге 1
- [ ] `flagship-ts-piot-dm-serial-explored` — кликнул на серийник
- [ ] `flagship-ts-piot-dm-gs-explored` — кликнул на GS-разделитель
- [ ] `flagship-ts-piot-dm-crypto-explored` — кликнул на криптохвост
- [ ] `flagship-ts-piot-offline-toggle` — переключил тогл «связь есть/нет» (Шаг 3)
- [ ] `flagship-ts-piot-error-branch-clicked` — выбрал ошибочную ветку (Шаг 4)
- [ ] `flagship-ts-piot-ffd-toggle` — переключил тогл «до/после 01.07.2026» (Шаг 5)
- [ ] `flagship-ts-piot-replay` — нажал «пройти ещё раз с ошибкой» (Шаг 7)

## Калькуляторы (вторичные артефакты Спринта A)

- [ ] `calc-usn-nds-used` — выполнен расчёт в калькуляторе НДС/УСН
  (статья `nalogi-msb-2026`)
- [ ] `calc-shtraf-markirovka-used` — выполнен расчёт штрафа
  (статья `shtraf-za-markirovku`)

## Журнал законов `/zakon-2026/`

- [ ] `zakon-2026-filter-used` — взаимодействие с фильтр-таймлайном

## Что проверить после создания

1. Открыть страницу с компонентом → совершить действие → в Метрике
   в режиме реального времени должна появиться галочка по цели.
2. Через сутки — в стандартных отчётах появится столбец с
   достижениями.
3. Через неделю — собрать «Воронку» по 9 шагам флагмана.

## Связано

- `src/utils/track.ts` — код, который шлёт события
- `src/content/wiki/flagship-ts-piot-simulator.md` — раздел
  «Аналитика» с обоснованием, какие цели зачем
