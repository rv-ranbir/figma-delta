import { chromium } from 'playwright';
import { inside } from './config.js';
import { measureElement } from './measure-element.js';
import { measureTextVisibility } from './text-visibility.js';
import { measureRenderedFonts } from './rendered-fonts.js';
const pageErrors=new WeakMap();

export async function openCapturePage(root,screen,{headless=true}={}){
  const browser=await chromium.launch({headless,...(process.env.FIDELITY_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.FIDELITY_CHROMIUM_EXECUTABLE_PATH}:{})});
  try{
    const context=await browser.newContext({viewport:screen.viewport,deviceScaleFactor:1,
      colorScheme:screen.colorScheme,reducedMotion:'reduce',locale:screen.locale,timezoneId:screen.timezoneId,
      ...(screen.storageState?{storageState:inside(root,screen.storageState)}:{})});
    const page=await context.newPage();page.setDefaultTimeout(screen.timeoutMs);
    const errors=[];pageErrors.set(page,errors);
    page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())errors.length=0;});
    page.on('pageerror',error=>errors.push(error.message));
    const response=await page.goto(screen.url,{waitUntil:'load',timeout:screen.timeoutMs});
    if(headless&&response&&!response.ok())throw Error(`Page returned HTTP ${response.status()}`);
    return {browser,page};
  }catch(error){await browser.close();throw error;}
}
export async function capture(root,screen,output,{page:livePage,passive=false}={}){
  if(livePage?.isClosed())throw Error('Interactive page was closed. Reopen the comparison browser and navigate to the required state.');
  if(passive&&!livePage)throw Error('Passive capture requires a caller-owned page');
  if(livePage){const size=livePage.viewportSize()??(passive?await livePage.evaluate(()=>({width:innerWidth,height:innerHeight})):null);if(size?.width!==screen.viewport.width||size?.height!==screen.viewport.height)throw Object.assign(Error('Page viewport must match the pinned reference dimensions'),{code:'VIEWPORT_MISMATCH'});}
  if(passive&&screen.captureSelector)throw Object.assign(Error('Prepared pages support viewport capture only; element capture may scroll the page'),{code:'UNSUPPORTED_PAGE'});
  const owned=livePage?null:await openCapturePage(root,screen);
  const page=livePage??owned.page;const tracked=passive?undefined:pageErrors.get(page);const errors=tracked??[];const onError=e=>errors.push(e.message);
  if(!tracked)page.on('pageerror',onError);
  let motionStyle;
  try{
    await page.locator(screen.readySelector).waitFor({state:'visible',timeout:screen.timeoutMs});
    // Disable motion before measurements as well as during screenshots.
    if(!passive)motionStyle=await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}'});
    let deadline;
    try{await Promise.race([page.evaluate(async resetScroll=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));if(resetScroll)window.scrollTo(0,0);},!livePage),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Fonts/images did not settle before timeoutMs')),screen.timeoutMs);})]);}finally{clearTimeout(deadline);}
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
      const value=await locator.evaluate(measureElement,Object.keys(region.styles));
      Object.assign(value,await locator.evaluate(el=>{const text=el.innerText??el.textContent??'';return {renderedText:text.slice(0,10000),textComplete:text.length<=10000,textWhiteSpace:getComputedStyle(el).whiteSpace};}));
      if(value.textContentReason)value.textComplete=false;
      value.textVisibility=await locator.evaluate(measureTextVisibility);
      value.rect.x-=crop.x;value.rect.y-=crop.y;
      if(value.rect.width===0||value.rect.height===0||value.styles.display==='none'||value.styles.visibility==='hidden'||Number(value.styles.opacity)===0)value.error='hidden or zero-sized';
      measures.push({name:region.name,selector:region.selector,...value});
    }
    await measureRenderedFonts(page,measures);
    const brokenImages=await page.evaluate(()=>[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>({src:i.currentSrc,alt:i.alt})));
    const options={path:output,animations:passive?'allow':'disabled',caret:passive?'initial':'hide',scale:'css',timeout:screen.timeoutMs};
    if(target)await target.screenshot(options);else await page.screenshot({...options,fullPage:false});
    const environment=passive?await page.evaluate(()=>({locale:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,colorScheme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light',deviceScaleFactor:devicePixelRatio})):undefined;
    return {measures,fonts,brokenImages,errors:tracked?tracked.splice(0):errors,browserVersion:page.context().browser()?.version()??'unavailable',capturedAt:new Date().toISOString(),url:page.url(),entryUrl:screen.url,...(environment?{environment}:{})};
  }finally{if(livePage&&motionStyle)await motionStyle.evaluate(el=>el.remove()).catch(()=>{});if(!tracked)page.off('pageerror',onError);if(owned)await owned.browser.close();}
}
