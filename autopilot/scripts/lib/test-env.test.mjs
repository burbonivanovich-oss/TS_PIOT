import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isolatedTestEnv } from './test-env.mjs';
import { spawnSync } from 'node:child_process';
test('test children cannot inherit production paths, locks or strict checkout overrides', () => {
  const env={...process.env,CONTENT_ROOT:'/production',AUTOPILOT_CONFIG:'/production/config',AUTOPILOT_DATA_DIR:'/production/state',AUTOPILOT_LOCK_FILE:'/production/lock',AUTOPILOT_ALLOWED_BRANCH:'main',AUTOPILOT_CODEX_BIN:'/production/cli'};
  const isolated=isolatedTestEnv(env);
  assert.equal(isolated.PATH,env.PATH);assert.equal(env.CONTENT_ROOT,'/production');
  const result=spawnSync(process.execPath,['-e',"process.stdout.write(JSON.stringify(Object.keys(process.env).filter(key=>key==='CONTENT_ROOT'||key.startsWith('AUTOPILOT_'))))"],{env:isolated,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),[]);
});
