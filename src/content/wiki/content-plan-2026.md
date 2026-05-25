---
title: "Контент-план Этикетка на 2026"
description: "Кластерный план публикаций со статусами done/draft/planned, целевыми ключами, CPA-баннерами и приоритетами P0/P1/P2."
createdDate: "2026-04-28"
lastModified: "2026-05-25"
tags:
  - контент-план
  - SEO
  - стратегия
type: research
status: published
---

> Статус каждой темы считается через `node scripts/health-check.mjs --content-plan`.
> Источник истины — slug в `src/content/blog/` (без префикса даты) и поле `draft`
> во frontmatter. Любая ручная правка статусов в этом файле — временная и
> перезатирается следующим прогоном health-check.

## Стратегия

Сайт растим как **тематический кластер** для любого малого бизнеса в России —
розница, услуги, HoReCa, онлайн-продажи, стартующие предприниматели.

Принцип: узкие статьи-сателлиты под конкретные запросы → pillar-страницы кластера.
Внутренняя перелинковка передаёт авторитет, поисковик видит «эксперта» по теме.
CPA-монетизация встроена в контент органично: баннер соответствует теме статьи.

**Аудитории:**
- Розница с физическим товаром — маркировка, ТС ПИоТ, ЕГАИС, касса.
- Услуги и самозанятые — налоги, касса, переход ИП, патент, НПД.
- HoReCa — касса, ЕГАИС, Меркурий, учёт, инвентаризация.
- Онлайн-бизнес и маркетплейсы — маркировка, ЭДО, налоги с продаж.
- Стартующий бизнес — открытие ИП/ООО, счёт, первая касса, первый сотрудник.

Стратегические опоры:

