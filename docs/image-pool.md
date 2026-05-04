# Пул изображений сайта

## Концепция

Сайт использует три слоя изображений:

| Слой | Кол-во | Назначение |
|---|---|---|
| **Универсальные фоны** | 6 | Любая статья, нейтральный контекст |
| **Категориальные базы** | 4–5 на категорию | Узнаваемая атмосфера кластера |
| **Тематические детали** | 10 | Конкретные объекты для ротации |

80% статей закрываются пулом. Уникальные изображения — только для флагманских материалов.

## Механика назначения

```ts
// В BlogPost.astro или при сборке
const pool = CAT_IMAGE_POOL[primaryCategory] ?? UNIVERSAL_POOL;
const idx  = slugCharSum % pool.length; // детерминировано, без Math.random()
const img  = pool[idx];
```

## Структура хранения

```
public/images/pool/
  universal-dark-01.jpg   … universal-dark-06.jpg
  ts-piot-01.jpg          … ts-piot-05.jpg
  markirovka-01.jpg       … markirovka-05.jpg
  kkt-01.jpg              … kkt-05.jpg
  egais-01.jpg            … egais-05.jpg
  zakonodatelstvo-01.jpg  … zakonodatelstvo-05.jpg
  detail-receipt-01.jpg
  detail-barcode-01.jpg
  … (10 деталей)
```

---

## Общий стилевой суффикс

Добавлять к каждому промпту в скрипте генерации:

```
high contrast editorial photography, dark dramatic lighting OR clean cream-beige surface,
sharp shadows, professional B2B context, Russian small retail or office environment,
no text overlays, photorealistic, no people's faces visible
```

Соотношения:
- **Hero** `--ar 16:9` или `width:1344, height:768`
- **Preview** `--ar 4:3` или `width:800, height:600`

---

## Блок 1 — Универсальные тёмные фоны

Используются когда категория статьи неизвестна или как запасной вариант.
Полностью абстрактные или минимальные — никаких предметов конкретной тематики.

### universal-dark-01
```
Dark matte concrete surface texture, close-up, even diffused studio light,
deep charcoal tones, subtle grain, no objects, abstract background,
high contrast, photorealistic
```

### universal-dark-02
```
Dark weathered paper texture, close-up macro shot, soft raking light
creating subtle shadows in paper grain, near-black background,
minimal abstract, no text, photorealistic
```

### universal-dark-03
```
Overhead shot of a dark wooden desk surface, completely empty, single narrow
window light strip across the surface, deep shadows in wood grain,
clean minimal abstract, no objects, photorealistic
```

### universal-dark-04
```
Dark corrugated cardboard texture shot at angle, dramatic side light,
deep shadows in ridges, charcoal and near-black tones, abstract industrial,
no objects, photorealistic
```

### universal-dark-05
```
Close-up of dark grey linen fabric texture, even soft light,
fine woven pattern visible, minimal grain, dark neutral background,
no objects, abstract, photorealistic
```

### universal-dark-06
```
Blurred bokeh background of a dark office interior, multiple small warm
light sources creating orbs, deep charcoal background, abstract atmospheric,
no recognizable objects in focus, professional environment, photorealistic
```

---

## Блок 2 — ТС ПИоТ (5 изображений)

Тематика: кассы, фискальные терминалы, розница, сканирование.
Настроение: технологичное, сдержанное, деловое.

### ts-piot-01 — Hero
```
Wide shot of a modern compact POS terminal and receipt printer on a dark retail counter,
strong side lighting creating sharp shadows, dark background,
small status LED glowing green on terminal, bold editorial product photography,
no text on screen, no readable labels, photorealistic
```

### ts-piot-02 — Preview
```
Close-up overhead of a fiscal receipt thermal printer, paper roll partially pulled out,
dark surface underneath, single overhead spotlight, deep shadows,
editorial still life, no text on receipt, photorealistic
```

### ts-piot-03 — Hero
```
Low angle wide shot of a small convenience store checkout counter at night,
POS terminal in center, dim warm overhead light, dark background,
empty counter, no customers, moody retail atmosphere, photorealistic
```

