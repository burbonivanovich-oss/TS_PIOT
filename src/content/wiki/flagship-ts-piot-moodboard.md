---
title: "Мудборд и промт-шаблон для иллюстраций флагмана-симулятора"
createdDate: "2026-05-19"
lastModified: "2026-05-19"
type: reference
status: draft
tags:
  - ts-piot
  - interactive
  - sprint-a
  - visual
---

# Мудборд и промт-шаблон для иллюстраций флагмана-симулятора

> **Назначение:** до генерации иллюстраций к 7 шагам сценария
> зафиксировать визуальный язык, чтобы все 8 изображений
> выглядели как один материал, а не сборная солянка.
> **Сценарий, который иллюстрируем:** `src/content/wiki/flagship-ts-piot-simulator.md`

## Контекст и цель

Симулятор — **explainer-лонгрид**, не статья с hero-картинкой
сверху. Иллюстрации работают внутри потока чтения, по одной на
каждый шаг. Они должны:

1. Помогать понять механику (схема > фото).
2. Быть консистентными между собой — единая палитра,
   геометрия, плотность линий, тип объектов.
3. Не конкурировать с текстом за внимание — низкоконтрастный фон,
   акцент на 1–2 элементах.
4. Работать на тёмной и светлой темах сайта (палитра
   `--pink`, `--lime`, `--sand`, `--dark` из `global.css`).

## Референсы

