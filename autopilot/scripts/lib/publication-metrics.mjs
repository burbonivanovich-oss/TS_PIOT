const sha=value=>typeof value==='string'&&/^[a-f0-9]{40,64}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const empty=()=>({new:0,rewrite:0,unknown:0,total:0});
const add=(counts,kind)=>{counts[['new','rewrite'].includes(kind)?kind:'unknown']++;counts.total++;};
export function publicationMetrics({state,publishLog,queue=[],proofs={checks:[]},now=new Date(),targets}) {
 const month=now.toISOString().slice(0,7),to=now.toISOString().slice(0,10),events=[];
 for(const [date,slugs] of Object.entries(publishLog.days||{})) {
  if(!day(date)||!Array.isArray(slugs)||slugs.some(s=>typeof s!=='string'||!s))throw Error('Invalid publication ledger');
  if(!date.startsWith(month)||date>to)continue;
  for(const slug of new Set(slugs))events.push({date,slug,kind:publishLog.kinds?.[date]?.[slug]??'unknown'});
 }
 const released=empty(),waiting=empty(),confirmed=empty();events.forEach(e=>add(released,e.kind));queue.forEach(item=>add(waiting,item.kind));
 const identities=new Map(events.map(e=>[e.date+'\0'+e.slug,e]));const checked=new Map();let invalidProofs=0;
 for(const proof of proofs.checks||[]) {
  const at=Date.parse(proof.checkedAt),built=Date.parse(proof.builtAt);
  if(proof.liveVerified!==true||!sha(proof.revision)||!Number.isFinite(at)||at>now.getTime()||!Number.isFinite(built)||built>at+300000||!Array.isArray(proof.items)||!Array.isArray(proof.pages)){invalidProofs++;continue;}
  for(const item of proof.items) {
   const key=item.date+'\0'+item.slug,event=identities.get(key),page=proof.pages.find(p=>p.path===`/blog/${item.slug}/`);
   if(!event||item.kind!==event.kind||!day(item.date)||item.date>proof.checkedAt.slice(0,10)||!sha(item.releaseCommit)||!hash(item.sourceSha256)||!hash(item.expectedHtmlSha256)||page?.status!==200||page.contentVerified!==true||page.verification!=='exact-rendered-html'||page.htmlSha256!==item.expectedHtmlSha256){invalidProofs++;continue;}
   if(!checked.has(key)||checked.get(key).checkedAt<proof.checkedAt)checked.set(key,{...event,checkedAt:proof.checkedAt,revision:proof.revision,releaseCommit:item.releaseCommit,sourceSha256:item.sourceSha256});
  }
 }
 checked.forEach(e=>add(confirmed,e.kind));
 const accepted=state.month===month?{new:state.counters.new,rewrite:state.counters.rewrite,total:state.counters.new+state.counters.rewrite}:null;
 const remaining=counts=>({new:counts?Math.max(0,targets.new-counts.new):null,rewrite:counts&&targets.rewrite!=null?Math.max(0,targets.rewrite-counts.rewrite):null});
 const dates=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0)).getUTCDate(),expected={new:Math.round(targets.new*now.getUTCDate()/dates),rewrite:targets.rewrite==null?null:Math.round(targets.rewrite*now.getUTCDate()/dates)};
 const repeatedNew=events.filter(e=>e.kind==='new').filter((e,i,all)=>all.findIndex(x=>x.slug===e.slug)!==i).map(e=>({date:e.date,slug:e.slug}));
 if(repeatedNew.length)throw Error('Repeated NEW URL in publication ledger');
 return{month,accepted,released,confirmedOnSite:confirmed,waiting,targets,expectedByToday:expected,
  releaseDebt:{new:Math.max(0,expected.new-released.new),rewrite:expected.rewrite==null?null:Math.max(0,expected.rewrite-released.rewrite)},
  remainingToAccept:remaining(accepted),remainingToRelease:remaining(released),
  liveCoverage:{checkedEvents:checked.size,ledgerEvents:events.length,complete:checked.size===events.length,invalidProofs,observations:[...checked.values()],scope:'Exact built versions observed at checkedAt; not continuous availability or proof of publication time'},
  repeatedNew,scope:'Accepted counters and calendar release events are separate; URL repetition is not another new article; missing kind or proof is unknown'};
}
