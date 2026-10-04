import path from 'node:path';
import {readJson,writeJson} from './content.mjs';
import {scanCorpus} from '../dedupe.mjs';

// Runs under daily's existing ownership lock, before rewrite planning.
export function refreshDuplicateAudit({dataDir,now=new Date(),scan=scanCorpus}) {
 const file=path.join(dataDir,'dupes.json');
 const previous=readJson(file,null);
 const day=now.toISOString().slice(0,10);
 const stamp=previous?.generatedAt;
 const valid=typeof stamp==='string' && /^\d{4}-\d{2}-\d{2}$/.test(stamp) && new Date(stamp).toISOString().slice(0,10)===stamp;
 const age=valid ? (Date.parse(day)-Date.parse(stamp))/86400000 : Infinity;
 if(age<0)throw new Error('Duplicate audit date is in the future');
 if(age<7 && Array.isArray(previous?.pairs))return {refreshed:false,generatedAt:stamp};
 const pairs=scan();
 if(!Array.isArray(pairs))throw new Error('Invalid duplicate audit result');
 writeJson(file,{generatedAt:day,pairs});
 return {refreshed:true,generatedAt:day,pairs:pairs.length};
}
