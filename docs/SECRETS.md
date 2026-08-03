# Секреты GitHub: что есть, как получить, как обновлять

Все API-ключи проекта живут в **Settings → Secrets and variables →
Actions** репозитория. Этот документ — единый справочник.

## Сводная таблица

| Секрет | Сервис | Срок жизни | Используется |
|---|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter | бессрочный | Hero, preview, flagship-illustrations, OG-фоны |
| `METRIKA_OAUTH_TOKEN` | Яндекс OAuth (Метрика) | **1 год** | sync-goals, fetch-metrika-traffic |
| `YC_API_KEY` | Yandex Cloud Search API (сервисный аккаунт) | бессрочный | wordstat-weekly |
| `YC_FOLDER_ID` | Yandex Cloud (ID каталога) | — | wordstat-weekly |
| `WEBMASTER_OAUTH_TOKEN` | Яндекс OAuth (Вебмастер) | **1 год** | fetch-webmaster |
| `WEBMASTER_HOST` | строка | — | fetch-webmaster (опционально) |
| `GSC_CLIENT_ID` | Google Cloud | бессрочный | fetch-gsc |
| `GSC_CLIENT_SECRET` | Google Cloud | бессрочный | fetch-gsc |
| `GSC_REFRESH_TOKEN` | Google OAuth2 | бессрочный (test apps — 7 дней без верификации, но рефрешится) | fetch-gsc |
| `GSC_SITE_URL` | строка | — | fetch-gsc |
| `GEMINI_API_KEY` | Google AI Studio | бессрочный | OG-backgrounds через Imagen |
| `JINA_API_KEY` | Jina AI | бессрочный | embeddings-monthly |
| `OPENAI_API_KEY` | OpenAI | бессрочный | embeddings-monthly (опционально) |
| `GOOGLE_DOCS_KEY` | Google Cloud service account | бессрочный | Drive + Docs API — выгрузка соцпостов в Google Docs |
| `GOOGLE_DOCS_FOLDER_ID` | строка | — | ID папки Drive для соцпостов |
| `GOOGLE_DOCS_FOLDER_ID` | строка | — | она же — корневая папка редакционного цикла |
| `GITHUB_TOKEN` | автоматически | в каждом workflow | git push commit'ов |

## Приоритеты обновления

**Раз в год** — токены Яндекс OAuth (`METRIKA_OAUTH_TOKEN`,
`WEBMASTER_OAUTH_TOKEN`). Если они истекли,
соответствующий workflow упадёт с 401. Workflow analytics-refresh
помечен `continue-on-error` — он не блокирует деплой, но трафик в
дашборд не обновится.

**По мере необходимости:**
- `OPENROUTER_API_KEY` — если баланс кончился (платит OpenRouter)
- `GEMINI_API_KEY` — если квота Google AI Studio превышена

## Как добавить секрет в GitHub

1. **Settings → Secrets and variables → Actions** в репозитории
2. **New repository secret**
3. Имя — точно как в таблице выше (case-sensitive)
4. Значение — токен/ключ. Без кавычек, без `OAuth ` префикса, без пробелов

После сохранения — все workflow получают доступ автоматически.

---

## OpenRouter

**Что это:** агрегатор LLM/image API, через который мы дёргаем
Google Gemini, FLUX, OpenAI, Imagen, Recraft и др.

