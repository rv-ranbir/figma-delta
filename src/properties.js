import { normalizePaint, isColorProperty, COLOR_FORMAT } from './colors.js';
import { checkSemantics } from './semantics.js';
export { normalizeColor } from './colors.js';
const labels={x:'Left position',y:'Top position',width:'Width',height:'Height',color:'Text color',backgroundColor:'Background color',fontFamily:'Font family',fontSize:'Font size',fontWeight:'Font weight',lineHeight:'Line height',letterSpacing:'Letter spacing',borderRadius:'Corner radius',margin:'Margin',marginTop:'Top margin',marginRight:'Right margin',marginBottom:'Bottom margin',marginLeft:'Left margin',padding:'Padding',paddingTop:'Top padding',paddingRight:'Right padding',paddingBottom:'Bottom padding',paddingLeft:'Left padding',gap:'Layout gap',rowGap:'Row gap',columnGap:'Column gap',display:'Display',visibility:'Visibility',opacity:'Opacity'};
const px=value=>/^-?\d+(\.\d+)?px$/.test(String(value));
const textProperties=new Set(['color','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing']);
const normalizedValue=(property,value)=>property==='letterSpacing'&&value==='normal'?'0px':value;
export function compareMeasuredStyle(actual,property,expected){
  const runs=textProperties.has(property)&&actual.textRuns?.length?actual.textRuns:[actual];
  let result;
  for(const run of runs){
    const rawValue=run.styles?.[property],value=normalizedValue(property,rawValue),expectedValue=normalizedValue(property,expected),comparison=compareStyle(property,expectedValue,value);
    const reason=actual.unavailable?.[property]??run.unavailable?.[property]??(expected!==undefined&&value===undefined?'Expected property was not captured.':comparison.method==='color-unavailable'?'Color cannot be resolved to canonical sRGB.':undefined);
    const next={...comparison,value,rawValue,expectedValue,...(reason?{reason}:{} )};
    if(reason)return next;
    // Keep a failing run once found, even if later runs match.
    if(!result||(result.matches&&!comparison.matches))result=next;
  }
  return result;
}
export function compareStyle(property,expected,actual){
  if(property==='letterSpacing'){
    if(expected==='normal')expected='0px';if(actual==='normal')actual='0px';
  }
  if(property==='fontFamily'){
    const normalize=value=>String(value).replace(/["']/g,'').split(',')[0].trim().toLowerCase();
    return {matches:normalize(expected)===normalize(actual),method:'primary-font-family-equals'};
  }
  if(isColorProperty(property)){
    const a=normalizePaint(property,expected),b=normalizePaint(property,actual);
    return {matches:a!==null&&b!==null&&a===b,method:a!==null&&b!==null?(a==='none'||b==='none'?'paint-equals':'color-equals'):'color-unavailable',colorFormat:COLOR_FORMAT,expectedColor:a,actualColor:b};
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
    const source=reference[property];
    const comparison=compareMeasuredStyle(actual,property,source),observed=comparison.value,desired=comparison.expectedValue;
    const color=isColorProperty(property);
    rows.push({property,label:labels[property]??property,group:'style',expected:color?comparison.expectedColor:desired??null,actual:color?comparison.actualColor:observed??null,
      ...(color?{expectedRaw:expected.rawStyles?.[property]??desired??null,actualRaw:actual.textRuns?.length&&textProperties.has(property)?observed:actual.rawStyles?.[property]??observed??null}:{}),
      ...(property==='letterSpacing'?{expectedRaw:source??null,actualRaw:comparison.rawValue??null}:{}),
      ...Object.fromEntries(Object.entries(comparison).filter(([key])=>!['matches','expectedColor','actualColor','value','expectedValue','rawValue'].includes(key))),
      ...(expected.unavailable?.[property]?{reason:expected.unavailable[property]}:{}),
      status:expected.unavailable?.[property]?'unavailable':desired===undefined?'not-specified':observed===undefined||comparison.reason?'unavailable':comparison.matches?'match':'different'});
  }
  const semanticIssues=checkSemantics({name:'properties'},actual,expected);
  const semanticRow=(property,label,desired,observed)=>{
    const issue=semanticIssues.find(i=>i.property===property);
    rows.push({property,label,group:'rendering',expected:desired??null,actual:observed??null,status:issue?(issue.kind==='coverage'?'unavailable':'different'):'match',...(issue?.reason?{reason:issue.reason}:{})});
  };
  if(expected.text!==undefined)semanticRow('text','Rendered text',expected.text,actual.renderedText);
  if(expected.checkTextVisibility&&actual.textVisibility)semanticRow('textVisibility','Text visibility','fully visible',actual.textVisibility.status);
  if(semanticIssues.some(i=>i.property==='renderedFontFamily'))semanticRow('renderedFontFamily','Rendered font family',expected.styles?.fontFamily,actual.fontRendering?.fonts?.map(f=>f.familyName).join(', '));
  return rows;
}
