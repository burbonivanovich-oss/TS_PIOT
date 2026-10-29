import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { claudeArgs, parseClaudeOutput, runClaude, ensureClaudeToken, modelProvider } from './claude-cli.mjs';

const schema = { type: 'object', required: ['slug'], properties: { slug: { type: 'string' } } };

test('аргументы: строгая схема, явный список инструментов, без вопросов и сохранения сессии', () => {
  const args = claudeArgs({ schema, tools: ['Read', 'Bash(node autopilot/scripts/gates.mjs *)'], model: null });
  assert.deepEqual(args.slice(0, 3), ['-p', '--output-format', 'json']);
  assert.equal(args[args.indexOf('--json-schema') + 1], JSON.stringify(schema));
  assert.equal(args[args.indexOf('--permission-mode') + 1], 'dontAsk');
  const tools = args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--no-session-persistence'));
  assert.deepEqual(tools, ['Read', 'Bash(node autopilot/scripts/gates.mjs *)']);
  assert.ok(!args.includes('--dangerously-skip-permissions'));
  assert.ok(claudeArgs({ schema, tools: ['Read'], model: 'sonnet' }).includes('sonnet'));
  assert.throws(() => claudeArgs({ schema, tools: [] }));
});

test('ответ CLI: структурированный результат, токены, ошибка входа и мусор', () => {
  const ok = parseClaudeOutput(JSON.stringify({ is_error: false, structured_output: { slug: 'a' }, usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100 } }));
  assert.deepEqual(ok, { value: { slug: 'a' }, reportedTokens: 115 });
  assert.deepEqual(parseClaudeOutput(JSON.stringify({ is_error: false, result: '{"slug":"b"}', usage: {} })), { value: { slug: 'b' }, reportedTokens: null });
  assert.throws(() => parseClaudeOutput(JSON.stringify({ is_error: true, result: 'Failed to authenticate: OAuth session expired' })), /Claude CLI: Failed to authenticate/);
  assert.throws(() => parseClaudeOutput('not json'), /не JSON/);
  assert.throws(() => parseClaudeOutput(JSON.stringify({ is_error: false, result: 'просто текст' })), /структурированный/);
});

test('настоящий запуск через супервизор: успех, причина отказа входа, права', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'claude-cli-'));
  try {
    const bin = path.join(dir, 'fake-claude');
    const argvFile = path.join(dir, 'argv.json');
    writeFileSync(bin, `#!/usr/bin/env node
const fs = require('fs');
fs.writeFileSync(${JSON.stringify(argvFile)}, JSON.stringify(process.argv.slice(2)));
let input = ''; process.stdin.on('data', (d) => input += d).on('end', () => {
  if (input.includes('FAIL')) { process.stdout.write(JSON.stringify({ is_error: true, result: 'Failed to authenticate: OAuth session expired' })); process.exit(1); }
  process.stdout.write(JSON.stringify({ is_error: false, structured_output: { slug: input.trim() }, usage: { input_tokens: 3, output_tokens: 4 } }));
});
`);
    chmodSync(bin, 0o755);
    const ok = await runClaude('article', { schema, tools: ['Read', 'WebSearch'], cwd: dir, actorFile: path.join(dir, 'actor.json'), binary: bin, timeout: 20000 });
    assert.deepEqual(ok, { value: { slug: 'article' }, reportedTokens: 7 });
    const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
    assert.deepEqual(argv.slice(argv.indexOf('--allowedTools') + 1, argv.indexOf('--no-session-persistence')), ['Read', 'WebSearch']);
    await assert.rejects(runClaude('FAIL', { schema, tools: ['Read'], cwd: dir, actorFile: path.join(dir, 'actor2.json'), binary: bin, timeout: 20000 }), /Claude CLI: Failed to authenticate/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('токен: существующий не перезаписывается, из Связки ключей подставляется, пустой — нет входа', () => {
  const kept = { CLAUDE_CODE_OAUTH_TOKEN: 'own' };
  assert.equal(ensureClaudeToken({ env: kept, read: () => 'keychain' }), true);
  assert.equal(kept.CLAUDE_CODE_OAUTH_TOKEN, 'own');
  const loaded = {};
  assert.equal(ensureClaudeToken({ env: loaded, read: () => 'keychain' }), true);
  assert.equal(loaded.CLAUDE_CODE_OAUTH_TOKEN, 'keychain');
  const none = {};
  assert.equal(ensureClaudeToken({ env: none, read: () => '' }), false);
  assert.ok(!('CLAUDE_CODE_OAUTH_TOKEN' in none));
});

test('провайдер по умолчанию — claude, codex выбирается явно', () => {
  const saved = process.env.AUTOPILOT_MODEL_PROVIDER;
  try {
    delete process.env.AUTOPILOT_MODEL_PROVIDER; assert.equal(modelProvider(), 'claude');
    process.env.AUTOPILOT_MODEL_PROVIDER = 'Codex'; assert.equal(modelProvider(), 'codex');
  } finally { if (saved === undefined) delete process.env.AUTOPILOT_MODEL_PROVIDER; else process.env.AUTOPILOT_MODEL_PROVIDER = saved; }
});
