export async function measureRenderedFonts(page,measures){
  const text=measures.filter(m=>!m.error&&m.textRuns?.length);
  if(!text.length)return;
  let session;
  try{
    session=await page.context().newCDPSession(page);
    await session.send('DOM.enable');await session.send('CSS.enable');
    const {root}=await session.send('DOM.getDocument');
    const loadedFaces=await page.evaluate(()=>[...document.fonts].filter(f=>f.status==='loaded').map(f=>({family:f.family,weight:f.weight,style:f.style})));
    for(const measure of text){
      try{
        const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector:measure.selector});
        if(!nodeId)throw Error('Selector is not addressable by browser font diagnostics');
        const {fonts}=await session.send('CSS.getPlatformFontsForNode',{nodeId});
        measure.fontRendering={fonts:fonts.filter(f=>f.glyphCount>0),loadedFaces};
      }catch{measure.fontRendering={reason:'Rendered font diagnostics require an addressable CSS selector in this document.'};}
    }
  }catch{for(const measure of text)measure.fontRendering={reason:'Rendered font diagnostics are unavailable in this browser.'};}
  finally{await session?.detach().catch(()=>{});}
}
