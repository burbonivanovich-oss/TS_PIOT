# Аналитика статей: GSC + Метрика → дашборд

Чтобы решать «что писать дальше» и «что обновить», нужен фактический
сигнал — позиции в поиске и трафик. У нас три скрипта и одна страница
дашборда, которые работают вместе.

## Что где

| Файл | Назначение |
|---|---|
| `scripts/analytics/fetch-gsc.mjs` | Тянет Google Search Console: клики, показы, средняя позиция, CTR по URL |
| `scripts/analytics/fetch-metrika-traffic.mjs` | Тянет Яндекс.Метрику (Stat API): просмотры, визиты, пользователи, длительность по URL |
| `scripts/analytics/merge.mjs` | Сводит оба источника + frontmatter статей + наличие маркера фактчека в `src/data/analytics/articles.json` |
| `src/pages/dashboard.astro` | Страница `/dashboard/` с таблицей. Поиск, фильтр по категории, сортировка. `noindex, nofollow` — не для поисковиков |
| `.github/workflows/analytics-refresh.yml` | Триггеры: cron понедельник 06:00 МСК + `workflow_dispatch` |

## Как добавлять данные

Cron обновляет сам — раз в неделю в понедельник. Вручную:

Actions → **Analytics — Refresh Data** → Run workflow. Параметры:
- `days` — окно в днях, по умолчанию 28
- `skip_gsc` — пропустить GSC (если ключи ещё не настроены)

После прогона:
1. В `src/data/analytics/` обновляются `gsc.json`, `metrika.json`, `articles.json`.
2. Бот делает коммит `data(analytics): обновление трафика и позиций`.
3. Если есть деплой при пуше — сайт пересобирается, `/dashboard/` показывает свежие данные.

## Первоначальная настройка

### Метрика (5 минут)

Уже настроено — используется тот же `METRIKA_OAUTH_TOKEN`, что и для
`sync-goals.mjs`. Scope `metrika:write` включает чтение статистики.
Если в Metrika sync токен работает — Stat API тоже работает.

### Google Search Console (20 минут, один раз)

GSC API требует OAuth2 (Service Account для GSC не поддерживается).
Подход — получить refresh_token и хранить его в секретах.

#### Шаг 1. Создать OAuth client в Google Cloud

1. Идём в [Google Cloud Console](https://console.cloud.google.com/),
   создаём проект (или используем существующий).
2. **APIs & Services → Enable APIs** → найти **Google Search Console API** → Enable.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID.**
4. Если первый раз — потребует настроить OAuth consent screen:
   - **User type:** External (но с доступом только себе через test users).
   - **App name:** "Etiketka Analytics".
   - **User support email:** свой.
   - На шаге Scopes — добавить
     `https://www.googleapis.com/auth/webmasters.readonly`.
   - На шаге Test users — добавить ваш email.
   - Status: **Testing** (не нужно publishing — токены будут жить 7 дней без верификации, но для refresh_token это не проблема, мы рефрешим access_token каждый раз).
5. Возвращаемся к Create OAuth client ID:
   - **Application type:** Desktop app.
   - **Name:** "Etiketka CLI".
   - Получаем **Client ID** и **Client secret**.

#### Шаг 2. Получить refresh_token

В браузере под аккаунтом, у которого есть доступ к property GSC, открыть:

```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=ВАШ_CLIENT_ID
  &redirect_uri=urn:ietf:wg:oauth:2.0:oob
  &response_type=code
  &scope=https://www.googleapis.com/auth/webmasters.readonly
  &access_type=offline
  &prompt=consent
```

(всё в одну строку, без переносов).

Google вернёт код вида `4/0AX...`. Скопировать.

Через curl или [любой POST-клиент](https://reqbin.com/) обменять
код на refresh_token:

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "code=4/0AX..." \
  -d "client_id=ВАШ_CLIENT_ID" \
  -d "client_secret=ВАШ_CLIENT_SECRET" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob" \
  -d "grant_type=authorization_code"
```

В ответе будет `refresh_token: "1//0g..."` — это он. Сохраняем.

#### Шаг 3. Прописать секреты GitHub

Settings → Secrets and variables → Actions → New repository secret:

| Имя | Значение |
|---|---|
| `GSC_CLIENT_ID` | из Шага 1 |
| `GSC_CLIENT_SECRET` | из Шага 1 |
| `GSC_REFRESH_TOKEN` | из Шага 2 |
| `GSC_SITE_URL` | `https://etiketka-media.ru/` (URL-prefix) или `sc-domain:etiketka-media.ru` (domain property) — **точно как в консоли GSC** |

#### Шаг 4. Проверка

Actions → **Analytics — Refresh Data** → Run workflow с дефолтными
параметрами. В логах должно быть:

```
GSC: https://etiketka-media.ru/
Окно: 2026-04-21 → 2026-05-19 (28 дней)
Готово. Страниц с трафиком: 42, кликов: 358, показов: 12480
```

Если 401/403 — проверьте, что аккаунт OAuth добавлен в GSC property
как «Полный пользователь» или «Владелец», и в Test users в OAuth
consent screen.

## Как читается дашборд

Откройте `/dashboard/` (URL `https://etiketka-media.ru/dashboard/`).
На странице `noindex` — поисковики не индексируют.

**Что показывает:**
- Тотал-карточки: статей, кликов/показов GSC, просмотров Метрики, сколько статей с трафиком вообще
- Сегменты по свежести: ≤30 / 31–90 / >90 дней
- Таблица всех статей с колонками: заголовок, категория, дата, GSC клики/показы/позиция, Метрика просмотры/пользователи, маркер фактчека

**Что умеет:**
- Поиск по заголовку и slug
- Фильтр по категории
- Чекбокс «только с трафиком» — скрывает статьи без обращений
- Клик по заголовку колонки — сортировка (повторный клик меняет направление)

## Как использовать в работе

- **Каждый понедельник** — открыть дашборд, посмотреть, что выросло и что просело.
- **Перед обновлением статьи** — сравнить позицию в GSC с трафиком в Метрике. Расхождение «показов много, кликов мало» = плохой title/description, можно подкрутить.
- **Перед публикацией нового материала** — фильтр по категории, чтобы убедиться, что нет статьи на ту же тему с уже сложившимся трафиком (иначе будет каннибализация).
- **Раз в квартал** — посмотреть на «stale» сегмент (статьи старше 90 дней): что зашло — оставляем, что не зашло и не обновлялось — обновляем или склеиваем.

## Открытые вопросы

1. **Яндекс.Вебмастер API (#7).** Аналог GSC, но для Яндекса.
   У нас есть Метрика по трафику — но позиций в Яндексе мы пока не видим.
   Отдельная задача, требует своего OAuth scope (`webmaster:read`).
2. **Интеграция в `/maintain-content` (#9).** Сейчас дашборд статичный —
   читается человеком. Можно прокинуть данные в скилл, чтобы он сам
   рекомендовал, что обновлять/мерджить/убивать на основе цифр.
3. **MCP-сервер для аналитики (#32).** Большой апгрейд: вместо
   еженедельного снимка — query-по-требованию из Claude Code. Окупится
   только если работаем с данными часто.
4. **Heatmap сезонности.** Метрика умеет давать данные по дням —
   можно строить тепловую карту «когда в году статья получала трафик».
   Полезно для статей с явной сезонностью (квартальная отчётность,
   новогодние налоговые изменения).
