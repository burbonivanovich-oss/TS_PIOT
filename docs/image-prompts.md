# Промпты для генерации изображений статей

Два типа изображений:
- **Preview** — превью карточки, соотношение 4:3 (~800×600 px). Используется в листингах.
- **Hero** — шапка статьи, соотношение 16:9 (~1344×768 px). Занимает левую колонку hero-блока.

## Стилевой контекст

Сайт — информационный портал для малого и среднего бизнеса РФ. Дизайн:
тёмный (#111) + тёплый кремово-бежевый (#EDE8DF) + белый, акцент — приглушённый малиновый.
Не кричащий, не корпоративно-синий, не стоковый. Ближе к деловому журналу — Monocle, РБК.

**Общий стилевой суффикс** (добавлять к каждому промпту):
```
editorial photography style, warm neutral color palette (charcoal, cream, warm white),
clean composition, shallow depth of field, soft natural light from the side,
no text overlays, no neon colors, muted tones, professional B2B feel,
Russian small retail or office environment context, sharp details
```

---

## Кластер: ТС ПИоТ

### 1. «Что такое ТС ПИоТ» — Hero

```
Close-up of a modern compact fiscal receipt printer and a small touchscreen POS terminal
on a clean retail counter, dark charcoal background, warm side lighting,
a faint barcode scan visible on the terminal screen, cream-colored surface beneath devices,
editorial photography style, warm neutral color palette, clean composition,
shallow depth of field, soft natural light, no text overlays, muted professional tones
```

### 2. «ТС ПИоТ: штрафы за отсутствие» — Hero

```
A folded official document with a visible stamp seal on a dark wooden desk,
next to a closed cash register, warm window light casting soft shadows,
serious and restrained mood, no people, editorial photography style,
warm neutrals (cream, charcoal), clean composition, no text overlays
```

### 3. «Подключение ТС ПИоТ: пошаговая инструкция» — Preview

```
Hands of a person (hands only, cropped) connecting a USB cable to a small fiscal
receipt terminal on a retail counter, blurred background showing shelves,
warm natural light, editorial close-up, cream and charcoal palette, no text
```

### 4. «ТС ПИоТ на кассах Эвотор, АТОЛ, Штрих» — Preview

```
Three different POS terminal models lined up on a minimalist cream-colored shelf,
dark background, product-style editorial photography, soft diffused side light,
neutral tones, no labels or text visible on devices, professional B2B feel
```

### 5. «ОФД для ТС ПИоТ» — Hero

```
Overhead flat lay: a printed fiscal receipt next to a compact POS terminal,
a smartphone with a blurred interface, and a glass of water on a sand-colored desk,
editorial top-down composition, warm neutral light, charcoal and cream palette,
clean negative space on one side, no text overlays
```

---

## Кластер: Маркировка «Честный знак»

### 6. «Категории маркировки 2026» — Hero

```
Wide editorial shot of supermarket shelves stocked with various consumer products —
dairy, beverages, personal care items — photographed from a low angle,
warm tungsten-tinted retail lighting, blurred depth in background,
muted warm tones, no focus on specific brand labels, professional calm atmosphere
```

### 7. «Маркировка молочной продукции» — Preview

```
Close-up of a glass milk bottle and a small cardboard package of dairy on a wooden counter,
a faint QR code label visible on the packaging, warm side light,
editorial still life, cream and charcoal tones, soft shadows, no text overlays
```

### 8. «Маркировка пива и пивных напитков» — Preview

```
Two glass beer bottles on a dark bar counter, condensation visible, warm backlight,
editorial moody atmosphere, dark charcoal background, muted amber tones,
no brand labels visible, professional B2B feel, shallow depth of field
```

### 9. «Разрешительный режим маркировки» — Hero

```
A retail cashier's hand (hand and forearm only) hovering over a barcode scanner,
scanner light glowing, blurred shelves in background, muted retail environment,
editorial photography, warm neutral tones, charcoal and cream palette, no text
```

### 10. «Штрафы за нарушение маркировки» — Hero

```
A gavel and a small printed document on a minimalist dark desk, soft warm light
from a desk lamp, serious restrained mood, charcoal and cream palette,
no text visible, editorial photography style, clean negative space
```

---

## Кластер: Онлайн-кассы (ККТ)

### 11. «Как выбрать онлайн-кассу 2026» — Hero

```
Four different compact POS terminal models arranged in a row on a light cream surface,
product editorial photography, soft diffused overhead light, dark background behind them,
warm neutral palette, no labels, clean professional composition, no text overlays
```

### 12. «Замена фискального накопителя» — Preview

```
Open drawer of a fiscal receipt printer exposing the internal mechanism,
a small rectangular fiscal accumulator module visible, warm workshop light,
editorial close-up, dark charcoal and cream tones, no text, professional B2B
```

### 13. «Смарт-терминал vs фискальный регистратор» — Hero

```
Two devices side by side: a touchscreen smart POS terminal and a compact fiscal
receipt printer, separated by visible space on a cream-colored surface,
dark background, editorial product photography, soft side lighting,
warm neutral palette, no text visible, comparison-style clean composition
```

---

## Кластер: ЕГАИС

### 14. «Что такое ЕГАИС» — Hero

```
Wide shot of a small liquor store section: shelves with wine and spirits bottles,
warm tungsten lighting, clean orderly arrangement, no customers visible,
editorial B2B atmosphere, warm dark tones, muted charcoal and amber palette,
shallow depth of field, no text overlays
```

### 15. «Гашение ВСД в Меркурии» — Preview

```
Close-up of hands (hands only) typing on a laptop keyboard, screen slightly blurred
showing a government portal interface, warm desk lamp light, wooden desk surface,
editorial office photography, charcoal and cream tones, no identifiable screen text
```

### 16. «Учёт алкоголя в общепите» — Preview

```
Overhead flat lay of a bar counter: two wine glasses, a spirits bottle, a tablet
with a blurred inventory screen, small notepad, warm candlelight-style lighting,
editorial hospitality photography, dark moody but restrained tones, no text visible
```

---

## Кластер: Законодательство / налоги

### 17. «Налоги для МСБ 2026» — Hero

```
Wide editorial shot of a small open-plan office: a desk with a laptop, printed documents,
a calculator, and a cup of coffee, warm window light, one person visible from the back
only (blurred), clean business atmosphere, warm neutral palette (cream, charcoal),
no text on papers, professional restrained mood
```

### 18. «УСН и НДС: расчёт» — Preview

```
Close-up of a printed spreadsheet table with columns of figures, a mechanical pencil
pointing at a row, soft warm side light, dark desk surface, editorial still life,
charcoal and cream palette, shallow depth of field, no readable text or numbers
```

### 19. «Проверки бизнеса 2026» — Hero

```
Two people seated across a desk in a minimalist office: one person (blurred, formal attire)
facing another (back to camera, business casual), documents between them,
serious restrained atmosphere, warm natural window light, cream and charcoal tones,
editorial documentary photography, no text visible
```

### 20. «ЕНС и ЕНП: как подать уведомление» — Preview

```
A smartphone showing a blurred government app interface, held above a desk with
printed documents and a pen, warm editorial lighting, shallow depth of field,
cream desk surface, charcoal phone, muted professional tones, no readable text
```

---

## Технические параметры для генерации

| Тип | Соотношение | Разрешение | Параметр |
|---|---|---|---|
| Preview | 4:3 | 800×600 | `width: 800, height: 600` |
| Hero | 16:9 | 1344×768 | `width: 1344, height: 768` |

## Рекомендуемые модели

| Модель | API | Качество | Стоимость |
|---|---|---|---|
| `black-forest-labs/FLUX.1-schnell-Free` | Together.ai / OpenRouter | Хорошее | Бесплатно |
| `black-forest-labs/FLUX.1-dev` | Together.ai | Отличное | ~$0.025/img |
| `black-forest-labs/FLUX.1.1-pro` | OpenRouter | Лучшее | ~$0.04/img |

Текущая конфигурация в `scripts/generate-preview-images.mjs` и `scripts/generate-hero-images.mjs`.
