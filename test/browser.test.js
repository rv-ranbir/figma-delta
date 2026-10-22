import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { capture } from '../src/capture.js';
import { screenSchema, writeJson } from '../src/config.js';
import { beginSession, verify } from '../src/runner.js';
import { page, viewport, demoConfig } from '../examples/page.js';

async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'fidelity-browser-test-'));let broken=false;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(page(broken));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:50});});
 const url=`http://127.0.0.1:${server.address().port}`;await fs.mkdir(path.join(root,'design'),{recursive:true});
 const config=demoConfig(url);
 const ref=await capture(root,screenSchema.parse({...config.screens[0],regions:[{name:'title',selector:'#title'}]}),path.join(root,'design','reference.png'));
 config.screens[0].regions[1].rect=ref.measures[0].rect;
 await writeJson(path.join(root,'fidelity.config.json'),config);
 return {root,config,broken:v=>{broken=v;},save:()=>writeJson(path.join(root,'fidelity.config.json'),config)};
}
test('browser pipeline detects deliberate CSS regression then passes after correction',async t=>{
 const f=await fixture(t);f.broken(true);const session=await beginSession(f.root,'desktop');
 const before=await verify(f.root,'desktop',{sessionId:session.id,format:'html'});assert.equal(before.pass,false);assert.ok(before.pixels.mismatchPercent>1);
 assert.ok(before.issues.some(i=>i.kind==='geometry'&&i.region==='header'&&i.property==='height'&&i.delta===22));
 assert.ok(before.issues.some(i=>i.kind==='style'&&i.property==='fontSize'));
 assert.ok(before.findings.length>=before.issues.length);
 const finding=before.findings.find(i=>i.category==='geometry'&&i.target.region==='header'&&i.property==='height');
 assert.equal(finding.expected.value,64);assert.equal(finding.actual.value,86);assert.equal(finding.delta,22);
 assert.equal(finding.target.selector,'#header');assert.equal(finding.review.status,'unreviewed');
 const exported=JSON.parse(await fs.readFile(before.artifacts.findings,'utf8'));
 assert.equal(exported.schemaVersion,1);assert.deepEqual(exported.findings,before.findings);
 const saved=JSON.parse(await fs.readFile(before.artifacts.json,'utf8'));assert.deepEqual(saved.findings,before.findings);
 await fs.access(path.join(before.artifacts.directory,finding.evidence.images.diff));
 const report=await fs.readFile(before.artifacts.report,'utf8');assert.equal(report.includes('data:image/png;base64,'),false);assert.equal(report.includes('Needs review'),true);
 for(const removed of ['Full page comparison','Run details & original checks','Raw report JSON','supporting-evidence'])assert.equal(report.includes(removed),false);
 const browser=await chromium.launch();
 try{
  const reportPage=await browser.newPage();await reportPage.goto(pathToFileURL(before.artifacts.report).href);
  assert.equal(await reportPage.getByRole('searchbox',{name:'Search findings'}).count(),1);
  await reportPage.locator(`[data-select-finding="${finding.id}"]`).click();
  assert.equal(await reportPage.locator(`[data-select-finding="${finding.id}"]`).getAttribute('aria-pressed'),'true');
  const item=reportPage.locator(`[data-finding-id="${finding.id}"]`);
  assert.equal(await item.count(),1);
  await item.locator('.technical > summary').click();assert.match(await item.innerText(),/#header/);
  await item.locator('.technical > summary').click();
  assert.equal(await item.locator('img').count(),4);
  assert.equal(await item.locator('img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0)),true);
  assert.equal(await reportPage.getByRole('link',{name:'Download findings JSON'}).getAttribute('href'),'findings.json');
  assert.equal(await reportPage.getByRole('link',{name:'Download simple JSON'}).getAttribute('href'),'result.json');
  assert.match(await item.getByRole('heading',{level:2}).innerText(),/22px too tall/);
  await item.locator('[data-pixel-maps] > summary').click();
  assert.equal(await item.getByAltText('Difference map for header').isVisible(),true);
  assert.equal(await item.getByAltText('Figma reference for header').isVisible(),true);
  await item.locator('[data-pixel-maps] > summary').click();
  assert.match(await item.locator('.property-table').first().innerText(),/Height/);
  await item.getByLabel('Review decision').selectOption('confirmed');
  await item.getByLabel('Severity',{exact:true}).selectOption('medium');
  await item.getByLabel('Review note').fill('Header is visibly too tall; use the reference height.');
  assert.equal(await reportPage.locator('[data-reviewed-count]').innerText(),'1');
  const downloadEvent=reportPage.waitForEvent('download');
  await reportPage.getByRole('button',{name:'Export reviewed JSON'}).click();
  const download=await downloadEvent;const reviewed=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  const reviewedFinding=reviewed.findings.find(f=>f.id===finding.id);
  assert.equal(reviewedFinding.review.status,'confirmed');assert.equal(reviewedFinding.review.severity,'medium');
  assert.match(reviewedFinding.review.comment,/Header is visibly/);assert.equal(reviewed.pass,false);
  const search=reportPage.getByRole('searchbox',{name:'Search findings'});
  await search.fill('no-such-finding');assert.equal(await reportPage.getByText('No findings match your search.').isVisible(),true);
  assert.equal(await item.isVisible(),false);await search.fill('');
  await reportPage.locator(`[data-select-finding="${finding.id}"]`).click();
  await reportPage.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true}));
  await item.getByRole('button',{name:'Copy developer ticket'}).click();
  const ticket=reportPage.getByRole('textbox',{name:'Text to copy'});
  assert.match(await ticket.inputValue(),/#header/);assert.match(await ticket.inputValue(),/Expected: 64px/);
  await reportPage.getByRole('button',{name:'Close copy panel'}).click();
  await item.getByRole('button',{name:'Copy agent instructions'}).click();
  assert.match(await ticket.inputValue(),/fidelity_image/);assert.match(await ticket.inputValue(),new RegExp(session.id));
  await reportPage.getByRole('button',{name:'Close copy panel'}).click();
  await reportPage.setViewportSize({width:390,height:844});
  assert.equal(await reportPage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 }finally{await browser.close();}
 f.broken(false);const after=await verify(f.root,'desktop',{sessionId:session.id});assert.equal(after.pass,true);assert.equal(after.pixels.mismatchPercent,0);assert.equal(after.session.status,'passed');
 assert.deepEqual(after.findings,[]);
 await assert.rejects(()=>verify(f.root,'desktop',{sessionId:session.id}),/Session has stopped/);
});

test('browser measures text color, margin, padding and gap as explicit property differences',async t=>{
 const f=await fixture(t);
 f.config.screens[0].regions[1].styles={color:'rgb(0, 0, 0)',marginTop:'18px',paddingLeft:'8px',gap:'12px'};
 await f.save();const report=await verify(f.root,'desktop');
 const styles=report.regions.find(r=>r.name==='title').actual.styles;
 assert.equal(styles.marginTop,'12px');assert.equal(styles.paddingLeft,'0px');assert.equal(styles.gap,'normal');
 for(const property of ['color','marginTop','paddingLeft','gap'])assert.ok(report.issues.some(i=>i.kind==='style'&&i.property===property));
 const finding=report.findings.find(f=>f.property==='marginTop');
 assert.equal(finding.expected.value,18);assert.equal(finding.actual.value,12);
 const color=finding.properties.find(p=>p.property==='color');
 assert.equal(color.expected,'color(srgb 0 0 0 / 1)');assert.equal(color.actual,'color(srgb 0.094118 0.133333 0.219608 / 1)');assert.equal(color.status,'different');
 assert.equal(styles.color,color.actual);
 assert.equal(report.regions.find(r=>r.name==='title').actual.rawStyles.color,'rgb(24, 34, 56)');
 const saved=JSON.parse(await fs.readFile(report.artifacts.result,'utf8'));
 assert.equal(saved.differences.find(d=>d.property==='color').actual,color.actual);
 assert.ok((await fs.readFile(report.artifacts.report,'utf8')).includes(color.actual));
 const noExpectation=finding.properties.find(p=>p.property==='marginRight');assert.equal(noExpectation.status,'not-specified');
});
test('session stops after two non-improving runs and pins config content',async t=>{
 const f=await fixture(t);f.broken(true);let session=await beginSession(f.root,'desktop');
 await verify(f.root,'desktop',{sessionId:session.id});await verify(f.root,'desktop',{sessionId:session.id});
 const last=await verify(f.root,'desktop',{sessionId:session.id});assert.equal(last.session.status,'no-improvement');assert.match(last.session.nextAction,/STOP/);
 await assert.rejects(()=>verify(f.root,'desktop',{sessionId:session.id}),/Session has stopped/);
 session=await beginSession(f.root,'desktop');f.config.screens[0].maxMismatchPercent=100;await f.save();
 await assert.rejects(()=>verify(f.root,'desktop',{sessionId:session.id}),/changed during repair/);
});

test('JSON-only verification skips HTML and crops while preserving measurements, evidence and repair limits',async t=>{
 const f=await fixture(t);f.broken(true);f.config.maxIterations=1;await f.save();
 const session=await beginSession(f.root,'desktop');
 const r=await verify(f.root,'desktop',{sessionId:session.id,format:'json'});
 assert.equal(r.pass,false);assert.equal(r.session.status,'iteration-limit');assert.equal(r.artifacts.report,null);
 await assert.rejects(()=>fs.access(path.join(r.artifacts.directory,'report.html')));
 await assert.rejects(()=>fs.access(path.join(r.artifacts.directory,'findings')));
 for(const name of ['reference','actual','diff','overlay'])await fs.access(path.join(r.artifacts.directory,name+'.png'));
 const compact=JSON.parse(await fs.readFile(r.artifacts.result,'utf8'));
 assert.ok(compact.differences.some(d=>d.property==='height'&&d.expected===64&&d.actual===86));
 assert.equal(compact.session.status,'iteration-limit');assert.equal(compact.regions,undefined);
 const full=JSON.parse(await fs.readFile(r.artifacts.json,'utf8'));assert.ok(full.regions.length>0);assert.ok(full.findings.length>0);
 await assert.rejects(()=>verify(f.root,'desktop',{sessionId:session.id,format:'json'}),/Session has stopped/);
});

test('default simple HTML lists every finding with its compact JSON and no embedded images or scripts',async t=>{
 const f=await fixture(t);f.broken(true);const r=await verify(f.root,'desktop');
 assert.equal(r.format,'simple');
 const html=await fs.readFile(r.artifacts.report,'utf8');
 assert.equal(html.includes('data:image/'),false);assert.equal(html.includes('<script'),false);assert.ok(Buffer.byteLength(html)<30000);
 await assert.rejects(()=>fs.access(path.join(r.artifacts.directory,'findings')));
 const compact=JSON.parse(await fs.readFile(r.artifacts.result,'utf8'));
 const browser=await chromium.launch();
 try{
  const p=await browser.newPage();await p.goto(pathToFileURL(r.artifacts.report).href);
  assert.equal(await p.locator('[data-simple-finding]').count(),r.findings.length);
  const snippets=await p.locator('[data-simple-finding] pre').allTextContents();
  assert.deepEqual(snippets.map(JSON.parse),compact.differences);
  assert.match(await p.locator('body').innerText(),/configured checks/);
  assert.equal(await p.getByRole('link',{name:'Download simple JSON'}).getAttribute('href'),'result.json');
  await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await browser.close();}
});

test('CLI and MCP JSON options return compact differences and share the original capture budget',async t=>{
 const f=await fixture(t);f.broken(true);f.config.maxIterations=2;await f.save();
 const session=await beginSession(f.root,'desktop');
 const cli=fileURLToPath(new URL('../src/cli.js',import.meta.url));
 const result=await promisify(execFile)(process.execPath,[cli,'check','--project',f.root,'--screen','desktop','--session',session.id,'--format','json']).catch(error=>{assert.equal(error.code,1);return error;});
 const first=JSON.parse(result.stdout);assert.equal(first.format,'json');assert.equal(first.pass,false);assert.equal(first.session.iteration,1);
 assert.ok(first.differences.some(d=>d.property==='height'&&d.actual===86));assert.equal(first.regions,undefined);assert.equal(first.artifacts.report,null);
 assert.equal(result.stdout.trim().includes('\n'),false);
 const client=new Client({name:'json-browser-test',version:'1.0.0'});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../src/mcp.js',import.meta.url)),'--project',f.root],stderr:'pipe'}));
 t.after(()=>client.close());
 const secondReply=await client.callTool({name:'fidelity_verify',arguments:{screen:'desktop',sessionId:session.id}});
 assert.equal(secondReply.isError,undefined);assert.equal(secondReply.content[0].text.includes('\n'),false);
 const second=JSON.parse(secondReply.content[0].text);assert.equal(second.session.iteration,2);assert.equal(second.session.status,'iteration-limit');
 const read=await client.callTool({name:'fidelity_report',arguments:{screen:'desktop'}});
 assert.deepEqual(JSON.parse(read.content[0].text),second);
 const full=await client.callTool({name:'fidelity_report',arguments:{screen:'desktop',format:'html'}});assert.ok(JSON.parse(full.content[0].text).regions.length>0);
 const stopped=await client.callTool({name:'fidelity_verify',arguments:{screen:'desktop',sessionId:session.id,format:'json'}});assert.equal(stopped.isError,true);assert.match(stopped.content[0].text,/Session has stopped/);
 const invalid=await promisify(execFile)(process.execPath,[cli,'check','--project',f.root,'--format','yaml']).catch(error=>error);assert.equal(invalid.code,2);assert.match(invalid.stderr,/format must be simple, html or json/);
});
test('iteration budget stops repairs, missing/ambiguous selectors and missing fonts fail',async t=>{
 const f=await fixture(t);f.config.maxIterations=1;
 f.config.screens[0].regions.push({name:'missing',selector:'#does-not-exist'},{name:'ambiguous',selector:'.card'});
 f.config.screens[0].requiredFonts=['ThisFontDoesNotExist'];await f.save();
 const session=await beginSession(f.root,'desktop');const r=await verify(f.root,'desktop',{sessionId:session.id,format:'html'});
 assert.equal(r.pass,false);assert.equal(r.pixels.mismatchPercent,0);assert.equal(r.session.status,'iteration-limit');
 assert.ok(r.issues.some(i=>i.kind==='element'&&i.message==='missing'));assert.ok(r.issues.some(i=>i.kind==='element'&&i.message==='ambiguous selector'));
 assert.ok(r.issues.some(i=>i.kind==='font'));
 const browser=await chromium.launch();
 try{
  const reportPage=await browser.newPage();await reportPage.goto(pathToFileURL(r.artifacts.report).href);
  const font=r.findings.find(f=>f.category==='font');
  await reportPage.locator(`[data-select-finding="${font.id}"]`).click();
  const article=reportPage.locator(`[data-finding-id="${font.id}"]`);
  assert.match(await article.innerText(),/ThisFontDoesNotExist/);
  await reportPage.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true}));
  await article.getByRole('button',{name:'Copy developer ticket'}).click();
  assert.match(await reportPage.getByRole('textbox',{name:'Text to copy'}).inputValue(),/Resource: ThisFontDoesNotExist/);
 }finally{await browser.close();}
});
