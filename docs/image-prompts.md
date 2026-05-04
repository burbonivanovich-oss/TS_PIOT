# Промпты для генерации изображений статей

Два типа изображений:
- **Preview** — превью карточки, соотношение 4:3 (~800×600 px). Используется в листингах.
- **Hero** — шапка статьи, соотношение 16:9 (~1344×768 px). Размещается в тёмной левой колонке hero-блока (bg `#111`).

---

## Стилевой контекст бренда

Сайт — жёсткий, прямой, editorial. Палитра: тёмный (`#111`) + лаймовый (`#C8F500`) + малиновый (`#E8175D`) + бежевый (`#EDE8DF`). Шрифт Bebas Neue, uppercase.

**Задача фотографии** — служить подложкой под bold UI: тёмные изображения с хорошим контрастом работают под лаймовые и розовые UI-элементы поверх. Изображения не обязаны буквально воспроизводить фирменные цвета — они должны *не конкурировать* с ними.

**Два рабочих подхода:**

1. **Тёмный editorial** — тёмный фон (`#111`-атмосфера), резкий направленный свет, высокий контраст. Объекты: кассы, сканеры, упаковка, документы, розница.
2. **Светлый minimal** — нейтральный бежево-кремовый фон (близкий к `#EDE8DF`), чистая kompoziция, без цветового шума. Один-два объекта крупным планом.

---

## Общий стилевой суффикс

Добавлять к каждому промпту в скрипте (не повторять в каждом):

```
high contrast editorial photography, dark dramatic background OR clean cream-beige background,
sharp directional lighting, bold composition with strong shadows, professional B2B context,
Russian small retail or office environment, no text overlays, photorealistic
```

---

## Кластер: ТС ПИоТ

### 1. «Что такое ТС ПИоТ» — Hero (тёмный editorial)

```
Close-up of a modern compact fiscal POS terminal on a dark surface, strong directional
side light creating sharp highlights and deep shadows, dark charcoal background,
small glowing receipt printer next to it, bold product editorial photography,
high contrast, no text, photorealistic
```

### 2. «ТС ПИоТ: штрафы» — Hero (тёмный editorial)

```
An official stamped document and a closed receipt printer on a dark matte desk,
single overhead spotlight, dramatic shadows, serious mood, bold editorial,
high contrast black and cream palette, no readable text on document, photorealistic
```

### 3. «Подключение ТС ПИоТ: инструкция» — Preview (светлый minimal)

```
Hands close-up connecting a cable to a small POS terminal on a cream-beige surface,
clean overhead light, minimal composition, blurred retail shelves in background,
professional product photography, sharp focus on connection point, no text
```

### 4. «ТС ПИоТ на кассах Эвотор, АТОЛ, Штрих» — Preview (тёмный editorial)

```
Three different compact POS terminal models arranged in a row on a dark surface,
dramatic side lighting creating long shadows, bold product editorial composition,
high contrast, dark background, no labels or text visible, photorealistic
```

### 5. «ОФД для ТС ПИоТ» — Hero (светлый minimal)

```
Overhead flat lay on cream-beige surface: a printed fiscal receipt, a compact POS terminal,
a smartphone face-down, clean geometric composition with negative space on left side,
natural diffused light, minimal editorial, sharp shadows, no text overlays
```

---

## Кластер: Маркировка «Честный знак»

### 6. «Категории маркировки 2026» — Hero (тёмный editorial)

```
Wide low-angle shot of supermarket shelves stocked densely with consumer products,
dramatic tungsten retail lighting creating warm pools of light, dark upper area,
bold editorial atmosphere, shelves in sharp focus foreground blurring to background,
no readable brand labels, photorealistic, high contrast
```

### 7. «Маркировка молочной продукции» — Preview (светлый minimal)

```
Three glass milk bottles on a cream surface, clean overhead daylight,
minimal editorial still life, sharp geometric shadows, QR label faintly visible
on one bottle, bold composition, no brand text readable, photorealistic
```

### 8. «Маркировка пива» — Preview (тёмный editorial)

```
Two dark glass beer bottles on a black bar counter, strong backlight creating
rim highlights, condensation visible, moody dramatic atmosphere, dark background,
bold high-contrast editorial, no brand labels readable, photorealistic
```

### 9. «Разрешительный режим маркировки» — Hero (тёмный editorial)

