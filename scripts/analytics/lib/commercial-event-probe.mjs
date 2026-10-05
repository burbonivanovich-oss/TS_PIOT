import { createHash } from 'node:crypto';
import { COUNTER_ID, collectionWindow, resolveCommercialGoals, CPA_TRACKING_VERIFIED_AT } from './commercial-metrika.mjs';

// Read-only contract probe. Event counts are never users, leads, payments or CTR.
export const PROBE_DIMENSIONS = {
  pages: ['ym:ep:actionGoal', 'ym:ep:eventURLDomain', 'ym:ep:eventURLPath'],
  parameters: ['ym:ep:actionGoal', 'ym:ep:eventParamsLevel1', 'ym:ep:eventParamsLevel2'],
};
const integer = value => Number.isSafeInteger(value) && value >= 0;
const metric = 'ym:ep:eventsNumber';
export function eventProbeRequest(kind, period, asOf, offset = 1, limit = 1000) {
  if (!PROBE_DIMENSIONS[kind] || !integer(offset) || offset < 1 || !integer(limit) || limit < 1 || limit > 100000) throw Error('Invalid probe request');
  const filters = `ym:ep:dateTime<='${asOf.slice(0,19).replace('T',' ')}'`;
  const url = new URL('https://api-metrika.yandex.net/stat/v1/data');
  url.search = new URLSearchParams({ids:String(COUNTER_ID), dimensions:PROBE_DIMENSIONS[kind].join(','), metrics:metric,
    date1:period.from,date2:period.to,timezone:'+00:00',accuracy:'full',filters,
    sort:PROBE_DIMENSIONS[kind].join(','),limit:String(limit),offset:String(offset)}).toString();
  return {url:url.toString(),kind,period,filters,offset,limit};
}
export async function readPagedProbe({kind,period,asOf,get,limit=1000,maxPages=100}) {
  const rows=[], seen=new Set(); let baseline=null;
  for (let page=0;page<maxPages;page++) {
    const request=eventProbeRequest(kind,period,asOf,rows.length+1,limit), body=await get(request.url), q=body?.query;
    if (q?.timezone!=='+00:00' || q.date1!==period.from || q.date2!==period.to || q.filters!==request.filters ||
      q.dimensions?.join(',')!==PROBE_DIMENSIONS[kind].join(',') || q.metrics?.join(',')!==metric ||
      q.offset!==request.offset || q.limit!==limit || q.sort?.join(',')!==PROBE_DIMENSIONS[kind].join(',') ||
      (q.ids && String(q.ids)!==String(COUNTER_ID))) throw Error('response_query_mismatch');
    if (body.sampled!==false || body.sample_share!==1 || body.total_rows_rounded!==false ||
      body.contains_sensitive_data!==false || !integer(body.data_lag) || !integer(body.total_rows) ||
      body.totals?.length!==1 || !integer(body.totals[0]) || !Array.isArray(body.data)) throw Error('precision_unverified');
    const current={totalRows:body.total_rows,totalEvents:body.totals[0],dataLagSeconds:body.data_lag};
    if (baseline && JSON.stringify(current)!==JSON.stringify(baseline)) throw Error('pagination_changed');
    baseline=current;
    if (body.data.length>limit || rows.length+body.data.length>baseline.totalRows) throw Error('pagination_invalid');
    for (const row of body.data) {
      if (row.dimensions?.length!==PROBE_DIMENSIONS[kind].length || row.dimensions.some(d=>!d || typeof d.name!=='string') ||
        row.metrics?.length!==1 || !integer(row.metrics[0])) throw Error('row_invalid');
      const key=JSON.stringify(row.dimensions.map(d=>[d.id??null,d.name]));
      if (seen.has(key)) throw Error('pagination_duplicate');
      seen.add(key);rows.push(row);
    }
    if (rows.length===baseline.totalRows) return {rows,coverage:{...baseline,returnedRows:rows.length,paginationComplete:true,sampled:false,sampleShare:1}};
    if (body.data.length!==limit) throw Error('pagination_truncated');
  }
  throw Error('pagination_limit');
}
function eventFor(dimension, goals) {
  // Do not assume whether the API names a goal by id or exact event identifier.
  const matches=goals.filter(g=>g.goalId!==null && (String(dimension.id)===String(g.goalId) || dimension.name===g.event || dimension.id===g.event));
  return matches.length===1?matches[0].event:null;
}
export function sanitizeProbe({kind,report,goals,slugs,period,asOf}) {
  const allowed=new Set(slugs), hashes=new Set(slugs.map(s=>createHash('sha256').update(s).digest('hex')));
  const rows=[]; let excludedRows=0;
  for (const row of report.rows) {
    const event=eventFor(row.dimensions[0],goals);
    if (!['cpa-visible','cpa-click'].includes(event)) {excludedRows++;continue;}
    if (kind==='pages') {
      const domain=row.dimensions[1].name, pathname=row.dimensions[2].name;
      const match=/^\/blog\/([a-z0-9-]+)\/$/.exec(pathname);
      if (!['etiketka-media.ru','www.etiketka-media.ru'].includes(domain) || !match || !allowed.has(match[1])) {excludedRows++;continue;}
      rows.push({event,slug:match[1],domain,events:row.metrics[0]});
    } else {
      const parameter=row.dimensions[1].name, value=row.dimensions[2].name;
      // Only article hashes are retained. Arbitrary parameter names/values never leave the process.
      if (parameter!=='contentId' || !hashes.has(value)) {excludedRows++;continue;}
      rows.push({event,contentId:value,events:row.metrics[0]});
    }
  }
  return {status:'ok',kind,unit:'events',rows,excludedRows,coverage:report.coverage,
    trackingCoverage:Date.parse(`${period.from}T00:00:00Z`)>=Date.parse(CPA_TRACKING_VERIFIED_AT)?'since_verified_release':'partial_since_verified_release',
    complete:report.coverage.dataLagSeconds===0 && Date.parse(`${period.from}T00:00:00Z`)>=Date.parse(CPA_TRACKING_VERIFIED_AT),
    semantics:kind==='pages'?'Event page, not landing page; article membership from checked-out published source, not proof of live article text.':'Marginal contentId parameter rows; no join with offer/placement and no sum across sibling parameters.',
    asOf};
}
export async function collectCommercialEventProbe({token,slugs,sourceRevision,fetcher=fetch,now=new Date(),days=1,clock=()=>new Date()}) {
  if (!token) throw Error('token_unavailable');
  if (!Array.isArray(slugs) || !slugs.length || slugs.some(s=>typeof s!=='string' || !/^[a-z0-9-]+$/.test(s)) || !/^[a-f0-9]{40}$/.test(sourceRevision)) throw Error('source_articles_unavailable');
  const period=collectionWindow(now,days), asOf=new Date(Math.floor(now.getTime()/1000)*1000).toISOString();
  const get=async url=>{
    const response=await fetcher(url,{headers:{Authorization:`OAuth ${token}`},redirect:'error',signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw Error(`api_http_${response.status}`);
    return response.json();
  };
  const goalResponse=await get(`https://api-metrika.yandex.net/management/v1/counter/${COUNTER_ID}/goals`);
  const goals=resolveCommercialGoals(goalResponse.goals).filter(g=>g.event.startsWith('cpa-'));
  if (goals.some(g=>g.goalId===null)) throw Error('goal_missing_or_ambiguous');
  const reports={};
  for (const kind of Object.keys(PROBE_DIMENSIONS)) {
    try {reports[kind]=sanitizeProbe({kind,report:await readPagedProbe({kind,period,asOf,get}),goals,slugs,period,asOf});}
    catch(error) {reports[kind]={status:'error',reason:/^(api_http_\d{3}|response_query_mismatch|precision_unverified|pagination_\w+|row_invalid)$/.test(error.message)?error.message:'collection_failed'};}
  }
  return {schemaVersion:1,status:Object.values(reports).every(r=>r.status==='ok')?'ok':'partial',counterId:COUNTER_ID,
    period,asOf,fetchedAt:clock().toISOString(),sourceRevision,sourceArticleCount:slugs.length,reports,
    attributionProven:false,confirmedLeads:null,payments:null,revenue:null,paidModelCost:null};
}
