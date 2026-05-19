# Changelog

## 2026-05-19 — Backfill factcheck до 100% + жёсткий gate против фейковых НПА

29 коммитов на ветке `claude/review-backlog-1oz82`. Подробный разбор —
[`docs/session-2026-05-19-postmortem.md`](./docs/session-2026-05-19-postmortem.md).

### Контент

* **Factcheck покрытие 8 → 83/83 (100%).** 18 параллельных батчей,
  пойманы 12 фейковых НПА (5 ПП, 1 распоряжение, 3 ФЗ, ложная атрибуция
  приказа, отменённый ПП, реальный номер не той нормы), исправлено 70+
  системных ошибок фактологии (НДС 22%, лимиты УСН/ПСН, ст. 15.12 ч. 2 КоАП,
  ФСРАР → РАТК, маркировка кег с 01.04.2023 и др.).
  См. [`docs/factcheck-history.md`](./docs/factcheck-history.md).
* **reviewDate проставлен в 67 статьях** (pubDate + 90 дней, синхрон с
  quarterly re-factcheck).
* **Pillar-страницы ссылаются на 46 weak-статей** (1 входящая → 2+).
  До правок ни один pillar не содержал ссылок на блог.
* **0 сирот** в linkgraph (61 → 0): часть закрылась после фикса битых
  ссылок (#60), остальное — точечные вставки в донорах.

### Пайплайн

* **`research-specialist` обязателен для тем с НПА** (категории
  `ts-piot`, `markirovka`, `zakonodatelstvo`, `kkt`, `egais`).
  Поводом — 12 фейковых НПА за сессию. `/create-article` Стадия 1
  не запустит writer без research-brief'а с
  `frontmatter.sources[].verified=true`.
* **`content-writer` имеет правило про whitelist:** запрещено
  генерировать номера НПА из памяти; разрешено только из
  `brief.sources[]` + `sources.json.npaWhitelist`.
* **`extract-claims.mjs` расширен** типами `NPA_UK`, `NPA_NK`,
  `NPA_PP_NUMBERED`, `NPA_PRIKAZ`.
* **`audit-npa-references.mjs`** (новый) — регрессионный аудит против
  whitelist, флаг `--strict` для CI. Прогон в `/create-article` Стадия 3
  до запуска `/factcheck`.
* **`sources.json` v2** с whitelist'ом: 14 ФЗ + 11 ПП + 5 Приказов +
  1 Распоряжение + ст. КоАП/УК.
* **Embeddings (Jina v3 multilingual) + similarity** — ежемесячный
  workflow `.github/workflows/embeddings-monthly.yml`.
* **`/maintain-content` Шаг 2а-bis** — трендовый анализ Wordstat
  (формула `recent3 / baseline6`, пороги ≥ 2 → «обновить», ≤ 0.5 → «архив»).
* **`/maintain-content` Шаг 1** — re-factcheck по маркеру старше 90 дней
  (quarterly cycle).
* **`/create-article` Стадия 2а** — автоперелинковка: ≥ 3 исходящих +
  ≥ 1 входящая обязательны до следующей стадии.
* **`/monitor-rss` Шаг 4** разделён на три порога дублей: ≥ 0.9 →
  «обновить», 0.6–0.9 → «ручная оценка», < 0.6 → «новая статья».

### Инфраструктура

* **196 битых внутренних ссылок** в 59 файлах исправлены через
  `scripts/audit/fix-broken-blog-links.mjs` (формат `/blog/<slug-без-даты>/`
  не соответствует `post.id` Astro glob loader). Регрессионный чек —
  `scripts/audit/check-blog-links.mjs`. GitHub Issue #30.
* **Новые скрипты:**
  * `scripts/audit/embed-articles.mjs`
  * `scripts/audit/similarity.mjs`
  * `scripts/audit/fix-broken-blog-links.mjs`
  * `scripts/audit/check-blog-links.mjs`
  * `scripts/audit/set-review-dates.mjs`
  * `scripts/factcheck/audit-npa-references.mjs`
* **`docs/architecture.md`** обновлён: новые скрипты, источники данных,
  раздел про внутренние ссылки.
* **Новые docs:** `docs/factcheck-history.md`,
  `docs/session-2026-05-19-postmortem.md`.

### GitHub Issues

* **Закрыты:** [#30](https://github.com/burbonivanovich-oss/TS_PIOT/issues/30)
  (битые ссылки), [#31](https://github.com/burbonivanovich-oss/TS_PIOT/issues/31)
  (research-specialist gate).
* **Локальный backlog → done:** #22, #24, #41, #42, #44, #48, #54,
  #58/#39, #59, #60, #61.

### Метрики до / после

| Метрика | До | После |
|---|---|---|
| Factcheck покрытие | 8/83 (10%) | **83/83 (100%)** |
| Битых ссылок | 196 | 0 |
| Сирот в linkgraph | 61 | 0 |
| Pillar → блог ссылок | 0 | 46 |
| Статей с reviewDate | 16 | 83 |
| Фейковых НПА в whitelist (защита) | 0 | 32 |

### Известные открытые вопросы

* 37 ФЗ + 18 ПП показаны `audit-npa-references.mjs` как «незнакомые» —
  материал на следующий цикл верификации (вероятно бо́льшая часть
  реальные, надо просто добавить в whitelist).
* Семантическая проверка «номер не той темы» в `audit-npa-references.mjs`
  ещё не реализована — это закроет 12-й тип ошибки (реальный ПП в
  неправильном контексте). См. `docs/factcheck-history.md` → «Открытые риски».
* Pre-commit hook против `draft: false` без factcheck-маркера (#57) —
  гигиена дисциплины 100% покрытия.