### ts-piot-04 — Preview
```
Three different compact fiscal receipt printers lined up on a dark surface,
strong directional side light creating long parallel shadows,
bold product editorial, dark background, no labels, photorealistic
```

### ts-piot-05 — Hero
```
Overhead flat lay on dark surface: a POS terminal, a coiled receipt paper roll,
a USB cable, small blank notepad — arranged in a clean grid layout,
single overhead light, sharp shadows, editorial product photography,
no text visible, photorealistic
```

---

## Блок 3 — Маркировка (5 изображений)

Тематика: штрих-коды, QR-коды, упаковка, розничные полки.
Настроение: системное, упорядоченное.

### markirovka-01 — Hero
```
Wide low-angle shot of supermarket shelves densely stocked with consumer goods,
warm tungsten retail lighting, dark upper area with bright shelf lights,
blurred products background, bold editorial retail photography, no readable labels,
photorealistic
```

### markirovka-02 — Preview
```
Close-up macro of a QR-code label on a product package, sharp focus on code cells,
soft blurred background in dark tones, single spot light, dramatic shadows,
editorial detail shot, photorealistic
```

### markirovka-03 — Hero
```
Barcode scanner gun hanging on a retail shelf bracket, dark warehouse background,
single overhead fluorescent strip light, editorial industrial photography,
no text, clean composition with negative space on left, photorealistic
```

### markirovka-04 — Preview
```
Overhead flat lay: five different consumer product packages (dairy, beverage,
personal care) arranged on a dark surface, sharp overhead light,
QR labels faintly visible, editorial still life, no readable brand text,
photorealistic
```

### markirovka-05 — Hero
```
Wide shot of a warehouse storage area: cardboard boxes on shelving racks,
barcode labels on boxes, dramatic industrial lighting from above,
dark upper ceiling, bold editorial warehouse photography,
no readable text on boxes, photorealistic
```

---

## Блок 4 — ККТ / Онлайн-кассы (5 изображений)

Тематика: кассовые аппараты, фискальные накопители, ФНС, регистрация.
Настроение: деловое, надёжное, техническое.

### kkt-01 — Hero
```
Wide shot of a modern touchscreen smart POS terminal on a café counter,
warm ambient lighting from pendant lamps above, dark background,
empty counter surface, no customers, editorial hospitality B2B photography,
no text on screen, photorealistic
```

### kkt-02 — Preview
```
Open cash register drawer showing empty slots, dark background,
single overhead spot light, bold product editorial photography,
no money visible, clean editorial, photorealistic
```

### kkt-03 — Hero
```
Four different POS terminal models arranged in a row on dark surface,
progressive depth of field blur from front to back,
dramatic directional side lighting, dark background, no labels, photorealistic
```

### kkt-04 — Preview
```
Close-up hands (hands only, forearms cropped) installing a small rectangular
fiscal accumulator module into an open printer, warm workshop light,
dark background, editorial technical photography, photorealistic
```

### kkt-05 — Hero
```
Long exposure night shot of a supermarket checkout lane, warm tungsten lights
above empty checkout belt, POS terminal lit and waiting, blurred background,
atmospheric retail photography, no customers, photorealistic
```

---

## Блок 5 — ЕГАИС (5 изображений)

Тематика: алкоголь, лицензирование, акцизы, склад.
Настроение: серьёзное, регуляторное, при этом живое.

### egais-01 — Hero
```
Wide shot of a wine and spirits retail section: densely packed bottle shelves,
warm tungsten lighting, dark upper area, amber bottle tones against dark background,
editorial retail photography, no readable labels, photorealistic
```

### egais-02 — Preview
```
Close-up of three wine bottles on a dark bar counter, strong backlight creating
rim highlights on glass, condensation on bottles, dark moody background,
bold editorial bar photography, no labels readable, photorealistic
```

### egais-03 — Hero
```
Wide shot of a wine storage cellar or warehouse: rows of bottles in dark wooden
racks, low amber accent lights, dark stone background,
editorial moody atmosphere, photorealistic
```

### egais-04 — Preview
```
Overhead flat lay on dark surface: a spirits bottle, two glasses,
a folded printed document, a pen — arranged in geometric composition,
single overhead spot light, sharp shadows, no text on document, photorealistic
```

