// Self-contained: Playwright serializes this function into the page.
export function measureElement(el,extraProperties){
  const b=el.getBoundingClientRect(),css=getComputedStyle(el);
  const textKeys=['color','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing'];
  const read=style=>Object.fromEntries(textKeys.map(key=>[key,style[key]]));
  const unavailable={};let textContentReason;
  const ancestor=element=>element.parentElement??element.getRootNode()?.host;
  const hiddenByAncestor=element=>{
    for(let current=element;current;current=ancestor(current)){
      const s=getComputedStyle(current);
      if(s.display==='none'||Number(s.opacity)===0||s.contentVisibility==='hidden')return true;
    }
    return false;
  };
  const paintReason=element=>{
    for(let current=element;current;current=ancestor(current)){
      const s=getComputedStyle(current);
      if(Number(s.opacity)!==1)return 'Element or ancestor opacity requires composited paint review.';
      if(s.filter!=='none'||s.mixBlendMode!=='normal')return 'Filters or blend modes require composited paint review.';
    }
  };
  const styles={};
  for(const key of new Set([...textKeys,'backgroundColor','borderRadius','display','visibility','opacity','margin','marginTop','marginRight','marginBottom','marginLeft','padding','paddingTop','paddingRight','paddingBottom','paddingLeft','gap','rowGap','columnGap',...extraProperties])){
    const value=css.getPropertyValue(key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()));
    if(value)styles[key]=value;
  }
  const backgroundReason=paintReason(el);
  if(backgroundReason)for(const key of Object.keys(styles))if(/color$/i.test(key)||['fill','stroke'].includes(key))unavailable[key]=backgroundReason;
  if(css.backgroundImage!=='none')unavailable.backgroundColor='Background image or gradient layers cover the background color.';
  if(el.namespaceURI==='http://www.w3.org/2000/svg'){
    if(Number(css.fillOpacity)!==1)unavailable.fill='SVG fill opacity requires composited paint review.';
    if(Number(css.strokeOpacity)!==1)unavailable.stroke='SVG stroke opacity requires composited paint review.';
  }
  const textRuns=[],seen=new Set();let visited=0;
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    if(++visited>2000){textContentReason='Text inspection limit reached; map a smaller text element.';for(const key of textKeys)unavailable[key]=textContentReason;break;}
    const node=walker.currentNode;if(!node.textContent.trim())continue;
    const parent=node.parentElement,s=getComputedStyle(parent);
    if(s.visibility!=='visible'||hiddenByAncestor(parent))continue;
    const range=document.createRange();range.selectNodeContents(node);
    if(![...range.getClientRects()].some(r=>r.width>0&&r.height>0))continue;
    const values=read(s),missing={};
    // Chromium exposes the resolved text paint independently of CSS color.
    values.color=parent.namespaceURI==='http://www.w3.org/2000/svg'?s.fill:(s.webkitTextFillColor||s.color);
    const reason=paintReason(parent);
    if(reason)missing.color=reason;
    if(s.backgroundClip==='text'||s.webkitBackgroundClip==='text'||parseFloat(s.webkitTextStrokeWidth)>0)missing.color='Clipped backgrounds or text strokes require text paint review.';
    if(parent.namespaceURI==='http://www.w3.org/2000/svg'&&(Number(s.fillOpacity)!==1||s.stroke!=='none'))missing.color='SVG fill opacity or strokes require text paint review.';
    const key=JSON.stringify([values,missing]);if(seen.has(key))continue;seen.add(key);
    if(textRuns.length>=256){for(const property of textKeys)unavailable[property]='Text inspection limit reached; map a smaller text element.';break;}
    textRuns.push({styles:values,unavailable:missing,text:node.textContent.trim().slice(0,80)});
  }
  // Generated text and native form control text are not represented by DOM text nodes.
  function* elements(){yield el;const walker=document.createTreeWalker(el,NodeFilter.SHOW_ELEMENT);while(walker.nextNode())yield walker.currentNode;}
  let inspected=0;
  for(const element of elements()){
    if(++inspected>2000){textContentReason='Text inspection limit reached; map a smaller text element.';for(const key of textKeys)unavailable[key]=textContentReason;break;}
    const s=getComputedStyle(element);
    if(s.visibility!=='visible'||hiddenByAncestor(element))continue;
    const nativeText=element.matches('textarea,select')||(element.localName==='input'&&!['checkbox','radio','range','color','hidden','image'].includes(element.type));
    if(nativeText||element.shadowRoot||element.localName.includes('-')){
      textContentReason='Native control or shadow/custom element text requires a dedicated text mapping or visual review.';
      for(const key of textKeys)unavailable[key]=textContentReason;
    }
    for(const pseudo of ['::before','::after']){
      const s=getComputedStyle(element,pseudo);
      if(s.content&&!['none','normal','""',"''"].includes(s.content)&&s.display!=='none'&&s.visibility==='visible'){
        textContentReason='Generated pseudo-element content requires a dedicated text mapping or visual review.';
        for(const key of textKeys)unavailable[key]=textContentReason;
      }
    }
    for(const pseudo of ['::first-letter','::first-line']){
      const special=getComputedStyle(element,pseudo);
      for(const key of textKeys)if(special[key]!==s[key]||(key==='color'&&special.webkitTextFillColor!==s.webkitTextFillColor))unavailable[key]=`${pseudo} changes text styling; review its rendered text separately.`;
    }
  }
  if(!textRuns.length)for(const key of textKeys)unavailable[key]='No measurable DOM text; map the rendered text element (native controls and canvas need visual review).';
  return {rect:{x:b.x,y:b.y,width:b.width,height:b.height},styles,text:el.textContent?.trim().slice(0,200),textRuns,unavailable,textContentReason};
}
