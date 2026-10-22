import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { screenSchema, writeJson } from '../src/config.js';
import { capture } from '../src/capture.js';
import { beginSession, verify } from '../src/runner.js';
import { page, viewport, demoConfig } from './page.js';

// Test fixture, not an AI repair: a known correct design, a deliberate CSS regression,
// then its known correction. Real Figma and source-code repair are done by Cursor.
const root=fileURLToPath(new URL('../.demo-project/',import.meta.url));
await fs.mkdir(path.join(root,'design'),{recursive:true});let broken=false;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(page(broken));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
try{
 const s=screenSchema.parse({name:'desktop',url,viewport});
 await capture(root,s,path.join(root,'design','reference.png'));
 const config=demoConfig(url);
 // Measure the known reference title so the test does not rely on platform font metrics.
 const reference=await capture(root,screenSchema.parse({...config.screens[0],regions:[{name:'title',selector:'#title'}]}),path.join(root,'design','reference.png'));
 config.screens[0].regions[1].rect=reference.measures[0].rect;
 await writeJson(path.join(root,'fidelity.config.json'),config);
 broken=true;const session=await beginSession(root,'desktop');const before=await verify(root,'desktop',{sessionId:session.id});
 broken=false;const after=await verify(root,'desktop',{sessionId:session.id});
 if(before.pass||!after.pass)throw Error('Expected broken fixture to fail and corrected fixture to pass');
 console.log(JSON.stringify({note:'Deterministic CSS fixture; no AI edits or live Figma involved.',before:{pass:before.pass,mismatchPercent:before.pixels.mismatchPercent,issues:before.issues.length,report:before.artifacts.report},after:{pass:after.pass,mismatchPercent:after.pixels.mismatchPercent,report:after.artifacts.report}},null,2));
}finally{await new Promise(resolve=>server.close(resolve));}
