#!/usr/bin/env node
import { resolveProject } from './paths.js';
import { parseArgs } from 'node:util';
import { loadConfig, selectScreen, withLock } from './config.js';
import { syncFigma } from './figma.js';
import { verify, beginSession } from './runner.js';
import { install } from './install.js';
import { compactReport } from './findings.js';
try{
  const {values,positionals}=parseArgs({allowPositionals:true,options:{project:{type:'string',default:process.cwd()},screen:{type:'string'},url:{type:'string'},figma:{type:'string'},width:{type:'string'},height:{type:'string'},session:{type:'string'},format:{type:'string',default:'simple'},help:{type:'boolean'}}});
  if(!['simple','html','json'].includes(values.format))throw Error('--format must be simple, html or json');
  const command=positionals[0];const root=resolveProject(values.project);
  if(values.help||!command){console.log(`Figma Delta 0.1.2 (Node >=22)\n\nnode src/cli.js init --project <app> [--url http://localhost:3000] [--figma <frame-url>] [--width 1440 --height 900]\nnode src/cli.js sync --project <app> [--screen desktop]\nnode src/cli.js begin --project <app> --screen desktop\nnode src/cli.js check --project <app> [--screen desktop] [--session <id>] [--format simple|html|json]\n\ncheck exits 0 on pass, 1 on mismatches, 2 on setup/runtime errors. Start your app separately. MCP: node src/mcp.js --project <app>.`);}
  else if(command==='init')console.log(JSON.stringify(await install(root,{url:values.url,figmaUrl:values.figma,...(values.width?{width:Number(values.width)}:{}),...(values.height?{height:Number(values.height)}:{})}),null,2));
  else{
    const config=await loadConfig(root);const screens=values.screen?[selectScreen(config,values.screen)]:config.screens;
    if(command==='begin'){
      if(!values.screen)throw Error('begin requires --screen');console.log(JSON.stringify(await beginSession(root,values.screen),null,2));
    }else if(command==='sync'){
      for(const s of screens)console.log(JSON.stringify(await withLock(root,()=>syncFigma(root,s)),null,2));
    }else if(command==='check'){
      if(values.session&&!values.screen)throw Error('--session requires --screen');
      for(const s of screens){const r=await verify(root,s.name,{sessionId:values.session,format:values.format});console.log(JSON.stringify(values.format!=='html'?compactReport(r):{screen:s.name,pass:r.pass,mismatchPercent:r.pixels.mismatchPercent,issues:r.issues,findingsVersion:r.findingsVersion,findings:r.findings,session:r.session,artifacts:r.artifacts},null,values.format!=='html'?undefined:2));if(!r.pass)process.exitCode=1;}
    }else throw Error('Unknown command: '+command);
  }
}catch(e){console.error(e.message);process.exitCode=2;}
