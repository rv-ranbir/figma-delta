import path from 'node:path';
import {createRegionComparator} from './compare.js';

export async function checkDesignAssets(manifest,screen,dir){
  const issues=[],regions=[];if(!manifest)return {issues,regions};
  const mapped=new Set(screen.regions.map(r=>r.nodeId?.replace('-',':')));
  const asset=node=>['VECTOR','BOOLEAN_OPERATION','ELLIPSE','LINE','STAR','POLYGON'].includes(node.type)||(node.fills??[]).some(f=>f.visible!==false&&f.type==='IMAGE');
  let compareCrop;
  for(const node of manifest.nodes.filter(node=>!mapped.has(node.id)&&asset(node))){
    if(!node.rect)continue;
    const {x,y,width,height}=node.rect,left=Math.max(0,x),top=Math.max(0,y),right=Math.min(screen.viewport.width,x+width),bottom=Math.min(screen.viewport.height,y+height);
    if(right<=left||bottom<=top)continue;
    const rect={x:left,y:top,width:right-left,height:bottom-top};
    let mismatchPercent;
    compareCrop??=await createRegionComparator(path.join(dir,'reference.png'),path.join(dir,'actual.png'),{threshold:screen.pixelThreshold,masks:screen.masks});
    try{mismatchPercent=compareCrop(rect);}
    catch(error){if(error.message==='Region is fully masked')continue;throw error;}
    const name='figma-asset:'+node.id;
    regions.push({name,nodeId:node.id,expected:{rect,styles:{}},actual:{styles:{}},mismatchPercent,source:'figma-asset-bounds'});
    if(mismatchPercent>screen.maxMismatchPercent)issues.push({kind:'region-pixels',region:name,nodeId:node.id,message:`Figma asset ${node.name??node.id}: local pixel mismatch ${mismatchPercent.toFixed(3)}% exceeds ${screen.maxMismatchPercent}%`});
  }
  return {issues,regions};
}
