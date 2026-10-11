#!/usr/bin/env node
// Установка расписания автопилота в launchd (macOS). Запускает человек один
// раз из рабочей копии runner:
//
//   node autopilot/scripts/install-scheduler.mjs install     # создать и загрузить
//   node autopilot/scripts/install-scheduler.mjs install --codex-retired
//        # подписки Codex нет: его автоматизацию нельзя выключить, но и
//        # выполниться она не может — не считать её вторым владельцем
//   node autopilot/scripts/install-scheduler.mjs uninstall   # выгрузить и удалить
//   node autopilot/scripts/install-scheduler.mjs print       # показать plist
//
// Расписание: каждый день в 09:00 и повторная попытка в 15:00 (выполненный
// день пропускается), плюс запуск при входе в систему. Если Mac спал в 09:00,
// launchd запустит задание при пробуждении. Выключенный Mac задание пропускает,
// а календарь выпуска потом догоняет пропущенное в пределах 3 материалов в день.
import path from 'node:path';
import os from 'node:os';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const LABEL = 'ru.etiketka.autopilot';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const LOGS = path.join(os.homedir(), 'Library', 'Logs', 'etiketka-autopilot');
const CODEX_AUTOMATION = path.join(os.homedir(), '.codex', 'automations', 'automation-2', 'automation.toml');

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function claudeBinary() {
  for (const candidate of [process.env.AUTOPILOT_CLAUDE_BIN, '/opt/homebrew/bin/claude', '/usr/local/bin/claude', path.join(os.homedir(), '.local', 'bin', 'claude'), path.join(os.homedir(), '.claude', 'local', 'claude')]) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

function codexBinary() {
  for (const candidate of [process.env.AUTOPILOT_CODEX_BIN, '/opt/homebrew/bin/codex', '/usr/local/bin/codex', '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex']) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

function plist({ node = process.execPath, repo = REPO, codex = codexBinary(), claude = claudeBinary(), retired = false, logs = LOGS } = {}) {
  const pathEnv = [...new Set([path.dirname(node), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'])].join(':');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- Создано autopilot/scripts/install-scheduler.mjs. Править через него. -->
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>${LABEL}</string>
	<!-- Главный процесс — node, не оболочка: доступ к ~/Documents под launchd
	     выдаётся именно ему (Полный доступ к диску). -->
	<key>ProgramArguments</key>
	<array>
		<string>${xml(node)}</string>
		<string>${xml(path.join(repo, 'autopilot', 'scripts', 'scheduler.mjs'))}</string>
		<string>run</string>
	</array>
	<key>WorkingDirectory</key>
	<string>${xml(repo)}</string>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>${xml(pathEnv)}</string>${codex ? `
		<key>AUTOPILOT_CODEX_BIN</key>
		<string>${xml(codex)}</string>` : ''}
		<key>AUTOPILOT_MODEL_PROVIDER</key>
		<string>claude</string>${claude ? `
		<key>AUTOPILOT_CLAUDE_BIN</key>
		<string>${xml(claude)}</string>` : ''}${retired ? `
		<key>AUTOPILOT_CODEX_RETIRED</key>
		<string>1</string>` : ''}
		<key>LANG</key>
		<string>ru_RU.UTF-8</string>
	</dict>
	<key>StartCalendarInterval</key>
	<array>
		<dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
		<dict><key>Hour</key><integer>15</integer><key>Minute</key><integer>0</integer></dict>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>StandardOutPath</key>
	<string>${xml(path.join(logs, 'launchd.out.log'))}</string>
	<key>StandardErrorPath</key>
	<string>${xml(path.join(logs, 'launchd.err.log'))}</string>
	<key>ProcessType</key>
	<string>Background</string>
</dict>
</plist>
`;
}

function launchctl(args) {
  return spawnSync('/bin/launchctl', args, { encoding: 'utf8' });
}

const [cmd, ...flags] = process.argv.slice(2);
const retired = flags.includes('--codex-retired');
const domain = `gui/${process.getuid()}`;
if (cmd === 'print') {
  process.stdout.write(plist({ retired }));
} else if (cmd === 'install') {
  if (!retired && existsSync(CODEX_AUTOMATION) && /^\s*status\s*=\s*"ACTIVE"\s*$/m.test(readFileSync(CODEX_AUTOMATION, 'utf8'))) {
    console.error('Сначала выключите в Codex автоматизацию «Этикетка — ежедневный выпуск»: владелец расписания должен быть один.\nЕсли подписки Codex нет и выключить её нельзя, повторите с флагом --codex-retired.');
    process.exit(2);
  }
  if (!claudeBinary()) console.warn('Внимание: не найден Claude Code CLI — статьи писаться не будут. Укажите путь в AUTOPILOT_CLAUDE_BIN и повторите установку.');
  const keychain = spawnSync('/usr/bin/security', ['find-generic-password', '-s', 'etiketka-autopilot-claude', '-a', os.userInfo().username], { encoding: 'utf8' });
  if (keychain.status !== 0) console.warn('Внимание: в Связке ключей нет токена Claude (etiketka-autopilot-claude). Без него статьи не пишутся; выпуск готовых идёт. Порядок — в autopilot/docs/scheduler.md.');
  mkdirSync(path.dirname(PLIST), { recursive: true });
  mkdirSync(LOGS, { recursive: true });
  launchctl(['bootout', `${domain}/${LABEL}`]);
  writeFileSync(PLIST, plist({ retired }));
  const r = launchctl(['bootstrap', domain, PLIST]);
  if (r.status !== 0) { console.error(`launchctl bootstrap: ${r.stderr.trim()}`); process.exit(1); }
  console.log(`Установлено: ${PLIST}\nЗапуск — сейчас, затем ежедневно в 09:00 (повтор в 15:00).\nЛоги: ${LOGS}\nЕсли в логе «Operation not permitted»: Системные настройки → Конфиденциальность → Полный доступ к диску → добавить ${process.execPath}.`);
} else if (cmd === 'uninstall') {
  launchctl(['bootout', `${domain}/${LABEL}`]);
  if (existsSync(PLIST)) unlinkSync(PLIST);
  console.log('Расписание удалено.');
} else {
  console.log('Использование: install-scheduler.mjs install | uninstall | print');
  process.exitCode = 2;
}
