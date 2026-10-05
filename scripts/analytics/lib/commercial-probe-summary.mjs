import { createHash } from 'node:crypto';
import { COUNTER_ID } from './commercial-metrika.mjs';

// Derived metrics for public article slugs only, not raw API rows or parameter values.
export function commercialProbeSummary(result, slugs) {
  const allowed=new Set(slugs.filter(s=>typeof s==='string' && /^[a-z0-9-]+$/.test(s)));
  const byHash=new Map([...allowed].map(s=>[createHash('sha256').update(s).digest('hex'),s]));
  const safe=result.counterId===COUNTER_ID && /^[a-f0-9]{40}$/.test(result.sourceRevision);
  const metrics=new Map();
  for (const kind of ['pages','parameters']) {
    const report=result.reports?.[kind];
    if (!safe || report?.status!=='ok') continue;
    for (const row of report.rows||[]) {
      const slug=kind==='pages'?row.slug:byHash.get(row.contentId);
      if (!allowed.has(slug) || !['cpa-visible','cpa-click'].includes(row.event) || !Number.isSafeInteger(row.events) || row.events<0) continue;
      const key=`${row.event}:${slug}`;
      if (!metrics.has(key)) metrics.set(key,{event:row.event,slug,pageEvents:null,contentParameterEvents:null});
      const item=metrics.get(key),field=kind==='pages'?'pageEvents':'contentParameterEvents';
      const next=(item[field]??0)+row.events;
      if (!Number.isSafeInteger(next)) throw Error('summary_count_invalid');
      item[field]=next;
    }
  }
  const articles=[...metrics.values()].sort((a,b)=>a.slug.localeCompare(b.slug)||a.event.localeCompare(b.event))
    .map(a=>({...a,countsAgree:a.pageEvents!==null && a.contentParameterEvents!==null?a.pageEvents===a.contentParameterEvents:null}));
  const coverage=Object.fromEntries(['pages','parameters'].map(kind=>{
    const r=result.reports?.[kind],c=r?.coverage;
    const int=x=>safe && r?.status==='ok' && Number.isSafeInteger(x) && x>=0?x:null;
    return [kind,{status:safe && r?.status==='ok'?'ok':'unverified',returnedRows:int(c?.returnedRows),totalRows:int(c?.totalRows),
      dataLagSeconds:int(c?.dataLagSeconds),paginationComplete:safe && c?.paginationComplete===true,
      sampled:safe && typeof c?.sampled==='boolean'?c.sampled:null,sampleShare:safe && c?.sampleShare===1?1:null,
      trackingWindowComplete:safe && r?.complete===true}];
  }));
  return {counterId:COUNTER_ID,sourceRevision:safe?result.sourceRevision:null,unit:'events',coverage,
    articleRows:articles.length,truncated:articles.length>200,articles:articles.slice(0,200),
    semantics:'Independent event-page and marginal contentId counts. Agreement is not a joined offer attribution or conversion proof.',
    attributionProven:false,confirmedLeads:null,payments:null,revenue:null,paidModelCost:null};
}
