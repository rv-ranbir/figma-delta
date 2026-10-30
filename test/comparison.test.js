import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const cli=fileURLToPath(new URL('../src/cli.js',import.meta.url));
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'delta compare 测试-'));t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}));await sharp({create:{width:320,height:200,channels:4,background:'white'}}).png().toFile(path.join(root,'frame.png'));return root;}

test('CLI prepares an isolated comparison from a URL and PNG without init or a config file',async t=>{
 const root=await fixture(t);
 const result=await promisify(execFile)(process.execPath,[cli,'prepare','--project',root,'--url','http://localhost:3000/settings?token=SECRET','--reference','frame.png']);
 assert.equal(result.stdout.includes('SECRET'),false);
 const prepared=JSON.parse(result.stdout);assert.match(prepared.comparisonId,/^[a-f0-9-]{36}$/);assert.deepEqual(prepared.viewport,{width:320,height:200});
 assert.equal((await fs.readFile(path.join(prepared.root,'fidelity.config.json'),'utf8')).includes('SECRET'),true);
 await assert.rejects(()=>fs.access(path.join(root,'fidelity.config.json')));assert.match(await fs.readFile(path.join(root,'.figma-fidelity','.gitignore'),'utf8'),/\*/);
});

test('per-run comparisons pin independent references and preserve host config and supplied mappings',async t=>{
 const root=await fixture(t);const host='{"existing":"unchanged"}';await fs.writeFile(path.join(root,'fidelity.config.json'),host);
 const {prepareComparison,resolveComparison}=await import('../src/comparison.js');
 const regions=[{name:'title',selector:'h1',styles:{color:'#182238'}}];
 const first=await prepareComparison(root,{url:'http://localhost:3000/a',reference:'frame.png',regions});
 await sharp({create:{width:640,height:400,channels:4,background:'black'}}).png().toFile(path.join(root,'frame.png'));
 const second=await prepareComparison(root,{url:'http://localhost:3000/b',reference:'frame.png'});
 assert.notEqual(first.comparisonId,second.comparisonId);assert.deepEqual(first.viewport,{width:320,height:200});assert.deepEqual(second.viewport,{width:640,height:400});
 const saved=await resolveComparison(root,first.comparisonId);const config=JSON.parse(await fs.readFile(path.join(saved.root,'fidelity.config.json'),'utf8'));
 assert.equal(config.screens[0].url,'http://localhost:3000/a');assert.deepEqual(config.screens[0].regions,regions);assert.equal(await fs.readFile(path.join(root,'fidelity.config.json'),'utf8'),host);
 const bytes=await sharp(path.join(saved.root,'reference.png')).metadata();assert.equal(bytes.width,320);
 await assert.rejects(()=>resolveComparison(root,'../secret'),/comparison/i);
 await assert.rejects(()=>prepareComparison(root,{url:'file:///secret',reference:'frame.png'}));
 await assert.rejects(()=>prepareComparison(root,{url:'http://localhost',reference:'frame.png',width:100,height:200}),/dimensions/i);
});

test('per-run Figma selection infers viewport and records version without leaking the token to image downloads',async t=>{
 const root=await fixture(t);const {prepareComparison,resolveComparison}=await import('../src/comparison.js');
 const bytes=await fs.readFile(path.join(root,'frame.png'));const calls=[];
 const fetcher=async(url,options)=>{calls.push({url,options});if(url.startsWith('https://api.figma.com/v1/files/'))return {ok:true,json:async()=>({version:'version-1',lastModified:'2026-10-23',nodes:{'1:2':{document:{id:'1:2',name:'Settings',absoluteBoundingBox:{x:0,y:0,width:320,height:200}},components:{}}}})};if(url.startsWith('https://api.figma.com/v1/images/'))return {ok:true,json:async()=>({images:{'1:2':'https://cdn.example/frame.png'}})};return {ok:true,arrayBuffer:async()=>bytes};};
 const prepared=await prepareComparison(root,{url:'http://localhost/settings',figmaUrl:'https://www.figma.com/design/abc/Design?node-id=1-2'},{fetcher,token:'test-secret'});
 assert.deepEqual(prepared.viewport,{width:320,height:200});assert.equal(prepared.design.version,'version-1');assert.equal(prepared.design.frameName,'Settings');
 assert.equal(calls.filter(c=>c.url.includes('/files/')).length,1);assert.equal(calls.find(c=>c.url.startsWith('https://cdn')).options.headers,undefined);
 const saved=await resolveComparison(root,prepared.comparisonId);assert.equal((await fs.readFile(path.join(saved.root,'comparison.json'),'utf8')).includes('test-secret'),false);
 const local=await prepareComparison(root,{url:'http://localhost/settings',reference:'frame.png',figmaUrl:'https://www.figma.com/design/abc/Design?node-id=1-2'});assert.equal(local.design.source,'png');assert.equal(local.design.version,null);
 await assert.rejects(()=>prepareComparison(root,{url:'http://localhost',figmaUrl:'https://evil.test/frame'}),/figma/i);
});

test('interactive CLI requires a real terminal before opening a browser or creating a comparison',async t=>{
 const root=await fixture(t);const failure=await promisify(execFile)(process.execPath,[cli,'check','--project',root,'--url','http://localhost','--reference','frame.png','--interactive']).catch(e=>e);
 assert.equal(failure.code,2);assert.match(failure.stderr,/terminal|TTY/i);await assert.rejects(()=>fs.access(path.join(root,'.figma-fidelity')));
});

test('switching a saved comparison to interactive persists its readiness requirement',async t=>{
 const root=await fixture(t);const {prepareComparison,resolveComparison,requireInteractive}=await import('../src/comparison.js');
 const prepared=await prepareComparison(root,{url:'http://localhost:3000',reference:'frame.png'});
 assert.equal(prepared.interactive,false);await requireInteractive(root,prepared.comparisonId);
 const reopened=await resolveComparison(root,prepared.comparisonId);assert.equal(reopened.interactive,true);assert.equal(reopened.comparisonId,prepared.comparisonId);assert.equal(reopened.design.source,'png');
});
