import {test} from 'node:test';import assert from 'node:assert/strict';
import {registerCpaVisibility} from '../../src/utils/cpa-visibility.mjs';
test('visible CTA only: hidden tabs, below threshold, duplicate callbacks and unknown offers are excluded',()=>{
 let callback;const observed=[],unobserved=[],sent=[],listeners={};
 const article={dataset:{commercialContentId:'a'.repeat(64)}};
 const anchor={dataset:{cpaId:'kontur-ofd',cpaPlacement:'inline'},closest:()=>article};
 const doc={visibilityState:'visible',querySelectorAll:()=>[anchor],addEventListener:(name,fn)=>listeners[name]=fn};
 class Observer{constructor(cb){callback=cb;}observe(a){observed.push(a)}unobserve(a){unobserved.push(a)}}
 assert.equal(registerCpaVisibility({document:doc,send:(event,params)=>sent.push({event,params}),Observer}),true);
 assert.equal(registerCpaVisibility({document:doc,send:()=>{},Observer}),false);
 const fire=ratio=>callback([{target:anchor,isIntersecting:true,intersectionRatio:ratio}]);
 fire(.49);assert.equal(sent.length,0);doc.visibilityState='hidden';fire(1);assert.equal(sent.length,0);
 doc.visibilityState='visible';anchor.dataset.cpaId='private@example.org';fire(1);assert.equal(sent.length,0);anchor.dataset.cpaId='kontur-ofd';listeners.visibilitychange();assert.equal(observed.length,2);
 fire(.5);fire(1);assert.equal(sent.length,1);assert.equal(sent[0].event,'cpa-visible');assert.equal(sent[0].params.placement,'inline');
});
test('missing observer does not turn page views into impressions',()=>{
 assert.equal(registerCpaVisibility({document:{},send:()=>{throw Error('unexpected')},Observer:null}),false);
});
