const primary=value=>String(value??'').replace(/["']/g,'').split(',')[0].trim().toLowerCase();
export const normalizeText=(value,whiteSpace='normal')=>{
  const text=String(value).normalize('NFC').replace(/\r\n?/g,'\n');
  return ['pre','pre-wrap','break-spaces'].includes(whiteSpace)?text:text.replace(/\s+/gu,' ').trim();
};
const generic=new Set(['serif','sans-serif','monospace','cursive','fantasy','system-ui','ui-serif','ui-sans-serif','ui-monospace','ui-rounded','-apple-system','blinkmacsystemfont']);

export function checkSemantics(region,actual,expected){
  const issues=[],add=(kind,property,desired,observed,message,reason)=>issues.push({kind,region:region.name,property,expected:desired,actual:observed,message,...(reason?{reason}:{})});
  if(expected.text!==undefined){
    if(actual.textComplete!==true)add('coverage','text',expected.text,null,'Text could not be verified completely.',actual.textContentReason??'Rendered text is unavailable or exceeds the inspection limit.');
    else if(normalizeText(expected.text,actual.textWhiteSpace)!==normalizeText(actual.renderedText,actual.textWhiteSpace))add('content','text',expected.text,actual.renderedText,'Rendered text does not match the design.');
  }
  if(expected.checkTextVisibility&&actual.textVisibility&&actual.textVisibility.status!=='visible'){
    const fact=actual.textVisibility;
    add(['clipped','outside-viewport'].includes(fact.status)?'visibility':'coverage','textVisibility','fully visible',fact.status,`Text visibility needs review: ${fact.reason}`,fact.reason);
  }
  const family=expected.styles?.fontFamily,diagnostic=actual.fontRendering;
  if(family&&diagnostic&&!generic.has(primary(family))){
    const fonts=diagnostic.fonts??[],wanted=primary(family);
    if(diagnostic.reason||!fonts.length)add('coverage','renderedFontFamily',family,null,'Rendered font could not be verified.',diagnostic.reason??'No rendered glyph font information was available.');
    else{
      const families=[...new Set(fonts.map(f=>f.familyName))];
      const matches=fonts.filter(font=>primary(font.familyName)===wanted);
      const loadedFamilies=[...new Set((diagnostic.loadedFaces??[]).map(face=>primary(face.family)))];
      const alias=fonts.every(font=>font.isCustomFont)&&loadedFamilies.length===1&&loadedFamilies[0]===wanted;
      if(!matches.length&&!alias){
        if(fonts.some(font=>font.isCustomFont)&&loadedFamilies.includes(wanted))add('coverage','renderedFontFamily',family,families,'Custom font alias could not be verified.','Multiple custom fonts prevent a reliable alias-to-rendered-font match.');
        else add('font','renderedFontFamily',family,families,`Rendered font differs: expected ${family}; browser used ${families.join(', ')}.`);
      }else if(matches.length!==fonts.length&&!alias)add('coverage','renderedFontFamily',family,families,'Some glyphs use fallback fonts.','Mixed rendered fonts require glyph review; emoji and unsupported characters can legitimately fall back.');
    }
  }
  return issues;
}
