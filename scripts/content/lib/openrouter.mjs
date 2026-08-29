/**
 * Тонкий клиент OpenRouter для текстовых моделей.
 *
 * Единственный внешний ключ автопилота — `OPENROUTER_API_KEY`, тот же, что
 * уже используют генераторы картинок. Новых секретов заводить не нужно.
 *
 * Две особенности OpenRouter, ради которых здесь больше кода, чем ожидаешь:
 *
 * 1. Наличие модели в каталоге `/models` не значит, что ключ имеет к ней
 *    доступ: политика Allowed providers вылезает только на реальном запросе
 *    (404 «No allowed providers»). Поэтому кандидат проверяется пробным вызовом.
 * 2. Под каждый запрос в полёте резервируется его максимальная стоимость, и
 *    параллельные запросы упираются в резерв раньше, чем в баланс — 402
 *    `in_flight_budget_exhausted`. Это временный отказ, его пережидают.
 */
const API = 'https://openrouter.ai/api/v1';

const HEADERS = () => ({
	Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
	'Content-Type': 'application/json',
	'HTTP-Referer': 'https://etiketka-media.ru',
	'X-Title': 'etiketka-media autopilot',
});

/**
 * Кандидаты для написания статей — по цене за качество, а не по «самая
 * сильная сверху»: конвейер пишет 22 длинных текста в месяц, и разница между
 * тиром за $3.75 и тиром за $30 за миллион токенов — это разница между
 * $4 и $15+ в месяц. Качество держит не модель, а шлюз: статья, не прошедшая
 * редполитику, не публикуется.
 */
export const WRITER_CANDIDATES = [
	'google/gemini-3.7-flash',
	'openai/gpt-5.4-mini',
	'google/gemini-2.5-pro',
	'google/gemini-3.1-pro-preview',
	'deepseek/deepseek-v4-pro',
	'openai/gpt-4.1',
	'anthropic/claude-sonnet-4.5',
];

/**
 * Кандидаты для вспомогательных шагов — research, фактчек, соцпосты.
 * Здесь дорогая модель не окупается: фактуру всё равно перепроверяет
 * онлайн-фактчек, а номера НПА — валидатор.
 */
export const HELPER_CANDIDATES = [
	'google/gemini-2.5-flash',
	'deepseek/deepseek-v4-flash',
	'openai/gpt-4.1-mini',
	'google/gemini-3.7-flash',
];

let modelCache = null;
const deadModels = new Set();

async function availableModels() {
	if (modelCache) return modelCache;
	const res = await fetch(`${API}/models`, { headers: HEADERS() });
	if (!res.ok) throw new Error(`OpenRouter /models ${res.status}: ${(await res.text()).slice(0, 200)}`);
	const data = await res.json();
	modelCache = new Set((data.data ?? []).map((m) => m.id));
	return modelCache;
}

/** Признак «эта модель нам недоступна»: снята, переименована или закрыта политикой. */
function isModelUnavailable(status, text) {
	if (status !== 404 && status !== 403) return false;
	return /allowed[- ]providers|not a valid model|no endpoints|data policy/i.test(text);
}

/** 402 бывает временный (резерв под запросы в полёте) и окончательный (деньги). */
function isInFlightBudget(text) {
	return /in_flight_budget_exhausted|in-flight requests settle/i.test(text);
}

/** Пробный вызов: единственный честный способ узнать, ответит ли модель этому ключу. */
async function probe(model) {
	const res = await fetch(`${API}/chat/completions`, {
		method: 'POST',
		headers: HEADERS(),
		body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ok' }], max_tokens: 1 }),
	});
	if (res.ok) return true;
	const text = await res.text();
	if (isModelUnavailable(res.status, text)) {
		console.warn(`  ${model} недоступна: ${text.slice(0, 120)}`);
		return false;
	}
	// 402/429/5xx — модель живая, проблема не в ней.
	return true;
}

/** Первый кандидат, который реально отвечает этому ключу. */
export async function resolveModel(envValue, candidates = WRITER_CANDIDATES) {
	if (envValue) return envValue;

	let catalogue = null;
	try {
		catalogue = await availableModels();
	} catch (e) {
		console.warn(`Каталог моделей недоступен (${e.message}), пробую кандидатов вслепую.`);
	}

	for (const candidate of candidates) {
		if (deadModels.has(candidate)) continue;
		if (catalogue && !catalogue.has(candidate)) continue;
		if (await probe(candidate)) return candidate;
		deadModels.add(candidate);
	}

	throw new Error(
		'Ни одна модель из списка кандидатов не доступна ключу. Проверьте баланс и ' +
			'настройку Allowed providers на https://openrouter.ai/settings/privacy',
	);
}

/**
 * Тир — пара «текущая модель + запасные». Живёт весь прогон: если модель
 * отвалится посреди работы, тир переезжает на следующего кандидата сам.
 */
