import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { writeFindings } from '../src/findings.js';

async function fixture(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fidelity-findings-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 for(const [name,color] of [['reference','#000000'],['actual','#ffffff'],['diff','#ff0000'],['overlay','#808080']]){
  await sharp({create:{width:20,height:20,channels:4,background:color}}).png().toFile(path.join(dir,name+'.png'));
 }
 const screen={name:'desktop',url:'http://localhost',viewport:{width:20,height:20},maxMismatchPercent:2,tolerancePx:2,regions:[{name:'card',selector:'#card',nodeId:'1:2',maxMismatchPercent:3}]};
 const report={runId:'one',screen:'desktop',url:screen.url,viewport:screen.viewport,pass:false,capturedAt:'2026-10-23T00:00:00Z',pixels:{mismatchPercent:10},regions:[{name:'card',expected:{rect:{x:1,y:2,width:6,height:5}},actual:{rect:{x:-2,y:4,width:8,height:5}} ,mismatchPercent:40}],issues:[{kind:'geometry',region:'card',property:'x',expected:1,actual:-2,delta:-3,message:'x differs'},{kind:'region-pixels',region:'card',message:'Region mismatch'}]};
 return {dir,report,screen};
}

test('findings keep measured values, mappings and pixel limits without inventing causes or severity',async t=>{
 const {dir,report,screen}=await fixture(t);const doc=await writeFindings(dir,report,screen);
 const [geometry,pixels]=doc.findings;
 assert.equal(geometry.expected.value,1);assert.equal(geometry.expected.tolerance,2);assert.equal(geometry.actual.value,-2);assert.equal(geometry.delta,-3);
 assert.equal(geometry.target.selector,'#card');assert.equal(geometry.target.nodeId,'1:2');
 assert.deepEqual(pixels.expected,{operator:'<=',value:3,unit:'percent'});assert.equal(pixels.actual.value,40);
 assert.equal(pixels.review.status,'unreviewed');assert.equal(pixels.review.severity,null);assert.deepEqual(pixels.hypotheses,[]);
 assert.equal(pixels.evidenceType,'pixel-comparison');
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'findings.json'),'utf8')),doc);
});

test('crop evidence includes expected and actual bounds, clips to viewport and preserves actual image content',async t=>{
 const {dir,report,screen}=await fixture(t);const doc=await writeFindings(dir,report,screen);
 const evidence=doc.findings[0].evidence;assert.deepEqual(evidence.rect,{x:0,y:2,width:7,height:7});
 assert.deepEqual(evidence,doc.findings[1].evidence);
 const {data,info}=await sharp(path.join(dir,evidence.images.actual)).raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,7);assert.equal(info.height,7);assert.deepEqual([...data.subarray(0,4)],[255,255,255,255]);
 assert.ok(!path.isAbsolute(evidence.images.actual));
});

test('finding identities survive changed values and order, but distinguish page and region checks',async t=>{
 const {dir,report,screen}=await fixture(t);const first=await writeFindings(dir,report,screen);
 const later=structuredClone(report);later.runId='two';later.issues.reverse();later.issues[1].actual=9;
 const second=await writeFindings(dir,later,screen);
 assert.equal(first.findings[0].id,second.findings[1].id);assert.equal(first.findings[1].id,second.findings[0].id);
 screen.regions[0].name='page';later.regions[0].name='page';later.issues=[{kind:'pixels',message:'page differs'},{kind:'region-pixels',region:'page',message:'region differs'}];
 const third=await writeFindings(dir,later,screen);assert.notEqual(third.findings[0].id,third.findings[1].id);
});

test('missing and unmapped elements use available reference or page evidence without inventing bounds',async t=>{
 const {dir,report,screen}=await fixture(t);report.regions[0].actual={error:'missing',count:0};report.issues=[{kind:'element',region:'card',message:'missing'},{kind:'runtime',message:'Oops'}];
 const doc=await writeFindings(dir,report,screen);
 assert.deepEqual(doc.findings[0].evidence.rect,{x:1,y:2,width:6,height:5});assert.equal(doc.findings[0].actual.value,'missing');
 assert.equal(doc.findings[1].target.selector,null);assert.equal(doc.findings[1].evidence.images.diff,'diff.png');
 assert.deepEqual(doc.findings[1].evidence.rect,{x:0,y:0,width:20,height:20});
 report.issues=[];report.pass=true;assert.deepEqual((await writeFindings(dir,report,screen)).findings,[]);
});

test('style findings describe the effective CSS tolerance and primary font-family comparison',async t=>{
 const {dir,report,screen}=await fixture(t);
 report.issues=[{kind:'style',region:'card',property:'fontSize',expected:'20px',actual:'18px',message:'size differs'},{kind:'style',region:'card',property:'fontFamily',expected:'Inter',actual:'Arial, sans-serif',message:'font differs'}];
 const {findings}=await writeFindings(dir,report,screen);
 assert.deepEqual(findings[0].expected,{operator:'within',value:20,unit:'px',tolerance:0.5,rawValue:'20px'});
 assert.equal(findings[0].actual.value,18);assert.equal(findings[0].delta,-2);
 assert.equal(findings[1].expected.operator,'primary-font-family-equals');
 assert.equal(findings[1].expected.value,'Inter');assert.equal(findings[1].actual.value,'Arial, sans-serif');
});

test('repeated runtime and resource failures have unique finding IDs and retain occurrence counts',async t=>{
 const {dir,report,screen}=await fixture(t);
 report.issues=[{kind:'asset',resource:'/broken.png',message:'Failed image'},{kind:'asset',resource:'/broken.png',message:'Failed image'},{kind:'runtime',message:'Oops'},{kind:'runtime',message:'Oops'},{kind:'runtime',message:'Different error'}];
 const {findings}=await writeFindings(dir,report,screen);
 assert.equal(findings.length,3);assert.equal(new Set(findings.map(f=>f.id)).size,3);
 assert.deepEqual(findings.map(f=>f.occurrences),[2,2,1]);
});
