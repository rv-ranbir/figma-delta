import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { writeJson } from './config.js';
import { propertyComparisons, compareStyle } from './properties.js';
import { normalizePaint, isColorProperty, COLOR_FORMAT } from './colors.js';

const imageNames=['reference','actual','diff','overlay'];
const identity=parts=>crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0,24);

function cropBounds(region,viewport){
  const rects=[region?.expected?.rect,region?.actual?.rect].filter(r=>r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0);
  if(!rects.length)return null;
  const x=Math.max(0,Math.floor(Math.min(...rects.map(r=>r.x))));
  const y=Math.max(0,Math.floor(Math.min(...rects.map(r=>r.y))));
  const right=Math.min(viewport.width,Math.ceil(Math.max(...rects.map(r=>r.x+r.width))));
  const bottom=Math.min(viewport.height,Math.ceil(Math.max(...rects.map(r=>r.y+r.height))));
  return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:null;
}

function measurement(issue,region,screen,configured,report){
  const tolerance=configured?.tolerancePx??screen.tolerancePx;
  switch(issue.kind){
    case 'coverage':return {property:issue.property,reason:issue.reason,expected:{operator:'unavailable',value:issue.expected??null},actual:{value:issue.actual??null}};
    case 'geometry':return {property:issue.property,expected:{operator:'within',value:issue.expected,unit:'px',tolerance},actual:{value:issue.actual,unit:'px'},delta:issue.delta};
    case 'style':{
      if(isColorProperty(issue.property)){
        const desired=normalizePaint(issue.property,issue.expected),observed=normalizePaint(issue.property,issue.actual);
        return {property:issue.property,colorFormat:COLOR_FORMAT,
          expected:{operator:compareStyle(issue.property,issue.expected,issue.actual).method,value:desired,rawValue:issue.expectedRaw??issue.expected??null},
          actual:{value:observed,rawValue:issue.actualRaw??issue.actual??null}};
      }
      if(issue.property==='fontFamily')return {property:issue.property,expected:{operator:'primary-font-family-equals',value:issue.expected},actual:{value:issue.actual??null}};
      const px=value=>/^-?\d+(\.\d+)?px$/.test(String(value));
      if(px(issue.expected)&&px(issue.actual))return {property:issue.property,
        expected:{operator:'within',value:parseFloat(issue.expected),unit:'px',tolerance:0.5,rawValue:issue.expected},
        actual:{value:parseFloat(issue.actual),unit:'px',rawValue:issue.actual},delta:parseFloat(issue.actual)-parseFloat(issue.expected)};
      return {property:issue.property,expected:{operator:compareStyle(issue.property,issue.expected,issue.actual).method,value:issue.expected},actual:{value:issue.actual??null}};
    }
    case 'pixels':case 'region-pixels':return {property:'mismatchPercent',expected:{operator:'<=',value:configured?.maxMismatchPercent??screen.maxMismatchPercent,unit:'percent'},actual:{value:issue.kind==='pixels'?report.pixels.mismatchPercent:region?.mismatchPercent??null,unit:'percent'}};
    case 'element':return {property:'availability',expected:{operator:'equals',value:'one visible element'},actual:{value:region?.actual?.error??issue.message,count:region?.actual?.count??null}};
    case 'font':return {property:'loaded',expected:{operator:'equals',value:true},actual:{value:false}};
    case 'asset':return {property:'loaded',expected:{operator:'equals',value:true},actual:{value:false}};
    default:return {property:'runtimeError',expected:{operator:'equals',value:null},actual:{value:issue.message}};
  }
}