```
Close-up of a barcode scanner actively scanning, red scan line visible,
dark dramatic background, strong directional light on scanner and operator's hand,
retail context blurred in background, bold editorial photography, high contrast, no text
```

### 10. «Штрафы за нарушение маркировки» — Hero (тёмный editorial)

```
A gavel on a dark wooden surface, single harsh overhead spotlight,
deep shadows, serious imposing mood, bold dramatic composition,
dark background with strong highlights on gavel head, photorealistic, no text
```

---

## Кластер: Онлайн-кассы (ККТ)

### 11. «Как выбрать онлайн-кассу 2026» — Hero (тёмный editorial)

```
Four compact POS terminal models lined up in a row on a dark surface, strong side
lighting creating sharp edge highlights, progressive focus blur from front to back,
bold product editorial, dark background, no brand labels visible, photorealistic
```

### 12. «Замена фискального накопителя» — Preview (светлый minimal)

```
Open fiscal receipt printer showing internal mechanism, small rectangular module
partially removed, clean cream-beige surface, overhead workshop light,
technical close-up editorial, sharp focus, no text, photorealistic
```

### 13. «Смарт-терминал vs фискальный регистратор» — Hero (тёмный editorial)

```
A touchscreen smart POS terminal and a compact receipt printer placed apart
on a dark surface, bold dramatic lighting with sharp separation between two devices,
high contrast editorial, dark background, equal visual weight left and right, no text
```

---

## Кластер: ЕГАИС

### 14. «Что такое ЕГАИС» — Hero (тёмный editorial)

```
Wide shot of liquor store shelves densely packed with wine and spirits bottles,
moody low tungsten lighting, dark upper shadow, warm amber bottle tones against dark,
bold editorial atmosphere, no readable labels, high contrast, photorealistic
```

### 15. «Гашение ВСД в Меркурии» — Preview (светлый minimal)

```
Hands typing on a laptop keyboard on a cream desk, laptop screen blurred showing
a government-style portal interface, harsh angular desk lamp light casting sharp shadows,
clean minimal composition, no readable screen text, photorealistic
```

### 16. «Учёт алкоголя в общепите» — Preview (тёмный editorial)

```
Bar counter at night: two wine glasses and a spirits bottle, single spotlight from above,
dark dramatic background, condensation on glass visible, bold moody atmosphere,
editorial bar photography, no text, high contrast, photorealistic
```

---

## Кластер: Законодательство / налоги

### 17. «Налоги для МСБ 2026» — Hero (светлый minimal)

```
Wide shot of a clean minimal desk: laptop, stacked documents, a calculator,
cream surface, harsh directional window light casting long shadows,
bold editorial office photography, no readable text on documents, photorealistic
```

### 18. «УСН и НДС: расчёт» — Preview (тёмный editorial)

```
Close-up of a printed spreadsheet with dense rows of numbers, a mechanical pencil
resting diagonally, dark desk surface, single sharp spotlight from above,
dramatic contrast, no readable numbers, bold editorial, photorealistic
```

### 19. «Проверки бизнеса 2026» — Hero (тёмный editorial)

```
Two people at a meeting table: one in formal attire facing another (back to camera),
documents spread between them, single overhead lamp, dark room with dramatic shadows,
serious imposing atmosphere, bold editorial documentary, faces not visible, no text
```

### 20. «ЕНС и ЕНП: уведомления» — Preview (светлый minimal)

```
A smartphone showing a blurred government app, placed on cream surface next to a pen
and folded printed document, harsh overhead light, minimal geometric composition,
clean editorial, sharp shadow, no readable screen content, photorealistic
```

---

## Технические параметры

| Тип | Соотношение | Разрешение | Параметр в скрипте |
|---|---|---|---|
| Preview | 4:3 | 800×600 | `width: 800, height: 600` |
| Hero | 16:9 | 1344×768 | `width: 1344, height: 768` |

## Рекомендуемые модели

| Модель | API | Качество | Стоимость |
|---|---|---|---|
| `black-forest-labs/flux-1-schnell` | OpenRouter | Хорошее | ~$0.004/img |
| `black-forest-labs/flux-1.1-pro` | OpenRouter | Лучшее | ~$0.04/img |

Текущие скрипты: `scripts/generate-preview-images.mjs` и `scripts/generate-hero-images.mjs`.
