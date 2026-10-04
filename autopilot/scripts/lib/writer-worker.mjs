// Inherits the supervisor's dedicated process group. No command starts before
// stdin ends: the parent persists the actor lease before sending the prompt.
import { spawn } from 'node:child_process';
const [command, args] = JSON.parse(process.argv[2]);
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const child = spawn(command, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  child.on('error', error => { console.error(error.code || 'spawn-error'); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
  child.stdin.on('error', () => {});
  child.stdin.end(input);
});
