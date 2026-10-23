import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { inside, stateDir, snapshotDir, readJson, writeJson, loadConfig, selectScreen, withLock } from './config.js';
import { capture } from './capture.js';
import { compare, compareRegion } from './compare.js';
import { writeReport } from './report.js';
import { writeFindings, compactReport } from './findings.js';
import { compareStyle } from './properties.js';
import { writeSimpleReport } from './simple-report.js';
import { normalizeStyles, isColorProperty, COLOR_FORMAT } from './colors.js';
import { redactUrls } from './privacy.js';

export async function referencePath(root,screen){
  if(screen.figmaUrl)return path.join(snapshotDir(root,screen.name),'reference.png');
  return inside(root,screen.reference);
}
export async function manifestFor(root,screen){
  if(!screen.figmaUrl)return null;
  const m=await readJson(path.join(snapshotDir(root,screen.name),'manifest.json'));
  if(m.source!==screen.figmaUrl)throw Error('Figma URL changed. Sync the new reference explicitly before verification.');
  return m;
}
export function regionExpectations(region,manifest){
  let node;if(region.nodeId){node=manifest?.nodes.find(n=>n.id===region.nodeId.replace('-',':'));if(!node)throw Error(`Region ${region.name}: Figma node ${region.nodeId} is absent from snapshot`);}
  const styles={};
  if(node?.style){const s=node.style;if(s.fontFamily)styles.fontFamily=s.fontFamily;if(s.fontSize!==undefined)styles.fontSize=s.fontSize+'px';if(s.fontWeight!==undefined)styles.fontWeight=String(s.fontWeight);if(s.lineHeightUnit==='PIXELS'&&s.lineHeightPx!==undefined)styles.lineHeight=s.lineHeightPx+'px';}
  const fills=Array.isArray(node?.fills)?node.fills.filter(fill=>fill.visible!==false&&(fill.opacity??1)>0):[];
  if(fills.length===1&&fills[0].type==='SOLID'&&fills[0].color){
    const fill=fills[0];const c=fill.color;const channels=[c.r,c.g,c.b];
    const alpha=(c.a??1)*(fill.opacity??1);
    const property=node.type==='TEXT'?'color':['FRAME','COMPONENT','COMPONENT_SET','INSTANCE','RECTANGLE'].includes(node.type)?'backgroundColor':null;
    if(property&&channels.every(Number.isFinite))styles[property]=`color(srgb ${channels.join(' ')} / ${alpha})`;
  }
  if(Number.isFinite(node?.cornerRadius))styles.borderRadius=node.cornerRadius+'px';
  if(['HORIZONTAL','VERTICAL'].includes(node?.layoutMode)){
    for(const key of ['paddingTop','paddingRight','paddingBottom','paddingLeft'])if(Number.isFinite(node[key]))styles[key]=node[key]+'px';
    if(node.primaryAxisAlignItems!=='SPACE_BETWEEN'&&node.layoutWrap!=='WRAP'&&Number.isFinite(node.itemSpacing)&&node.itemSpacing>=0)styles[node.layoutMode==='HORIZONTAL'?'columnGap':'rowGap']=node.itemSpacing+'px';
  }
  return {rect:region.rect??node?.rect,...normalizeStyles({...styles,...region.styles})};
}
export function checkGeometry(region,actual,expected,tolerance){
  if(actual.error)return [{kind:'element',region:region.name,message:actual.error}];
  const issues=[];
  if(expected.rect){for(const key of ['x','y','width','height']){const delta=actual.rect[key]-expected.rect[key];if(Math.abs(delta)>tolerance)issues.push({kind:'geometry',region:region.name,property:key,expected:expected.rect[key],actual:actual.rect[key],delta,message:`${key}: expected ${expected.rect[key]}px, actual ${Number(actual.rect[key].toFixed(2))}px (Δ ${Number(delta.toFixed(2))}px)`});}}
  for(const [key,val] of Object.entries(expected.styles)){
    const value=actual.styles[key];
    const comparison=compareStyle(key,val,value);
    if(!comparison.matches){
      const color=isColorProperty(key),desired=color?comparison.expectedColor:val,observed=color?comparison.actualColor:value;
      issues.push({kind:'style',region:region.name,property:key,expected:desired,actual:observed,
        ...(color?{colorFormat:COLOR_FORMAT,expectedRaw:expected.rawStyles?.[key]??val,actualRaw:actual.rawStyles?.[key]??value}:{}),
        message:comparison.method==='color-unavailable'?`${key}: color normalization unavailable; inspect raw values`:`${key}: expected ${desired}, actual ${observed??'unavailable'}`});
    }
  }return issues;
}
async function signature(root,screen){
  const ref=await referencePath(root,screen);const manifest=await manifestFor(root,screen);
  return crypto.createHash('sha256').update(JSON.stringify(screen)).update(await fs.readFile(ref)).update(JSON.stringify(manifest)).digest('hex');
}
export async function beginSession(root,name){return withLock(root,async()=>{
  const config=await loadConfig(root);const screen=selectScreen(config,name);
  const session={id:crypto.randomUUID(),screen:name,signature:await signature(root,screen),maxIterations:config.maxIterations,history:[],stale:0,status:'active',startedAt:new Date().toISOString()};
  await writeJson(inside(stateDir(root),'sessions',name+'.json'),session);
  return session;
});}
export async function verify(root,name,{sessionId,format='simple',page,comparison,captureFn=capture}={}){return withLock(root,async()=>{
  if(!['simple','html','json'].includes(format))throw Error('format must be simple, html or json');
  const config=await loadConfig(root);const screen=selectScreen(config,name);
  let session;
  const sessionFile=inside(stateDir(root),'sessions',name+'.json');
  if(sessionId){session=await readJson(sessionFile);if(session.id!==sessionId)throw Error('Session ID mismatch');
    if(session.status!=='active')throw Error(`Session has stopped: ${session.status}. Report unresolved differences; do not silently reset the budget.`);
    if(session.signature!==await signature(root,screen))throw Error('Reference or config changed during repair; start a new session explicitly.');
  }
  const reference=await referencePath(root,screen);const meta=await sharp(reference).metadata();
  if(meta.width!==screen.viewport.width||meta.height!==screen.viewport.height)throw Error(`Reference must be ${screen.viewport.width}×${screen.viewport.height}; got ${meta.width}×${meta.height}`);
  const manifest=await manifestFor(root,screen);
  const expectations=screen.regions.map(r=>regionExpectations(r,manifest));
  const runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8);
  const dir=inside(stateDir(root),'runs',name,runId);await fs.mkdir(dir,{recursive:true});
  const captured=await captureFn(root,screen,path.join(dir,'actual.png'),{page});
  for(const measure of captured.measures)if(measure.styles)Object.assign(measure,normalizeStyles(measure.styles));
  await fs.copyFile(reference,path.join(dir,'reference.png'));
  const pixels=await compare(path.join(dir,'reference.png'),path.join(dir,'actual.png'),dir,{threshold:screen.pixelThreshold,masks:screen.masks});
  const issues=[];
  if(pixels.mismatchPercent>screen.maxMismatchPercent)issues.push({kind:'pixels',message:`${pixels.mismatchPercent.toFixed(3)}% mismatched pixels exceeds ${screen.maxMismatchPercent}% budget`});
  const regions=[];
  for(let i=0;i<screen.regions.length;i++){
    const r=screen.regions[i],expected=expectations[i],actual=captured.measures[i];
    issues.push(...checkGeometry(r,actual,expected,r.tolerancePx??screen.tolerancePx));
    let mismatchPercent;
    if(expected.rect){mismatchPercent=await compareRegion(path.join(dir,'reference.png'),path.join(dir,'actual.png'),expected.rect,{threshold:screen.pixelThreshold,masks:screen.masks});
      const max=r.maxMismatchPercent??screen.maxMismatchPercent;if(mismatchPercent>max)issues.push({kind:'region-pixels',region:r.name,message:`Region pixel mismatch ${mismatchPercent.toFixed(3)}% exceeds ${max}%`});}
    regions.push({name:r.name,expected,actual,mismatchPercent});
  }
  for(const f of captured.fonts)if(!f.loaded)issues.push({kind:'font',resource:f.family,message:`Required web font ${f.family} has no loaded FontFace. Verify its source and weight. System fonts should not be listed in requiredFonts.`});
  for(const image of captured.brokenImages)issues.push({kind:'asset',resource:image.src,message:`Image failed to load: ${image.src}`});
  for(const message of captured.errors)issues.push({kind:'runtime',message});
  const pass=issues.length===0;
  let sessionResult;
  if(session){
    // Rank configured non-pixel failures first; pixel noise alone cannot hide new structural errors.
    const objective={failedChecks:issues.filter(i=>!['pixels','region-pixels'].includes(i.kind)).length,mismatchPercent:pixels.mismatchPercent};
    const better=!session.best||objective.failedChecks<session.best.objective.failedChecks||(objective.failedChecks===session.best.objective.failedChecks&&objective.mismatchPercent<session.best.objective.mismatchPercent-0.01);
    if(better){session.best={runId,objective};session.stale=0;}else session.stale++;
    session.history.push({runId,pass,objective});
    if(pass)session.status='passed';else if(session.history.length>=session.maxIterations)session.status='iteration-limit';else if(session.stale>=2)session.status='no-improvement';
    sessionResult={id:session.id,iteration:session.history.length,maxIterations:session.maxIterations,status:session.status,bestRun:session.best.runId,
      nextAction:pass?'Complete: report configured checks and remaining coverage limits.':session.status==='active'?'Inspect images and fix the largest evidenced root cause, then verify with this sessionId.':'STOP: retain reports and summarize unresolved issues. Review your checkpoint before reverting only your own edits.'};
  }
  const report=redactUrls({version:1,colorFormat:COLOR_FORMAT,runId,screen:name,url:screen.url,viewport:screen.viewport,pass,pixels,regions,issues,...captured,session:sessionResult,...(comparison?{comparison}:{ }),
    coverage:{geometryRegions:screen.regions.filter((_,i)=>expectations[i].rect).length,styleRegions:expectations.filter(e=>Object.keys(e.styles).length).length,
      note:'Pass applies only to configured checks. No accessibility audit, functional suite, semantic source-asset verification, or inferred responsive design.'}});
  const findingDocument=await writeFindings(dir,report,redactUrls(screen),{cropImages:format==='html'});
  report.findingsVersion=findingDocument.schemaVersion;report.findings=findingDocument.findings;
  report.format=format;
  report.artifacts={directory:dir,report:format!=='json'?path.join(dir,'report.html'):null,json:path.join(dir,'report.json'),findings:path.join(dir,'findings.json'),result:path.join(dir,'result.json')};
  await writeJson(path.join(dir,'report.json'),report);await fs.writeFile(report.artifacts.result,JSON.stringify(compactReport(report)));
  if(format==='html')await writeReport(dir,report);
  if(format==='simple')await writeSimpleReport(dir,report);
  if(session)await writeJson(sessionFile,session);
  await writeJson(inside(stateDir(root),'latest',name+'.json'),{runId,dir});
  return report;
});}
export async function latest(root,name){
  selectScreen(await loadConfig(root),name);const p=await readJson(inside(stateDir(root),'latest',name+'.json'));
  const dir=inside(stateDir(root),'runs',name,p.runId);return {dir,report:await readJson(path.join(dir,'report.json'))};
}
