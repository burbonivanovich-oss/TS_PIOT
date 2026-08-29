/**
 * Тонкий клиент OpenRouter для текстовых моделей.
 *
 * Единственный внешний ключ автопилота — `OPENROUTER_API_KEY`, тот же, что
 * уже используют генераторы картинок. Новых секретов заводить не нужно.
 *
 * Модель выбирается динамически: берём первую доступную из списка кандидатов
 * (`/api/v1/models`), чтобы прогон не падал, когда провайдер снимает или
 * переименовывает конкретную версию.
 */
const API = 'https://openrouter.ai/api/v1';

const HEADERS = () => ({
	Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
	'Content-Type': 'application/json',
	'HTTP-Referer': 'https://etiketka-media.ru',
	'X-Title': 'etiketka-media autopilot',
});

/**
 * Кандидаты по убыванию предпочтения.
 *
 * Порядок учитывает, что у ключа проекта в настройках OpenRouter разрешены не
 * все провайдеры (Privacy → Allowed providers). Наличие модели в каталоге
 * `/models` этого не показывает — политика вылезает только на реальном запросе,
 * поэтому кандидат проверяется пробным вызовом.
 */
export const WRITER_CANDIDATES = [
	'openai/gpt-5.5',
	'google/gemini-3.1-pro-preview',
	'openai/gpt-5.2',
	'google/gemini-2.5-pro',
	'google/gemini-3.7-flash',
	'deepseek/deepseek-v4-pro',
	'anthropic/claude-opus-4.5',
	'anthropic/claude-sonnet-4.5',
];

let modelCache = null;
let activeModel = null;
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
	// 429 или 5xx — модель живая, просто занята.
	return res.status === 429 || res.status >= 500;
}

/**
 * Разрешает рабочую модель: явный env — как есть, иначе первый кандидат,
 * который реально отвечает этому ключу.
 */
export async function resolveModel(envValue, candidates = WRITER_CANDIDATES) {
	if (envValue) {
		activeModel = envValue;
		return envValue;
	}

	let catalogue = null;
	try {
		catalogue = await availableModels();
	} catch (e) {
		console.warn(`Каталог моделей недоступен (${e.message}), пробую кандидатов вслепую.`);
	}

	for (const candidate of candidates) {
		if (deadModels.has(candidate)) continue;
		if (catalogue && !catalogue.has(candidate)) continue;
		if (await probe(candidate)) {
			activeModel = candidate;
			return candidate;
		}
		deadModels.add(candidate);
	}

	throw new Error(
		`Ни одна модель из списка кандидатов не доступна ключу. Проверьте баланс и ` +
			`настройку Allowed providers на https://openrouter.ai/settings/privacy`,
	);
}

export const currentModel = () => activeModel;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Один запрос к chat/completions с ретраями на 429/5xx.
 *
 * opts.web = true подключает веб-поиск OpenRouter — нужен фактчеку, чтобы
 * сверять номера НПА и суммы штрафов с первоисточниками.
 */
export async function chat({
	model,
	messages,
	temperature = 0.4,
	maxTokens = 8000,
	web = false,
	retries = 4,
}) {
	if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY не задан');

	const body = {
		model: model && !deadModels.has(model) ? model : (activeModel ?? model),
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
		if (res.status === 429 || res.status >= 500) {
			lastError = new Error(`API ${res.status}: ${text.slice(0, 200)}`);
			continue;
		}

		// Модель сняли или её закрыла политика провайдеров — переезжаем на
		// следующего кандидата, а не роняем весь прогон.
		if (isModelUnavailable(res.status, text)) {
			deadModels.add(body.model);
			console.warn(`Модель ${body.model} отвалилась, ищу замену…`);
			body.model = await resolveModel(null);
			console.warn(`Перешёл на ${body.model}.`);
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
		return { content, usage: data.usage ?? null };
	}

	throw lastError ?? new Error('запрос не удался');
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
