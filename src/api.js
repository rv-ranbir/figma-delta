import {z} from 'zod';
import sharp from 'sharp';
import {resolveProject} from './paths.js';
import {regionSchema} from './config.js';
import {prepareComparison,resolveComparison} from './comparison.js';
import {capture} from './capture.js';
import {verify} from './runner.js';
import {parseFigmaUrl} from './figma.js';
import {safeUrl} from './privacy.js';

const input=z.object({project:z.string().default(process.cwd()),page:z.any(),comparisonId:z.string().uuid().optional(),reference:z.string().optional(),figmaUrl:z.string().optional(),regions:z.array(regionSchema).optional(),sessionId:z.string().uuid().optional(),format:z.enum(['simple','html','json']).default('simple'),readiness:z.object({confirmed:z.boolean(),selector:z.string().min(1).optional(),expectedUrl:z.string().min(1).optional()}).strict(),signal:z.any().optional()}).strict();
const blocked=reason=>({status:'blocked',reason,preparationRequired:true,message:'Page preparation required. The project must restore the requested screen; Figma Delta did not navigate, recover or close the page.'});
const fail=reason=>{throw Object.assign(Error(reason),{preparedReason:reason});};
async function ready(page,readiness,signal){
  if(signal?.aborted)fail('CAPTURE_UNAVAILABLE');
  if(page.isClosed())fail('PAGE_CLOSED');
  if(!readiness.confirmed||readiness.expectedUrl&&page.url()!==readiness.expectedUrl||readiness.selector&&!await page.locator(readiness.selector).isVisible())fail('PAGE_NOT_READY');
}

/** Compare a project-prepared Playwright Page. The caller retains all browser ownership. */
export async function checkPreparedPage(options){
  const values=input.parse(options);const {page,readiness,signal}=values;
  if(!page||!['isClosed','url','viewportSize','evaluate','locator','screenshot','context','on','off','mainFrame'].every(key=>typeof page[key]==='function'))return blocked('UNSUPPORTED_PAGE');
  if(values.comparisonId&&(values.reference!==undefined||values.figmaUrl!==undefined||values.regions!==undefined))throw Error('A comparison is pinned. Do not supply new reference, Figma or region inputs with comparisonId.');
  if(values.sessionId&&!values.comparisonId)throw Error('sessionId requires an existing comparisonId; prepare once before beginning repairs.');
  const project=resolveProject(values.project);
  let comparison;
  try{await ready(page,readiness,signal);}catch(error){return blocked(error.preparedReason??(page.isClosed()?'PAGE_CLOSED':'PAGE_NOT_READY'));}
  if(values.comparisonId)comparison=await resolveComparison(project,values.comparisonId);
  else{
    const url=page.url();if(!/^https?:/.test(url))return blocked('UNSUPPORTED_PAGE');
    let figmaUrl;
    if(values.figmaUrl){const {key,nodeId}=parseFigmaUrl(values.figmaUrl);figmaUrl=`https://www.figma.com/design/${key}?node-id=${nodeId.replace(':','-')}`;}
    comparison=await prepareComparison(project,{url:safeUrl(url),reference:values.reference,figmaUrl,regions:values.regions});
  }
  const captureFn=async(root,screen,output)=>{
    let changed=false;const navigated=frame=>{if(frame===page.mainFrame())changed=true;};const closed=()=>{changed=true;};
    page.on('framenavigated',navigated);page.on('close',closed);
    try{
      await ready(page,readiness,signal);const initialUrl=page.url();
      const captured=await capture(root,screen,output,{page,passive:true});
      if(page.isClosed())fail('PAGE_CLOSED');
      if(changed||page.url()!==initialUrl)fail('PAGE_CHANGED_DURING_CAPTURE');
      const size=page.viewportSize()??await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
      const image=await sharp(output).metadata();
      if([size,image].some(value=>value.width!==screen.viewport.width||value.height!==screen.viewport.height))fail('VIEWPORT_MISMATCH');
      await ready(page,readiness,signal);return captured;
    }catch(error){fail(error.preparedReason??(page.isClosed()?'PAGE_CLOSED':changed?'PAGE_CHANGED_DURING_CAPTURE':['VIEWPORT_MISMATCH','UNSUPPORTED_PAGE'].includes(error.code)?error.code:'CAPTURE_UNAVAILABLE'));}
    finally{page.off('framenavigated',navigated);page.off('close',closed);}
  };
  try{
    const report=await verify(comparison.root,'desktop',{sessionId:values.sessionId,format:values.format,comparison:{id:comparison.comparisonId,entryUrl:comparison.entryUrl,design:comparison.design},captureFn});
    return {status:'complete',report};
  }catch(error){if(error.preparedReason)return blocked(error.preparedReason);throw error;}
}
