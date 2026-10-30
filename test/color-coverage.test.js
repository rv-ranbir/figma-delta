import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {capture} from '../src/capture.js';
import {screenSchema,writeJson} from '../src/config.js';
import {flatten} from '../src/figma.js';
import {regionExpectations,checkGeometry,verify,manifestFor} from '../src/runner.js';

const red={type:'SOLID',color:{r:1,g:0,b:0,a:1}};
const blue={type:'SOLID',color:{r:0,g:0,b:1,a:1}};
const expected=node=>regionExpectations({name:'title',nodeId:'1:2',styles:{}},{nodes:flatten({id:'1:2',type:'TEXT',...node})});

test('uniform Figma rich text overrides produce color and typography expectations',()=>{
 const result=expected({characters:'Hi',fills:[blue],style:{fontSize:16},characterStyleOverrides:[1,1],styleOverrideTable:{1:{fills:[red],fontSize:20,letterSpacing:2}}});
 assert.equal(result.styles.color,'color(srgb 1 0 0 / 1)');
 assert.equal(result.styles.fontSize,'20px');assert.equal(result.styles.letterSpacing,'2px');
});

test('mixed Figma text and layered paint emit explicit unavailable checks',()=>{
 for(const node of [
  {characters:'Hi',fills:[blue],characterStyleOverrides:[0,1],styleOverrideTable:{1:{fills:[red]}}},
  {fills:[red,blue]}, {fills:[{type:'GRADIENT_LINEAR'}]}, {fills:[]}
 ]){
  const result=expected(node);
  assert.ok(result.unavailable?.color);
  const issues=checkGeometry({name:'title'},{styles:{color:'blue'}},result,2);
  assert.ok(issues.some(i=>i.kind==='coverage'&&i.property==='color'));
 }
 const mixed=expected({characters:'Hi',fills:[blue],style:{fontSize:16},characterStyleOverrides:[0,1],styleOverrideTable:{1:{fontSize:20}}});
 assert.ok(mixed.unavailable.fontSize);
});

test('Figma ancestor opacity is preserved and cannot silently pass paint checks',()=>{
 const nodes=flatten({id:'1:1',type:'FRAME',opacity:0.5,children:[{id:'1:2',type:'TEXT',fills:[red]}]});
 const result=regionExpectations({name:'title',nodeId:'1:2',styles:{}},{nodes});
 assert.ok(result.unavailable?.color);
});

async function fixture(t,html,regions){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'delta-color-'));t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
 const browser=await chromium.launch();t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:800,height:600}});await page.setContent(html);
 const screen=screenSchema.parse({name:'desktop',url:'http://localhost:3000',reference:'reference.png',viewport:{width:800,height:600},regions});
 return {root,page,screen};
}

test('wrong descendant color produces a finding below the global pixel budget and fixes cleanly',async t=>{
 const f=await fixture(t,'<style>:root{--brand:#182238}.custom{color:var(--brand)}span{font-size:12px}</style><div id="parent" class="custom"><span>Small label</span></div>',[{name:'title',selector:'#parent',styles:{color:'#182238'}}]);
 await capture(f.root,f.screen,path.join(f.root,'reference.png'),{page:f.page});
 await writeJson(path.join(f.root,'fidelity.config.json'),{version:1,screens:[f.screen]});
 await f.page.locator('span').evaluate(el=>el.style.color='#c43224');
 const report=await verify(f.root,'desktop',{page:f.page});
 assert.ok(report.pixels.mismatchPercent<2);assert.equal(report.pass,false);
 const diff=JSON.parse(await fs.readFile(report.artifacts.result)).differences.find(d=>d.property==='color');
 assert.equal(diff.actual,'color(srgb 0.768627 0.196078 0.141176 / 1)');
 assert.equal(diff.expected,'color(srgb 0.094118 0.133333 0.219608 / 1)');
 await f.page.locator('span').evaluate(el=>el.style.removeProperty('color'));
 assert.equal((await verify(f.root,'desktop',{page:f.page,format:'json'})).pass,true);
});

test('text run checks catch later mixed spans, text fill and descendant typography',async t=>{
 const regions=['mixed','paint','type','hidden'].map(name=>({name,selector:'#'+name,styles:{color:'#000',fontSize:'16px'}}));
 const f=await fixture(t,'<style>body{color:black;font-size:16px}</style><p id="mixed">Black <span style="color:red">Red</span></p><p id="paint" style="-webkit-text-fill-color:red">Paint</p><p id="type"><span style="font-size:22px">Large</span></p><p id="hidden">Visible<span hidden style="color:red">Hidden</span></p>',regions);
 const data=await capture(f.root,f.screen,path.join(f.root,'actual.png'),{page:f.page});
 const issues=name=>checkGeometry(regions.find(r=>r.name===name),data.measures.find(m=>m.name===name),{styles:{color:'#000',fontSize:'16px'}},2);
 assert.ok(issues('mixed').some(i=>i.property==='color'));assert.ok(issues('paint').some(i=>i.property==='color'));
 assert.ok(issues('type').some(i=>i.property==='fontSize'));assert.deepEqual(issues('hidden'),[]);
});

