import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { activeFactCorrections, lateCorrectionPriority } from './fact-corrections.mjs';
import { claimHash } from './claim-evidence.mjs';
const now = new Date('2026-10-04T18:00:00Z');
const source = 'https://www.consultant.ru/document/cons_doc_LAW_34661/';
const statement = 'Неверное утверждение про штраф.';
function fixture() {
 const text = 'Подтверждающий фрагмент нормы.';
 return { version:1,slug:'article',documents:[{url:source,status:200,text,sha256:createHash('sha256').update(text).digest('hex'),fetchedAt:now.toISOString()}],findings:[{statement,claimHash:claimHash(statement),source,result:'contradicted',excerpt:text,checkedAt:now.toISOString(),rationale:'Заявленная квалификация противоречит области применения нормы.'}] };
}
const check = evidence => activeFactCorrections({slug:'article',body:statement,evidence,now});
test('verified URL correction survives a renamed label and clears after destination replacement',()=>{
 const evidence=fixture();evidence.findings[0].matchUrl=source;
 const run=body=>activeFactCorrections({slug:'article',body,evidence,now});
 assert.equal(run(`[Закон](${source})`).length,1);
 assert.equal(run(`[Новое название](${source})`).length,1);
 assert.equal(run('[Закон](https://www.consultant.ru/document/cons_doc_LAW_480697/)').length,0);
 assert.equal(run(statement).length,0);
 for(const invalid of [null,42,'https://example.com/norm']){
  evidence.findings[0].matchUrl=invalid;assert.equal(run(statement).length,0);
 }
});
test('fresh semantic finding is active only while its exact statement is present',()=>{
 const evidence=fixture();assert.equal(check(evidence).length,1);
 assert.equal(activeFactCorrections({slug:'article',body:'Исправленное утверждение.',evidence,now}).length,0);
 assert.equal(activeFactCorrections({slug:'other',body:statement,evidence,now}).length,0);
 assert.equal(activeFactCorrections({slug:'article',body:'[Неверное утверждение](/blog/other/) про штраф.',evidence,now}).length,1);
});
test('missing verification and invalid primary evidence cannot produce correction priority',()=>{
 for(const mutate of [e=>e.findings[0].result='unreviewed',e=>e.findings[0].claimHash='0'.repeat(64),e=>e.findings[0].rationale='',e=>e.findings[0].excerpt='not present',e=>e.documents[0].sha256='0'.repeat(64),e=>e.documents[0].status=403,e=>e.findings[0].source='https://example.com/norm',e=>e.findings[0].checkedAt='2027-01-01',e=>e.documents[0].fetchedAt='2025-01-01']){
  const evidence=fixture();mutate(evidence);assert.deepEqual(check(evidence),[]);
 }
 assert.deepEqual(check(null),[]);
});

test('late verified finding promotes only a staged rewrite that removes the published contradiction',()=>{
 const item={slug:'article',kind:'rewrite',stagedFile:'release-drafts/article.md',acceptedAt:'2026-10-01'};
 const options={item,publishedBody:statement,candidateBody:'Исправленное утверждение.',evidence:fixture(),now};
 assert.equal(lateCorrectionPriority(options).factualCorrection,true);
 assert.equal(item.factualCorrection,undefined);
 for(const changed of [{candidateBody:statement},{publishedBody:'Другая статья.'},{evidence:null},{item:{...item,kind:'new'}},{item:{...item,stagedFile:null}},{now:new Date('2027-10-04')}]) assert.equal(lateCorrectionPriority({...options,...changed}).factualCorrection,undefined);
});


test('official Rospotrebnadzor correction remains exact, fresh and source-bound', () => {
 const url='https://zpp.rospotrebnadzor.ru/news/federal/575519';
 const make=()=>{const e=fixture();e.documents[0].url=url;e.findings[0].source=url;return e;};
 assert.equal(check(make()).length,1);
 assert.equal(activeFactCorrections({slug:'article',body:'Исправлено',evidence:make(),now}).length,0);
 for(const mutate of [e=>e.findings[0].excerpt='Чужой фрагмент',e=>e.findings[0].checkedAt='2025-01-01',e=>{e.findings[0].source='https://rospotrebnadzor.ru.evil.example/news/1';e.documents[0].url=e.findings[0].source;}]){const e=make();mutate(e);assert.equal(check(e).length,0);}
});