**Как получить:**
1. Зарегистрироваться на [openrouter.ai](https://openrouter.ai/)
2. Пополнить баланс (минимум $5)
3. [openrouter.ai/keys](https://openrouter.ai/keys) → **Create key**
4. Скопировать `sk-or-v1-...`

**Когда обновлять:** ключ бессрочный. Меняем только если он
скомпрометирован или вы создали новый.

**Расход:** ~$0.04 за hero (Nano Banana 2), ~$0.04 за OG-фон.
83 статьи hero = $3.5/мес при пересоздании всех.

---

## Яндекс OAuth: общие шаги

Метрика, Вебмастер и Wordstat используют один источник —
**oauth.yandex.ru**, но **разные scope** и **разные приложения**
(могут быть одним приложением со всеми scope, но удобнее держать
раздельно для аудита).

### Создание приложения

1. [oauth.yandex.ru](https://oauth.yandex.ru/) → войти под аккаунтом
   с правами доступа к нужному сервису
2. **Зарегистрировать приложение**:
   - Платформа: «Веб-сервисы»
   - Redirect URI: `https://oauth.yandex.ru/verification_code`
3. В разделе **Доступы** выбрать нужный scope (см. ниже)
4. Сохранить → скопировать **ClientID**

### Получение токена (implicit flow, самый простой)

В браузере открыть:

```
https://oauth.yandex.ru/authorize?response_type=token&client_id=ВАШ_CLIENT_ID
```

Подтвердить доступ. В URL после редиректа:

```
https://oauth.yandex.ru/verification_code#access_token=y0_AgAAA...&expires_in=...
```

Скопировать значение между `access_token=` и `&` — это и есть токен.

> **Срок жизни** для приложений без явной ротации — обычно **1 год**.
> Поставьте напоминание в календарь!

---

## METRIKA_OAUTH_TOKEN

**Scope:** «Яндекс.Метрика → Управление счётчиками, включая параметры
обработки и доступа» (`metrika:write` — включает чтение).

**Использование:** `sync-goals.mjs` (запись целей через Management API)
+ `fetch-metrika-traffic.mjs` (чтение трафика через Stat API).

**Аккаунт:** должен быть «Представитель — редактирование» или
владелец счётчика **109130279**. Проверить — на
[metrika.yandex.ru](https://metrika.yandex.ru/) счётчик должен быть в списке.

**Гайд:** `docs/metrika.md` (раздел «Первичная настройка»).

---

## WEBMASTER_OAUTH_TOKEN

**Scope:** «Яндекс.Вебмастер → Управление сайтами и данными о них»
(`webmaster:hostinfo`).

**Использование:** `fetch-webmaster.mjs` (SQI + топ запросы).

**Аккаунт:** должен быть **подтверждённым владельцем хоста**
`kontur.ru` в [webmaster.yandex.ru](https://webmaster.yandex.ru/).

**Опциональный секрет** `WEBMASTER_HOST`: точная hostname как
зарегистрирована в Вебмастере. По умолчанию скрипт использует
`kontur.ru`.

**Гайд:** `docs/analytics.md` (раздел «Яндекс.Вебмастер»).

---

## YC_API_KEY + YC_FOLDER_ID

Wordstat переехал в **Yandex Cloud Search API v2**. Старый
`WORDSTAT_OAUTH_TOKEN` (api.wordstat.yandex.net/v1) отключён — удалён из
секретов.

**Использование:** `wordstat/fetch.mjs`, `wordstat/discover.mjs` —
weekly cron собирает частоты по 162 seed'ам.

**Как получить (чек-лист):**
1. Yandex Cloud → привязать платёжный аккаунт (без него 403/402).
2. Запомнить **ID каталога** (`b1ghs…`), не облака (`b1gl7…`) → `YC_FOLDER_ID`.
3. Создать **сервисный аккаунт**, выдать роль `search-api.webSearch.user`
   на каталог (распространяется ~1 минуту).
4. Создать **API-ключ** этого аккаунта → `YC_API_KEY`.
5. Проверка: `curl` к `/v2/wordstat/topRequests` с `numPhrases` должен
   вернуть `results`.

**Авторизация:** заголовок `Authorization: Api-Key <ключ>`, `folderId` в теле
каждого запроса. Сервис платный (тариф за запрос).

**Безопасность:** Api-Key = доступ к платному сервису под ваш счёт. При утечке —
удалить и пересоздать в том же сервисном аккаунте (роль сохранится).

**Гайд:** `docs/wordstat.md`.

---

## Google Search Console: GSC_*

GSC API — самый сложный сетап, потому что Google требует OAuth2 с
рефреш-токеном.

**4 секрета нужны вместе:**
- `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET` — из Google Cloud OAuth client
- `GSC_REFRESH_TOKEN` — получается одноразовым обменом authorization code
- `GSC_SITE_URL` — точное значение из консоли (например
  `https://kontur.ru/` или `sc-domain:kontur.ru`)

**Аккаунт:** должен иметь доступ к property GSC как **«Полный
пользователь»** или **«Владелец»**.

**Гайд:** `docs/analytics.md` (раздел «Google Search Console»). Там
4 шага с конкретными URL'ами и curl-командой для обмена code на
refresh_token.

**Особенность:** для приложений в статусе **Testing** в Google
Cloud Console refresh_token живёт **7 дней без верификации**. Но
поскольку мы используем его только для рефреша access_token,
которые мы запрашиваем каждый прогон — это не проблема. Если хочется
бессрочный — пройти процедуру **Publish** в Google Cloud (требует
review).

---

## GEMINI_API_KEY

**Сервис:** Google AI Studio (платный API напрямую к Imagen,
не через OpenRouter).

**Получение:** [aistudio.google.com](https://aistudio.google.com/)
→ **Get API key**.

**Использование:** `generate-og-backgrounds-gemini.mjs` для
Imagen 4 (через прямой Google API, минуя OpenRouter — иногда дешевле).

**Опциональный:** все картинки можно генерить через OpenRouter без
GEMINI_API_KEY вообще.

---

## GOOGLE_DOCS_KEY + GOOGLE_DOCS_FOLDER_ID

**Сервис:** Google Drive + Docs API — автоматическая выгрузка
черновиков из `src/content/wiki/social/` в Google Docs для
дальнейшей публикации в Telegram, VK, Дзен, рассылке.

**Получение (10 минут, один раз):**

1. **Создать папку в Google Drive** — например «Контур —
   Соцпосты». Открыть её, скопировать ID из URL:
   `https://drive.google.com/drive/folders/<ID>`
2. **Google Cloud Console** → APIs & Services → Library →
   включить **Google Drive API** и **Google Docs API**.
3. **Создать service account** (можно тот же, что для Indexing
   API — он уже есть):
   - APIs & Services → Credentials → Create credentials →
     Service account
   - Скачать JSON-ключ
4. **Поделиться папкой с service account email.** В Google Drive:
   ПКМ на папке → **Открыть доступ** → ввести `client_email`
   из JSON → роль **Редактор**.
5. **Прописать секреты:**
   - `GOOGLE_DOCS_KEY` = JSON service account как одна строка
     или base64
   - `GOOGLE_DOCS_FOLDER_ID` = ID папки из шага 1

**Альтернатива (Способ B):** использовать OAuth-токен уже
существующих `GSC_*` секретов. Нужно добавить scope
`https://www.googleapis.com/auth/drive.file` в OAuth consent
screen и переполучить refresh_token. Документы будут создаваться
от имени вашего личного аккаунта, расшаривать папку с
service-account email не нужно. Подробнее — `docs/SECRETS.md`
раздел «Обходной путь через OAuth refresh_token».

**Использование:** `scripts/drive-sync.mjs` — та же аутентификация
(сервисный аккаунт + откат на OAuth), используется мостом в Google Drive
для редакционного цикла: таблица плана и доки статей. Подробности —
`docs/editorial-cycle.md`, `docs/google-api-setup.md`.

**Идемпотентно:** повторный запуск находит документ с тем же
именем в папке и обновляет содержимое, не создаёт дубль.

### ⚠ Service Account даёт `storageQuotaExceeded`

**Симптом:** при первом боевом запуске на всех файлах падает
`403 The user's Drive storage quota has been exceeded`.

**Причина:** Google service-account не имеет собственной квоты
Drive. Даже если папка расшарена с ним и принадлежит вашему
личному аккаунту с 15 ГБ — при создании файла объём учитывается
в квоте **создателя** (= service-account = 0 ГБ).

**Решение — переключиться на OAuth refresh_token (Способ B):**
1. Удалить секрет `GOOGLE_DOCS_KEY` (или не задавать его)
2. Добавить scope `https://www.googleapis.com/auth/drive.file`
   в OAuth consent screen в Google Cloud
3. Переполучить `GSC_REFRESH_TOKEN` с обновлённым scope (см.
   раздел «Обходной путь через OAuth refresh_token» выше)
4. Запустить workflow заново

Скрипт автоматически переключается на OAuth, если SA даёт
`storageQuotaExceeded` **и** OAuth-креды (`GSC_*`) тоже заданы.
Если у вас только service-account — нужно либо переключиться
на OAuth явно, либо подключить Workspace + Shared Drive.

---

## JINA_API_KEY и OPENAI_API_KEY

**Сервис:** провайдеры для embeddings (семантический поиск, similarity).

**Использование:** `audit/embed-articles.mjs` — раз в месяц через
`embeddings-monthly.yml`.

**JINA** — бесплатный лимит обычно покрывает наш объём.
**OPENAI** — альтернатива, если Jina недоступна.

Достаточно одного из них (скрипт автоматически выбирает доступный).

---

## Что делать, если workflow упал по 401/403

| Код | Что значит | Что делать |
|---|---|---|
| 401 Unauthorized | Токен невалидный / истёк | Получить новый по гайду выше, обновить секрет |
| 403 Forbidden | Токен валидный, но прав не хватает | Проверить роль аккаунта в соответствующем сервисе |
| 429 Too Many Requests | Превышен лимит API | Подождать сутки или взять платный тариф |

При 401 на Яндекс OAuth — всегда смотрите дату создания токена в
календаре или в логах последнего успешного прогона. Если прошёл год —
истёк, нужен новый.

---

## Backup-стратегия

Все секреты — внешние, репозиторий их не хранит. **Если потеряете
доступ к GitHub репо, восстановить токены придётся вручную** — все
шаги выше повторяются.

Рекомендация: храните **ClientID + последний токен** в зашифрованном
вэлте (1Password, Bitwarden, KeePass). Достаточно одной записи на
сервис — клиент_id можно переиспользовать, токен переполучить за 5 минут.
