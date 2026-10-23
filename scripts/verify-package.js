import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const exec=promisify(execFile);
const root=fileURLToPath(new URL('../',import.meta.url));
const npmCli=process.env.npm_execpath;
if(!npmCli)throw Error('Run through npm: npm run test:package');
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'figma-delta-consumer-'));
const output=process.argv[2]?path.resolve(root,process.argv[2]):path.join(temporary,'packages');
// npm lifecycle scripts export project policy as env flags. Do not promote that
// policy into the isolated consumer's CLI layer; installation ignores all scripts.
const npmEnvironment={...process.env};
for(const key of Object.keys(npmEnvironment))if(/^npm_config_allow_scripts$/i.test(key))delete npmEnvironment[key];
const npm=(args,cwd)=>exec(process.execPath,[npmCli,...args],{cwd,env:npmEnvironment,maxBuffer:8*1024*1024,timeout:180000});
const run=(args,cwd)=>exec(process.execPath,args,{cwd,maxBuffer:8*1024*1024,timeout:90000});
let server,client,result;
try{
  await fs.mkdir(output,{recursive:true});
  const metadata=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
  assert.equal(metadata.name,'figma-delta');assert.equal(metadata.private,undefined);assert.equal(metadata.license,'MIT');
  const packed=JSON.parse((await npm(['pack','--json','--pack-destination',output],root)).stdout);
  const artifact=Array.isArray(packed)?packed[0]:Object.values(packed)[0];
  const files=new Set(artifact.files.map(file=>file.path));
  for(const file of ['src/cli.js','src/mcp.js','src/report.css','src/report-client.js','templates/SKILL.md','templates/figma-fidelity.mdc','scripts/setup.js','scripts/doctor.js','LICENSE'])assert.ok(files.has(file),`Missing packaged ${file}`);
  for(const file of files)assert.ok(!/^(?:test|examples|node_modules|\.tools|\.cursor-benchmark|\.github)\//.test(file)&&!/(?:^|\/)(?:\.env(?:\..*)?|fidelity\.auth\.json|FIGMA-TOOLKIT-PROJECT-HANDOFF\.md)$/.test(file),`Unexpected packaged ${file}`);
  const tarball=path.join(output,artifact.filename);
  const consumer=path.join(temporary,'consumer');await fs.mkdir(consumer);
  await fs.writeFile(path.join(consumer,'package.json'),JSON.stringify({name:'fidelity-consumer-test',version:'1.0.0',private:true}));
  await npm(['install',tarball,'--ignore-scripts','--no-fund'],consumer);
  const audit=JSON.parse((await npm(['audit','--json'],consumer)).stdout);
  assert.equal(audit.metadata?.vulnerabilities?.total,0,'Installed package dependencies must have zero known vulnerabilities');
  const installed=path.join(consumer,'node_modules','figma-delta');
  const cli=path.join(installed,'src','cli.js');
  const help=await npm(['exec','--offline','--','figma-delta','--help'],consumer);assert.match(help.stdout,/Figma Delta/);
  await run([cli,'setup'],consumer);
  assert.equal(JSON.parse((await run([cli,'doctor'],consumer)).stdout).ok,true);
  let color='black';
  server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><body style="margin:0"><h1 id="title" style="color:${color}">Package verification</h1></body></html>`);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const app=path.join(consumer,'app');
  await run([cli,'init','--project',app,'--url',`http://127.0.0.1:${server.address().port}`,'--width','320','--height','200'],consumer);
  const configFile=path.join(app,'fidelity.config.json');const config=JSON.parse(await fs.readFile(configFile,'utf8'));
  config.screens[0].regions=[{name:'title',selector:'#title',styles:{color:'#000000'}}];
  await fs.writeFile(configFile,JSON.stringify(config));await fs.mkdir(path.join(app,'design'));
  // Native image libraries must exit before cleanup on Windows; load them only
  // in a child process, otherwise their DLLs keep the consumer directory locked.
  await run(['--input-type=module','-e',`
    import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
    const [installed,app]=process.argv.slice(1);
    const {screenSchema}=await import(pathToFileURL(path.join(installed,'src/config.js')));
    const {capture}=await import(pathToFileURL(path.join(installed,'src/capture.js')));
    const config=JSON.parse(await fs.readFile(path.join(app,'fidelity.config.json'),'utf8'));
    await capture(app,screenSchema.parse(config.screens[0]),path.join(app,'design/reference.png'));
  `,installed,app],consumer);
  const oneoff=path.join(consumer,'oneoff');await fs.mkdir(oneoff);await fs.copyFile(path.join(app,'design/reference.png'),path.join(oneoff,'frame.png'));
  const standalone=JSON.parse((await run([cli,'check','--project',oneoff,'--url',`http://127.0.0.1:${server.address().port}`,'--reference','frame.png','--format','json'],consumer)).stdout);
  assert.equal(standalone.pass,true);assert.ok(standalone.comparison.id);assert.deepEqual(standalone.viewport,{width:320,height:200});assert.equal(standalone.artifacts.report,null);
  await assert.rejects(()=>fs.access(path.join(oneoff,'fidelity.config.json')));
  const mcp=JSON.parse(await fs.readFile(path.join(app,'.cursor','mcp.json'),'utf8')).mcpServers['figma-fidelity'];
  assert.equal(await fs.realpath(mcp.args[0]),await fs.realpath(path.join(installed,'src','mcp.js')));
  client=new Client({name:'package-consumer',version:'1.0.0'});
  await client.connect(new StdioClientTransport({command:mcp.command,args:mcp.args,stderr:'pipe'}));
  assert.ok((await client.listTools()).tools.some(tool=>tool.name==='fidelity_verify'));
  const project=await client.callTool({name:'fidelity_project',arguments:{}});assert.equal(await fs.realpath(JSON.parse(project.content[0].text).project),await fs.realpath(app));
  color='red';
  let failed;
  try{await run([cli,'check','--project',app,'--screen','desktop','--format','html'],consumer);}catch(error){assert.equal(error.code,1);failed=JSON.parse(error.stdout);}
  assert.equal(failed?.pass,false);assert.ok(failed.findings.some(f=>f.property==='color'));
  const pointer=JSON.parse(await fs.readFile(path.join(app,'.figma-fidelity/latest/desktop.json'),'utf8'));
  const saved=JSON.parse(await fs.readFile(path.join(app,'.figma-fidelity/runs/desktop',pointer.runId,'report.json'),'utf8'));
  assert.ok((await fs.readFile(saved.artifacts.report,'utf8')).includes('review-data'));
  color='black';assert.equal(JSON.parse((await run([cli,'check','--project',app,'--screen','desktop'],consumer)).stdout).pass,true);
  result={package:artifact.filename,files:files.size,consumerAudit:0,cli:true,browser:true,templates:true,mcp:true,noConfigComparison:true,regressionDetected:true,correctionPassed:true,cleanup:true};
}finally{
  if(client)await client.close();
  if(server)await new Promise(resolve=>server.close(resolve));
  // Only the unique temporary consumer directory created above is removed.
  await fs.rm(temporary,{recursive:true,force:true,maxRetries:3,retryDelay:50});
}
console.log(JSON.stringify(result));
