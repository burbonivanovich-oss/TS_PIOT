import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpaClickPayload, registerCpaTracking } from '../../src/utils/cpa-tracking.mjs';
const contentId = 'a'.repeat(64);
test('article click adds only controlled offer, content identifier and placement; disabled context preserves historical payload', () => {
  assert.deepEqual(cpaClickPayload({offer:'diadoc-logistika',contentId,placement:'inline',contextEnabled:true}),{event:'cpa-click',params:{offer:'diadoc-logistika',contentId,placement:'inline'}});
  assert.deepEqual(cpaClickPayload({offer:'diadoc-logistika',contentId,placement:'inline'}),{event:'cpa-click',params:{offer:'diadoc-logistika'}});
  assert.equal(cpaClickPayload({offer:'private@example.org',contentId,contextEnabled:true}),null);
  assert.deepEqual(cpaClickPayload({offer:'kontur-ofd',contentId:'https://site/?email=private',placement:'personal text',contextEnabled:true}).params,{offer:'kontur-ofd'});
});
test('one delegated handler covers nested inline and footer clicks without double counting or breaking navigation', () => {
  const listeners=[],sent=[];
  const document={addEventListener:(name,handler)=>listeners.push(handler)};
  const send=(event,params)=>sent.push({event,params});
  assert.equal(registerCpaTracking({document,send,contextEnabled:true}),true);
  assert.equal(registerCpaTracking({document,send,contextEnabled:true}),false);
  const article={dataset:{commercialContentId:contentId}};
  const anchor={dataset:{cpaId:'kontur-ofd',cpaPlacement:'article-footer'},closest:selector=>selector.startsWith('article')?article:null};
  listeners[0]({target:{closest:()=>anchor}});
  assert.equal(sent.length,1);assert.equal(sent[0].params.contentId,contentId);assert.equal(sent[0].params.placement,'article-footer');
  listeners[0]({target:{closest:()=>null}});assert.equal(sent.length,1);
  const broken={addEventListener:(_,handler)=>listeners.push(handler)};
  registerCpaTracking({document:broken,send:()=>{throw Error('counter blocked')},contextEnabled:true});
  assert.doesNotThrow(()=>listeners[1]({target:{closest:()=>anchor}}));
});

test('built content index resolves the rendered id and rejects mismatched article identity', async () => {
  const { contentIndex } = await import('../analytics/content-index.mjs');
  const { mkdtempSync,mkdirSync,writeFileSync,rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { createHash } = await import('node:crypto');
  const path = await import('node:path');
  const root=mkdtempSync(path.join(tmpdir(),'cpa-index-'));
  try {
    mkdirSync(path.join(root,'blog/article'),{recursive:true});
    const file=path.join(root,'blog/article/index.html');
    const id=createHash('sha256').update('article').digest('hex');
    writeFileSync(file,`<article data-commercial-content-id="${id}">`);
    assert.deepEqual(contentIndex(root).articles,[{contentId:id,slug:'article'}]);
    writeFileSync(file,`<article data-commercial-content-id="${'b'.repeat(64)}">`);
    assert.throws(()=>contentIndex(root),/does not match/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
