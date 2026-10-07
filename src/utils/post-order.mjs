// Resolve equal dates/scores independently of collection loading order or locale.
export function latestPostFirst(a,b){
 const date=b.data.pubDate.valueOf()-a.data.pubDate.valueOf();
 return date||(a.id<b.id?-1:a.id>b.id?1:0);
}
export function relatedPostFirst(a,b){return b.score-a.score||latestPostFirst(a.post,b.post);}