export async function makeTier(envValue, candidates) {
	return { model: await resolveModel(envValue, candidates), candidates };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Кредиты на ключе кончились — продолжать прогон бессмысленно. */
export class CreditsError extends Error {}

/** Баланс ключа: сколько положили и сколько потратили. */
export async function credits() {
	const res = await fetch(`${API}/credits`, { headers: HEADERS() });
	if (!res.ok) throw new Error(`OpenRouter /credits ${res.status}: ${(await res.text()).slice(0, 200)}`);
	const { data } = await res.json();
	return {
		total: data?.total_credits ?? null,
		used: data?.total_usage ?? null,
		left: data?.total_credits != null ? data.total_credits - (data.total_usage ?? 0) : null,
	};
}

const spent = { requests: 0, promptTokens: 0, completionTokens: 0 };
export const usageTotals = () => ({ ...spent });

/**
 * Один запрос к chat/completions.
 *
 * opts.tier — предпочтительный способ передать модель: при отказе модели
 * тир сам переезжает на следующего кандидата. opts.model — простой вариант
 * без переезда.
 * opts.web = true подключает веб-поиск OpenRouter: нужен research и фактчеку.
 */
export async function chat({
	tier = null,
	model = null,
	messages,
	temperature = 0.4,
	maxTokens = 8000,
	web = false,
	retries = 4,
}) {
	if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY не задан');

	const body = {
		model: tier?.model ?? model,
		messages,
		temperature,
		max_tokens: maxTokens,
	};
	if (web) body.plugins = [{ id: 'web', max_results: 5 }];

	let lastError;
	for (let attempt = 0; attempt <= retries; attempt++) {
		if (attempt > 0) await sleep(2000 * 2 ** (attempt - 1));

		let res;
		try {
			res = await fetch(`${API}/chat/completions`, {
				method: 'POST',
				headers: HEADERS(),
				body: JSON.stringify(body),
			});
		} catch (e) {
			lastError = e;
			continue;
		}

		const text = await res.text();

		if (res.status === 402) {
			if (!isInFlightBudget(text)) {
				throw new CreditsError(
					`кончились кредиты OpenRouter. Пополнить: https://openrouter.ai/settings/credits`,
				);
			}
			const retryAfter = Number(res.headers.get('retry-after'));
			await sleep(Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 20_000, 60_000));
			lastError = new Error('API 402 (бюджет запросов в полёте)');
			continue;
		}

		if (res.status === 429 || res.status >= 500) {
			lastError = new Error(`API ${res.status}: ${text.slice(0, 200)}`);
			continue;
		}

		// Модель сняли или её закрыла политика провайдеров — переезжаем на
		// следующего кандидата, а не роняем весь прогон.
		if (isModelUnavailable(res.status, text)) {
			deadModels.add(body.model);
			console.warn(`Модель ${body.model} отвалилась, ищу замену…`);
			const next = await resolveModel(null, tier?.candidates ?? WRITER_CANDIDATES);
			if (tier) tier.model = next;
			body.model = next;
			console.warn(`Перешёл на ${next}.`);
			lastError = new Error(`API ${res.status}: ${text.slice(0, 200)}`);
			continue;
		}

		if (!res.ok) throw new Error(`API ${res.status}: ${text.slice(0, 400)}`);

		let data;
		try {
			data = JSON.parse(text);
		} catch {
			lastError = new Error(`ответ не JSON: ${text.slice(0, 200)}`);
			continue;
		}

		const content = data?.choices?.[0]?.message?.content;
		if (!content) {
			lastError = new Error(`пустой ответ: ${JSON.stringify(data).slice(0, 300)}`);
			continue;
		}

		spent.requests++;
		spent.promptTokens += data.usage?.prompt_tokens ?? 0;
		spent.completionTokens += data.usage?.completion_tokens ?? 0;

		return {
			content,
			usage: data.usage ?? null,
			truncated: data?.choices?.[0]?.finish_reason === 'length',
		};
	}

	throw lastError ?? new Error('запрос не удался');
}

/**
 * Запрос, ответ на который обязан быть JSON. Модель иногда упирается в лимит
 * токенов на середине объекта — тогда просим короче и парсим ещё раз, а не
 * теряем статью на `Unexpected end of JSON input`.
 */
export async function chatJson(options) {
	const first = await chat(options);
	try {
		return extractJson(first.content);
	} catch (e) {
		const reason = first.truncated ? 'ответ обрезан лимитом токенов' : e.message;
		console.warn(`  JSON не разобрался (${reason}) — прошу короче.`);

		const retry = await chat({
			...options,
			messages: [
				...options.messages,
				{ role: 'assistant', content: first.content.slice(-400) },
				{
					role: 'user',
					content:
						'Ответ оборвался и не разобрался как JSON. Верни тот же ответ заново, ' +
						'строго одним валидным JSON-объектом и вдвое компактнее: короче формулировки, ' +
						'меньше элементов в массивах, только самое важное. Без markdown-обёртки.',
				},
			],
			temperature: 0,
		});
		return extractJson(retry.content);
	}
}

/** Достаёт JSON из ответа модели: голый объект или блок ```json. */
export function extractJson(content) {
	const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
	const raw = (fenced ? fenced[1] : content).trim();
	const start = raw.search(/[[{]/);
	if (start === -1) throw new Error(`в ответе нет JSON: ${content.slice(0, 200)}`);
	return JSON.parse(raw.slice(start));
}

/** Достаёт Markdown-статью: снимает обёртку ```markdown, если модель её добавила. */
export function extractMarkdown(content) {
	const fenced = content.match(/^\s*```(?:markdown|mdx|md)?\s*\n([\s\S]*?)\n```\s*$/);
	return (fenced ? fenced[1] : content).trim() + '\n';
}
