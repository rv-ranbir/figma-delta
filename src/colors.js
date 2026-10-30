import { parse, converter } from 'culori';
export const COLOR_FORMAT='srgb-css';
export const isColorProperty=property=>/color$/i.test(property)||['fill','stroke'].includes(property);
export const normalizePaint=(property,value)=>['fill','stroke'].includes(property)&&typeof value==='string'&&value.trim().toLowerCase()==='none'?'none':normalizeColor(value);
const toRgb=converter('rgb');

const channel=value=>Number(value.toFixed(6));
const clamp=value=>Math.max(0,Math.min(1,value));
// Extended sRGB preserves converted wide-gamut channels; no gamut clipping or 8-bit alpha loss.
export function normalizeColor(value){
  if(typeof value!=='string'||!value.trim())return null;
  try{
    const input=value.trim().toLowerCase();
    const parsed=parse(input);if(!parsed)return null;
    // CSS bounds legacy functional inputs, but allows extended color() channels.
    if(/^rgba?\(/.test(input))for(const key of ['r','g','b'])parsed[key]=clamp(parsed[key]);
    if(/^hsla?\(/.test(input))for(const key of ['s','l'])parsed[key]=clamp(parsed[key]);
    if(/^hwb\(/.test(input))for(const key of ['w','b'])parsed[key]=clamp(parsed[key]);
    const rgb=toRgb(parsed);if(!rgb)return null;
    const channels=[rgb.r,rgb.g,rgb.b];const alpha=rgb.alpha??1;
    if(!channels.every(Number.isFinite)||!Number.isFinite(alpha))return null;
    const a=channel(Math.max(0,Math.min(1,alpha)));
    const rgbChannels=a===0?[0,0,0]:channels.map(channel);
    return `color(srgb ${rgbChannels.join(' ')} / ${a})`;
  }catch{return null;}
}

export function normalizeStyles(styles={}){
  const normalized={...styles},rawStyles={};
  for(const [property,value] of Object.entries(styles))if(isColorProperty(property)){
    rawStyles[property]=value;normalized[property]=normalizePaint(property,value);
  }
  return {styles:normalized,rawStyles};
}