- **/category/ts-piot/** — ТС ПИоТ и маркировка на кассе.
- **/category/markirovka/** — «Честный знак»: категории, сроки, штрафы.
- **/category/zakonodatelstvo/** — налоги, ЭДО, кадры, проверки.
- **/category/kkt/** — выбор кассы, ОФД, ФН, регистрация.
- **/category/egais/** — алкоголь, Меркурий, общепит.

Под каждой опорой — 8–12 узких статей. Минимум 3 внутренние ссылки в каждой
статье. Раз в квартал — обновление дат и фактов в опорных материалах
(`updatedDate`).

## Принципы выбора тем

1. **Триггер закона/срока.** Пишем под конкретные даты (01.07.2026 — расширение
   маркировки, 01.09.2026 — ЭТрН и ЭПД по 140-ФЗ, 01.10.2026 — закон о
   маркетплейсах 289-ФЗ, 01.01.2026 — лимиты УСН).
2. **Информационный интент.** «что такое», «как подключить», «штрафы за».
   Коммерческие («купить», «цена») оставляем платформам сравнения.
3. **Проверяемые факты.** Каждое число — со ссылкой на источник в драфте.
4. **Длина 1500–2500 слов** для опор, 800–1500 для сателлитов.

## TODO: топ-20 на ближайший месяц

Приоритет: P0 + Wordstat показывает up + закрывает пробел в кластере. Старт
писать сверху, по одной статье за день.

1. **kto-ne-nuzhen-ts-piot** (P0, ts-piot) — исключения и освобождения, частая
   боль читателя. Wordstat: «тс пиот» 32 962 up. CPA: ts-piot-provider.
2. **markirovka-tabaka-2026** (P0, markirovka) — разрешительный режим табака,
   проверка цены ниже минимальной. CPA: kontur-markirovka.
3. **markirovka-vody-2026** (P0, markirovka) — питьевая вода, новая категория.
   CPA: kontur-markirovka.
4. **markirovka-bad-2026** (P0, markirovka) — БАД попадают под Честный знак.
   CPA: kontur-markirovka.
5. **markirovka-ostatkov** (P0, markirovka) — Wordstat 8 466 stable, кросс-категорийная
   боль. CPA: kontur-markirovka.
6. **kedo-vnedrenie-msb** (P0, zakonodatelstvo) — КЭДО для МСБ. CPA: diadoc-kedo.
7. **mchd-chto-eto** (P0, zakonodatelstvo) — машиночитаемая доверенность, обязательна
   с 01.09.2024. CPA: kontur-mchd.
8. **kassa-dlya-kafe-2026** (P0, kkt) — pillar HoReCa, кафе-чек-лист уже опубликован.
   CPA: kontur-market.
9. **egais-dlya-bara** (P0, egais) — пошаговое подключение для бара. CPA: kontur-market.
10. **markirovka-dlya-wb-ozon** (P0, markirovka) — требования 2026. CPA: kontur-markirovka.
11. **patent-2026-limit** (P0, zakonodatelstvo) — лимит 60 млн ₽, ставка вопрос года.
    CPA: kontur-elba.
12. **limity-usn-2026** (P0, zakonodatelstvo) — Wordstat 26 545 down, но
    остаётся в топе. CPA: kontur-elba.
13. **vznosy-ip-bez-rabotnikov-2026** (P0, zakonodatelstvo) — Wordstat
    «фиксированные взносы ИП 2026» 81 072 up. CPA: kontur-elba.
14. **ffd-12-chto-eto** (P0, kkt) — ФФД 1.2 завязан на ТС ПИоТ. CPA: kontur-ofd.
15. **kassa-dlya-ip-bez-rabotnikov** (P0, kkt) — частый вопрос ИП. CPA: kontur-market.
16. **proverka-kontragenta-pered-sdelkoy** (P0, zakonodatelstvo) — Wordstat
    в кластере 115-ФЗ растёт. CPA: kontur-focus.
17. **152-fz-personalnye-dannye** (P0, zakonodatelstvo) — 152-ФЗ Wordstat 102 806
    stable, у нас только штрафы. CPA: default-zakonodatelstvo.
18. **kassa-dlya-marketplace** (P0, kkt) — частая боль селлеров. CPA: kontur-market.
19. **markirovka-tabaka-novye-proverki-2026** (P0, markirovka) — проверка
    минимальной цены с 01.09.2026. CPA: kontur-markirovka.
20. **subsidii-msb-2026** (P0, zakonodatelstvo) — Wordstat 555 up. CPA: kontur-elba.

## Кластеры

### Кластер 1. ТС ПИоТ

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| kto-ne-nuzhen-ts-piot | Кому не нужен ТС ПИоТ: исключения и освобождения | P0 | ts-piot-provider | кому не нужен ТС ПИоТ | planned | — |
| ts-piot-dlya-obschepita | ТС ПИоТ для кафе и ресторана: нужен ли и как настроить | P0 | ts-piot-provider | ТС ПИоТ для кафе | planned | — |
| ts-piot-dlya-apteki | ТС ПИоТ для аптеки: лекарства и маркировка | P1 | ts-piot-provider | ТС ПИоТ аптека | planned | — |
| ts-piot-oshibki-kassira | ТС ПИоТ: сценарии отказа и что говорить покупателю | P1 | ts-piot-provider | ТС ПИоТ ошибка кассира | planned | — |
| ts-piot-mojsklad | Настройка ТС ПИоТ в МойСклад | P2 | ts-piot-provider | ТС ПИоТ МойСклад | planned | — |
| ts-piot-data-matrix | ТС ПИоТ и Data Matrix: что сканирует касса | P1 | ts-piot-provider | ТС ПИоТ Data Matrix | planned | wordstat-2026-05 |
| chto-takoe-ts-piot | ТС ПИоТ: что это, кому нужен и как подключить | P0 | ts-piot-provider | что такое ТС ПИоТ | done | — |
| ts-piot-podklyuchenie-instrukciya | Подключение ТС ПИоТ к кассе: пошаговая инструкция | P0 | ts-piot-provider | подключить ТС ПИоТ | done | — |
| ts-piot-evotor-atol-shtrih | ТС ПИоТ на кассах Эвотор, Атол, Штрих и Дримкас | P0 | ts-piot-provider | ТС ПИоТ касса какая | done | — |
| ts-piot-shtrafy | Штраф за работу без ТС ПИоТ в 2026 | P0 | ts-piot-provider | штраф ТС ПИоТ | done | — |
| ts-piot-bez-interneta | ТС ПИоТ без интернета: как работает касса при потере связи | P1 | ts-piot-provider | ТС ПИоТ нет интернета | done | — |
| ts-piot-vs-ofd | ТС ПИоТ и ОФД: в чём разница и нужны ли оба | P2 | ts-piot-provider | ТС ПИоТ или ОФД | done | — |
| ts-piot-1c | ТС ПИоТ в 1С:Розница и УНФ: настройка пошагово | P1 | ts-piot-provider | ТС ПИоТ 1С | done | — |
| ts-piot-provajdery-sravnenie | Провайдеры ТС ПИоТ: сравнение ЕСМ и Инвенты | P0 | ts-piot-provider | провайдер ТС ПИоТ | done | — |

### Кластер 2. Маркировка «Честный знак»

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| markirovka-tabaka-2026 | Маркировка табака и сигарет в 2026: разрешительный режим | P0 | kontur-markirovka | маркировка табака 2026 | planned | — |
| markirovka-bad-2026 | Маркировка БАД: сроки, требования, штрафы | P0 | kontur-markirovka | маркировка БАД 2026 | planned | — |
| markirovka-vody-2026 | Маркировка питьевой воды в 2026 | P0 | kontur-markirovka | маркировка воды | planned | — |
| markirovka-ostatkov | Маркировка остатков: когда возможна и как сделать | P0 | kontur-markirovka | маркировка остатков | planned | wordstat-2026-05 |
| poexzemplyarnyj-uchet | Поэкземплярный учёт: что меняется для розницы | P1 | kontur-markirovka | поэкземплярный учёт | planned | wordstat-2026-05 |
| markirovka-tabaka-novye-proverki-2026 | Табак 2026: проверка цены ниже минимальной с 01.09.2026 | P0 | kontur-markirovka | маркировка табака новые правила | planned | — |
| razreshitelnyj-rezhim-onlayn-offlayn | Онлайн- и офлайн-проверки в разрешительном режиме | P1 | kontur-markirovka | онлайн и офлайн проверки маркировки | planned | — |
| gis-mt-kak-rabotaet | ГИС МТ: как работает национальная система прослеживаемости | P1 | kontur-markirovka | ГИС МТ что это | planned | wordstat-2026-05 |
| sroki-markirovki-2026 | Полный календарь сроков маркировки 2026: даты и категории | P1 | kontur-markirovka | сроки маркировки 2026 | planned | wordstat-2026-05 |
| data-matrix-chto-eto | Data Matrix: что это, как читается и где взять | P1 | kontur-markirovka | Data Matrix маркировка | planned | wordstat-2026-05 |
| kategorii-markirovki-2026 | Маркировка «Честный знак» 2026: категории и сроки | P0 | kontur-markirovka | категории маркировки 2026 | done | — |
| markirovka-piva-roznica | Маркировка пива в рознице: пошаговая настройка | P0 | kontur-markirovka | маркировка пиво розница | done | — |
| markirovka-molochki-msb | Маркировка молочной продукции для МСБ | P1 | kontur-markirovka | маркировка молочной продукции | done | — |
| markirovka-obuvi-2026 | Маркировка обуви в 2026: разрешительный режим, остатки, штрафы | P1 | kontur-markirovka | маркировка обуви | done | — |
| markirovka-importerov | Маркировка для импортёров: GTIN, ЭДО и таможня | P1 | kontur-markirovka | маркировка импорт | done | — |
| markirovka-cherez-marketplace | Маркировка на маркетплейсах Wildberries и Ozon в 2026 | P1 | kontur-markirovka | маркировка маркетплейс | done | — |
| shtraf-za-markirovku | Штраф за отсутствие маркировки в 2026: размеры и последствия | P0 | kontur-markirovka | штраф за маркировку | done | — |
| razreshitelnyj-rezhim-markirovka | Разрешительный режим Честного знака: как работает | P0 | kontur-markirovka | разрешительный режим | done | — |
| chestny-znak-registraciya | Регистрация в «Честном знаке»: пошаговая инструкция для ИП и ООО | P0 | chestny-znak | регистрация в Честном знаке | done | — |

### Кластер 3. Маркировка 2026: новые категории по срокам

С 01.07.2026 — косметика, бытовая химия, средства гигиены. С 01.09.2026 —
безалкогольные напитки, спортпит, бакалея, табак (минимальная цена), игрушки.
С 01.10.2026 — автомобильные жидкости, консервы.

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| markirovka-kosmetiki-2026 | Маркировка косметики и парфюмерии с 01.07.2026 | P0 | kontur-markirovka | маркировка косметики 2026 | done | — |
| markirovka-bytovoy-himii-2026 | Маркировка бытовой химии с 01.07.2026 | P0 | kontur-markirovka | маркировка бытовой химии | done | — |
| markirovka-lichnoy-gigieny-2026 | Маркировка товаров личной гигиены с 01.07.2026 | P0 | kontur-markirovka | маркировка средств гигиены | done | — |
| markirovka-bezalk-napitkov-2026 | Безалкогольные напитки: проверки кодов с 01.09.2026 | P0 | kontur-markirovka | маркировка безалкогольных напитков | done | — |
| markirovka-sportpita-2026 | Спортивное питание: запрет остатков с 01.09.2026 | P0 | kontur-markirovka | маркировка спортивного питания | done | — |
| markirovka-bakalei-2026 | Маркировка снеков, соусов и специй с 01.09.2026 | P0 | kontur-markirovka | маркировка бакалеи | done | — |
| markirovka-igrushek-2026 | Маркировка игрушек с 01.09.2026: поэкземплярный учёт | P0 | kontur-markirovka | маркировка игрушек 2026 | done | — |
| markirovka-avtozhidkostey-2026 | Автомобильные жидкости: разрешительный режим с 01.10.2026 | P0 | kontur-markirovka | маркировка автомобильных жидкостей | done | — |
| markirovka-konservov-2026 | Маркировка консервов с 01.10.2026 | P0 | kontur-markirovka | маркировка консервов | done | — |
| kalendar-markirovki-2026 | Календарь маркировки 2026: что и когда вступает в силу | P0 | kontur-markirovka | календарь маркировки 2026 | done | — |
| obyemno-sortovoy-vs-poexzemplyarnyj | Объёмно-сортовой и поэкземплярный учёт: разница | P1 | kontur-markirovka | объёмно-сортовой учёт | done | — |
| vyvod-iz-oborota-cherez-kassu | Вывод товаров из оборота через кассу: как настроить в 2026 | P0 | kontur-markirovka | вывод из оборота через кассу | done | — |

### Кластер 4. Законодательство и налоги

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| patent-2026-limit | Лимит патента в 2026 и что делать при превышении | P0 | kontur-elba | патент 60 миллионов | planned | — |
| limity-usn-2026 | Лимиты УСН в 2026: доходы, сотрудники, ОС | P0 | kontur-elba | лимит УСН 2026 | planned | wordstat-2026-05 |
| vznosy-ip-bez-rabotnikov-2026 | Страховые взносы ИП без сотрудников в 2026 | P0 | kontur-elba | фиксированные взносы ИП 2026 | planned | wordstat-2026-05 |
| reestr-msp-lgoty-2026 | Реестр МСП: как проверить статус и получить льготы | P1 | kontur-elba | реестр МСП льготы 2026 | planned | — |
| elektronnaya-trudovaya-knizhka-2026 | Электронная трудовая книжка работодателя в 2026 | P1 | kontur-extern | электронная трудовая работодатель | planned | — |
| kontrolnye-zakupki-fns-2025 | Контрольные закупки ФНС 2025–2026: как проходят | P1 | kontur-extern | контрольная закупка ФНС | planned | — |
| subsidii-msb-2026 | Субсидии и гранты для МСБ в 2026 | P0 | kontur-elba | субсидии малому бизнесу 2026 | planned | wordstat-2026-05 |
| koap-shtrafy-biznes-2026 | Новые штрафы КоАП для бизнеса в 2026 | P1 | default-zakonodatelstvo | новые штрафы для бизнеса 2026 | planned | — |
| bnpl-msb | Индикаторы риска ФНС в 2026 | P1 | kontur-focus | индикаторы риска ФНС 2026 | planned | — |
| trudovoy-uchet-mikropredpr | Кадровый учёт у микропредприятия: упрощение | P2 | kontur-extern | кадровый учёт микропредприятие | planned | — |
| nalogi-msb-2026 | Налоги МСБ в 2026: УСН, патент, ЕНС и КЭДО | P0 | kontur-elba | налоги МСБ 2026 | done | — |
| usn-nds-rasschet | НДС на УСН в 2026: ставка 5%, 7% или 22% — как выбрать | P0 | kontur-elba | НДС на УСН какая ставка | done | — |
| ens-enp-uvedomleniya | Уведомления по ЕНС в 2026 | P0 | kontur-extern | уведомление ЕНП | done | — |
| proverki-2026 | Мораторий на проверки бизнеса в 2026 | P0 | kontur-focus | мораторий на проверки 2026 | done | — |
| edo-upd-markirovka | ЭДО и УПД для маркированных товаров | P1 | kontur-diadoc | ЭДО маркировка УПД | done | — |
| strahovye-vznosy-msp-2026 | Страховые взносы МСП в 2026: пониженный тариф | P0 | kontur-elba | страховые взносы МСП 2026 | done | — |
| mrot-2026-rabotodatel | МРОТ 27 093 ₽: как пересчитать зарплаты и взносы | P1 | kontur-extern | МРОТ 2026 для работодателя | done | — |
| etrn-2026 | ЭТрН с 01.09.2026: кто обязан оформлять | P0 | diadoc-logistika | электронная транспортная накладная 2026 | done | — |
| zakon-o-marketpleysah-289-fz | Закон о маркетплейсах 289-ФЗ: с 01.10.2026 | P0 | kontur-elba | закон о маркетплейсах 2026 | done | — |
| personalnye-dannye-shtrafy-2025 | Персональные данные: штрафы до 500 млн ₽ | P0 | default-zakonodatelstvo | штрафы персональные данные | done | — |
| samozanyatye-riski-2026 | Самозанятые и работодатель в 2026: риски с октября | P0 | kontur-focus | риски работы с самозанятыми | done | — |
| psn-nds-2026 | ПСН и НДС в 2026: платит ли ИП на патенте | P0 | kontur-elba | патент НДС 2026 ИП | done | — |
| sovmeschenie-usn-patent-2026 | Совмещение УСН и патента в 2026 | P1 | kontur-elba | совмещение УСН и патента | done | — |
| 140-fz-epd-perehod-msb | 140-ФЗ: переход на ЭПД с 01.09.2026 для МСБ | P0 | diadoc-logistika | 140 ФЗ ЭПД 2026 | draft | редактура |

### Кластер 5. ОФД и фискальные накопители

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| smena-ofd-instrukciya | Смена ОФД: пошаговая инструкция без штрафов | P1 | kontur-ofd | как сменить ОФД | planned | — |
| ofd-shtrafy | Штрафы за работу без действующего договора с ОФД | P1 | kontur-ofd | штраф ОФД нет договора | planned | — |
| pereregistraciya-kkt | Перерегистрация ККТ при замене ФН в ФНС | P1 | kontur-ofd | перерегистрация ККТ ФНС | planned | — |
| fn-dlya-markirovki | Какой ФН нужен для торговли маркированным товаром | P1 | kontur-ofd | ФН для маркировки | planned | — |
| shtrafy-prosrochennyj-fn | Штрафы за работу с просроченным ФН | P1 | kontur-ofd | штраф просроченный ФН | planned | — |
| ffd-12-chto-eto | ФФД 1.2: что это и кому нужно менять ФН | P0 | kontur-ofd | ФФД 1.2 зачем переходить | planned | — |
| oshibki-na-kasse | Ошибки на кассе: коды ошибок и как исправить | P1 | kontur-ofd | ошибка на кассе что делать | planned | — |
| snyatie-kkt-s-ucheta | Снятие ККТ с учёта: когда нужно и как сделать | P2 | kontur-ofd | снять ККТ с учёта | planned | — |
| chto-takoe-ofd | ОФД: что это, как работает и кому обязателен | P0 | kontur-ofd | что такое ОФД | done | — |
| kak-vybrat-ofd-2026 | Сравнение операторов фискальных данных в 2026 | P0 | kontur-ofd | какой ОФД выбрать 2026 | done | — |
| chto-takoe-fn | Фискальный накопитель: ФН-1.1М и ФН-1.2 | P0 | kontur-ofd | что такое фискальный накопитель | done | — |
| srok-fn-15-36 | Срок действия ФН: 15 или 36 месяцев | P1 | kontur-ofd | ФН 15 или 36 месяцев | done | — |
| zamena-fn-poshagovo | Замена фискального накопителя: пошаговая инструкция | P0 | kontur-ofd | замена ФН пошагово | done | — |
| ofd-dlya-ts-piot | ОФД для ТС ПИоТ 2026: оператор фискальных данных | P0 | ts-piot-provider | ОФД для ТС ПИоТ | done | — |
| registraciya-kkt-v-fns | Регистрация онлайн-кассы в ФНС в 2026 | P0 | kontur-ofd | регистрация ККТ в ФНС | done | — |

### Кластер 6. Меркурий (ВетИС)

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| merkuriy-shtrafy | Штрафы за нарушения в Меркурии в 2026 | P1 | kontur-markirovka | штраф Меркурий | planned | — |
| merkuriy-1c | Интеграция Меркурия с 1С: настройка обмена | P1 | kontur-markirovka | Меркурий 1С интеграция | planned | — |
| merkuriy-offline | Что делать при сбое Меркурия: офлайн-режим | P1 | kontur-markirovka | Меркурий не работает | planned | wordstat-2026-05 |
| merkuriy-dlya-roznicy | Меркурий для розничного магазина: минимум действий | P1 | kontur-markirovka | Меркурий розница | planned | — |
| merkuriy-dlya-obschepita | Меркурий в общепите: входящие ВСД и списание | P1 | kontur-market | Меркурий общепит | planned | — |
| merkuriy-import-eksport | Меркурий при импорте и экспорте | P2 | kontur-diadoc | Меркурий импорт | planned | — |
| vetdokumenty-kak-poluchit | Ветеринарные документы: как получить ВСД пошагово | P1 | kontur-markirovka | ветеринарные документы | planned | wordstat-2026-05 |
| chto-takoe-merkuriy | Меркурий ВетИС: что это и кому обязателен | P0 | kontur-markirovka | что такое Меркурий | done | — |
| registraciya-v-merkurii | Регистрация в Меркурии для ИП и ООО | P0 | kontur-markirovka | регистрация в Меркурии | done | — |
| gashenie-vsd-merkuriy | Гашение ВСД в Меркурии: сроки и порядок | P0 | kontur-markirovka | гашение ВСД Меркурий | done | — |
| merkuriy-i-chestnyj-znak | Меркурий и Честный знак: молочка и рыба | P1 | kontur-markirovka | Меркурий и Честный знак | done | — |

### Кластер 7. ККТ: выбор кассы

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| mspos-nastroyka-markirovka | Настройка MSPOS под маркировку и ТС ПИоТ | P1 | kontur-market | MSPOS маркировка настройка | planned | — |
| atol-podklyuchenie-1c | Подключение фискальных регистраторов АТОЛ к 1С | P1 | kontur-ofd | АТОЛ 1С подключить | planned | — |
| kassa-dlya-kuryera | Касса для курьерской доставки | P1 | kontur-market | касса для курьера | planned | — |
| kassa-dlya-marketplace | Касса для продавца на Wildberries и Ozon | P0 | kontur-market | касса для маркетплейса | planned | — |
| kassa-dlya-obschepita | Касса для кафе и общепита | P1 | kontur-market | касса для общепита | planned | — |
| kassa-dlya-uslug | Касса для парикмахерской и сферы услуг | P2 | kontur-market | касса для парикмахерской | planned | — |
| kassa-dlya-ip-bez-rabotnikov | Касса для ИП без сотрудников: нужна ли в 2026 | P0 | kontur-market | нужна ли касса ИП | planned | — |
| kak-vybrat-onlayn-kassu-2026 | Как выбрать онлайн-кассу для МСБ в 2026 | P0 | kontur-market | как выбрать онлайн-кассу | done | — |
| vidy-kkt | Виды ККТ: автономные, смарт, фискальные регистраторы | P0 | kontur-market | виды онлайн-касс | done | — |
| smart-terminal-vs-fiskalnyj-registrator | Смарт-терминал или фискальный регистратор | P0 | kontur-market | смарт-терминал или ФР | done | — |
| mspos-f20-obzor | MSPOS F20: характеристики и сценарии | P1 | kontur-market | MSPOS F20 обзор | done | — |
| mspos-t-d3-mini-obzor | MSPOS T D3 Mini: характеристики | P1 | kontur-market | MSPOS T D3 Mini обзор | done | — |
| mspos-f20-vs-d3-mini | Сравнение MSPOS F20 и MSPOS T D3 Mini | P1 | kontur-market | MSPOS F20 или D3 Mini | done | — |
| atol-30f-obzor | АТОЛ 30Ф: обзор фискального регистратора | P1 | kontur-market | АТОЛ 30Ф обзор | done | — |
| atol-27f-obzor | АТОЛ 27Ф: обзор и сценарии установки | P1 | kontur-market | АТОЛ 27Ф обзор | done | — |
| atol-30f-vs-27f | Сравнение АТОЛ 30Ф и АТОЛ 27Ф | P1 | kontur-market | АТОЛ 30Ф или 27Ф | done | — |
| kassa-dlya-internet-magazina | Касса для интернет-магазина в 2026 | P0 | kontur-market | касса для интернет-магазина | done | — |

### Кластер 8. ЕГАИС, общепит и розница алкоголя

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| spisanie-alkogolya | Списание алкоголя в ЕГАИС: бой, просрочка | P1 | kontur-market | списание алкоголя ЕГАИС | planned | — |
| aktsiznaya-marka-proverka | Акцизные марки на алкоголь: проверка и сканирование | P1 | kontur-market | акцизная марка проверка | planned | wordstat-2026-05 |
| kokteyli-i-egais | Слабоалкогольные коктейли и ЕГАИС | P2 | kontur-market | коктейли ЕГАИС | planned | — |
| kassa-alkogol-fkk | Онлайн-касса и алкоголь: ФФД и реквизиты чека | P1 | kontur-ofd | касса алкоголь чек | planned | — |
| egais-shtrafy-2026 | Штрафы за нарушения в ЕГАИС в 2026 | P1 | default-zakonodatelstvo | штрафы ЕГАИС 2026 | planned | — |
| egais-i-markirovka-piva | ЕГАИС и маркировка пива: как уживаются | P1 | kontur-markirovka | ЕГАИС и Честный знак пиво | planned | — |
| licenziya-na-alkogol | Лицензия на розничную продажу алкоголя | P1 | kontur-focus | лицензия на алкоголь розница | planned | — |
| uchyot-alkogolya-v-obschepite | Учёт алкоголя в кафе и баре: ЕГАИС без ошибок | P0 | kontur-market | учёт алкоголя в общепите | done | — |
| egais-chto-eto | ЕГАИС: что это, кому нужен и как подключить | P0 | kontur-market | что такое ЕГАИС | done | — |
| utm-egais-podklyuchenie | Подключение УТМ ЕГАИС: пошаговая инструкция | P0 | kontur-market | подключение УТМ ЕГАИС | done | — |
| egais-zhurnal-roznichnoy-prodazhi | Журнал учёта розничной продажи алкоголя в 2026 | P0 | kontur-market | журнал учёта алкоголя | done | — |
| deklaracii-po-alkogolyu | Декларации по алкоголю: формы 7 и 8 | P1 | kontur-extern | декларация по алкоголю | done | — |
| poshtuchnyj-uchyot-alkogolya | Поштучный учёт крепкого алкоголя в общепите | P1 | kontur-market | поштучный учёт алкоголя | done | — |
| uchyot-razlivnogo-piva | Учёт разливного пива: марки, кеги, остатки | P1 | kontur-market | учёт разливного пива | done | — |

### Кластер 9. Онлайн-бухгалтерия и ЭДО

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| buh-dlya-ooo | Онлайн-бухгалтерия для ООО: что должна закрывать | P1 | kontur-elba | онлайн бухгалтерия для ООО | planned | — |
| buh-dlya-samozanyatyh | Нужна ли самозанятому онлайн-бухгалтерия | P2 | kontur-elba | бухгалтерия для самозанятых | planned | — |
| buh-i-bank-integraciya | Интеграция онлайн-бухгалтерии с банком | P1 | bank-elba | онлайн бухгалтерия банк | planned | — |
| sdacha-otchetnosti-onlayn | Сдача отчётности онлайн: УСН, ЕНП, страховые | P1 | kontur-extern | сдать отчётность онлайн | planned | — |
| buh-i-markirovka | Онлайн-бухгалтерия и маркировка: что учесть | P2 | kontur-markirovka | бухгалтерия и маркировка | planned | — |
| buh-i-egais | Онлайн-бухгалтерия для общепита и магазина с алкоголем | P1 | kontur-market | бухгалтерия для общепита | planned | — |
| perehod-na-onlayn-buh | Переход с офлайн-бухгалтера на облачный сервис | P2 | kontur-elba | как перейти на онлайн бухгалтерию | planned | — |
| elektronnaya-otchetnost-dlya-ip | Электронная отчётность для ИП и ООО: как подключить | P1 | kontur-extern | электронная отчётность подключить | planned | — |
| sverka-s-ens-kak-proverit | Сверка с ЕНС: как проверить переплату или долг | P1 | kontur-extern | сверка с ЕНС ФНС | planned | — |
| otchetnost-v-sfr-2026 | Персонифицированный учёт в СФР: ЕФС-1 и сроки | P1 | kontur-extern | отчётность в СФР 2026 | planned | — |
| proverka-kontragenta-pered-sdelkoy | Как проверить контрагента перед сделкой | P0 | kontur-focus | проверка контрагента ФНС | planned | — |
| priznaki-firmy-odnodevki | Признаки фирмы-однодневки: чек-лист | P1 | kontur-focus | фирма однодневка признаки | planned | — |
| kedo-vnedrenie-msb | КЭДО: с чего начать внедрение в малом бизнесе | P0 | diadoc-kedo | КЭДО малый бизнес | planned | — |
| elektronnye-kadrovye-dokumenty | Электронные кадровые документы: как перейти | P1 | diadoc-kedo | кадровые документы электронный вид | planned | — |
| mchd-chto-eto | МЧД с 01.09.2024: что обязан сделать работодатель | P0 | kontur-mchd | МЧД машиночитаемая доверенность | planned | — |
| mchd-oformlenie-dlya-bukhgaltera | МЧД для бухгалтера: как оформить пошагово | P1 | kontur-mchd | МЧД для бухгалтера | planned | — |
| edi-dlya-postavschikov | EDI для поставщика торговой сети: как подключиться | P1 | kontur-diadoc | EDI для поставщика | planned | — |
| 152-fz-personalnye-dannye | 152-ФЗ для бизнеса: согласия, реестр, ответственность | P0 | default-zakonodatelstvo | 152-ФЗ персональные данные бизнес | planned | wordstat-2026-05 |
| onlayn-buhgalteriya-2026 | Онлайн-бухгалтерия для МСБ в 2026: как выбрать | P0 | kontur-elba | онлайн-бухгалтерия 2026 | done | — |
| sravnenie-onlayn-buhov | Сравнение Контур.Эльба, Моё дело, 1С:Облако | P1 | kontur-elba | сравнение онлайн бухгалтерий | done | — |
| buh-dlya-ip-usn | Онлайн-бухгалтерия для ИП на УСН: чек-лист | P1 | kontur-elba | онлайн бухгалтерия для ИП УСН | done | — |
| buh-dlya-marketplace | Онлайн-бухгалтерия для продавца на маркетплейсах | P1 | kontur-elba | бухгалтерия для маркетплейса | done | — |

### Кластер 10. Услуги и самозанятые

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| kogda-samozanyatyj-dolzhen-otkryt-ip | Когда самозанятый обязан открыть ИП: лимиты и риски | P1 | kontur-elba | лимит самозанятого 2026 | planned | wordstat-2026-05 |
| kassa-dlya-uslug-ip | Нужна ли касса ИП в сфере услуг в 2026 | P1 | kontur-market | касса для услуг ИП | planned | — |
| patent-dlya-uslug | Патент для ИП в сфере услуг: как рассчитать | P1 | kontur-elba | патент для ИП услуги | planned | — |
| nalog-dlya-freelansera | Налоги фрилансера в 2026: НПД, УСН, патент | P1 | kontur-elba | налог для фрилансера | planned | — |
| ip-na-usn-uslugi | ИП на УСН в услугах: 6% или 15% | P1 | kontur-elba | УСН для услуг 6 или 15 | planned | — |
| kak-vesti-uchet-samozanyatomu | Как самозанятому вести учёт доходов | P2 | kontur-elba | учёт доходов самозанятого | planned | — |
| dogovor-s-samozanyatym-riski | Договор с самозанятым: переквалификация | P1 | kontur-focus | договор с самозанятым риски | planned | — |
| ip-dlya-repetitora | ИП для репетитора: касса, налог | P2 | kontur-elba | ИП репетитор касса | planned | — |
| ip-dlya-mastera | ИП для мастера маникюра и парикмахера | P2 | kontur-elba | ИП мастер маникюр патент | planned | — |
| npd-vs-ip-chto-vybrat | НПД или ИП: что выгоднее в 2026 | P0 | kontur-elba | самозанятый или ИП | done | — |

### Кластер 11. HoReCa

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| kassa-dlya-kafe-2026 | Касса для кафе в 2026: требования, модели, ФФД 1.2 | P0 | kontur-market | касса для кафе 2026 | planned | — |
| egais-dlya-bara | ЕГАИС для бара: пошаговое подключение | P0 | kontur-market | ЕГАИС для бара | planned | — |
| merkuriy-dlya-restorana | Меркурий в ресторане: ВСД на мясо и молочку | P1 | kontur-markirovka | Меркурий ресторан | planned | — |
| uchet-produktov-v-kafe | Учёт продуктов в кафе: списание, инвентаризация | P1 | kontur-market | учёт продуктов кафе | planned | — |
| alkogolnaya-licenziya-kafe | Лицензия на алкоголь для кафе: стоимость и сроки | P1 | kontur-focus | лицензия на алкоголь кафе | planned | — |
| chajnye-cheki-obschepita | Чек в общепите: 54-ФЗ, обязательные реквизиты | P1 | kontur-ofd | чек для кафе реквизиты | planned | — |
| dostavka-eda-kassa | Касса при доставке еды: чеки курьера | P1 | kontur-market | касса для доставки еды | planned | — |
| nalog-dlya-kafe-2026 | Налог для кафе в 2026: УСН, патент, НДС 5% | P1 | kontur-elba | налог для кафе 2026 | planned | — |
| edo-s-postavschikami-obschepita | ЭДО с поставщиками в общепите | P2 | kontur-diadoc | ЭДО ресторан поставщики | planned | — |
| kassovaya-disciplina-horeca | Кассовая дисциплина в HoReCa: возвраты, Z-отчёты | P2 | kontur-ofd | кассовая дисциплина кафе | planned | — |
| kofejnya-bez-kassy | Нужна ли касса кофейне: исключения 54-ФЗ | P2 | kontur-market | касса для кофейни | planned | — |
| kak-otkryt-kafe-cheklis | Открытие кафе в 2026: полный чек-лист | P0 | kontur-market | как открыть кафе 2026 | done | — |

### Кластер 12. Старт бизнеса

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| pervaya-kassa-dlya-ip | Первая касса для ИП: когда и как зарегистрировать | P1 | kontur-market | нужна ли касса ИП | planned | — |
| usn-posle-registracii-ip | Как перейти на УСН сразу после регистрации ИП | P1 | kontur-elba | переход на УСН ИП | planned | — |
| pervyj-sotrudnik-ip | Первый сотрудник у ИП: договор, взносы, отчётность | P1 | kontur-extern | первый сотрудник ИП | planned | — |
| ooo-bez-sotrudnikov | ООО без сотрудников: что сдавать | P1 | kontur-extern | ООО без сотрудников отчётность | planned | — |
| registraciya-ip-cherez-gosuslugi | Регистрация ИП через Госуслуги: пошагово | P1 | kontur-elba | регистрация ИП госуслуги | planned | — |
| lgoty-dlya-novogo-ip | Налоговые каникулы для нового ИП в 2026 | P1 | kontur-elba | налоговые каникулы ИП 2026 | planned | wordstat-2026-05 |
| kak-zakryt-ip | Как закрыть ИП в 2026: долги, касса, документы | P2 | kontur-elba | как закрыть ИП 2026 | planned | wordstat-2026-05 |
| ooo-likvidaciya | Ликвидация ООО: сроки, документы, долги | P2 | kontur-extern | ликвидация ООО 2026 | planned | wordstat-2026-05 |
| ip-ili-ooo-chto-vybrat-2026 | ИП или ООО в 2026: что выбрать | P0 | kontur-elba | ИП или ООО 2026 | done | — |
| kak-otkryt-ip-poshagovo | Как открыть ИП в 2026: пошаговая инструкция | P0 | kontur-elba | как открыть ИП пошагово | done | — |
| kakoy-nalog-vybrat-ip | Какую систему налогообложения выбрать ИП | P0 | kontur-elba | система налогообложения ИП | done | — |
| raschetnyj-schet-dlya-ip-2026 | Расчётный счёт для ИП: как выбрать банк в 2026 | P1 | kontur-elba | расчётный счёт ИП 2026 | planned | — |
| nuzhen-li-raschetnyj-schet-ip | Нужен ли расчётный счёт ИП на патенте и УСН | P2 | kontur-elba | нужен ли расчётный счёт ИП | planned | wordstat-2026-05 |

### Кластер 13. Маркетплейсы и онлайн-продажи

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| markirovka-dlya-wb-ozon | Маркировка для Wildberries и Ozon: требования 2026 | P0 | kontur-markirovka | маркировка Wildberries | planned | — |
| vozvrat-tovara-marketplace | Возврат через маркетплейс: учёт и налоги | P1 | kontur-elba | возврат маркетплейс бухучёт | planned | — |
| komissiya-marketplace-nds | Комиссия маркетплейса и НДС: учёт в расходах | P1 | kontur-elba | комиссия WB Ozon НДС | planned | — |
| ozon-edo-postavschik | ЭДО с Ozon для поставщика: как подключиться | P1 | kontur-diadoc | ЭДО с Ozon | planned | — |
| wb-lichnyj-kabinet-nalogi | Личный кабинет WB: отчёт и расчёт налога | P1 | kontur-elba | Wildberries отчёт налог | planned | — |
| prodazhi-cherez-socset | Продажи через ВКонтакте и Telegram | P2 | kontur-elba | продажи через соцсети касса | planned | — |
| svoy-internet-magazin-kassa | Своя онлайн-касса: облачная или физическая | P2 | kontur-ofd | онлайн-касса для сайта | planned | — |
| yandex-market-nalog | Продажи на Яндекс Маркете: налог и ЭДО | P2 | kontur-elba | Яндекс Маркет налог | planned | — |
| sbp-dlya-internet-magazina | СБП для онлайн-магазина: подключение | P2 | bank-elba | СБП для интернет-магазина | planned | — |
| nalogi-s-wildberries-2026 | Налоги с продаж на Wildberries в 2026 | P0 | kontur-elba | налоги с Wildberries 2026 | done | — |
| samozanyatyj-na-wildberries | Самозанятый на Wildberries в 2026 | P0 | kontur-elba | самозанятый Wildberries | done | — |

### Кластер 14. Трудовые отношения и кадры

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| gpd-vs-trudovoj-dogovor | ГПД или трудовой договор: что выбрать | P1 | kontur-extern | ГПД или трудовой договор | planned | — |
| bolnichnyj-2026-rabotodatel | Больничный в 2026: как рассчитать | P1 | kontur-extern | больничный лист работодатель | planned | — |
| otpusknye-raschet-2026 | Отпускные в 2026: как рассчитать | P1 | kontur-extern | расчёт отпускных 2026 | planned | wordstat-2026-05 |
| uvolnenie-po-soglasheniyu | Увольнение по соглашению сторон | P1 | kontur-extern | увольнение по соглашению | planned | wordstat-2026-05 |
| inostrannyj-sotrudnik-oformlenie | Иностранный сотрудник: МВД, патент, взносы | P1 | kontur-extern | иностранный сотрудник 2026 | planned | — |
| distancionnaya-rabota-dogovor | Дистанционный сотрудник: договор, КЭДО, налоги | P1 | diadoc-kedo | дистанционная работа договор | planned | — |
| sokraschenie-shtata | Сокращение штата: порядок, выплаты, документы | P1 | kontur-extern | сокращение штата 2026 | planned | — |
| ndfl-s-zarplaty-2026 | НДФЛ с зарплаты в 2026: ставки и вычеты | P1 | kontur-extern | НДФЛ с зарплаты 2026 | planned | wordstat-2026-05 |
| vznosy-za-sotrudnikov-2026 | Страховые взносы за сотрудников в 2026 | P1 | kontur-extern | взносы за сотрудников 2026 | planned | wordstat-2026-05 |
| efs-1-sdacha | ЕФС-1 в СФР: кто, когда и как сдаёт в 2026 | P1 | kontur-extern | ЕФС-1 как сдать 2026 | planned | wordstat-2026-05 |
| komandirovka-2026 | Командировочные расходы в 2026 | P2 | kontur-elba | командировка суточные 2026 | planned | wordstat-2026-05 |
| sverhurochnie | Сверхурочная работа: оформление, оплата | P2 | kontur-extern | сверхурочная работа оплата | planned | — |
| materialnaya-otvetstvennost | Материальная ответственность сотрудника | P2 | kontur-extern | материальная ответственность работника | planned | wordstat-2026-05 |
| pervyj-sotrudnik-dokumenty | Первый сотрудник в ООО и ИП | P0 | kontur-extern | первый сотрудник оформление | done | — |

### Кластер 15. Расчёты, банк и финансовая безопасность

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| 115-fz-biznes | 115-ФЗ и малый бизнес: блокировка счёта | P1 | bank-elba | 115 ФЗ блокировка счёта | planned | wordstat-2026-05 |
| ekvajring-vs-sbp | Эквайринг или СБП: что выгоднее в 2026 | P1 | bank-elba | эквайринг или СБП | planned | — |
| kak-vybrat-bank-dlya-ip | Как выбрать банк для ИП в 2026 | P1 | bank-elba | как выбрать банк для ИП | planned | — |
| nalogovoe-trebovanie-kak-otvetit | Требование ФНС о документах: как ответить | P1 | kontur-extern | требование ФНС документы | planned | — |
| kameralka-chto-eto | Камеральная проверка: как проходит | P1 | kontur-extern | камеральная проверка ФНС | planned | — |
| vstrechnaya-proverka | Встречная проверка от ФНС | P1 | kontur-focus | встречная проверка ФНС | planned | — |
| kak-rabotat-s-nalichnymi | Кассовая дисциплина при работе с наличными | P1 | kontur-market | кассовая дисциплина наличные | planned | — |
| vozvrat-nds-iz-byudzheta | Возврат НДС из бюджета | P2 | kontur-extern | возврат НДС МСБ | planned | — |
| lizing-dlya-ip | Лизинг для ИП: учёт и налоги | P2 | kontur-elba | лизинг для ИП налоги | planned | — |
| faktoring-dlya-msb | Факторинг для малого бизнеса | P2 | bank-elba | факторинг для МСБ | planned | — |
| blokirovka-scheta-fns | Блокировка расчётного счёта ФНС | P0 | bank-elba | заблокировали счёт ФНС | done | — |

### Кластер 16. Нишевые аудитории

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| apteka-markirovka-lekarstv | Аптека и маркировка лекарств в 2026 | P1 | kontur-markirovka | аптека маркировка лекарств | planned | — |
| ip-voditel-taksi-nalogi | ИП-водитель такси: патент, НПД или УСН | P1 | kontur-elba | такси ИП налог | planned | — |
| stroitelnyj-ip-nalogi | Строительный подряд: ИП или самозанятый | P1 | kontur-elba | строитель ИП налог | planned | — |
| fotograf-ip-ili-samozanyatyj | Фотограф: самозанятость или ИП | P1 | kontur-elba | фотограф самозанятый | planned | — |
| stomatologiya-kassa | Стоматология и касса: реквизиты в чеке | P1 | kontur-market | касса для стоматологии | planned | — |
| fitnes-klub-kassa-nalogi | Фитнес-клуб: касса, абонемент, налог | P1 | kontur-market | фитнес касса абонемент | planned | — |
| salonkrasoty-kassa | Салон красоты: касса, патент, маркировка | P1 | kontur-market | салон красоты касса | planned | — |
| cvetochnyj-magazin-markirovka | Цветочный магазин и маркировка | P2 | kontur-markirovka | маркировка цветочный магазин | planned | — |
| avtoservis-kassa | Автосервис и касса: запчасти + работы | P2 | kontur-market | касса для автосервиса | planned | — |
| yurist-advocat-nalog | Адвокат и юрист: налоги в 2026 | P2 | kontur-elba | юрист ИП налог патент | planned | — |
| medicinskaya-licenziya | Медицинская лицензия: кому нужна и как получить | P2 | kontur-focus | медицинская лицензия 2026 | planned | — |
| detskij-centr-kassa | Детский центр: касса, лицензия | P2 | kontur-market | детский центр касса | planned | — |
| gruzoperevozki-etrn | Грузоперевозки с 01.09.2026: ЭТрН, путевой лист | P1 | diadoc-logistika | грузоперевозки ЭТрН 2026 | planned | — |
| kurier-samozanyatyj | Курьер-самозанятый: договор, чек, риски | P1 | kontur-elba | курьер самозанятый договор | planned | — |
| klinig-ip-nalogi | Клининг: ИП или ООО, касса, налоги | P2 | kontur-elba | клининг ИП налог | planned | — |
| ekvajring-dlya-uslug | Эквайринг для ИП в услугах | P2 | bank-elba | эквайринг ИП услуги | planned | — |

### Кластер 17. Налоговая оптимизация

| Slug | Заголовок | Priority | CPA | Целевой запрос | Status | Blocker |
|---|---|---|---|---|---|---|
| nalogovy-vychet-ip | Налоговый вычет для ИП на УСН: взносы и страховка | P1 | kontur-elba | вычет для ИП УСН | planned | — |
| avansovye-platezhi-usn | Авансовые платежи по УСН в 2026 | P1 | kontur-elba | авансовый платёж УСН 2026 | planned | wordstat-2026-05 |
| usn-dohody-rashody-chto-vklyuchat | УСН 15%: что включать в расходы и что нельзя | P1 | kontur-elba | расходы УСН 15 процентов | planned | wordstat-2026-05 |
| kak-umenshit-nalog-usn | Как уменьшить налог на УСН 6%: схемы и вычеты | P1 | kontur-elba | как уменьшить налог УСН | planned | wordstat-2026-05 |
| nulevaya-otchetnost-ip | Нулевая отчётность ИП: когда и как сдать | P1 | kontur-elba | нулевая отчётность ИП | planned | — |
| usn-pri-prodazhe-biznesa | УСН при продаже бизнеса: налог с дохода | P2 | kontur-elba | продажа бизнеса налог УСН | planned | — |
| nalog-na-imuschestvo-ip | Налог на имущество для ИП | P2 | kontur-elba | налог на имущество ИП | planned | wordstat-2026-05 |
| droblenie-biznesa-riski | Дробление бизнеса: когда законно, а когда уклонение | P1 | kontur-focus | дробление бизнеса ФНС | planned | — |
| ip-bez-deyatelnosti-vznosy | ИП без деятельности: взносы и отчёты | P1 | kontur-elba | ИП без деятельности 2026 | planned | — |

---

## Метрики

- Всего тем в плане: **244**
- Опубликовано (done, `draft:false`): **83**
- В draft (`draft:true`): **1** (140-fz-epd-perehod-msb)
- Planned (нет в blog): **160**
- Deprioritized: **0**
- Целевая частота публикаций: **3–5 статей/неделю**
- P0 в planned: 21
- P1 в planned: 102
- P2 в planned: 37

## SEO-задачи помимо контента

- **Регистрация в Яндекс.Вебмастер и Google Search Console.**
- **Подача sitemap.xml** в обе системы: https://etiketka-media.ru/sitemap.xml
- **Метрика и Analytics** — счётчики через `<BaseHead>`.
- **JSON-LD** для статей, организации и WebSite — поддерживать актуальность.
- **Перелинковка.** В каждой новой статье ≥ 3 внутренних ссылки.
- **Внешний трафик.** Гостевые публикации в профильных Telegram-каналах,
  регистрация в Яндекс.Бизнес.
- **Семантика.** Раз в квартал собирать частотность по ключам в Wordstat,
  актуализировать приоритеты в плане.
- **Технический аудит** через Lighthouse и PageSpeed раз в месяц.
  Цель: CLS < 0.1, LCP < 2.5 c, INP < 200 мс.

## Расписание публикаций

- **3–5 статей/неделю** на старте (первые 6 месяцев).
- После 100 публикаций — режим 1 опорный + 3 сателлита в неделю.
- Раз в 3 месяца — апдейт 3–5 старых статей (`updatedDate`, новые факты,
  расширение блоков).

## Легенда

- **Priority P0** — есть конкретный срок в 2026 или Wordstat показывает up.
- **Priority P1** — горячая тема без жёсткого срока, частотность средняя.
- **Priority P2** — справочное, низкочастотное, добиваем кластер.
- **Status done** — `draft: false`, опубликовано.
- **Status draft** — `draft: true`, в работе.
- **Status planned** — нет в `src/content/blog/`, нужно писать.
- **Blocker wordstat-2026-05** — тема добавлена из Wordstat-кеша 2026-05-18.
