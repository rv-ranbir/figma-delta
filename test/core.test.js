import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { compare, compareRegion } from '../src/compare.js';
import * as comparison from '../src/compare.js';
import { configSchema, inside, withLock, writeJson } from '../src/config.js';
import { parseFigmaUrl, flatten, syncFigma } from '../src/figma.js';
import { checkGeometry, regionExpectations } from '../src/runner.js';
import { install } from '../src/install.js';
const temp=()=>fs.mkdtemp(path.join(os.tmpdir(),'fidelity-test-'));
const png=async(file,color,w=20,h=20)=>sharp({create:{width:w,height:h,channels:4,background:color}}).png().toFile(file);

test('exact images pass and fully changed images differ',async t=>{
 const d=await temp();t.after(()=>fs.rm(d,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
 await png(path.join(d,'a.png'),'#000');await png(path.join(d,'b.png'),'#fff');
 const same=await compare(path.join(d,'a.png'),path.join(d,'a.png'),path.join(d,'same'));
 assert.equal(same.mismatchPercent,0);
 const different=await compare(path.join(d,'a.png'),path.join(d,'b.png'),path.join(d,'different'));
 assert.equal(different.mismatchPercent,100);assert.equal(different.hotspots[0].changedPixels,400);
});
test('masks excluded from denominator and cannot hide entire image',async t=>{
 const d=await temp();t.after(()=>fs.rm(d,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
 await png(path.join(d,'a.png'),'#000');await png(path.join(d,'b.png'),'#fff');
 const r=await compare(path.join(d,'a.png'),path.join(d,'b.png'),path.join(d,'out'),{masks:[{x:0,y:0,width:10,height:20}]});
 assert.equal(r.comparedPixels,200);assert.equal(r.maskedPixels,200);assert.equal(r.mismatchPercent,100);
 const fractional={x:0.5,y:0.5,width:8.5,height:18.5};
 const global=await compare(path.join(d,'a.png'),path.join(d,'b.png'),path.join(d,'fractional'),{masks:[fractional]});
 const regional=await compareRegion(path.join(d,'a.png'),path.join(d,'b.png'),{x:0,y:0,width:20,height:20},{masks:[fractional]});
 assert.equal(global.mismatchPercent,regional);
 await assert.rejects(()=>compare(path.join(d,'a.png'),path.join(d,'b.png'),path.join(d,'out'),{masks:[{x:0,y:0,width:20,height:20}]}),/every pixel/);
 await assert.rejects(()=>compare(path.join(d,'a.png'),path.join(d,'b.png'),path.join(d,'out'),{masks:[{x:19,y:0,width:20,height:20}]}),/outside/);
});
test('dimension mismatch fails instead of rescaling',async t=>{
 const d=await temp();t.after(()=>fs.rm(d,{recursive:true,force:true,maxRetries:5,retryDelay:100}));await png(path.join(d,'a.png'),'black');await png(path.join(d,'b.png'),'black',21,20);
 await assert.rejects(()=>compare(path.join(d,'a.png'),path.join(d,'b.png'),d),/No auto-resize/);
});
test('regional compare catches localized differences and respects masks',async t=>{
 const d=await temp();t.after(()=>fs.rm(d,{recursive:true,force:true,maxRetries:5,retryDelay:100}));await png(path.join(d,'a.png'),'black');await png(path.join(d,'b.png'),'white');
 assert.equal(await compareRegion(path.join(d,'a.png'),path.join(d,'b.png'),{x:0,y:0,width:10,height:20}),100);
 await assert.rejects(()=>compareRegion(path.join(d,'a.png'),path.join(d,'b.png'),{x:18,y:0,width:10,height:20}),/outside/);
 await assert.rejects(()=>compareRegion(path.join(d,'a.png'),path.join(d,'b.png'),{x:0,y:0,width:10,height:20},{masks:[{x:0,y:0,width:10,height:20}]}),/fully masked/);
});

test('shared regional comparison retains local budgets and masks across asset crops',async t=>{
 const d=await temp();t.after(()=>fs.rm(d,{recursive:true,force:true,maxRetries:5}));await png(path.join(d,'a.png'),'black');await png(path.join(d,'b.png'),'white');
 assert.equal(typeof comparison.createRegionComparator,'function');
 const compareCrop=await comparison.createRegionComparator(path.join(d,'a.png'),path.join(d,'b.png'),{masks:[{x:0,y:0,width:5,height:20}]});
 assert.equal(compareCrop({x:0,y:0,width:10,height:20}),100);assert.equal(compareCrop({x:10,y:0,width:10,height:20}),100);
 assert.throws(()=>compareCrop({x:0,y:0,width:5,height:20}),/fully masked/);
 assert.throws(()=>compareCrop({x:19,y:0,width:10,height:20}),/outside/);
});
test('parse Figma frame links and reject unrelated URL or absent node',()=>{
 assert.deepEqual(parseFigmaUrl('https://www.figma.com/design/abc123/File?node-id=1-2'),{key:'abc123',nodeId:'1:2'});
 assert.throws(()=>parseFigmaUrl('https://evil.test/design/abc?node-id=1-2'));
 assert.throws(()=>parseFigmaUrl('https://figma.com/design/abc/File'));
});
test('flatten uses frame-relative coordinates and skips hidden subtrees',()=>{
 const n={id:'1:1',absoluteBoundingBox:{x:40,y:80,width:200,height:100},children:[{id:'1:2',absoluteBoundingBox:{x:50,y:90,width:20,height:10}},{id:'1:3',visible:false,children:[{id:'1:4'}]}]};
 const list=flatten(n,n.absoluteBoundingBox);assert.equal(list.length,2);assert.deepEqual(list[1].rect,{x:10,y:10,width:20,height:10});
});
test('geometry tolerance, typography and missing element checks',()=>{
 const region={name:'title'};const actual={rect:{x:4,y:0,width:100,height:50},styles:{fontFamily:'"Inter", sans-serif',fontSize:'18px'}};
 const issues=checkGeometry(region,actual,{rect:{x:0,y:0,width:100,height:50},styles:{fontFamily:'Inter',fontSize:'20px'}},2);
 assert.equal(issues.length,2);assert.equal(issues[0].delta,4);assert.equal(checkGeometry(region,{error:'missing'},{},2)[0].kind,'element');
});
test('node mapping fails closed and derives font expectations',()=>{
 assert.throws(()=>regionExpectations({name:'x',nodeId:'9:9'},null),/absent/);
 const e=regionExpectations({name:'x',nodeId:'1-2',styles:{fontWeight:'700'}},{nodes:[{id:'1:2',rect:{x:0,y:0,width:10,height:10},style:{fontFamily:'Inter',fontSize:20,fontWeight:400}}]});
 assert.equal(e.styles.fontWeight,'700');assert.equal(e.styles.fontSize,'20px');
});

test('node expectations derive solid text color and explicit auto-layout padding and gap without inventing margins',()=>{
 const manifest={nodes:[{id:'1:2',type:'TEXT',style:{fontSize:20},fills:[{type:'SOLID',color:{r:1,g:0,b:0,a:1}}]},{id:'1:3',type:'FRAME',layoutMode:'HORIZONTAL',primaryAxisAlignItems:'MIN',itemSpacing:12,paddingLeft:16,paddingRight:24,paddingTop:8,paddingBottom:8,cornerRadius:6}]};
 const text=regionExpectations({name:'text',nodeId:'1:2',styles:{}},manifest);assert.equal(text.styles.color,'color(srgb 1 0 0 / 1)');
 const layout=regionExpectations({name:'layout',nodeId:'1:3',styles:{}},manifest);
 assert.equal(layout.styles.paddingLeft,'16px');assert.equal(layout.styles.columnGap,'12px');assert.equal(layout.styles.borderRadius,'6px');
 assert.equal(layout.styles.margin,undefined);
 manifest.nodes[1].primaryAxisAlignItems='SPACE_BETWEEN';assert.equal(regionExpectations({name:'layout',nodeId:'1:3',styles:{}},manifest).styles.columnGap,undefined);
 manifest.nodes[0].fills.push({type:'SOLID',color:{r:0,g:0,b:1,a:1}});assert.equal(regionExpectations({name:'text',nodeId:'1:2',styles:{}},manifest).styles.color,undefined);
 manifest.nodes.push({id:'1:4',type:'VECTOR',fills:[{type:'SOLID',color:{r:1,g:0,b:0,a:1}}]});
 assert.equal(regionExpectations({name:'icon',nodeId:'1:4',styles:{}},manifest).styles.backgroundColor,undefined);
});

test('Figma auto-layout spacing compares its axis instead of requiring both CSS gap axes',()=>{
 const node={id:'1:2',type:'FRAME',layoutMode:'HORIZONTAL',itemSpacing:12};
 const region={name:'row',nodeId:'1:2',styles:{}};
 let expected=regionExpectations(region,{nodes:[node]});
 assert.deepEqual(checkGeometry(region,{styles:{gap:'normal 12px',columnGap:'12px',rowGap:'normal'}},expected,2),[]);
 node.layoutMode='VERTICAL';expected=regionExpectations(region,{nodes:[node]});
 assert.deepEqual(checkGeometry(region,{styles:{gap:'12px normal',rowGap:'12px',columnGap:'normal'}},expected,2),[]);
});

test('equivalent opaque hex and browser RGB colors match while different colors still fail',()=>{
 const actual={rect:{x:0,y:0,width:10,height:10},styles:{color:'rgb(43, 54, 116)',backgroundColor:'rgb(255, 255, 255)'}};
 const region={name:'title'};
 assert.equal(checkGeometry(region,actual,{styles:{color:'#2b3674',backgroundColor:'#fff'}},2).length,0);
 const issues=checkGeometry(region,actual,{styles:{color:'#000000'}},2);assert.equal(issues.length,1);assert.equal(issues[0].actual,'color(srgb 0.168627 0.211765 0.454902 / 1)');
});
test('strict config rejects duplicate screens, bad budgets, unexpected keys',()=>{
 const s={name:'desktop',url:'http://localhost:3000',viewport:{width:1440,height:900}};
 assert.throws(()=>configSchema.parse({version:1,screens:[s,s]}));
 assert.throws(()=>configSchema.parse({version:1,maxIterations:0,screens:[s]}));
 assert.throws(()=>configSchema.parse({version:1,screens:[{...s,foo:1}]}));
 assert.throws(()=>configSchema.parse({version:1,screens:[{...s,url:'file:///etc/passwd'}]}));
 assert.equal(configSchema.parse({version:1,screens:[s]}).screens[0].pixelThreshold,0.1);
});
test('path traversal prevented and operation lock released after errors',async t=>{
 const d=await temp();t.after(()=>fs.rm(d,{recursive:true,force:true,maxRetries:5,retryDelay:100}));assert.throws(()=>inside(d,'../secret'));
 await assert.rejects(()=>withLock(d,async()=>{await assert.rejects(()=>withLock(d,async()=>{}),/Another/);throw Error('test failure');}),/test failure/);
 assert.equal(await withLock(d,async()=>42),42);
});
test('installer preserves existing MCP entries, does not overwrite setup',async t=>{
 const d=await temp();t.after(()=>fs.rm(d,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
 await writeJson(path.join(d,'.cursor','mcp.json'),{mcpServers:{existing:{url:'https://example.com/mcp'}}});
 const existing={
  'AGENTS.md':'Use company components and tokens.',
  '.cursor/rules/company.mdc':'Reuse CompanyButton.',
  '.agents/skills/company-design/SKILL.md':'Follow the company design system.'
 };
 for(const [file,content] of Object.entries(existing)){await fs.mkdir(path.dirname(path.join(d,file)),{recursive:true});await fs.writeFile(path.join(d,file),content);}
 await install(d);const c=JSON.parse(await fs.readFile(path.join(d,'.cursor','mcp.json')));
 assert.equal(c.mcpServers.existing.url,'https://example.com/mcp');assert.ok(c.mcpServers['figma-fidelity'].args.includes(d));
 await assert.rejects(()=>install(d),/Already exists/);
 assert.match(await fs.readFile(path.join(d,'.cursor','skills','figma-fidelity','SKILL.md'),'utf8'),/fidelity_verify/);
 for(const [file,content] of Object.entries(existing))assert.equal(await fs.readFile(path.join(d,file),'utf8'),content);
});
test('Figma sync uses token only on API, saves manifest, refuses incorrect viewport',async t=>{
 const d=await temp();t.after(()=>fs.rm(d,{recursive:true,force:true,maxRetries:5,retryDelay:100}));const bytes=await sharp({create:{width:20,height:20,channels:4,background:'white'}}).png().toBuffer();const calls=[];
 const fetcher=async(url,opts)=>{calls.push({url,opts});if(url.includes('/nodes?'))return Response.json({version:'v1',nodes:{'1:2':{document:{id:'1:2',name:'Frame',absoluteBoundingBox:{x:100,y:100,width:20,height:20},children:[]}}}});if(url.includes('/images/'))return Response.json({images:{'1:2':'https://export.example/frame.png'}});return new Response(bytes);};
 const s={name:'desktop',figmaUrl:'https://figma.com/design/abc/File?node-id=1-2',viewport:{width:20,height:20}};
 const r=await syncFigma(d,s,{token:'fake-token',fetcher});assert.equal(r.version,'v1');assert.equal(calls[0].opts.headers['X-Figma-Token'],'fake-token');assert.equal(calls[2].opts.headers,undefined);
 const manifest=JSON.parse(await fs.readFile(r.manifest));assert.equal(manifest.nodes[0].rect.x,0);
 await assert.rejects(()=>syncFigma(d,{...s,viewport:{width:21,height:20}},{token:'fake',fetcher}),/Match them/);
});
test('Figma auth and rate limit errors are actionable, do not persist token',async t=>{
 const d=await temp();t.after(()=>fs.rm(d,{recursive:true,force:true,maxRetries:5,retryDelay:100}));const s={name:'desktop',figmaUrl:'https://figma.com/design/abc/File?node-id=1-2'};
 await assert.rejects(()=>syncFigma(d,s,{token:''}),/FIGMA_ACCESS_TOKEN/);
 await assert.rejects(()=>syncFigma(d,s,{token:'do-not-print-me',fetcher:async()=>new Response('',{status:429,headers:{'retry-after':'30'}})}),e=>/rate limited/.test(e.message)&&!e.message.includes('do-not-print-me'));
});
