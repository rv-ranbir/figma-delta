import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { snapshotDir, writeJson } from './config.js';

export function parseFigmaUrl(value){
  const url=new URL(value);if(!['figma.com','www.figma.com'].includes(url.hostname))throw Error('Expected a figma.com design URL');
  const [,kind,key]=url.pathname.split('/');const node=url.searchParams.get('node-id');
  if(!['design','file','proto'].includes(kind)||!key||!/^[a-zA-Z0-9]+$/.test(key)||!node||!/^\d+[:-]\d+$/.test(node))throw Error('Use a Figma frame link containing ?node-id=123-456');
  return {key,nodeId:node.replace('-',':')};
}
export function flatten(node,origin={x:0,y:0},out=[],ancestorPaintUnsupported=false){
  if(node.visible===false)return out;
  const b=node.absoluteBoundingBox;
  out.push({id:node.id,name:node.name,type:node.type,componentId:node.componentId,
    rect:b?{x:b.x-origin.x,y:b.y-origin.y,width:b.width,height:b.height}:undefined,
    text:node.characters,style:node.style,fills:node.fills,strokes:node.strokes,
    characterStyleOverrides:node.characterStyleOverrides,styleOverrideTable:node.styleOverrideTable,
    opacity:node.opacity,blendMode:node.blendMode,effects:node.effects,ancestorPaintUnsupported,paintMetadataVersion:1,
    cornerRadius:node.cornerRadius,layoutMode:node.layoutMode,itemSpacing:node.itemSpacing,primaryAxisAlignItems:node.primaryAxisAlignItems,layoutWrap:node.layoutWrap,
    paddingLeft:node.paddingLeft,paddingRight:node.paddingRight,paddingTop:node.paddingTop,paddingBottom:node.paddingBottom,
    boundVariables:node.boundVariables,styles:node.styles});
  const unsupported=ancestorPaintUnsupported||(node.opacity??1)!==1||(node.blendMode&&!['NORMAL','PASS_THROUGH'].includes(node.blendMode))||(node.effects??[]).some(e=>e.visible!==false&&['LAYER_BLUR','BACKGROUND_BLUR'].includes(e.type));
  for(const child of node.children??[])flatten(child,origin,out,unsupported);return out;
}
async function api(endpoint,token,fetcher){
  const response=await fetcher('https://api.figma.com/v1/'+endpoint,{headers:{'X-Figma-Token':token},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Figma API HTTP ${response.status}${response.status===429?' (rate limited; retry after '+(response.headers.get('retry-after')??'the reset')+')':''}`);
  const data=await response.json();if(data.err)throw Error('Figma export failed');return data;
}
export async function getFigmaFrame(figmaUrl,{fetcher=fetch,token=process.env.FIGMA_ACCESS_TOKEN}={}){
  const {key,nodeId}=parseFigmaUrl(figmaUrl);
  if(!token)throw Error('Set FIGMA_ACCESS_TOKEN with file_content:read, or export a local reference PNG. Never put tokens in config.');
  const data=await api(`files/${key}/nodes?ids=${encodeURIComponent(nodeId)}`,token,fetcher);
  const node=data.nodes?.[nodeId]?.document;if(!node?.absoluteBoundingBox)throw Error('Figma frame not found or has no bounding box');
  return {key,nodeId,data,node};
}
export async function syncFigma(root,screen,{fetcher=fetch,token=process.env.FIGMA_ACCESS_TOKEN,frame}={}){
  if(!screen.figmaUrl)throw Error('Set figmaUrl for this screen, or use a local reference PNG');
  const {key,nodeId,data,node}=frame??await getFigmaFrame(screen.figmaUrl,{fetcher,token});
  const box=node.absoluteBoundingBox;
  if(Math.abs(box.width-screen.viewport.width)>0.01||Math.abs(box.height-screen.viewport.height)>0.01)throw Error(`Frame is ${box.width}×${box.height}; config viewport is ${screen.viewport.width}×${screen.viewport.height}. Match them before syncing.`);
  const image=await api(`images/${key}?ids=${encodeURIComponent(nodeId)}&format=png&scale=1&use_absolute_bounds=true`,token,fetcher);
  const imageUrl=image.images?.[nodeId];if(!imageUrl)throw Error('Figma returned no frame image');
  // Export URLs are fetched without the Figma credential.
  if(new URL(imageUrl).protocol!=='https:')throw Error('Figma export must use HTTPS');
  const res=await fetcher(imageUrl,{signal:AbortSignal.timeout(60000)});if(!res.ok)throw Error(`Export download HTTP ${res.status}`);
  const bytes=Buffer.from(await res.arrayBuffer());const meta=await sharp(bytes).metadata();
  if(meta.width!==screen.viewport.width||meta.height!==screen.viewport.height)throw Error('Export dimensions differ from viewport; reference was not replaced');
  const dir=snapshotDir(root,screen.name);await fs.mkdir(dir,{recursive:true});
  const nodes=flatten(node,box);const manifest={source:screen.figmaUrl,version:data.version,lastModified:data.lastModified,nodeId,viewport:screen.viewport,syncedAt:new Date().toISOString(),nodes,components:data.nodes[nodeId].components??{}};
  // Write all payloads before replacing the manifest, so incomplete downloads do not become references.
  await fs.writeFile(path.join(dir,'reference.png'),bytes);await writeJson(path.join(dir,'design.json'),data);await writeJson(path.join(dir,'manifest.json'),manifest);
  return {reference:path.join(dir,'reference.png'),manifest:path.join(dir,'manifest.json'),nodes:nodes.length,version:data.version,
    note:'Raw design includes image refs, vector nodes and bound variable IDs. Use official Figma MCP for downloadable source assets, resolved variable values and Code Connect mappings.'};
}
