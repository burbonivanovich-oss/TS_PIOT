// https://yandex.ru/dev/metrika/en/stat/openapi/data
// https://yandex.ru/dev/metrika/ru/stat/metrics/visits/conversions
export const COUNTER_ID = 109130279;
// First HTTP verification of the release enabling these events, not a guessed launch date.
export const TRACKING_VERIFIED_AT = '2026-10-04T08:31:34.252Z';
export const CPA_TRACKING_VERIFIED_AT = '2026-10-04T21:31:08.779Z';
export const COMMERCIAL_GOALS = [
  ['product-view', 'productViews'], ['product-cta-click', 'ctaClicks'],
  ['selector-task', 'selectorTasks'], ['selector-result', 'selectorResults'],
  ['selector-product-click', 'selectorProductClicks'], ['form-start', 'formStarts'],
  ['form-submit-attempt', 'formSubmitAttempts'],
  ['cpa-visible', 'cpaVisibleVisitors'], ['cpa-click', 'cpaClickVisitors'],
];
const integer = x => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
export function collectionWindow(now, days) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || !Number.isInteger(days) || days < 1 || days > 366) throw new Error('Invalid collection window');
  const start = new Date(now); start.setUTCDate(start.getUTCDate() - days + 1);
  return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), timeZone: 'UTC' };
}
export function resolveCommercialGoals(goals) {
  if (!Array.isArray(goals)) throw new Error('Invalid goal list');
  return COMMERCIAL_GOALS.map(([event, field]) => {
    const matches = goals.filter(g => g.type === 'action' && g.conditions?.length === 1 && g.conditions[0].type === 'exact' && g.conditions[0].url === event && integer(g.id) && g.id > 0);
    return { event, field, trackingVerifiedAt: event.startsWith('cpa-') ? CPA_TRACKING_VERIFIED_AT : TRACKING_VERIFIED_AT, goalId: matches.length === 1 ? matches[0].id : null, issue: matches.length === 1 ? null : 'goal_missing_or_ambiguous' };
  });
}
export function reportRequest(goalRows, period, asOf) {
  const definitions = [{field:'users',metric:'ym:s:users'}, {field:'siteVisits',metric:'ym:s:visits'}, ...goalRows.filter(g => g.goalId !== null).map(g => ({...g,metric:`ym:s:goal${g.goalId}users`}))];
  const filters = `ym:s:dateTime<='${asOf.slice(0,19).replace('T',' ')}'`;
  const url = new URL('https://api-metrika.yandex.net/stat/v1/data');
  url.search = new URLSearchParams({ids:String(COUNTER_ID),metrics:definitions.map(d=>d.metric).join(','),date1:period.from,date2:period.to,timezone:'+00:00',accuracy:'full',filters,limit:'1'}).toString();
  return {url:url.toString(),definitions,filters};
}
export function normalizeCommercialReport(body, {period, asOf, fetchedAt, request, goalRows}) {
  const result = {schemaVersion:1,status:'ok',counterId:COUNTER_ID,period,asOf,fetchedAt,source:'Yandex Metrika Reporting API',sourceRequest:request.url,trackingVerifiedAt:TRACKING_VERIFIED_AT,measurement:{},issues:{},coverage:{sampled:body?.sampled ?? null,sampleShare:body?.sample_share ?? null,dataLagSeconds:body?.data_lag ?? null}};
  const q = body?.query;
  const queryMatches = q?.timezone === '+00:00' && q.date1 === period.from && q.date2 === period.to && q.filters === request.filters && Array.isArray(q.metrics) && q.metrics.join(',') === request.definitions.map(d=>d.metric).join(',') && (!q.dimensions || q.dimensions.length === 0);
  const precise = body?.sampled === false && body.sample_share === 1 && body.total_rows_rounded === false && body.contains_sensitive_data === false && integer(body.data_lag);
  if (!queryMatches || !precise || !Array.isArray(body.totals) || body.totals.length !== request.definitions.length) return {...result,status:'error',reason:!queryMatches?'response_query_mismatch':!precise?'sampling_rounding_privacy_or_lag_unverified':'missing_aggregate_totals'};
  const totalUsers = body.totals[0];
  const cohort = `counter:${COUNTER_ID};UTC:${period.from}/${period.to};visit-start-cutoff:${asOf}`;

  for (let i=0;i<request.definitions.length;i++) {
    const d=request.definitions[i], value=body.totals[i];
    if (!integer(value) || (d.goalId && (!integer(totalUsers) || value > totalUsers))) {result.issues[d.field]='invalid_or_missing_aggregate';continue;}
    const verifiedAt = d.trackingVerifiedAt || TRACKING_VERIFIED_AT;
    const fullyTracked = Date.parse(`${period.from}T00:00:00Z`) >= Date.parse(verifiedAt);
    result[d.field]=value;
    result.measurement[d.field]={unit:d.field==='siteVisits'?'visits':'visitors',cohort,unique:true,complete:body.data_lag===0 && (!d.goalId || fullyTracked),trackingVerifiedAt:d.goalId?verifiedAt:null,subsetOf:d.goalId?['users']:[],trackingCoverage:d.goalId?(fullyTracked?'full':'partial_since_verified_release'):'not_applicable'};
  }
  for (const g of goalRows) if (g.issue) result.issues[g.field]=g.issue;
  if (Object.keys(result.issues).length) result.status='partial';
  return result;
}
export async function collectCommercialMetrika({token, fetcher=fetch, now=new Date(), days=7, clock=()=>new Date()}) {
  const period=collectionWindow(now,days), asOf=new Date(Math.floor(now.getTime()/1000)*1000).toISOString();
  if (!token) throw new Error('METRIKA_OAUTH_TOKEN is absent');
  const get = async url => {
    const response=await fetcher(url,{headers:{Authorization:`OAuth ${token}`},redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new Error(`Metrika API HTTP ${response.status}`);
    return response.json();
  };
  const goalResponse=await get(`https://api-metrika.yandex.net/management/v1/counter/${COUNTER_ID}/goals`);
  const goalRows=resolveCommercialGoals(goalResponse.goals);
  const request=reportRequest(goalRows,period,asOf);
  return normalizeCommercialReport(await get(request.url),{period,asOf,fetchedAt:clock().toISOString(),request,goalRows});
}