| # | URL | Что забираем |
|---|---|---|
| 1 | [notdotteam.github.io/trust](https://notdotteam.github.io/trust) | Главный референс. Плоские схемы, лёгкая 3D-перспектива, акцентные элементы на бежевом фоне. Каждый шаг — самостоятельный visual, но узнаваем как часть серии. |
| 2 | [molyanov.ru/blog/markov-chains](https://molyanov.ru/blog/markov-chains) | Минимализм, монохром + 1 акцентный цвет, диаграммы-состояния. Очень близко к нашему Шагу 7 (статусы кода в ЧЗ). |
| 3 | [stripe.com/docs/payments/checkout](https://stripe.com/docs/payments/checkout) (иллюстрации) | Эталон для Шагов 3 и 5: «как данные ходят между системами», стрелки + конверты + коробочки. |
| 4 | [Документация ЦРПТ → схемы](https://честныйзнак.рф/business/projects/dairy/) | Не для копирования стиля, а для **проверки**: наши схемы должны выглядеть правдоподобно, не противоречить тому, что ЦРПТ публикует у себя. |
| 5 | [duolingo.com/efficacy](https://www.duolingo.com/efficacy) (иллюстрации в отчётах) | Бытовая лёгкость, scale (большой объект + маленькие детали). Для Шага 0 и Шага 1. |

## Визуальный язык — обязательные параметры

| Параметр | Значение |
|---|---|
| **Стиль** | Flat / semi-isometric illustration. Не фотореалистично. |
| **Палитра базовая** | `--sand` (#F4EBD9) фон, `--dark` (#1F1F1F) линии и текст. |
| **Акцентные цвета** | `--pink` (#FF4D8F) — главный акцент шага; `--lime` (#C8FF6B) — второстепенный (стрелки движения данных, кнопки «дальше»). |
| **Использование акцентов** | Не больше 2 акцентных цветов на одной иллюстрации. Один из них — главный (3–5% площади), другой — второстепенный (1–3%). |
| **Линии** | Чёрные, толщина равная (примерно 2pt на 1200px ширины). Без градиентов. |
| **Перспектива** | Лёгкая изометрия 30° для объектов (касса, чек), фронтальная — для схем (DataMatrix, статусы кода). |
| **Соотношение сторон** | 4:3 (1200×900) для шагов, кроме Шага 0 — там 16:9 (1200×675). |
| **Объекты** | Стилизованные, не реалистичные. Касса — не фотография касса-аппарата, а узнаваемый силуэт с экраном и лентой. |
| **Текст в иллюстрации** | Только если он критичен для смысла (код DataMatrix, статус «Выведен из оборота»). Все объяснения — в HTML рядом, не на картинке. |

## Что обязательно НЕ должно быть

- **Людей** (ни лиц, ни фигур). Это сразу делает иллюстрацию
  стоковой.
- **Эмодзи и пиктограмм из эмодзи-шрифтов.**
- **3D-рендеров и фотореализма.** Это не hero-картинки статей,
  где у нас editorial photography.
- **Текста, который читать неудобно** (мелкий, повёрнутый, в
  перспективе).
- **Логотипов реальных компаний** (Сбер, 1С, ОФД-конкретный).
  Только обобщённые названия: «Касса», «ОФД», «Честный знак»
  (последнее — можно с обобщённым «галочка-в-квадрате» как
  логотип-плейсхолдер).
- **Реальных GTIN, штрих-кодов, серийников из жизни.** Только
  синтетические (`46070345678901` и т. п.) с дисклеймером
  в HTML рядом.

## Базовый промт для Nano Banana

```
Flat semi-isometric illustration in editorial explainer style,
reminiscent of notdotteam.github.io/trust and molyanov.ru
visualizations. Sand-colored background (#F4EBD9), dark
charcoal lines (#1F1F1F), equal stroke weight. Two accent
colors maximum per image: primary pink (#FF4D8F) for the
focal element and secondary lime (#C8FF6B) for data flow
arrows or active states. No people, no realistic 3D, no
stock-photo aesthetic. Clean composition with one dominant
object and supporting smaller elements. 4:3 aspect ratio.
Russian B2B explainer context — should look like a page from
a long-form interactive article about retail compliance
systems.

Subject: {{SUBJECT_LINE}}
```

### Конкретные SUBJECT_LINE по шагам

| Шаг | SUBJECT_LINE |
|---|---|
| 0 (16:9) | A grocery store cash register from a 30-degree isometric angle; on the conveyor belt lies a single retail package of candy (zefir or marshmallow-style sweet) with a clearly visible DataMatrix code on its label. Above the scene floats a thin line «3 seconds» in dark charcoal. Mood: calm, anticipatory, hint of «something invisible is about to happen». |
| 1 | A large DataMatrix code (the GS1 type, square dotted pattern) shown frontally, taking 60% of the frame. To the right, three horizontal bands extending from the code, each labeled with one short term: «GTIN», «Serial», «Crypto-tail». Light pink highlight on the «Crypto-tail» band — that's the primary focus. Small lime triangle marker pointing to the gap between bands, indicating an invisible GS separator. |
| 2 | An isometric outline of a POS terminal (cash register) cut into two layered zones. Top zone «Hardware» contains a small chip-like icon labeled «ФН» (fiscal storage). Bottom zone «Software» contains six labeled rectangles arranged in a grid: «Кассовая программа», «Драйвер ККТ», «Драйвер сканера», «ОФД-модуль», «ТС ПИоТ» (pink-highlighted), «ЛМ ЧЗ». Clean borders, no shadows. |
| 3 | A POS terminal on the left, a stylized cloud labeled «Честный знак» on the right, connected by a lime arrow. Between them, a small envelope-shaped JSON pack labeled `{ cm, inn, kkt_rn, op_type }`. A semi-transparent timer arc in the corner shows «1.5 sec» — pink highlight. |
| 4 (composite, optional separate visuals for branches) | Three vertical option cards stacked left-to-right: «✓ Валиден» (lime tint), «⚠ Выведен из оборота» (pink tint, primary focus), «✗ Нет в системе» (charcoal). Above all three — small cloud labeled «Честный знак» as the source. |
| 5 | A long thermal receipt rendered semi-isometrically, with three highlighted lines forming a connected block: «[1163] Код товара», «[2106] Результат проверки», «[1265] ID запроса». The block has a thin pink border around it to emphasize the structure. Background — same sand. |
| 6 | A POS terminal (left), an «ОФД» rectangle in the center, then a fork: one lime arrow rising up to «ФНС» (top-right), one pink arrow extending right to «Честный знак» (bottom-right). Small clock icons next to arrows: «секунды» for ФНС, «минуты» for ЧЗ. |
| 7 | A horizontal flow diagram showing five status circles connected by arrows: «Эмитирован» → «Нанесён» → «В обороте» → «Выведен из оборота» (pink-highlighted, current state) and a sixth branching off «Заблокирован». Below the highlighted circle — a small info card with rows: «ИНН», «ККТ», «ФД», «ФПД», «дата». |

## Что подготовить до запуска генерации

1. **Тестовая партия — 2 иллюстрации (Шаг 1 и Шаг 7).** Если
   они получились в едином стиле и читаемы — генерим остальные
   8. Если нет — итерируем промт.
2. **Сравнение моделей.** Сейчас в проекте используется
   `google/gemini-3.1-flash-image-preview` (Nano Banana). Перед
   массовой генерацией стоит проверить тот же промт на 1–2
   альтернативах (FLUX.1, Ideogram) и выбрать ту, которая
   стабильнее держит сэндовый фон и плоский стиль.
3. **Кропы под мобильный.** 4:3 на мобильном вертикальном —
   узкий горизонтальный кусок. Для каждой иллюстрации нужен
   либо отдельный кроп 1:1 для мобилы, либо изначально
   композиция, которая хорошо читается в обоих соотношениях.

## Открытые вопросы

1. **Реалистичный масштаб «zефира».** В рефах кондитерки на
   маркировку чаще берут плитки шоколада или конфеты в
   обёртке. Зефир — менее канонический объект для иллюстрации
   маркировки. Может, поменять на условную «коробочку конфет»
   или «пачку печенья»? Для понимания тестового слоя — без
   разницы, но иллюстратору-AI может быть проще.
2. **Стилизация логотипа «Честного знака».** Реальный логотип
   защищён. Используем обобщённую «галочку в квадрате»? Или
   текстовую подпись «Честный знак» без иконки?
3. **Анимации поверх статики.** Часть шагов (Шаг 3, Шаг 6)
   подразумевает анимированный transition (конверт бежит по
   стрелке). Делаем как CSS-анимацию поверх статичного PNG?
   Или нужен SVG, чтобы анимировать отдельные элементы?
   От ответа зависит, в каком формате просим у Nano Banana.
   Безопасно — генерим PNG + отдельно делаем SVG-оверлей
   стрелок вручную.

## Связано

- `src/content/wiki/flagship-ts-piot-simulator.md` — сценарий.
- `docs/image-prompts.md` — общий гид по промтам (если такой
  файл уже есть; иначе позже создадим).
- `scripts/generate-hero-images.mjs` — основа для будущего
  `scripts/generate-flagship-illustrations.mjs` (когда дойдём
  до автоматизации).
