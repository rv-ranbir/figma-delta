import { normalizeColor, isColorProperty, COLOR_FORMAT } from './colors.js';
export { normalizeColor } from './colors.js';
const labels={x:'Left position',y:'Top position',width:'Width',height:'Height',color:'Text color',backgroundColor:'Background color',fontFamily:'Font family',fontSize:'Font size',fontWeight:'Font weight',lineHeight:'Line height',letterSpacing:'Letter spacing',borderRadius:'Corner radius',margin:'Margin',marginTop:'Top margin',marginRight:'Right margin',marginBottom:'Bottom margin',marginLeft:'Left margin',padding:'Padding',paddingTop:'Top padding',paddingRight:'Right padding',paddingBottom:'Bottom padding',paddingLeft:'Left padding',gap:'Layout gap',rowGap:'Row gap',columnGap:'Column gap',display:'Display',visibility:'Visibility',opacity:'Opacity'};
const px=value=>/^-?\d+(\.\d+)?px$/.test(String(value));
export function compareStyle(property,expected,actual){
  if(property==='fontFamily'){
    const normalize=value=>String(value).replace(/["']/g,'').split(',')[0].trim().toLowerCase();
    return {matches:normalize(expected)===normalize(actual),method:'primary-font-family-equals'};
  }
  if(isColorProperty(property)){
    const a=normalizeColor(expected),b=normalizeColor(actual);
    return {matches:a!==null&&b!==null&&a===b,method:a!==null&&b!==null?'color-equals':'color-unavailable',colorFormat:COLOR_FORMAT,expectedColor:a,actualColor:b};
  }
  if(px(expected)&&px(actual))return {matches:Math.abs(parseFloat(actual)-parseFloat(expected))<=0.5,method:'within',tolerance:0.5,unit:'px',delta:parseFloat(actual)-parseFloat(expected)};
  return {matches:String(expected)===String(actual),method:'equals'};
}

export function propertyComparisons(actual={},expected={},tolerance=2){
  const rows=[];
  if(expected.rect||actual.rect)for(const property of ['x','y','width','height']){
    const desired=expected.rect?.[property],observed=actual.rect?.[property];
    const delta=Number.isFinite(desired)&&Number.isFinite(observed)?observed-desired:null;
    rows.push({property,label:labels[property],group:'geometry',expected:desired??null,actual:observed??null,unit:'px',tolerance,delta,
      status:desired===undefined?'not-specified':observed===undefined?'unavailable':Math.abs(delta)<=tolerance?'match':'different'});
  }
  const styles=actual.styles??{},reference=expected.styles??{};
  for(const property of new Set([...Object.keys(labels).filter(k=>!['x','y','width','height'].includes(k)),...Object.keys(reference),...Object.keys(styles)])){
    const desired=reference[property],observed=styles[property];
    const comparison=compareStyle(property,desired,observed);
    const color=isColorProperty(property);
    rows.push({property,label:labels[property]??property,group:'style',expected:color?comparison.expectedColor:desired??null,actual:color?comparison.actualColor:observed??null,
      ...(color?{expectedRaw:expected.rawStyles?.[property]??desired??null,actualRaw:actual.rawStyles?.[property]??observed??null}:{}),
      ...Object.fromEntries(Object.entries(comparison).filter(([key])=>!['matches','expectedColor','actualColor'].includes(key))),
      status:desired===undefined?'not-specified':observed===undefined||comparison.method==='color-unavailable'?'unavailable':comparison.matches?'match':'different'});
  }
  return rows;
}
