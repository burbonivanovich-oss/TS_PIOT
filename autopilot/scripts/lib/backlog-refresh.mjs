// Refresh only schedulable topics; history, quarantine and active owners survive.
export function rebalancePlanned(topics, offers, {target, maxShare, rank, check, day}) {
  if(!Number.isSafeInteger(target)||target<1)throw new Error('Invalid backlog target');
  const active=topics.filter(t=>t.status==='writing');
  const candidates=topics.filter(t=>['planned','deferred'].includes(t.status));
  const historical=topics.filter(t=>!['planned','deferred','writing'].includes(t.status));
  const known=new Set(topics.map(t=>t.slug));
  const rejected=[];
  for(const offer of offers) {
    if(known.has(offer.slug))continue;
    const verdict=check(offer,[...topics,...candidates.filter(t=>!known.has(t.slug))]);
    if(verdict.verdict==='block'){rejected.push({slug:offer.slug,reason:verdict.advice});continue;}
    candidates.push({...offer,status:'planned',createdAt:day,dedupe:{verdict:verdict.verdict,advice:verdict.advice,related:verdict.hits.slice(0,3).map(h=>h.slug)}});
  }
  const ranked=rank(candidates), selected=[], deferred=[], count=new Map();
  const entity=t=>String(t.entity).trim().toLowerCase();
  for(const t of active)count.set(entity(t),(count.get(entity(t))||0)+1);
  const cap=Math.max(2,Math.ceil(target*maxShare)),slots=Math.max(0,target-active.length);
  for(const t of ranked) {
    if(selected.length<slots&&(count.get(entity(t))||0)<cap) {
      const {deferredAt,deferredReason,...clean}=t;selected.push({...clean,status:'planned'});count.set(entity(t),(count.get(entity(t))||0)+1);
    }else deferred.push({...t,status:'deferred',deferredAt:t.deferredAt||day,deferredReason:'buffer-rebalanced'});
  }
  return {topics:[...historical,...active,...selected,...deferred],selected,deferred,rejected};
}
