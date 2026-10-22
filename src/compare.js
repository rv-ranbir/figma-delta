import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pixelmatch from 'pixelmatch';

export async function compare(reference,actual,out,{threshold=0.1,masks=[]}={}){
  await fs.mkdir(out,{recursive:true});
  const [ref,act]=await Promise.all([sharp(reference).flatten({background:'#ffffff'}).ensureAlpha().raw().toBuffer({resolveWithObject:true}),sharp(actual).flatten({background:'#ffffff'}).ensureAlpha().raw().toBuffer({resolveWithObject:true})]);
  const {width,height}=ref.info;
  if(width!==act.info.width||height!==act.info.height)throw Error(`Reference ${width}×${height} differs from actual ${act.info.width}×${act.info.height}. No auto-resize allowed.`);
  const masked=new Uint8Array(width*height);
  for(const r of masks){
    if(r.x+r.width>width||r.y+r.height>height)throw Error('Mask extends outside the reference');
    for(let y=Math.floor(r.y);y<Math.ceil(r.y+r.height);y++)for(let x=Math.floor(r.x);x<Math.ceil(r.x+r.width);x++)masked[y*width+x]=1;
  }
  const total=masked.reduce((sum,v)=>sum+(v===0?1:0),0);if(!total)throw Error('Masks exclude every pixel; comparison would be meaningless');
  for(let p=0;p<masked.length;p++)if(masked[p]){ref.data.fill(255,p*4,p*4+4);act.data.fill(255,p*4,p*4+4);}
  const diff=Buffer.alloc(width*height*4);
  const mismatchCount=pixelmatch(ref.data,act.data,diff,width,height,{threshold,includeAA:false,diffMask:true});
  const raw={width,height,channels:4};
  await sharp(diff,{raw}).png().toFile(path.join(out,'diff.png'));
  // Blend normalized images; do not scale or align away real differences.
  const overlay=Buffer.alloc(ref.data.length);for(let i=0;i<overlay.length;i++)overlay[i]=i%4===3?255:Math.round((ref.data[i]+act.data[i])/2);
  await sharp(overlay,{raw}).png().toFile(path.join(out,'overlay.png'));
  const tiles=[];const size=128;
  for(let y=0;y<height;y+=size)for(let x=0;x<width;x+=size){let changed=0,compared=0;
    for(let j=y;j<Math.min(height,y+size);j++)for(let i=x;i<Math.min(width,x+size);i++){const p=j*width+i;if(!masked[p]){compared++;if(diff[p*4+3])changed++;}}
    if(changed)tiles.push({x,y,width:Math.min(size,width-x),height:Math.min(size,height-y),mismatchPercent:100*changed/compared,changedPixels:changed});
  }
  return {width,height,mismatchCount,comparedPixels:total,maskedPixels:width*height-total,mismatchPercent:100*mismatchCount/total,hotspots:tiles.sort((a,b)=>b.changedPixels-a.changedPixels).slice(0,12)};
}
export async function compareRegion(reference,actual,rect,{threshold=0.1,masks=[]}={}){
  const meta=await sharp(reference).metadata();
  const left=Math.max(0,Math.floor(rect.x)),top=Math.max(0,Math.floor(rect.y));
  const width=Math.min(meta.width,Math.ceil(rect.x+rect.width))-left,height=Math.min(meta.height,Math.ceil(rect.y+rect.height))-top;
  if(rect.x<0||rect.y<0||rect.x+rect.width>meta.width+0.01||rect.y+rect.height>meta.height+0.01||width<=0||height<=0)throw Error('Region extends outside the reference');
  const [a,b]=await Promise.all([reference,actual].map(p=>sharp(p).flatten({background:'#fff'}).ensureAlpha().extract({left,top,width,height}).raw().toBuffer()));
  let count=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const masked=masks.some(r=>x+left>=Math.floor(r.x)&&x+left<Math.ceil(r.x+r.width)&&y+top>=Math.floor(r.y)&&y+top<Math.ceil(r.y+r.height));
    if(masked){a.fill(255,(y*width+x)*4,(y*width+x)*4+4);b.fill(255,(y*width+x)*4,(y*width+x)*4+4);}else count++;
  }
  if(!count)throw Error('Region is fully masked');
  return 100*pixelmatch(a,b,null,width,height,{threshold,includeAA:false})/count;
}
