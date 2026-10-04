import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {refreshDuplicateAudit} from './duplicate-audit.mjs';
test('weekly duplicate scan refreshes stale evidence once; repeats use receipt; failed scan preserves previous bytes',()=>{
 const dataDir=mkdtempSync(path.join(tmpdir(),'duplicate-audit-'));const file=path.join(dataDir,'dupes.json');
 try {
  const now=new Date('2026-10-04T12:00:00Z');let calls=0;
  const scan=()=>{calls++;return [{a:'weak',b:'keep',rewrite:'weak',keep:'keep',verdict:'merge'}];};
  writeFileSync(file,JSON.stringify({generatedAt:'2026-08-10',pairs:[]}));
  assert.equal(refreshDuplicateAudit({dataDir,now,scan}).refreshed,true);
  const before=readFileSync(file,'utf8');
  assert.equal(refreshDuplicateAudit({dataDir,now,scan}).refreshed,false);assert.equal(calls,1);
  assert.equal(refreshDuplicateAudit({dataDir,now:new Date('2026-10-10'),scan}).refreshed,false);
  assert.throws(()=>refreshDuplicateAudit({dataDir,now:new Date('2026-10-11'),scan:()=>{throw new Error('unreadable corpus');}}),/unreadable/);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(refreshDuplicateAudit({dataDir,now:new Date('2026-10-11'),scan}).refreshed,true);assert.equal(calls,2);
  assert.throws(()=>refreshDuplicateAudit({dataDir,now,scan}),/future/);
 }finally{rmSync(dataDir,{recursive:true,force:true});}
});
