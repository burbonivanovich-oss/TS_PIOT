// Bind review priority to a dated, complete page-view report. Unknown is never 0.
const DAY=86400000;
const count=value=>Number.isInteger(value)&&value>=0;
export function reviewTraffic({snapshot,now=new Date(),counterId='109130279',maxAgeDays=7}={}) {
  const unavailable=reason=>({metadata:{status:'unavailable',reason},trafficFor:()=>null});
  if(!snapshot)return unavailable('snapshot-missing');
  if(String(snapshot.counterId)!==String(counterId))return unavailable('counter-mismatch');
  const fetched=Date.parse(snapshot.fetchedAt),clock=now.getTime();
  if(!Number.isFinite(fetched)||fetched>clock||clock-fetched>maxAgeDays*DAY)return unavailable('snapshot-stale-or-invalid');
  if(snapshot.coverage?.complete!==true||snapshot.coverage?.sampled!==false)return unavailable('coverage-incomplete-or-sampled');
  if(!snapshot.byPage||typeof snapshot.byPage!=='object'||Array.isArray(snapshot.byPage))return unavailable('page-data-missing');
  let period=snapshot.period;
  if(!period){
    if(!count(snapshot.days)||snapshot.days<1)return unavailable('period-missing');
    const end=new Date(fetched);const start=new Date(fetched);start.setUTCDate(start.getUTCDate()-snapshot.days);
    period={date1:start.toISOString().slice(0,10),date2:end.toISOString().slice(0,10),inclusiveDays:snapshot.days+1,derivation:'legacy collector subtracts days; API date bounds inclusive'};
  }
  const date=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;
  if(!date(period.date1)||!date(period.date2)||period.date1>period.date2||period.date2>snapshot.fetchedAt.slice(0,10))return unavailable('period-invalid');
  const metadata={status:'usable-dated-snapshot',counterId:String(counterId),fetchedAt:snapshot.fetchedAt,ageDays:(clock-fetched)/DAY,period,coverage:snapshot.coverage,rankingMetric:'pageviews; not visits or summed users'};
  const trafficFor=slug=>{
    const paths=[`/blog/${slug}/`,`/blog/${slug}`];const rows=paths.filter(p=>Object.hasOwn(snapshot.byPage,p)).map(p=>snapshot.byPage[p]);
    if(rows.some(r=>!count(r?.pageviews)))return{pageviews:null,status:'unknown-invalid-metric'};
    return{pageviews:rows.reduce((sum,r)=>sum+r.pageviews,0),status:rows.length?'reported':'zero-in-complete-report',paths};
  };
  return{metadata,trafficFor};
}
