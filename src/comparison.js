import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {z} from 'zod';
import {configSchema,regionSchema,inside,stateDir,writeJson,loadConfig} from './config.js';
import {parseFigmaUrl,getFigmaFrame,syncFigma} from './figma.js';

export const comparisonInput=z.object({
  url:z.string().url().refine(v=>/^https?:/.test(v)&&!new URL(v).username&&!new URL(v).password,'Use an HTTP(S) URL without embedded credentials'),
  figmaUrl:z.string().url().optional(),reference:z.string().min(1).optional(),
  width:z.number().int().min(1).max(10000).optional(),height:z.number().int().min(1).max(10000).optional(),
  readySelector:z.string().min(1).default('body'),regions:z.array(regionSchema).default([]),
  storageState:z.string().min(1).optional(),interactive:z.boolean().default(false)
}).strict().refine(v=>v.figmaUrl||v.reference,{message:'Provide a Figma frame URL or a local reference PNG'});
export function projectFile(root,value){return inside(root,path.relative(path.resolve(root),path.resolve(root,value)));}
async function privateState(root){const dir=stateDir(root);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'.gitignore'),'*\n',{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});return dir;}

export async function prepareComparison(project,input,options={}){
  const values=comparisonInput.parse(input);
  if(values.figmaUrl)parseFigmaUrl(values.figmaUrl);
  let bytes,frame,viewport;
  if(values.reference){bytes=await fs.readFile(projectFile(project,values.reference));const meta=await sharp(bytes).metadata();if(meta.format!=='png')throw Error('Reference must be a PNG');viewport={width:meta.width,height:meta.height};}
  else{frame=await getFigmaFrame(values.figmaUrl,options);viewport={width:frame.node.absoluteBoundingBox.width,height:frame.node.absoluteBoundingBox.height};}
  if(values.width!==undefined&&values.width!==viewport.width||values.height!==undefined&&values.height!==viewport.height)throw Error('Requested dimensions must match the reference; no automatic resizing');
  let storage;
  if(values.storageState){storage=JSON.parse(await fs.readFile(projectFile(project,values.storageState),'utf8'));if(!Array.isArray(storage.cookies)||!Array.isArray(storage.origins))throw Error('Invalid Playwright storage state: expected cookies and origins arrays');}
  const config=configSchema.parse({version:1,maxIterations:5,screens:[{name:'desktop',url:values.url,...(!values.reference?{figmaUrl:values.figmaUrl}:{}),reference:'reference.png',viewport,readySelector:values.readySelector,regions:values.regions,...(storage?{storageState:'storage-state.json'}:{})}]});
  const comparisonId=crypto.randomUUID();const dir=inside(await privateState(project),'comparisons',comparisonId);await fs.mkdir(dir,{recursive:true});
  if(bytes)await fs.writeFile(path.join(dir,'reference.png'),bytes);
  if(frame)await syncFigma(dir,config.screens[0],{...options,frame});
  if(storage)await fs.writeFile(path.join(dir,'storage-state.json'),JSON.stringify(storage),{mode:0o600});
  const design={source:bytes?'png':'figma',figmaUrl:values.figmaUrl??null,version:frame?.data.version??null,nodeId:frame?.nodeId??null,frameName:frame?.node.name??null};
  const metadata={comparisonId,entryUrl:values.url,viewport,design,interactive:values.interactive,createdAt:new Date().toISOString()};
  await writeJson(path.join(dir,'fidelity.config.json'),config);await writeJson(path.join(dir,'comparison.json'),metadata);
  return {...metadata,root:dir,screen:'desktop',note:values.interactive?'Navigate the visible browser to the required page state, then explicitly confirm readiness before capture.':'Reference pinned for this comparison. Reuse comparisonId for repairs; prepare another comparison for a different frame.'};
}
export async function resolveComparison(project,id){
  if(!z.string().uuid().safeParse(id).success)throw Error('Invalid comparison ID');
  const root=inside(stateDir(project),'comparisons',id);const metadata=JSON.parse(await fs.readFile(path.join(root,'comparison.json'),'utf8'));
  if(metadata.comparisonId!==id)throw Error('Comparison metadata does not match its ID');
  return {...metadata,root,config:await loadConfig(root)};
}
export async function saveLogin(project,page){
  const file=path.join(await privateState(project),'auth.json');
  const state=await page.context().storageState({indexedDB:true});await fs.writeFile(file,JSON.stringify(state),{mode:0o600});
  return {storageState:path.relative(project,file),note:'Saved local cookies, localStorage and IndexedDB. SessionStorage, wizard steps and open dialogs are not restored by this file.'};
}
export async function requireInteractive(project,id){
  const {config,root,...metadata}=await resolveComparison(project,id);
  if(!metadata.interactive)await writeJson(path.join(root,'comparison.json'),{...metadata,interactive:true});
}