### egais-05 — Hero
```
Wide dark bar interior at closing time: back bar shelves with bottles lit from below,
warm amber underlit glow on bottles, dark room beyond the bar,
moody editorial atmosphere, no people, photorealistic
```

---

## Блок 6 — Законодательство / Налоги (5 изображений)

Тематика: документы, налоги, проверки, ЭДО, офис.
Настроение: авторитетное, деловое, без пафоса.

### zakonodatelstvo-01 — Hero
```
Wide editorial shot of a minimalist office desk: laptop, stacked paper documents,
a pen holder, a coffee cup — single harsh side window light casting long shadows,
dark desk surface, no readable text on documents, photorealistic
```

### zakonodatelstvo-02 — Preview
```
Close-up of a stack of printed documents with a mechanical pencil resting diagonally,
single overhead spot light, dark desk surface, sharp shadows,
editorial still life, no readable text on papers, photorealistic
```

### zakonodatelstvo-03 — Hero
```
Wide shot of a meeting room: two chairs at a dark table, printed documents spread
between empty chairs, overhead pendant light, dark background beyond,
serious restrained atmosphere, no people, editorial documentary, photorealistic
```

### zakonodatelstvo-04 — Preview
```
A laptop partially closed on a dark desk, screen glow visible on surface,
a paper document beside it, single desk lamp light, deep shadows,
editorial office photography, no readable screen content, photorealistic
```

### zakonodatelstvo-05 — Hero
```
Overhead flat lay on cream-sand surface: a fountain pen, a folded official document
with an embossed seal (no readable text), a paper clip, arranged with deliberate spacing,
clean editorial still life, harsh angular light, sharp shadows, photorealistic
```

---

## Блок 7 — Тематические детали (10 изображений)

Узнаваемые объекты для ротации внутри категорий. Могут использоваться в любом кластере.

### detail-receipt
```
A fresh thermal receipt partially unrolled on a dark surface,
single spotlight, crisp shadows, text on receipt blurred/unreadable, photorealistic
```

### detail-barcode-scan
```
Handheld barcode scanner mid-scan, red laser line visible on surface,
dark background, scanner in sharp focus, dramatic side light, photorealistic
```

### detail-stamp
```
An official rubber stamp and ink pad on a dark surface, single harsh overhead light,
bold graphic shadow, stamp face blurred, no readable text, photorealistic
```

### detail-calculator
```
A business calculator on a dark desk, keys in sharp focus, display blurred,
single narrow light strip from side, editorial product photography, photorealistic
```

### detail-document-pen
```
A pen resting on a printed form, hand not visible, close-up,
dark desk surface, single lamp light, blurred background, no readable text, photorealistic
```

### detail-smartphone-gov
```
A smartphone showing a blurred interface (government app style),
dark desk surface, editorial product shot, soft side light, photorealistic
```

### detail-laptop-dark
```
Laptop open on dark desk, screen partially visible but blurred, keyboard sharp,
single window light from side, editorial office photography, photorealistic
```

### detail-shelves-wide
```
Wide shot of empty retail shelving racks, dark warehouse, industrial overhead
fluorescent lighting, clean orderly metal structure, no products, photorealistic
```

### detail-envelope
```
A sealed white envelope on a dark surface with an official-looking sticker,
single harsh overhead spotlight, crisp shadow, no readable text, photorealistic
```

### detail-gavel
```
A wooden gavel on a dark surface, single overhead spot light, deep dramatic shadow,
editorial product photography, bold composition, photorealistic
```

---

## Технические параметры генерации

| Тип | Размер | Использование |
|---|---|---|
| Hero | 1344×768 (16:9) | Левая колонка hero-блока статьи |
| Preview | 800×600 (4:3) | Карточки в листингах |

Каждый промпт генерировать в обоих размерах → итого ~72 файла для полного пула.

## Рекомендуемые модели

| Задача | Модель | API |
|---|---|---|
| Быстрый прогон всего пула | `black-forest-labs/flux.2-max` | OpenRouter |
| Финальный прогон (рекомендуется) | `black-forest-labs/flux.2-max` | OpenRouter |