test('unsupported browser paint produces reviewable coverage findings in HTML and JSON',async t=>{
 const f=await fixture(t,'<div style="opacity:.5"><p id="title" style="color:black">Faded</p></div><div id="layer" style="background:red linear-gradient(blue,blue)">Layer</div>',[{name:'title',selector:'#title',styles:{color:'#000'}},{name:'layer',selector:'#layer',styles:{backgroundColor:'red'}}]);
 await capture(f.root,f.screen,path.join(f.root,'reference.png'),{page:f.page});await writeJson(path.join(f.root,'fidelity.config.json'),{version:1,screens:[f.screen]});
 for(const format of ['simple','html','json']){
  const report=await verify(f.root,'desktop',{page:f.page,format});
  assert.equal(report.pass,false);
  const compact=JSON.parse(await fs.readFile(report.artifacts.result));
  for(const property of ['color','backgroundColor']){
   const finding=compact.differences.find(d=>d.category==='coverage'&&d.property===property);
   assert.ok(finding);assert.ok(finding.reason);
   assert.equal(finding.comparison,'unavailable');
  }
  if(format!=='json')assert.match(await fs.readFile(report.artifacts.report,'utf8'),/could not be verified/);
 }
});

test('old snapshots recover rich text from saved raw design without modifying the snapshot',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'delta-old-colors-'));t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
 const dir=path.join(root,'.figma-fidelity/references/desktop');
 const screen={name:'desktop',figmaUrl:'https://figma.com/design/abc/File?node-id=1-1'};
 const manifest={source:screen.figmaUrl,nodeId:'1:1',version:'v1',nodes:[{id:'1:2',type:'TEXT',text:'Hi',fills:[blue],style:{fontSize:16}}]};
 await writeJson(path.join(dir,'manifest.json'),manifest);
 await writeJson(path.join(dir,'design.json'),{version:'v1',nodes:{'1:1':{document:{id:'1:1',type:'FRAME',absoluteBoundingBox:{x:0,y:0,width:800,height:600},children:[{id:'1:2',type:'TEXT',characters:'Hi',fills:[blue],style:{fontSize:16},characterStyleOverrides:[1,1],styleOverrideTable:{1:{fills:[red]}}}]}}}});
 const result=regionExpectations({name:'title',nodeId:'1:2',styles:{}},await manifestFor(root,screen));
 assert.equal(result.styles.color,'color(srgb 1 0 0 / 1)');assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'manifest.json'))),manifest);
 await fs.unlink(path.join(dir,'design.json'));
 const missing=regionExpectations({name:'title',nodeId:'1:2',styles:{}},await manifestFor(root,screen));
 assert.ok(missing.unavailable.color);
});

test('SVG opacity and native or shadow text cannot hide behind an ordinary DOM text run',async t=>{
 const f=await fixture(t,'<div id="native">Black<input value="Red" style="color:red"></div><div id="shadow">Black<x-label></x-label></div><svg><text id="svg" x="0" y="20" fill="black" fill-opacity=".5">SVG</text></svg><div id="pseudo">Black<span hidden><i></i></span></div><style>i::after{content:"Hidden";color:red}</style>',[]);
 await f.page.locator('x-label').evaluate(el=>{el.attachShadow({mode:'open'}).innerHTML='<span style="color:red">Red</span>';});
 f.screen.regions=['native','shadow','svg','pseudo'].map(name=>({name,selector:'#'+name,styles:{color:'black'}}));
 const data=await capture(f.root,f.screen,path.join(f.root,'actual.png'),{page:f.page});
 for(const name of ['native','shadow','svg']){
  const issues=checkGeometry({name},data.measures.find(m=>m.name===name),{styles:{color:'black'}},2);
  assert.ok(issues.some(i=>i.kind==='coverage'),name);
 }
 assert.deepEqual(checkGeometry({name:'pseudo'},data.measures.find(m=>m.name==='pseudo'),{styles:{color:'black'}},2),[]);
});

test('first-letter and first-line paint changes require review instead of passing base styles',async t=>{
 const f=await fixture(t,'<style>#title::first-letter{color:red;font-size:36px}#title::first-line{font-weight:900}</style><p id="title" style="color:black;font-size:16px;font-weight:400">Styled letter</p>',[{name:'title',selector:'#title',styles:{color:'black',fontSize:'16px',fontWeight:'400'}}]);
 const {measures}=await capture(f.root,f.screen,path.join(f.root,'actual.png'),{page:f.page});
 const issues=checkGeometry(f.screen.regions[0],measures[0],{styles:f.screen.regions[0].styles},2);
 for(const property of ['color','fontSize','fontWeight'])assert.ok(issues.some(i=>i.kind==='coverage'&&i.property===property),property);
});

test('textless controls and fully transparent descendants do not invalidate visible label text',async t=>{
 const regions=['checkbox','transparent'].map(name=>({name,selector:'#'+name,styles:{color:'black'}}));
 const f=await fixture(t,'<label id="checkbox"><input type="checkbox">Remember me</label><p id="transparent">Black <span style="opacity:0;color:red">Invisible</span></p>',regions);
 const data=await capture(f.root,f.screen,path.join(f.root,'actual.png'),{page:f.page});
 for(let i=0;i<regions.length;i++)assert.deepEqual(checkGeometry(regions[i],data.measures[i],{styles:{color:'black'}},2),[],regions[i].name);
});
