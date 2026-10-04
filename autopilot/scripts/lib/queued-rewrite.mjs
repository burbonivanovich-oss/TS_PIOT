import path from 'node:path';
import {existsSync,mkdirSync,lstatSync,readFileSync,writeFileSync,unlinkSync,copyFileSync} from 'node:fs';
import {parseFrontmatter} from './content.mjs';
function valid(slug){if(typeof slug!=='string'||!/^[a-z0-9-]+$/.test(slug))throw new Error('Invalid rewrite slug');}
function folder(dataDir,name){const dir=path.join(dataDir,name);mkdirSync(dir,{recursive:true});if(lstatSync(dir).isSymbolicLink()||!lstatSync(dir).isDirectory())throw new Error('Unsafe rewrite directory');return dir;}
function regular(file){if(lstatSync(file).isSymbolicLink()||!lstatSync(file).isFile())throw new Error('Unsafe rewrite file');return file;}
function find(dir,slug){valid(slug);const files=['.md','.mdx'].map(ext=>path.join(dir,slug+ext)).filter(existsSync);if(files.length>1)throw new Error('Ambiguous rewrite files');return files[0] ? regular(files[0]) : null;}
export function preservePublishedRewrite({blog,dataDir,slug}){
 const dir=folder(dataDir,'published-rewrites');if(find(dir,slug))return;
 const file=find(blog,slug);if(!file||parseFrontmatter(readFileSync(file,'utf8')).data.draft===true)return;
 writeFileSync(path.join(dir,path.basename(file)),readFileSync(file),{flag:'wx'});
}
export function restorePublishedRewrite({blog,dataDir,slug}){
 const original=find(folder(dataDir,'published-rewrites'),slug);if(!original)throw new Error('Missing published rewrite baseline');
 const current=find(blog,slug);if(current&&current!==path.join(blog,path.basename(original)))unlinkSync(current);
 copyFileSync(original,path.join(blog,path.basename(original)));
}
export function stageQueuedRewrite({blog,dataDir,slug,file}){
 const original=find(folder(dataDir,'published-rewrites'),slug);if(!original)throw new Error('Missing published rewrite baseline');
 if(path.resolve(file)!==path.resolve(find(blog,slug)||''))throw new Error('Unexpected rewrite candidate');
 const dir=folder(dataDir,'release-drafts'), staged=path.join(dir,path.basename(file));writeFileSync(staged,readFileSync(regular(file)),{flag:'wx'});restorePublishedRewrite({blog,dataDir,slug});
 return `release-drafts/${path.basename(staged)}`;
}
export function queuedRewriteFile({dataDir,slug,stagedFile}){
 valid(slug);if(stagedFile!==`release-drafts/${slug}.md`&&stagedFile!==`release-drafts/${slug}.mdx`)throw new Error('Unsafe queued rewrite path');
 const dir=folder(dataDir,'release-drafts');const file=path.join(dir,path.basename(stagedFile));if(!existsSync(file))throw new Error('Missing staged rewrite');return regular(file);
}
export function promoteQueuedRewrite({blog,dataDir,slug,stagedFile}){
 const staged=queuedRewriteFile({dataDir,slug,stagedFile});if(!staged)throw new Error('Missing staged rewrite');
 const current=find(blog,slug),target=path.join(blog,path.basename(staged));if(current&&current!==target)unlinkSync(current);copyFileSync(staged,target);unlinkSync(staged);
 const original=find(folder(dataDir,'published-rewrites'),slug);if(original)unlinkSync(original);
}
export function forgetPublishedRewrite({dataDir,slug}){const original=find(folder(dataDir,'published-rewrites'),slug);if(original)unlinkSync(original);}
export function retainFailedRewrite({blog,dataDir,slug,file}){
 const original=find(folder(dataDir,'published-rewrites'),slug);if(!original)return false;
 const failed=path.join(folder(dataDir,'failed-rewrites'),path.basename(regular(file)));writeFileSync(failed,readFileSync(file));restorePublishedRewrite({blog,dataDir,slug});return true;
}

// A writer candidate temporarily replaces a live article. Only an active rewrite
// with a regular, genuinely published baseline can retain that URL as a target.
export function publishedRewriteTargets({dataDir,articles,now=new Date()}) {
 const stateFile=path.join(dataDir,'autopilot.json');if(!existsSync(stateFile))return new Set();
 const state=JSON.parse(readFileSync(regular(stateFile),'utf8'));
 const active=new Set((state.inFlight||[]).filter(i=>i.kind==='rewrite').map(i=>i.slug));
 const dir=path.join(dataDir,'published-rewrites');if(!existsSync(dir))return new Set();
 if(lstatSync(dir).isSymbolicLink()||!lstatSync(dir).isDirectory())throw new Error('Unsafe published rewrite directory');
 const targets=new Set();
 for(const article of articles) {
  if(!active.has(article.slug))continue;
  const original=find(dir,article.slug);if(!original)continue;
  const {data}=parseFrontmatter(readFileSync(original,'utf8'));
  const date=new Date(data.pubDate);
  if(data.draft===false&&data.autopilotHold!==true&&Number.isFinite(date.getTime())&&date<=now)targets.add(article.slug);
 }
 return targets;
}
