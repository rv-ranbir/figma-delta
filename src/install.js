import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configSchema, inside, writeJson } from './config.js';
import { resolveProject } from './paths.js';
const toolkitRoot=fileURLToPath(new URL('../',import.meta.url));
async function exists(p){try{await fs.access(p);return true;}catch{return false;}}
export async function install(project,{url='http://localhost:3000',figmaUrl,width=1440,height=900}={}){
  project=resolveProject(project);await fs.mkdir(project,{recursive:true});
  const configFile=inside(project,'fidelity.config.json');
  const skill=inside(project,'.cursor','skills','figma-fidelity','SKILL.md');
  const rule=inside(project,'.cursor','rules','figma-fidelity.mdc');
  const mcpFile=inside(project,'.cursor','mcp.json');
  // Validate and read before any mutation. Never replace existing project setup silently.
  const config=configSchema.parse({version:1,maxIterations:5,screens:[{name:'desktop',url,figmaUrl,reference:'design/reference.png',viewport:{width,height}}]});
  for(const file of [configFile,skill,rule])if(await exists(file))throw Error(`Already exists: ${file}. Edit it explicitly instead of reinstalling.`);
  const mcp=await exists(mcpFile)?JSON.parse(await fs.readFile(mcpFile,'utf8')):{};
  if(mcp.mcpServers?.['figma-fidelity'])throw Error('MCP entry figma-fidelity already exists');
  mcp.mcpServers??={};mcp.mcpServers['figma-fidelity']={command:process.execPath,args:[path.join(toolkitRoot,'src','mcp.js'),'--project',project]};
  await fs.mkdir(path.dirname(skill),{recursive:true});await fs.mkdir(path.dirname(rule),{recursive:true});
  await fs.copyFile(path.join(toolkitRoot,'templates','SKILL.md'),skill);
  await fs.copyFile(path.join(toolkitRoot,'templates','figma-fidelity.mdc'),rule);
  await writeJson(configFile,config);await writeJson(mcpFile,mcp);
  const ignore=inside(project,'.gitignore');const previous=await exists(ignore)?await fs.readFile(ignore,'utf8'):'';
  const additions=['.figma-fidelity/','fidelity.auth.json'].filter(v=>!previous.split(/\r?\n/).includes(v));
  if(additions.length)await fs.appendFile(ignore,(previous&&!previous.endsWith('\n')?'\n':'')+additions.join('\n')+'\n');
  return {project,config:configFile,mcp:mcpFile,next:'Start the application, set exact frame dimensions, connect official Figma MCP or export a reference PNG, then invoke /figma-fidelity in Cursor. Reload MCP tools after installation.'};
}
