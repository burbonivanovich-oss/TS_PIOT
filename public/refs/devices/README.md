# Референс-картинки устройств для img2img генерации hero

Положи сюда оригинальные пресс-фото касс и фискальных регистраторов.
Скрипт scripts/generate-hero-images.mjs автоматически найдёт нужный реф
по slug статьи и приложит к запросу к Nano Banana.

## Маппинг slug → файл

Имя файла должно содержать pattern из DEVICE_REFS в scripts/generate-hero-images.mjs:

| Pattern в slug | Имя файла (любое из расширений) |
|---|---|
| mspos-f20 | mspos-f20.jpg / .png / .webp |
| mspos-t-d3-mini | mspos-t-d3-mini.jpg |
| mspos-t (без d3) | mspos-t.jpg |
| atol-27f | atol-27f.jpg |
| atol-30f | atol-30f.jpg |

## Откуда брать

Официальные пресс-материалы производителя или собственные фото.
Не использовать чужие фото без лицензии.
