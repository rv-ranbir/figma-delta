import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright';
import {capture} from '../src/capture.js';
import {flatten} from '../src/figma.js';
import {screenSchema,writeJson} from '../src/config.js';
import {verify,checkGeometry} from '../src/runner.js';
import {compareStyle} from '../src/properties.js';

async function fixture(t,{html='Order 123',text='Order 123',region={},viewport={width:800,height:600},extraNodes=[]}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'delta-semantic-'));t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:5}));
 const browser=await chromium.launch();t.after(()=>browser.close());
 const page=await browser.newPage({viewport});await page.setContent(`<style>body{margin:20px;font-family:sans-serif;font-size:16px;color:black}#target{display:block;width:180px;height:24px;font:400 16px/20px sans-serif;white-space:nowrap}</style><span id="target">${html}</span>`);
 const box=await page.locator('#target').boundingBox();
 const source='https://figma.com/design/QA123/Audit?node-id=1-1';
 const node={id:'1:2',type:'TEXT',characters:text,absoluteBoundingBox:box,style:{fontFamily:'sans-serif',fontSize:16,fontWeight:400,lineHeightUnit:'PIXELS',lineHeightPx:20,letterSpacing:0},fills:[{type:'SOLID',color:{r:0,g:0,b:0,a:1}}]};
 const nodes=flatten({id:'1:1',type:'FRAME',absoluteBoundingBox:{x:0,y:0,...viewport},children:[node,...extraNodes]});
 const screen=screenSchema.parse({name:'desktop',url:'http://localhost:3000/test',figmaUrl:source,viewport,regions:[{name:'title',selector:'#target',nodeId:'1:2',...region}]});
 const dir=path.join(root,'.figma-fidelity/references/desktop');await fs.mkdir(dir,{recursive:true});
 await writeJson(path.join(dir,'manifest.json'),{source,nodeId:'1:1',version:'v1',nodes});await writeJson(path.join(root,'fidelity.config.json'),{version:1,screens:[screen]});
 await capture(root,screen,path.join(dir,'reference.png'),{page});
 return {root,page,screen,nodes,dir,check:format=>verify(root,'desktop',{page,format:format??'json'})};
}

async function repin(f){
 f.nodes.find(node=>node.id==='1:2').rect=await f.page.locator('#target').boundingBox();
 await writeJson(path.join(f.dir,'manifest.json'),{source:f.screen.figmaUrl,nodeId:'1:1',version:'v1',nodes:f.nodes});
 await capture(f.root,f.screen,path.join(f.dir,'reference.png'),{page:f.page});
}

test('normal letter spacing equals zero without accepting nonzero tracking',()=>{
 assert.equal(compareStyle('letterSpacing','0px','normal').matches,true);
 assert.equal(compareStyle('letterSpacing','normal','0px').matches,true);
 assert.equal(compareStyle('letterSpacing','1px','normal').matches,false);
 assert.equal(checkGeometry({name:'tracking'},{styles:{letterSpacing:'normal'}},{styles:{letterSpacing:'1px'}},2)[0].actual,'0px');
});

test('generated copy is reported as unverified rather than a fabricated content mismatch',async t=>{
 const f=await fixture(t,{html:'Label',text:'Label suffix'});
 await f.page.addStyleTag({content:'#target::after{content:" suffix"}'});
 const result=await f.check();assert.ok(result.findings.some(f=>f.category==='coverage'&&f.property==='text'));assert.equal(result.findings.some(f=>f.category==='content'),false);
});

