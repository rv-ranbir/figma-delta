#!/usr/bin/env node
import fs from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';
import {resolveProject} from './paths.js';
import {parseArgs} from 'node:util';
import {loadConfig,selectScreen,withLock} from './config.js';
import {syncFigma} from './figma.js';
import {verify,beginSession} from './runner.js';
import {install} from './install.js';
import {compactReport} from './findings.js';
import {prepareComparison,resolveComparison,requireInteractive,projectFile,saveLogin} from './comparison.js';
import {openCapturePage} from './capture.js';
import {redactUrls} from './privacy.js';
const json=(value,...format)=>JSON.stringify(redactUrls(value),...format);
const string={type:'string'};
let interactiveBrowser;
try{
 const {values:v,positionals}=parseArgs({allowPositionals:true,options:{project:{...string,default:process.cwd()},screen:string,url:string,figma:string,reference:string,width:string,height:string,session:string,comparison:string,mappings:string,ready:string,'storage-state':string,interactive:{type:'boolean'},'save-login':{type:'boolean'},format:{...string,default:'simple'},help:{type:'boolean'}}});
 if(!['simple','html','json'].includes(v.format))throw Error('--format must be simple, html or json');
 const command=positionals[0];const project=resolveProject(v.project);
 if(v.help||!command){console.log(`Figma Delta 0.2.0 (Node 24 >=24.22.1)

figma-delta setup  # install Chromium
figma-delta doctor # check browser/runtime

No config required:
figma-delta check --url <app-url> --figma <frame-url> [--interactive] [--format simple|html|json]
figma-delta check --url <app-url> --reference <local.png> [--interactive]
figma-delta prepare --url <app-url> --figma <frame-url>
figma-delta begin --comparison <id> --screen desktop
figma-delta check --comparison <id> [--session <id>] [--interactive]

Guarded flows: --interactive opens a visible browser. Navigate manually, then press Enter to capture that exact page.
Optional: --save-login stores local login state; reuse with --storage-state .figma-fidelity/auth.json.
Use --ready <selector> to wait for the target view. --mappings <regions.json> adds explicit node/selector/property checks.
Figma links need FIGMA_ACCESS_TOKEN; an exported PNG works without it. Viewport is inferred from the reference.

Existing projects:
figma-delta init --project <app> [--url http://localhost:3000] [--figma <frame-url>] [--width 1440 --height 900]
figma-delta sync --project <app> [--screen desktop]
figma-delta begin --project <app> --screen desktop
figma-delta check --project <app> --screen desktop [--session <id>] [--format simple|html|json]

check exits 0 on pass, 1 on mismatches, 2 on setup/runtime errors. Start your app separately. MCP: node src/mcp.js --project <app>.`);}
 else if(command==='setup')await import('../scripts/setup.js');
 else if(command==='doctor')await import('../scripts/doctor.js');
 else if(command==='init')console.log(json(await install(project,{url:v.url,figmaUrl:v.figma,...(v.width?{width:Number(v.width)}:{}),...(v.height?{height:Number(v.height)}:{})}),null,2));
 else{
  if(!['prepare','begin','sync','check'].includes(command))throw Error('Unknown command: '+command);
  if(v.interactive&&command!=='check')throw Error('--interactive is supported by check; use prepare to pin a reference without opening a browser');
  if(v.interactive&&(!process.stdin.isTTY||!process.stderr.isTTY))throw Error('--interactive needs a real terminal (TTY). In an agent use fidelity_prepare with interactive:true, then confirm readiness explicitly.');
  if(v['save-login']&&!v.interactive)throw Error('--save-login requires --interactive');
  const supplied=v.figma||v.reference||v.url||v.mappings||v['storage-state']||v.ready;
  if(v.comparison&&supplied)throw Error('A saved comparison is pinned. Use --comparison alone, or prepare a new comparison with new inputs.');
  if(supplied&&command!=='prepare'&&command!=='check')throw Error('Per-run inputs are supported by prepare and check');
  if(supplied&&v.session)throw Error('Use --comparison with --session to preserve the pinned reference');
  if((supplied||command==='prepare')&&v.screen&&v.screen!=='desktop')throw Error('Per-run comparisons use screen desktop');
  let comparison;
  if(v.comparison)comparison=await resolveComparison(project,v.comparison);
  else if(supplied||command==='prepare'){
   const regions=v.mappings?JSON.parse(await fs.readFile(projectFile(project,v.mappings),'utf8')):[];
   comparison=await prepareComparison(project,{url:v.url,figmaUrl:v.figma,reference:v.reference,width:v.width?Number(v.width):undefined,height:v.height?Number(v.height):undefined,readySelector:v.ready,regions,storageState:v['storage-state'],interactive:!!v.interactive});
  }
  if(command==='prepare'){if(!comparison)throw Error('Provide an application URL and Figma frame or PNG');console.log(json(comparison));}
  else{
   const root=comparison?.root??project;const config=await loadConfig(root);
   const screens=v.screen?[selectScreen(config,v.screen)]:config.screens;
   if(command==='begin'){
    if(!v.screen&&!comparison)throw Error('begin requires --screen');console.log(json(await beginSession(root,v.screen??'desktop'),null,2));
   }else if(command==='sync'){
    if(comparison)throw Error('Comparison references are pinned. Prepare a new comparison to refresh the design.');
    for(const screen of screens)console.log(json(await withLock(root,()=>syncFigma(root,screen)),null,2));
   }else{
    if(v.session&&!v.screen&&!comparison)throw Error('--session requires --screen');
    if(comparison?.interactive&&!v.interactive)throw Error('This comparison requires --interactive to navigate back to its guarded page state. Login state alone cannot restore a wizard.');
    if(v.interactive&&screens.length!==1)throw Error('--interactive requires one screen; select it with --screen');
    for(const screen of screens){
     if(comparison)console.error(redactUrls(`Comparison ${comparison.comparisonId}: ${comparison.design.frameName??comparison.design.figmaUrl??'local PNG'} · ${screen.viewport.width} × ${screen.viewport.height} · entry ${screen.url}`));
     let page;
     if(v.interactive){if(comparison)await requireInteractive(project,comparison.comparisonId);const opened=await openCapturePage(root,screen,{headless:false});interactiveBrowser=opened.browser;page=opened.page;
      const terminal=createInterface({input:process.stdin,output:process.stderr});const abort=new AbortController();const cancel=()=>abort.abort();
      process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
      try{await terminal.question('Navigate this browser to the required page/state, then press Enter here to capture. Ctrl+C cancels.\n',{signal:abort.signal});}
      finally{process.off('SIGINT',cancel);process.off('SIGTERM',cancel);terminal.close();}
      if(page.isClosed())throw Error('Interactive browser was closed before capture');
      if(v['save-login'])console.error(json(await saveLogin(project,page)));
     }
     const details=comparison?{id:comparison.comparisonId,entryUrl:comparison.entryUrl,design:comparison.design}:undefined;
     const report=await verify(root,screen.name,{sessionId:v.session,format:v.format,page,comparison:details});
     console.log(json(v.format!=='html'?compactReport(report):report,null,v.format!=='html'?undefined:2));if(!report.pass)process.exitCode=1;
    }
   }
  }
 }
}catch(error){console.error(redactUrls(error.message));process.exitCode=2;}
finally{if(interactiveBrowser)await interactiveBrowser.close();}
