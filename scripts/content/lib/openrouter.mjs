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

/** Кандидаты по убыванию предпочтения. Первый доступный — победил. */
export const WRITER_CANDIDATES = [
	'anthropic/claude-opus-4.5',
	'anthropic/claude-sonnet-4.5',
	'anthropic/claude-3.7-sonnet',
	'google/gemini-2.5-pro',
	'openai/gpt-4.1',
];

let modelCache = null;

async function availableModels() {
	if (modelCache) return modelCache;
	const res = await fetch(`${API}/models`, { headers: HEADERS() });
	if (!res.ok) throw new Error(`OpenRouter /models ${res.status}: ${(await res.text()).slice(0, 200)}`);
	const data = await res.json();
	modelCache = new Set((data.data ?? []).map((m) => m.id));
	return modelCache;
}

/**
 * Разрешает модель: явный env перекрывает всё, иначе первый доступный
 * кандидат, иначе — первый кандидат «вслепую» (пусть API сам ответит ошибкой).
 */
export async function resolveModel(envValue, candidates = WRITER_CANDIDATES) {
	if (envValue) return envValue;
	try {
		const models = await availableModels();
		const hit = candidates.find((c) => models.has(c));
		if (hit) return hit;
	} catch (e) {
		console.warn(`Не удалось получить список моделей (${e.message}), беру первого кандидата.`);
	}
	return candidates[0];
}

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
		model,
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
