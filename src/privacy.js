// Display/persistence projection only. Never use a redacted URL for navigation.
export function safeUrl(value){
  try{
    const url=new URL(value);const changed=!!(url.username||url.password||url.search||url.hash);
    url.username='';url.password='';
    for(const key of new Set(url.searchParams.keys())){
      const structural=['figma.com','www.figma.com'].includes(url.hostname)&&key==='node-id'&&url.searchParams.getAll(key).every(node=>/^\d+[:-]\d+$/.test(node));
      if(!structural){url.searchParams.delete(key);url.searchParams.append(key,'[redacted]');}
    }
    if(url.hash){const fragment=url.hash.slice(1);url.hash=fragment.startsWith('/')?fragment.split('?')[0]+(fragment.includes('?')?'?[redacted]':''):'[redacted]';}
    return changed?url.href:value;
  }catch{return '[redacted URL]';}
}
export function redactUrls(value){
  if(typeof value==='string')return value.replace(/https?:\/\/[^\s"'<>\\]+/gi,url=>safeUrl(url));
  if(Array.isArray(value))return value.map(redactUrls);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,redactUrls(item)]));
  return value;
}