test('image, descendant and painted pseudo overlays cannot evade visibility checks',async t=>{
 const f=await fixture(t,{html:'No',text:'No'});
 for(const mode of ['image','descendant','pseudo']){
  await f.page.evaluate(mode=>{
   document.querySelectorAll('.audit-cover').forEach(el=>el.remove());
   if(mode==='pseudo'){const style=document.createElement('style');style.className='audit-cover';style.textContent='#target{position:relative}#target::after{content:"";position:absolute;inset:0;background:white;pointer-events:none}';document.head.append(style);return;}
   const cover=document.createElement(mode==='image'?'img':'div');cover.className='audit-cover';cover.style.cssText='position:absolute;left:20px;top:20px;width:180px;height:24px;pointer-events:none;background:white;z-index:10';
   if(mode==='image'){cover.style.background='none';cover.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="24"><rect width="180" height="24" fill="white"/></svg>');}
   (mode==='descendant'?document.querySelector('#target'):document.body).append(cover);
  },mode);
  const result=await f.check();assert.ok(result.findings.some(f=>f.property==='textVisibility'),mode);
 }
});

test('scaled clipping containers do not report visible text as clipped',async t=>{
 const f=await fixture(t,{html:'Account text',text:'Account text'});
 await f.page.locator('#target').evaluate(el=>{el.style.width='100px';el.style.height='30px';el.style.overflow='hidden';el.style.transformOrigin='top left';el.style.transform='scale(2)';});
 const result=await f.check();assert.equal(result.findings.some(f=>f.category==='visibility'&&f.actual.value==='clipped'),false);
});

test('changed mapped Figma text produces exact content findings below pixel budgets',async t=>{
 const f=await fixture(t);assert.equal((await f.check()).pass,true);
 await f.page.locator('#target').evaluate(el=>el.textContent='Order 128');
 for(const format of ['json','simple','html']){
  const report=await f.check(format);assert.equal(report.pass,false);
  const diff=JSON.parse(await fs.readFile(report.artifacts.result)).differences.find(d=>d.property==='text');
  assert.equal(diff.expected,'Order 123');assert.equal(diff.actual,'Order 128');
  if(format!=='json')assert.match(await fs.readFile(report.artifacts.report,'utf8'),/text does not match/);
 }
 await f.page.locator('#target').evaluate(el=>el.textContent='Order 123');assert.equal((await f.check()).pass,true);
});

test('dynamic text can be ignored explicitly and overrides support PNG or host-supplied text',async t=>{
 const f=await fixture(t,{region:{textMode:'ignore'}});await f.page.locator('#target').evaluate(el=>el.textContent='Order 128');assert.equal((await f.check()).pass,true);
 const config={version:1,screens:[{...f.screen,regions:[{name:'title',selector:'#target',text:'Order 128'}]}]};
 await writeJson(path.join(f.root,'fidelity.config.json'),config);assert.equal((await f.check()).pass,true);
 await f.page.locator('#target').evaluate(el=>el.textContent='Order 129');assert.ok((await f.check()).findings.some(f=>f.property==='text'));
});

test('short covered text is not allowed to pass solely because pixels stay below budget',async t=>{
 const f=await fixture(t,{html:'No',text:'No'});assert.equal((await f.check()).pass,true);
 await f.page.evaluate(()=>{const cover=document.createElement('div');cover.style.cssText='position:absolute;left:20px;top:20px;width:180px;height:24px;background:white;z-index:10';document.body.append(cover);});
 const result=await f.check();assert.equal(result.pass,false);assert.ok(result.findings.some(f=>f.property==='textVisibility'));
});

test('clipped and offscreen text emit visibility evidence, including pointer-events-none layers',async t=>{
 const f=await fixture(t,{html:'Account settings',text:'Account settings'});
 await f.page.locator('#target').evaluate(el=>{el.style.width='35px';el.style.overflow='hidden';});
 assert.ok((await f.check()).findings.some(f=>f.property==='textVisibility'));
 await f.page.locator('#target').evaluate(el=>{el.style.width='180px';el.style.overflow='visible';el.style.transform='translateX(-200px)';});
 assert.ok((await f.check()).findings.some(f=>f.property==='textVisibility'));
 await f.page.locator('#target').evaluate(el=>el.style.transform='none');
 await f.page.evaluate(()=>{const cover=document.createElement('div');cover.style.cssText='pointer-events:none;position:absolute;left:20px;top:20px;width:180px;height:24px;background:white;z-index:10';document.body.append(cover);});
 assert.ok((await f.check()).findings.some(f=>f.property==='textVisibility'));
});

test('actual font fallback fails even when declared font family and tiny pixels appear to match',async t=>{
 const f=await fixture(t,{html:'i',text:'i'});
 const bytes=await fs.readFile(new URL('../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2',import.meta.url));
 await f.page.evaluate(async data=>{const face=new FontFace('AuditInter',`url(data:font/woff2;base64,${data})`);document.fonts.add(await face.load());window.auditFace=face;document.querySelector('#target').style.fontFamily='AuditInter,sans-serif';},bytes.toString('base64'));
 f.nodes.find(n=>n.id==='1:2').style.fontFamily='AuditInter';
 await writeJson(path.join(f.dir,'manifest.json'),{source:f.screen.figmaUrl,nodeId:'1:1',version:'v1',nodes:f.nodes});
 await capture(f.root,f.screen,path.join(f.dir,'reference.png'),{page:f.page});assert.equal((await f.check()).pass,true);
 await f.page.evaluate(()=>document.fonts.delete(window.auditFace));
 const result=await f.check();assert.equal(result.pass,false);
 const finding=result.findings.find(f=>f.property==='renderedFontFamily');assert.ok(finding);assert.equal(finding.expected.value,'AuditInter');
});

test('unmapped Figma vector is checked locally and cannot disappear under the global budget',async t=>{
 const vector={id:'1:3',name:'Save icon',type:'VECTOR',absoluteBoundingBox:{x:220,y:20,width:16,height:16},fills:[{type:'SOLID',color:{r:0,g:0,b:0,a:1}}]};
 const f=await fixture(t,{extraNodes:[vector]});
 await f.page.evaluate(()=>{const icon=document.createElement('div');icon.id='icon';icon.style.cssText='position:absolute;left:220px;top:20px;width:16px;height:16px;background:black';document.body.append(icon);});
 await capture(f.root,f.screen,path.join(f.dir,'reference.png'),{page:f.page});assert.equal((await f.check()).pass,true);
 await f.page.locator('#icon').evaluate(el=>el.remove());
 const report=await f.check();assert.ok(report.pixels.mismatchPercent<2);assert.equal(report.pass,false);
 const diff=JSON.parse(await fs.readFile(report.artifacts.result)).differences.find(d=>d.nodeId==='1:3');assert.ok(diff);assert.equal(diff.category,'region-pixels');
 assert.deepEqual(report.findings.find(f=>f.target.nodeId==='1:3').properties,[]);
});

test('asset masks remain explicit exclusions, not new missing-asset findings',async t=>{
 const vector={id:'1:3',type:'VECTOR',absoluteBoundingBox:{x:220,y:20,width:16,height:16},fills:[{type:'SOLID',color:{r:0,g:0,b:0}}]};
 const f=await fixture(t,{extraNodes:[vector]});
 await f.page.evaluate(()=>{const icon=document.createElement('div');icon.id='icon';icon.style.cssText='position:absolute;left:220px;top:20px;width:16px;height:16px;background:black';document.body.append(icon);});
 await capture(f.root,f.screen,path.join(f.dir,'reference.png'),{page:f.page});await f.page.locator('#icon').evaluate(el=>el.remove());
 assert.equal((await f.check()).pass,false);
 f.screen.masks=[{x:220,y:20,width:16,height:16}];await writeJson(path.join(f.root,'fidelity.config.json'),{version:1,screens:[f.screen]});
 assert.equal((await f.check()).pass,true);
});

for(const width of [320,800])test(`wrapped long text and RTL content compare against their own ${width}px reference`,async t=>{
 const text='مرحبا بالعالم — '+('A longer account description with wrapping. ').repeat(4);
 const f=await fixture(t,{html:text,text,viewport:{width,height:240}});
 await f.page.locator('#target').evaluate((el,width)=>{el.style.direction='rtl';el.style.whiteSpace='normal';el.style.width=(width-40)+'px';el.style.height='140px';},width);
 await repin(f);assert.equal((await f.check()).pass,true);
 await f.page.locator('#target').evaluate(el=>el.textContent+=' Incorrect');
 assert.ok((await f.check()).findings.some(f=>f.property==='text'));
});

test('prepared hover and focus states use their own reference without app automation in the toolkit',async t=>{
 const f=await fixture(t,{html:'Action',text:'Action'});
 await f.page.locator('#target').evaluate(el=>el.tabIndex=0);
 await f.page.addStyleTag({content:'#target:hover{color:red}#target:focus{outline:2px solid blue}'});
 await f.page.locator('#target').hover();await f.page.locator('#target').focus();
 f.nodes.find(n=>n.id==='1:2').fills[0].color={r:1,g:0,b:0};
 await repin(f);assert.equal((await f.check()).pass,true);
 await f.page.mouse.move(0,0);assert.ok((await f.check()).findings.some(f=>f.property==='color'));
});

test('preformatted whitespace is compared without hiding meaningful space changes',async t=>{
 const f=await fixture(t,{html:'A  B',text:'A  B'});await f.page.locator('#target').evaluate(el=>el.style.whiteSpace='pre');await repin(f);
 assert.equal((await f.check()).pass,true);await f.page.locator('#target').evaluate(el=>el.textContent='A B');
 assert.ok((await f.check()).findings.some(f=>f.property==='text'));
});
