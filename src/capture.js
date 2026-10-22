import { chromium } from 'playwright';
import { inside } from './config.js';

export async function capture(root,screen,output){
  const browser=await chromium.launch({headless:true,...(process.env.FIDELITY_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.FIDELITY_CHROMIUM_EXECUTABLE_PATH}:{})});
  try{
    const context=await browser.newContext({viewport:screen.viewport,deviceScaleFactor:1,
      colorScheme:screen.colorScheme,reducedMotion:'reduce',locale:screen.locale,timezoneId:screen.timezoneId,
      ...(screen.storageState?{storageState:inside(root,screen.storageState)}:{})});
    const page=await context.newPage();page.setDefaultTimeout(screen.timeoutMs);const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(screen.url,{waitUntil:'load',timeout:screen.timeoutMs});
    if(response&&!response.ok())throw Error(`Page returned HTTP ${response.status()}`);
    await page.locator(screen.readySelector).waitFor({state:'visible'});
    // Disable motion before measurements as well as during screenshots.
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}'});
    let deadline;
    try{await Promise.race([page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));window.scrollTo(0,0);}),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Fonts/images did not settle before timeoutMs')),screen.timeoutMs);})]);}finally{clearTimeout(deadline);}
    const fonts=await page.evaluate(list=>list.map(f=>({family:f,loaded:[...document.fonts].some(face=>face.family.replace(/["']/g,'')===f&&face.status==='loaded')})),screen.requiredFonts);
    const target=screen.captureSelector?page.locator(screen.captureSelector):null;
    if(target)await target.waitFor({state:'visible'});
    const crop=target?await target.boundingBox():{x:0,y:0,...screen.viewport};
    if(!crop)throw Error('Capture element has no bounding box');
    if(target&&(Math.abs(crop.width-screen.viewport.width)>0.01||Math.abs(crop.height-screen.viewport.height)>0.01))throw Error('captureSelector dimensions must equal the reference viewport; no resizing is performed');
    const measures=[];
    for(const region of screen.regions){
      const locator=page.locator(region.selector);const count=await locator.count();
      if(count!==1){measures.push({name:region.name,selector:region.selector,error:count===0?'missing':'ambiguous selector',count});continue;}
      const value=await locator.evaluate((el,extraProperties)=>{
        const b=el.getBoundingClientRect();const css=getComputedStyle(el);
        const styles={};for(const k of new Set(['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color','backgroundColor','borderRadius','display','visibility','opacity','margin','marginTop','marginRight','marginBottom','marginLeft','padding','paddingTop','paddingRight','paddingBottom','paddingLeft','gap','rowGap','columnGap',...extraProperties])){
          const value=css.getPropertyValue(k.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()));
          if(value)styles[k]=value;
        }
        return {rect:{x:b.x,y:b.y,width:b.width,height:b.height},styles,text:el.textContent?.trim().slice(0,200)};
      },Object.keys(region.styles));
      value.rect.x-=crop.x;value.rect.y-=crop.y;
      if(value.rect.width===0||value.rect.height===0||value.styles.display==='none'||value.styles.visibility==='hidden'||Number(value.styles.opacity)===0)value.error='hidden or zero-sized';
      measures.push({name:region.name,selector:region.selector,...value});
    }
    const brokenImages=await page.evaluate(()=>[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>({src:i.currentSrc,alt:i.alt})));
    const options={path:output,animations:'disabled',caret:'hide',scale:'css',timeout:screen.timeoutMs};
    if(target)await target.screenshot(options);else await page.screenshot({...options,fullPage:false});
    return {measures,fonts,brokenImages,errors,browserVersion:browser.version(),capturedAt:new Date().toISOString()};
  }finally{await browser.close();}
}
