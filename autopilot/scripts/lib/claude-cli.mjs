// Вызов модели через Claude Code CLI (`claude -p`) по подписке владельца.
// Подписка Codex закончилась 11.10.2026; провайдер выбирается переменной
// AUTOPILOT_MODEL_PROVIDER (claude по умолчанию, codex — прежний путь).
//
// Права модели задаёт список инструментов, а режим dontAsk запрещает всё
// остальное без вопросов. Произвольные команды оболочки не разрешаются:
// текст источника из сети не должен подбить модель на действия вне наряда.
import { existsSync, readFileSync } from 'node:fs';
import { supervisedProcess } from './writer-process.mjs';

export const modelProvider = () => (process.env.AUTOPILOT_MODEL_PROVIDER || 'claude').toLowerCase();

/** Аргументы CLI: строгая схема ответа, явный список инструментов, без сохранения сессии. */
export function claudeArgs({ schema, tools, model = process.env.AUTOPILOT_CLAUDE_MODEL || null }) {
  if (!schema || !Array.isArray(tools) || !tools.length) throw new Error('Нужны схема ответа и список инструментов');
  return ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(schema), '--permission-mode', 'dontAsk',
    '--allowedTools', ...tools, '--no-session-persistence', ...(model ? ['--model', model] : [])];
}

/** Итог CLI: структурированный ответ и наблюдаемый расход токенов (не счёт за подписку). */
export function parseClaudeOutput(output) {
  let envelope;
  try { envelope = JSON.parse(String(output || '').trim()); } catch { throw new Error('Claude CLI вернул не JSON'); }
  if (envelope?.is_error) throw new Error(`Claude CLI: ${String(envelope.result || envelope.terminal_reason || envelope.subtype || 'ошибка').slice(0, 300)}`);
  let value = envelope?.structured_output;
  if (value === undefined && typeof envelope?.result === 'string') { try { value = JSON.parse(envelope.result); } catch { value = undefined; } }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Claude CLI не вернул структурированный ответ');
  const usage = envelope.usage || {};
  const tokens = ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'].reduce((sum, key) => sum + (Number.isSafeInteger(usage[key]) ? usage[key] : 0), 0);
  return { value, reportedTokens: tokens > 0 ? tokens : null };
}

export async function runClaude(prompt, { schema, tools, cwd, actorFile, timeout = 30 * 60_000, binary = process.env.AUTOPILOT_CLAUDE_BIN || 'claude', model } = {}) {
  try {
    const result = await supervisedProcess(binary, claudeArgs({ schema, tools, model }), { input: prompt, cwd, timeout, actorFile });
    return parseClaudeOutput(result.output);
  } catch (error) {
    // CLI с ошибкой входа или лимита выходит с ненулевым кодом, но печатает
    // JSON с причиной. Берём только её: полный вывод остаётся в приватном trace.
    const trace = `${actorFile}.trace.log`;
    if (!/^Claude CLI/.test(error.message) && existsSync(trace)) {
      try {
        const { output } = JSON.parse(readFileSync(trace, 'utf8'));
        parseClaudeOutput(output);
      } catch (reason) { if (/^Claude CLI: /.test(reason.message)) { reason.reportedTokens = error.reportedTokens ?? null; throw reason; } }
    }
    throw error;
  }
}

