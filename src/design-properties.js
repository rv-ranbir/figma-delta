import {normalizeColor} from './colors.js';

function solidPaint(fills){
  const visible=Array.isArray(fills)?fills.filter(f=>f.visible!==false):[];
  if(visible.length!==1||visible[0].type!=='SOLID')return null;
  const f=visible[0],c=f.color;
  if(!c||![c.r,c.g,c.b,c.a??1,f.opacity??1].every(Number.isFinite))return null;
  return normalizeColor(`color(srgb ${c.r} ${c.g} ${c.b} / ${(c.a??1)*(f.opacity??1)})`);
}

export function designProperties(node){
  const styles={},unavailable={};if(!node)return {styles,unavailable};
  const text=node.type==='TEXT';
  const variants=[];
  if(text&&node.characterStyleOverrides?.length){
    const ids=new Set(node.characterStyleOverrides);
    if((node.text?.length??0)>node.characterStyleOverrides.length)ids.add(0);
    for(const id of ids){
      if(id!==0&&!node.styleOverrideTable?.[id]){
        for(const key of ['color','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing'])unavailable[key]='Figma text override metadata is missing; sync the reference again.';
      }
      const override=id===0?{}:node.styleOverrideTable?.[id]??{};
      variants.push({style:{...node.style,...override},fills:override.fills??node.fills});
    }
  }else variants.push({style:node.style??{},fills:node.fills});
  const uniform=(key,values)=>{
    if(values.every(v=>v!==undefined&&v!==null)&&new Set(values).size===1)styles[key]=values[0];
    else unavailable[key]=`Figma ${key} is mixed or unsupported; map a uniform text node or supply an explicit expectation.`;
  };
  for(const [property,source,convert] of [
    ['fontFamily','fontFamily',v=>v],['fontSize','fontSize',v=>v+'px'],['fontWeight','fontWeight',String],['letterSpacing','letterSpacing',v=>v+'px']
  ]){
    if(variants.some(v=>v.style[source]!==undefined))uniform(property,variants.map(v=>v.style[source]===undefined?undefined:convert(v.style[source])));
  }
  if(variants.some(v=>v.style.lineHeightUnit!==undefined)){
    uniform('lineHeight',variants.map(({style:s})=>s.lineHeightUnit==='PIXELS'&&Number.isFinite(s.lineHeightPx)?s.lineHeightPx+'px':undefined));
  }
  const property=text?'color':['FRAME','COMPONENT','COMPONENT_SET','INSTANCE','RECTANGLE'].includes(node.type)?'backgroundColor':null;
  if(property&&(text||node.fills!==undefined)){
    uniform(property,variants.map(v=>solidPaint(v.fills)));
    if(node.ancestorPaintUnsupported||(node.opacity??1)!==1||(node.blendMode&&!['NORMAL','PASS_THROUGH'].includes(node.blendMode))||(node.effects??[]).some(e=>e.visible!==false&&['LAYER_BLUR','BACKGROUND_BLUR'].includes(e.type))||(text&&(node.strokes??[]).some(s=>s.visible!==false))){
      unavailable[property]='Figma opacity, blending, blur or text strokes require composited paint review.';
    }
  }
  if(node.paintMetadataAvailable===false)for(const key of new Set([...Object.keys(styles),...(property?[property]:[])]))unavailable[key]='Saved snapshot lacks text and ancestor paint metadata; sync the reference again before starting a new repair session.';
  return {styles,unavailable};
}
