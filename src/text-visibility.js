// Read-only browser function; never scrolls or changes hit-testing styles.
export function measureTextVisibility(el){
  const ancestor=node=>node.parentElement??node.getRootNode()?.host;
  const rects=[],owners=[];let inspected=0;
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    if(++inspected>2000)return {status:'unavailable',reason:'Text visibility inspection limit reached.'};
    const node=walker.currentNode;if(!node.textContent.trim())continue;
    const owner=node.parentElement,s=getComputedStyle(owner);
    if(s.visibility!=='visible')continue;
    let hidden=false;for(let current=owner;current;current=ancestor(current)){const css=getComputedStyle(current);if(css.display==='none'||Number(css.opacity)===0||css.contentVisibility==='hidden'){hidden=true;break;}}
    if(hidden)continue;
    const range=document.createRange();range.selectNodeContents(node);
    for(const r of range.getClientRects())if(r.width>0&&r.height>0){rects.push({x:r.x,y:r.y,width:r.width,height:r.height});owners.push(owner);}
    if(rects.length>512)return {status:'unavailable',reason:'Text visibility inspection limit reached.'};
  }
  if(!rects.length)return {status:'unavailable',reason:'No measurable visible DOM text.'};
  for(let i=0;i<rects.length;i++){
    const r=rects[i],owner=owners[i];
    if(r.x< -1||r.y< -1||r.x+r.width>innerWidth+1||r.y+r.height>innerHeight+1)return {status:'outside-viewport',reason:'Text extends outside the captured viewport.',rect:r};
    for(let current=owner;current;current=ancestor(current)){
      const css=getComputedStyle(current),box=current.getBoundingClientRect();
      const clipX=['hidden','clip','auto','scroll'].includes(css.overflowX),clipY=['hidden','clip','auto','scroll'].includes(css.overflowY);
      if((clipX||clipY)&&css.transform!=='none'){
        const matrix=new DOMMatrixReadOnly(css.transform);
        if(Math.abs(matrix.b)>0.0001||Math.abs(matrix.c)>0.0001||!matrix.is2D)return {status:'unavailable',reason:'Rotated or perspective clipping requires visual review.',rect:r};
      }
      const scaleX=current.offsetWidth?box.width/current.offsetWidth:1,scaleY=current.offsetHeight?box.height/current.offsetHeight:1;
      const left=box.left+current.clientLeft*scaleX,top=box.top+current.clientTop*scaleY;
      if((clipX&&(r.x<left-1||r.x+r.width>left+current.clientWidth*scaleX+1))||(clipY&&(r.y<top-1||r.y+r.height>top+current.clientHeight*scaleY+1)))return {status:'clipped',reason:'A scrolling or clipping ancestor cuts the measured text bounds.',rect:r};
      if(css.clipPath!=='none'||css.maskImage!=='none')return {status:'unavailable',reason:'Clip paths or masks need visual text review.',rect:r};
    }
    for(const x of [r.x+Math.min(1,r.width/2),r.x+r.width/2,r.x+r.width-Math.min(1,r.width/2)]){
      const top=document.elementFromPoint(x,r.y+r.height/2);
      if(top!==owner)return {status:'occlusion-unverified',reason:'Another element or hit-testing behavior obstructs sampled text positions; review its paint and stacking order.',rect:r};
    }
  }
  for(const owner of new Set([el,...owners]))for(const pseudo of ['::before','::after']){
    const s=getComputedStyle(owner,pseudo);
    if(s.content&&!['none','normal'].includes(s.content)&&['absolute','fixed'].includes(s.position)&&s.visibility==='visible'&&Number(s.opacity)>0&&!(Number(s.zIndex)<0)&&(s.backgroundImage!=='none'||s.backgroundColor!=='rgba(0, 0, 0, 0)'))return {status:'occlusion-unverified',reason:'A painted positioned pseudo-element may cover text; review its stacking order.'};
  }
  const layers=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_ELEMENT);inspected=0;
  while(layers.nextNode()){
    if(++inspected>3000)return {status:'unavailable',reason:'Layer inspection limit reached.'};
    const layer=layers.currentNode;if(layer===el||layer.contains(el))continue;
    const s=getComputedStyle(layer);
    if(s.pointerEvents!=='none'||!['absolute','fixed'].includes(s.position)||s.visibility!=='visible'||Number(s.opacity)===0||Number(s.zIndex)<0)continue;
    const replaced=['IMG','CANVAS','VIDEO','SVG','svg'].includes(layer.tagName);
    if(!replaced&&s.backgroundImage==='none'&&s.backgroundColor==='rgba(0, 0, 0, 0)')continue;
    const box=layer.getBoundingClientRect();
    if(rects.some(r=>r.x<box.right&&r.x+r.width>box.left&&r.y<box.bottom&&r.y+r.height>box.top))return {status:'occlusion-unverified',reason:'A non-interactive painted layer intersects text; stacking order requires visual review.'};
  }
  return {status:'visible',method:'text-bounds-and-sampled-hit-tests'};
}