// Project existing failed checks into reviewable facts; pixels never imply a CSS cause.
export async function writeFindings(dir,report,screen,{cropImages=true}={}){
  const evidenceCache=new Map();
  const byId=new Map();
  const findings=[];
  for(const issue of report.issues){
    const region=report.regions.find(r=>r.name===issue.region);
    const configured=screen.regions.find(r=>r.name===issue.region);
    const target={region:issue.region??null,selector:configured?.selector??region?.actual?.selector??null,nodeId:configured?.nodeId??null,resource:issue.resource??null};
    // Include unmapped issue subjects but never mismatch values, order, or run identifiers.
    const subject=issue.resource??(['font','asset','runtime'].includes(issue.kind)?issue.message:null);
    const id='finding-'+identity([...(report.comparison?.id?[report.comparison.id]:[]),report.screen,report.url,target.region,target.selector,target.nodeId,issue.kind,issue.property??null,subject]);
    if(byId.has(id)){byId.get(id).occurrences++;continue;}
    const evidenceKey=JSON.stringify([target.region,target.selector]);
    let evidence=evidenceCache.get(evidenceKey);
    if(!evidence){
      const bounds=cropBounds(region,report.viewport);
      const images=Object.fromEntries(imageNames.map(name=>[name,name+'.png']));
      if(bounds&&cropImages){
        const relative=path.posix.join('findings','region-'+identity([target.region,target.selector]));
        await fs.mkdir(path.join(dir,relative),{recursive:true});
        await Promise.all(imageNames.map(async name=>{
          images[name]=path.posix.join(relative,name+'.png');
          await sharp(path.join(dir,name+'.png')).extract({left:bounds.x,top:bounds.y,width:bounds.width,height:bounds.height}).png().toFile(path.join(dir,images[name]));
        }));
      }
      evidence={coordinateSpace:'capture-css-pixels',scope:bounds&&cropImages?'region':'page',rect:bounds&&cropImages?bounds:{x:0,y:0,...report.viewport},...(!cropImages&&bounds?{regionRect:bounds}:{}),images};
      evidenceCache.set(evidenceKey,evidence);
    }
    const pixelBased=['pixels','region-pixels'].includes(issue.kind);
    const finding={id,occurrences:1,category:issue.kind,summary:issue.message,target,...measurement(issue,region,screen,configured,report),
      properties:region?propertyComparisons(region.actual,region.expected,configured?.tolerancePx??screen.tolerancePx):[],
      evidenceType:issue.kind==='coverage'?'coverage-gap':pixelBased?'pixel-comparison':'measured-check',evidence,hypotheses:[],
      guidance:issue.kind==='coverage'?'Resolve the comparison coverage or review visually. An unverified check is not proof of a design defect.':pixelBased?'Inspect reference, actual, diff and overlay. Pixel differences do not establish a semantic defect or a CSS root cause.':'Inspect the measured difference and mapped element before editing. Reverify after the change.',
      review:{status:'unreviewed',severity:null,comment:null}};
    findings.push(finding);byId.set(id,finding);
  }
  const document={schemaVersion:1,colorFormat:COLOR_FORMAT,runId:report.runId,screen:report.screen,url:report.url,viewport:report.viewport,capturedAt:report.capturedAt,pass:report.pass,...(report.comparison?{comparison:report.comparison}:{}),
    reviewNote:'Review fields are a fresh export template, not persisted review state. Keep human annotations separately, keyed by finding ID. Severity and root cause require review.',findings};
  await writeJson(path.join(dir,'findings.json'),document);
  return document;
}

// Compact agent-facing projection: keep failed checks, not repeated matches or image payloads.
export function compactReport(report){
  const source=report.findings??(report.issues??[]).map(issue=>({category:issue.kind,target:{region:issue.region??null,selector:report.regions?.find(r=>r.name===issue.region)?.actual?.selector??null,resource:issue.resource??null},property:issue.property,
    expected:{value:issue.expected??null,rawValue:issue.expectedRaw},actual:{value:issue.actual??issue.message,rawValue:issue.actualRaw},delta:issue.delta,reason:issue.reason}));
  const differences=source.map(finding=>({id:finding.id??null,category:finding.category,region:finding.target?.region??null,selector:finding.target?.selector??null,
    ...(finding.target?.nodeId?{nodeId:finding.target.nodeId}:{}),...(finding.target?.resource?{resource:finding.target.resource}:{}),
    ...(finding.reason?{reason:finding.reason}:{}),
    property:finding.property??null,expected:isColorProperty(finding.property)?normalizePaint(finding.property,finding.expected?.value):finding.expected?.value??null,actual:isColorProperty(finding.property)?normalizePaint(finding.property,finding.actual?.value):finding.actual?.value??null,
    ...(isColorProperty(finding.property)?{colorFormat:COLOR_FORMAT,...(normalizePaint(finding.property,finding.expected?.value)===null?{expectedRaw:finding.expected?.rawValue??finding.expected?.value??null}:{}),...(normalizePaint(finding.property,finding.actual?.value)===null?{actualRaw:finding.actual?.rawValue??finding.actual?.value??null}:{})}:{}),
    ...(finding.category==='coverage'?{comparison:'unavailable'}:isColorProperty(finding.property)?{comparison:compareStyle(finding.property,finding.expected?.value,finding.actual?.value).method}:finding.expected?.operator?{comparison:finding.expected.operator}:{}),
    ...(finding.expected?.unit??finding.actual?.unit?{unit:finding.expected?.unit??finding.actual?.unit}:{}),
    ...(finding.expected?.tolerance!==undefined?{tolerance:finding.expected.tolerance}:{}),
    ...(finding.delta!==undefined?{delta:finding.delta}:{}),...(finding.actual?.count!==undefined&&finding.actual.count!==null?{count:finding.actual.count}:{}),
    ...(finding.occurrences>1?{occurrences:finding.occurrences}:{})}));
  return {schemaVersion:1,format:'json',colorFormat:COLOR_FORMAT,runId:report.runId,screen:report.screen,url:report.url,viewport:report.viewport,pass:report.pass,...(report.comparison?{comparison:report.comparison}:{}),
    mismatchPercent:report.pixels?.mismatchPercent,differences,coverage:report.coverage,session:report.session??null,artifacts:report.artifacts};
}
