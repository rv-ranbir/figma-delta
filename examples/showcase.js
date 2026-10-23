import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {checkPreparedPage} from '../src/api.js';
import {showcaseDashboard,showcaseRegions,showcaseViewport} from './showcase-dashboard.js';

// Reproducible, browser-rendered screenshots. This is a fixture, not a live
// Figma import or an autonomous repair claim. All data and artwork are original.
const toolkit=fileURLToPath(new URL('../',import.meta.url));
const project=path.join(toolkit,'.demo-project/showcase');
const images=path.join(toolkit,'docs/images');
await fs.mkdir(project,{recursive:true});await fs.mkdir(images,{recursive:true});
const fonts=new Map(await Promise.all([400,700].map(async weight=>[
  `/inter-${weight}.woff2`,await fs.readFile(path.join(toolkit,`node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff2`))
])));
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(fonts.has(url.pathname)){res.setHeader('Content-Type','font/woff2');res.end(fonts.get(url.pathname));return;}
  if(url.pathname!=='/'){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(showcaseDashboard(url.searchParams.get('variant')==='drift'));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({...(process.env.FIDELITY_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.FIDELITY_CHROMIUM_EXECUTABLE_PATH}:{})});
  const page=await browser.newPage({viewport:showcaseViewport,deviceScaleFactor:1,locale:'en-US',timezoneId:'UTC',colorScheme:'light',reducedMotion:'reduce'});
  const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  const reference=path.join(project,'dashboard-reference.png');
  await page.screenshot({path:reference,scale:'css'});
  await page.goto(url+'/?variant=drift',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  const result=await checkPreparedPage({project,page,reference:'dashboard-reference.png',regions:showcaseRegions,readiness:{confirmed:true,selector:'#transactions'},format:'html'});
  assert.equal(result.status,'complete');assert.equal(result.report.pass,false);
  const styles=result.report.issues.filter(issue=>issue.kind==='style');assert.equal(styles.length,5);
  for(const property of ['color','fontSize','backgroundColor','columnGap','paddingLeft'])assert.ok(styles.some(issue=>issue.property===property),`Missing ${property} finding`);
  const finding=result.report.findings.find(f=>f.target.region==='page-title'&&f.property==='color');assert.ok(finding);
  const review=await browser.newPage({viewport:{width:1440,height:1280},deviceScaleFactor:1});
  await review.goto(pathToFileURL(result.report.artifacts.report).href);
  await review.locator(`[data-select-finding="${finding.id}"]`).click();
  await review.locator(`[data-finding-id="${finding.id}"]`).waitFor({state:'visible'});
  await review.screenshot({path:path.join(images,'qa-workspace.png'),scale:'css'});
  const simple=await checkPreparedPage({project,page,comparisonId:result.report.comparison.id,readiness:{confirmed:true,selector:'#transactions'},format:'simple'});
  assert.equal(simple.status,'complete');assert.equal(simple.report.pass,false);
  const simpleView=await browser.newPage({viewport:{width:1200,height:1055},deviceScaleFactor:1});
  await simpleView.goto(pathToFileURL(simple.report.artifacts.report).href);
  assert.equal(await simpleView.locator('[data-simple-finding]').count(),5);
  await simpleView.screenshot({path:path.join(images,'simple-report.png'),scale:'css'});
  const fontFinding=simple.report.findings.findIndex(f=>f.property==='fontSize');assert.ok(fontFinding>=0);
  await simpleView.locator(`#finding-${fontFinding+1}`).screenshot({path:path.join(images,'finding-json.png'),scale:'css'});
  // Whitespace formatting only: values come from the saved result.json.
  const compact=JSON.parse(await fs.readFile(simple.report.artifacts.result,'utf8'));
  assert.equal(compact.differences.length,5);
  const prettyFile=path.join(project,'result.pretty.json');
  await fs.writeFile(prettyFile,JSON.stringify(compact,null,2));
  const jsonView=await browser.newPage({viewport:{width:1200,height:1380},deviceScaleFactor:1});
  await jsonView.goto(pathToFileURL(prettyFile).href);
  await jsonView.screenshot({path:path.join(images,'compact-json.png'),scale:'css'});
  // Known fixture correction proves the reported property defects disappear.
  await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  const corrected=await checkPreparedPage({project,page,comparisonId:result.report.comparison.id,readiness:{confirmed:true,selector:'#transactions'},format:'json'});
  assert.equal(corrected.status,'complete');assert.equal(corrected.report.pass,true);
  console.log(JSON.stringify({note:'Actual generated QA, simple HTML and JSON reports from an original fictional fixture. Five deliberate CSS differences; no live Figma import or AI repair.',images:['qa-workspace.png','simple-report.png','compact-json.png','finding-json.png'],styleDifferences:styles.length,correctedPass:corrected.report.pass,qaReport:result.report.artifacts.report,simpleReport:simple.report.artifacts.report,json:simple.report.artifacts.result},null,2));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
