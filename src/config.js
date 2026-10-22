import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const rect = z.object({x:z.number().nonnegative(), y:z.number().nonnegative(), width:z.number().positive(), height:z.number().positive()}).strict();
const region = z.object({
  name:z.string().regex(/^[a-zA-Z0-9_-]+$/), selector:z.string().min(1),
  nodeId:z.string().optional(), rect:rect.optional(),
  styles:z.record(z.union([z.string(),z.number()])).default({}),
  maxMismatchPercent:z.number().min(0).max(100).optional(),
  tolerancePx:z.number().nonnegative().optional()
}).strict();
export const screenSchema = z.object({
  name:z.string().regex(/^[a-zA-Z0-9_-]+$/),
  url:z.string().url().refine(v=>/^https?:/.test(v),'Use an HTTP(S) application URL'),
  figmaUrl:z.string().url().optional(), reference:z.string().default('reference.png'),
  viewport:z.object({width:z.number().int().min(1).max(10000),height:z.number().int().min(1).max(10000)}),
  readySelector:z.string().default('body'), captureSelector:z.string().optional(),
  colorScheme:z.enum(['light','dark']).default('light'), locale:z.string().default('en-US'),
  timezoneId:z.string().default('UTC'), storageState:z.string().optional(),
  timeoutMs:z.number().int().min(100).max(120000).default(30000),
  maxMismatchPercent:z.number().min(0).max(100).default(2),
  pixelThreshold:z.number().min(0).max(1).default(0.1),
  tolerancePx:z.number().nonnegative().default(2),
  masks:z.array(rect).default([]), regions:z.array(region).default([]),
  requiredFonts:z.array(z.string()).default([])
}).strict();
export const configSchema = z.object({
  version:z.literal(1), maxIterations:z.number().int().min(1).max(20).default(5),
  screens:z.array(screenSchema).min(1)
}).strict().superRefine((c,ctx)=>{
  if(new Set(c.screens.map(s=>s.name)).size!==c.screens.length)ctx.addIssue({code:'custom',message:'Screen names must be unique'});
  for(const s of c.screens)if(new Set(s.regions.map(r=>r.name)).size!==s.regions.length)ctx.addIssue({code:'custom',message:`Duplicate region names in ${s.name}`});
});
export async function loadConfig(root){return configSchema.parse(JSON.parse(await fs.readFile(path.join(root,'fidelity.config.json'),'utf8')));}
export function selectScreen(config,name){const s=config.screens.find(s=>s.name===name);if(!s)throw Error(`Unknown screen: ${name}`);return s;}
export function inside(root,...parts){const full=path.resolve(root,...parts);const rel=path.relative(path.resolve(root),full);if(rel.startsWith('..'+path.sep)||rel==='..'||path.isAbsolute(rel))throw Error('Path must stay inside project');return full;}
export const stateDir=root=>inside(root,'.figma-fidelity');
export const snapshotDir=(root,name)=>inside(stateDir(root),'references',name);
export async function readJson(p){return JSON.parse(await fs.readFile(p,'utf8'));}
export async function writeJson(p,v){await fs.mkdir(path.dirname(p),{recursive:true});const tmp=p+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(tmp,JSON.stringify(v,null,2));await fs.rename(tmp,p);}
export async function withLock(root,fn){
  await fs.mkdir(stateDir(root),{recursive:true});const lock=inside(stateDir(root),'operation.lock');
  let handle;try{handle=await fs.open(lock,'wx');}catch(e){if(e.code==='EEXIST')throw Error('Another fidelity operation is running. If a previous process crashed, remove .figma-fidelity/operation.lock.');throw e;}
  try{return await fn();}finally{await handle.close();await fs.unlink(lock);}
}
