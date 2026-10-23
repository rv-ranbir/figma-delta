import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';
import {beginSession} from '../src/runner.js';
async function fixture(t,viewport={width:320,height:200}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'delta prepared-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end('<html><body style="margin:0;min-height:1000px"><h1 id="review" style="color:black">Review</h1><input value="sample text"><dialog>Open review</dialog></body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const browser=await chromium.launch();t.after(()=>{t.mock.restoreAll();return browser.close();});const context=await browser.newContext({viewport,locale:'fr-FR',timezoneId:'Europe/Paris',colorScheme:'dark'});const page=await context.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/review?token=SECRET`);
 await page.evaluate(()=>{sessionStorage.setItem('wizard','review');localStorage.setItem('credential','STORAGE_SECRET');document.querySelector('dialog').show();document.querySelector('input').focus();document.querySelector('input').setSelectionRange(1,5);window.scrollTo(0,100);});
 await page.screenshot({path:path.join(root,'frame.png'),animations:'allow',caret:'initial',scale:'css'});
 return {root,page,browser,context};
}
const readiness={confirmed:true,selector:'#review'};

test('public API measures a prepared page passively without owning browser or leaking URL tokens',async t=>{
 const f=await fixture(t);const {checkPreparedPage}=await import('../src/api.js');
 const originalUrl=f.page.url();const calls=[];
 await f.page.locator('#review').evaluate(el=>el.style.setProperty('--resource-url','url("https://app.test/asset?token=SECRET")'));
 for(const [owner,names] of [[f.page,['goto','reload','close','setViewportSize','setDefaultTimeout','addStyleTag']],[f.context,['close','cookies','storageState','addCookies','setExtraHTTPHeaders']],[f.browser,['close']]])for(const name of names)t.mock.method(owner,name,()=>{calls.push(name);throw Error('Forbidden ownership action');});
 const result=await checkPreparedPage({project:f.root,page:f.page,reference:'frame.png',readiness,regions:[{name:'title',selector:'#review',styles:{color:'#000000','--resource-url':'url("https://app.test/asset?token=SECRET")'}}],format:'html'});
 assert.equal(result.status,'complete');assert.equal(result.report.pass,true);assert.deepEqual(calls,[]);assert.equal(f.page.isClosed(),false);assert.equal(f.page.url(),originalUrl);
 const state=await f.page.evaluate(()=>({scroll:scrollY,focused:document.activeElement.tagName,start:document.querySelector('input').selectionStart,end:document.querySelector('input').selectionEnd,dialog:document.querySelector('dialog').open,wizard:sessionStorage.getItem('wizard'),styles:document.querySelectorAll('style').length}));
 assert.deepEqual(state,{scroll:100,focused:'INPUT',start:1,end:5,dialog:true,wizard:'review',styles:0});
 assert.equal(result.report.environment.locale,'fr-FR');assert.equal(result.report.environment.timezone,'Europe/Paris');
 for(const file of Object.values(result.report.artifacts).filter(v=>v&&path.extname(v)==='.json'||v&&path.extname(v)==='.html'))assert.equal((await fs.readFile(file,'utf8')).includes('SECRET'),false);
 const comparison=path.resolve(result.report.artifacts.directory,'../../../..');
 assert.equal(JSON.parse(await fs.readFile(path.join(comparison,'fidelity.config.json'),'utf8')).screens[0].url.includes('SECRET'),false);
 t.mock.restoreAll();
});

test('window-sized prepared pages support simple reports and pinned repair sessions',async t=>{
 const f=await fixture(t,null);const {checkPreparedPage}=await import('../src/api.js');
 const first=await checkPreparedPage({project:f.root,page:f.page,reference:'frame.png',readiness,regions:[{name:'title',selector:'#review',styles:{color:'#ffffff'}}]});
 assert.equal(first.status,'complete');assert.equal(first.report.pass,false);assert.equal(first.report.format,'simple');
 assert.equal(f.page.viewportSize(),null);assert.deepEqual(first.report.viewport,await f.page.evaluate(()=>({width:innerWidth,height:innerHeight})));
 const comparisonId=first.report.comparison.id;const root=path.resolve(first.report.artifacts.directory,'../../../..');
 const session=await beginSession(root,'desktop');
 const listeners=f.page.listenerCount('framenavigated');
 const baseline=await checkPreparedPage({project:f.root,page:f.page,comparisonId,sessionId:session.id,readiness,format:'json'});
 assert.equal(baseline.report.session.iteration,1);assert.equal(baseline.report.session.status,'active');
 await f.page.locator('#review').evaluate(el=>el.style.color='white');
 const fixed=await checkPreparedPage({project:f.root,page:f.page,comparisonId,sessionId:session.id,readiness,format:'json'});
 assert.equal(fixed.report.session.iteration,2);assert.equal(fixed.report.session.status,'passed');
 assert.equal(f.page.listenerCount('framenavigated'),listeners);
 await assert.rejects(()=>checkPreparedPage({project:f.root,page:f.page,comparisonId,sessionId:session.id,readiness}),/Session has stopped/);
 assert.equal(f.page.isClosed(),false);
});

test('not-ready, expired and closed pages block without starting a browser or consuming a repair budget',async t=>{
 const f=await fixture(t);const {checkPreparedPage}=await import('../src/api.js');
 const notReady=await checkPreparedPage({project:f.root,page:f.page,reference:'frame.png',readiness:{confirmed:false}});assert.equal(notReady.status,'blocked');assert.equal(notReady.reason,'PAGE_NOT_READY');await assert.rejects(()=>fs.access(path.join(f.root,'.figma-fidelity')));
 const first=await checkPreparedPage({project:f.root,page:f.page,reference:'frame.png',readiness,regions:[{name:'title',selector:'h1',styles:{color:'#ffffff'}}],format:'json'});assert.equal(first.report.pass,false);
 const id=first.report.comparison.id;const comparison=path.resolve(first.report.artifacts.directory,'../../../..');const session=await beginSession(comparison,'desktop');
 const sessionFile=path.join(comparison,'.figma-fidelity/sessions/desktop.json');const sessionBefore=await fs.readFile(sessionFile,'utf8');const latestFile=path.join(comparison,'.figma-fidelity/latest/desktop.json');const latestBefore=await fs.readFile(latestFile,'utf8');
 await f.page.evaluate(()=>document.querySelector('h1').id='login');
 const expired=await checkPreparedPage({project:f.root,page:f.page,comparisonId:id,sessionId:session.id,readiness});assert.equal(expired.reason,'PAGE_NOT_READY');assert.equal(expired.pass,undefined);
 const wrongUrl=await checkPreparedPage({project:f.root,page:f.page,comparisonId:id,readiness:{confirmed:true,expectedUrl:'https://other.test'}});assert.equal(wrongUrl.reason,'PAGE_NOT_READY');
 const cancelled=await checkPreparedPage({project:f.root,page:f.page,comparisonId:id,readiness:{confirmed:true},signal:AbortSignal.abort()});assert.equal(cancelled.reason,'CAPTURE_UNAVAILABLE');
 await f.page.close();const closed=await checkPreparedPage({project:f.root,page:f.page,comparisonId:id,sessionId:session.id,readiness});assert.equal(closed.reason,'PAGE_CLOSED');
 assert.equal(await fs.readFile(sessionFile,'utf8'),sessionBefore);assert.equal(await fs.readFile(latestFile,'utf8'),latestBefore);
});

test('prepared capture blocks navigation or screenshot failure and never changes caller settings or viewport',async t=>{
 const f=await fixture(t);const {checkPreparedPage}=await import('../src/api.js');const take=f.page.screenshot.bind(f.page);
 t.mock.method(f.page,'screenshot',async options=>{await f.page.evaluate(()=>history.pushState({},'', '/login?token=SECRET'));return take(options);});
 const changed=await checkPreparedPage({project:f.root,page:f.page,reference:'frame.png',readiness});assert.equal(changed.reason,'PAGE_CHANGED_DURING_CAPTURE');assert.equal(f.page.isClosed(),false);t.mock.restoreAll();
 const comparisonId=(await fs.readdir(path.join(f.root,'.figma-fidelity/comparisons')))[0];
 const comparisonRoot=path.join(f.root,'.figma-fidelity/comparisons',comparisonId);
 // A blocked first capture must not become the latest report, even if a PNG exists.
 await assert.rejects(()=>fs.access(path.join(comparisonRoot,'.figma-fidelity/latest/desktop.json')));
 const session=await beginSession(comparisonRoot,'desktop');
 const sessionFile=path.join(comparisonRoot,'.figma-fidelity/sessions/desktop.json');const sessionBefore=await fs.readFile(sessionFile,'utf8');
 t.mock.method(f.page,'screenshot',async options=>{await f.page.setViewportSize({width:640,height:400});return take(options);});
 const resized=await checkPreparedPage({project:f.root,page:f.page,comparisonId,sessionId:session.id,readiness});assert.equal(resized.reason,'VIEWPORT_MISMATCH');t.mock.restoreAll();
 assert.equal(await fs.readFile(sessionFile,'utf8'),sessionBefore);await assert.rejects(()=>fs.access(path.join(comparisonRoot,'.figma-fidelity/latest/desktop.json')));
 await f.page.setViewportSize({width:640,height:400});const mismatch=await checkPreparedPage({project:f.root,page:f.page,comparisonId,readiness});assert.equal(mismatch.reason,'VIEWPORT_MISMATCH');assert.deepEqual(f.page.viewportSize(),{width:640,height:400});
 await f.page.setViewportSize({width:320,height:200});t.mock.method(f.page,'screenshot',()=>{throw Error('Transport failed at https://app.test/?token=SECRET');});
 const failed=await checkPreparedPage({project:f.root,page:f.page,comparisonId,readiness});assert.equal(failed.reason,'CAPTURE_UNAVAILABLE');assert.equal(JSON.stringify(failed).includes('SECRET'),false);assert.equal(f.page.isClosed(),false);t.mock.restoreAll();
 const unsupported=await checkPreparedPage({project:f.root,page:{},reference:'frame.png',readiness});assert.equal(unsupported.reason,'UNSUPPORTED_PAGE');
});
