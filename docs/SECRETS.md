# Секреты GitHub: что есть, как получить, как обновлять

Все API-ключи проекта живут в **Settings → Secrets and variables →
Actions** репозитория. Этот документ — единый справочник.

## Сводная таблица

| Секрет | Сервис | Срок жизни | Используется |
|---|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter | бессрочный | Hero, preview, flagship-illustrations, OG-фоны |
| `METRIKA_OAUTH_TOKEN` | Яндекс OAuth (Метрика) | **1 год** | sync-goals, fetch-metrika-traffic |
| `WORDSTAT_OAUTH_TOKEN` | Яндекс OAuth (Wordstat) | **1 год** | wordstat-weekly |
| `WEBMASTER_OAUTH_TOKEN` | Яндекс OAuth (Вебмастер) | **1 год** | fetch-webmaster |
| `WEBMASTER_HOST` | строка | — | fetch-webmaster (опционально) |
| `GSC_CLIENT_ID` | Google Cloud | бессрочный | fetch-gsc |
| `GSC_CLIENT_SECRET` | Google Cloud | бессрочный | fetch-gsc |
| `GSC_REFRESH_TOKEN` | Google OAuth2 | бессрочный (test apps — 7 дней без верификации, но рефрешится) | fetch-gsc |
| `GSC_SITE_URL` | строка | — | fetch-gsc |
| `ORD_API_KEY` | Яндекс ОРД | по договору | ord-register, ord-bootstrap, ord-status |
| `GEMINI_API_KEY` | Google AI Studio | бессрочный | OG-backgrounds через Imagen |
| `JINA_API_KEY` | Jina AI | бессрочный | embeddings-monthly |
| `OPENAI_API_KEY` | OpenAI | бессрочный | embeddings-monthly (опционально) |
| `GOOGLE_INDEXING_KEY` | Google Cloud service account | бессрочный | Indexing API — уведомление Google о новых страницах |
| `GITHUB_TOKEN` | автоматически | в каждом workflow | git push commit'ов |

## Приоритеты обновления

**Раз в год** — токены Яндекс OAuth (`METRIKA_OAUTH_TOKEN`,
`WORDSTAT_OAUTH_TOKEN`, `WEBMASTER_OAUTH_TOKEN`). Если они истекли,
соответствующий workflow упадёт с 401. Workflow analytics-refresh
помечен `continue-on-error` — он не блокирует деплой, но трафик в
дашборд не обновится.

**По мере необходимости:**
- `OPENROUTER_API_KEY` — если баланс кончился (платит OpenRouter)
- `GEMINI_API_KEY` — если квота Google AI Studio превышена
- `ORD_API_KEY` — при смене договора с Яндекс ОРД

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
`etiketka-media.ru` в [webmaster.yandex.ru](https://webmaster.yandex.ru/).

**Опциональный секрет** `WEBMASTER_HOST`: точная hostname как
зарегистрирована в Вебмастере. По умолчанию скрипт использует
`etiketka-media.ru`.

**Гайд:** `docs/analytics.md` (раздел «Яндекс.Вебмастер»).

---

## WORDSTAT_OAUTH_TOKEN

**Scope:** «Яндекс.Wordstat API» (отдельный сервис, отдельное приложение).

**Использование:** `wordstat/fetch.mjs`, `wordstat/discover.mjs` —
weekly cron собирает частоты по 162 seed'ам.

**Лимиты API:** 1000 запросов/сутки, 10 req/sec. Бюджет нашего
прогона ~640 квот, влезаем.

**Гайд:** `docs/wordstat.md`.

---

## Google Search Console: GSC_*

GSC API — самый сложный сетап, потому что Google требует OAuth2 с
рефреш-токеном.

**4 секрета нужны вместе:**
- `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET` — из Google Cloud OAuth client
- `GSC_REFRESH_TOKEN` — получается одноразовым обменом authorization code
- `GSC_SITE_URL` — точное значение из консоли (например
  `https://etiketka-media.ru/` или `sc-domain:etiketka-media.ru`)

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

## ORD_API_KEY

**Сервис:** Яндекс ОРД — Оператор Рекламных Данных. Регистрация
рекламных креативов (erid-токены) согласно 38-ФЗ.

**Получение:** через личный кабинет в Яндексе после заключения
договора как Рекламораспространитель.

**Использование:** `ord-register.mjs`, `ord-bootstrap.mjs`,
`ord-status.mjs` — синхронизация `src/data/ord-config.json` с ОРД.

**Workflow `ord-sync.yml`** имеет автотриггер на push к
`src/data/ord-config.json` — добавил организацию или баннер в JSON,
запушил → erid-токен прилетел.

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

## GOOGLE_INDEXING_KEY

**Сервис:** Google Indexing API — уведомляет Google о новых
страницах для ускоренной индексации.

**Формально API для:** JobPosting и BroadcastEvent schema.
**Фактически:** работает для любых URL, но Google может ограничить
квоту или игнорировать. Серая зона, используем «на свой риск».

**Получение (15 минут, один раз):**

1. [Google Cloud Console](https://console.cloud.google.com/) →
   тот же проект, что для GSC (или новый).
2. **APIs & Services → Library** → найти **Indexing API** → Enable.
3. **APIs & Services → Credentials → Create credentials → Service account**:
   - Name: `etiketka-indexing`
   - Role: можно без roles на этом шаге
   - Create → перейти к созданному account → вкладка **Keys** →
     **Add key → Create new key → JSON** → скачивается файл.
4. Скопировать `client_email` из JSON. Это адрес вида
   `etiketka-indexing@project.iam.gserviceaccount.com`.
5. [Search Console](https://search.google.com/search-console) →
   ваш property → **Settings → Users and permissions → Add user**:
   - Email: client_email из шага 4
   - Role: **Owner** (обязательно — иначе Indexing API вернёт
     `PERMISSION_DENIED`)
6. Содержимое JSON-файла (целиком) — в секрет:
   `GOOGLE_INDEXING_KEY` = base64 от JSON (так надёжнее) или
   сам JSON в одну строку. Скрипт распарсит оба варианта.
   ```bash
   base64 -w0 etiketka-indexing-key.json
   ```

**Использование:** `scripts/google-index.mjs` + workflow
`index-notify.yml`. Скрипт делает JWT, обменивает на access_token,
шлёт POST по одному URL.

**Лимиты:**
- 200 запросов/сутки по умолчанию
- 600/сутки для verified domains
- Превышение → 429 Too Many → скрипт остановится. LIMIT=180 в
  workflow даёт запас.

**Что если Google перестанет принимать:** просто оставляем
`continue-on-error: true` в workflow. Если 403/404 на большинстве
URL'ов — отключаем шаг (skip_google=1 в dispatch).

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
