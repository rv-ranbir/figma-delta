import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {chromium} from 'playwright';
import {capture,openCapturePage} from '../src/capture.js';
import {screenSchema} from '../src/config.js';
import {prepareComparison,saveLogin} from '../src/comparison.js';
import {beginSession,verify} from '../src/runner.js';

test('a supplied live page preserves sessionStorage and wizard state without navigation and records its actual URL',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'delta live-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end('<html><body><h1 id="state">Entry</h1></body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const url=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext({viewport:{width:320,height:200}});const page=await context.newPage();await page.goto(url);
 await page.evaluate(()=>{sessionStorage.setItem('wizard','step-3');document.querySelector('#state').textContent='Review order';history.pushState({},'', '/checkout/review');document.body.style.minHeight='1000px';document.body.style.transition='opacity 2s';window.scrollTo(0,100);});
 const screen=screenSchema.parse({name:'desktop',url,viewport:{width:320,height:200},readySelector:'#state',regions:[{name:'state',selector:'#state',styles:{}}]});
 const result=await capture(root,screen,path.join(root,'actual.png'),{page});assert.equal(result.measures[0].text,'Review order');assert.equal(result.url,url+'/checkout/review');assert.equal(await page.evaluate(()=>sessionStorage.getItem('wizard')),'step-3');assert.equal(page.isClosed(),false);
 assert.equal(await page.evaluate(()=>window.scrollY),100);assert.equal(await page.evaluate(()=>getComputedStyle(document.body).transitionDuration),'2s');
 await page.setViewportSize({width:640,height:400});await assert.rejects(()=>capture(root,screen,path.join(root,'wrong.png'),{page}),/viewport/i);
 await page.close();await assert.rejects(()=>capture(root,screen,path.join(root,'closed.png'),{page}),/closed/i);
});

test('a guarded comparison pins the live page, saves login separately and enforces repair stop limits',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'delta guarded-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end('<html><body><h1 id="state">Start</h1></body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const url=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext({viewport:{width:320,height:200}});const page=await context.newPage();await page.goto(url);
 await page.evaluate(()=>{localStorage.setItem('login','private-fixture-token');sessionStorage.setItem('wizard','review');document.querySelector('h1').textContent='Review';history.pushState({},'', '/review');});
 await page.screenshot({path:path.join(root,'frame.png')});
 const comparison=await prepareComparison(root,{url,reference:'frame.png',interactive:true,regions:[{name:'title',selector:'h1',styles:{color:'#000000'}}]});
 const login=await saveLogin(root,page);assert.match(login.storageState,/auth.json$/);assert.equal((await fs.readFile(path.join(root,login.storageState),'utf8')).includes('private-fixture-token'),true);
 const session=await beginSession(comparison.root,'desktop');const report=await verify(comparison.root,'desktop',{page,sessionId:session.id,format:'html',comparison:{id:comparison.comparisonId,entryUrl:url,design:comparison.design}});
 assert.equal(report.pass,true);assert.equal(report.url,url+'/review');assert.equal(report.session.status,'passed');assert.equal(JSON.stringify(report).includes('private-fixture-token'),false);
 const html=await fs.readFile(report.artifacts.report,'utf8');assert.ok(html.includes(comparison.comparisonId));assert.ok(html.includes(url+'/review'));assert.equal(html.includes('private-fixture-token'),false);
 const json=JSON.parse(await fs.readFile(report.artifacts.findings,'utf8'));assert.equal(json.comparison.id,comparison.comparisonId);
 await assert.rejects(()=>verify(comparison.root,'desktop',{page,sessionId:session.id}),/Session has stopped/);assert.equal(await page.evaluate(()=>sessionStorage.getItem('wizard')),'review');
});

test('fresh capture still records errors raised during initial navigation',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'delta error-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end('<html><body>Ready<script>throw new Error("initial-render-failure")</script></body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const screen=screenSchema.parse({name:'desktop',url:`http://127.0.0.1:${server.address().port}`,viewport:{width:320,height:200}});
 const result=await capture(root,screen,path.join(root,'actual.png'));assert.ok(result.errors.some(e=>e.includes('initial-render-failure')));
});

test('live captures consume runtime errors once and SPA history changes do not erase them',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'delta runtime-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end('<html><body>Ready<script>setTimeout(()=>{throw Error("initial-spa-error")},0);setTimeout(()=>history.pushState({},"","/ready"),10)</script></body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const screen=screenSchema.parse({name:'desktop',url:`http://127.0.0.1:${server.address().port}`,viewport:{width:320,height:200}});
 const opened=await openCapturePage(root,screen);t.after(()=>opened.browser.close());await opened.page.waitForURL('**/ready');
 const first=await capture(root,screen,path.join(root,'first.png'),{page:opened.page});assert.ok(first.errors.includes('initial-spa-error'));
 const second=await capture(root,screen,path.join(root,'second.png'),{page:opened.page});assert.deepEqual(second.errors,[]);assert.ok(first.errors.includes('initial-spa-error'),'Old report must not share mutable error state');
});
