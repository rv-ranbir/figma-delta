import fs from 'node:fs/promises';
import path from 'node:path';
import { inside } from './config.js';
import { propertyComparisons } from './properties.js';
import { normalizeColor, isColorProperty } from './colors.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=value=>String(value??'Page').replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());
const number=value=>Number.isInteger(value)?String(value):Number(value.toFixed(2)).toString();
const properties={x:'horizontal position',y:'vertical position',width:'width',height:'height',color:'text color',fontSize:'font size',fontFamily:'font',fontWeight:'font weight',lineHeight:'line height',letterSpacing:'letter spacing',backgroundColor:'background color',borderRadius:'corner radius',marginTop:'top margin',marginRight:'right margin',marginBottom:'bottom margin',marginLeft:'left margin',paddingTop:'top padding',paddingRight:'right padding',paddingBottom:'bottom padding',paddingLeft:'left padding',rowGap:'row gap',columnGap:'column gap'};

function propertyValue(value,row){
  if(value===null||value===undefined)return '<span class="muted">Not captured</span>';
  const text=String(value)+(row.group==='geometry'?'px':'');
  const color=isColorProperty(row.property)?normalizeColor(value):null;
  return color?`<span class="color-value"><span class="color-swatch" style="background:${color}" aria-hidden="true"></span>${escape(color)}</span>`:escape(text);
}

function propertyTable(rows,pixelBased){
  const displayed=rows.filter(row=>row.expected!==null||row.expectedRaw!=null||['color','margin','padding','gap'].includes(row.property));
  if(!displayed.length)return `<section class="property-section"><h3>Property-level comparison</h3><p class="muted">${pixelBased?'No element mapping is available. The images show a difference, but there are no exact design properties to compare.':'This check has no element-style mapping. Review the recorded resource or error above.'}</p></section>`;
  const differences=displayed.filter(row=>['different','unavailable'].includes(row.status));
  const matches=displayed.filter(row=>row.status==='match');
  const missing=displayed.filter(row=>row.status==='not-specified');
  const labels={match:'Matches',different:'Differs','not-specified':'No design value',unavailable:'Not captured'};
  const table=list=>`<div class="table-scroll"><table class="property-table"><thead><tr><th>Property</th><th>Design expects</th><th>Browser shows</th><th>Result</th></tr></thead><tbody>${list.map(row=>`<tr class="property-${row.status}"><th scope="row">${escape(row.label)}</th><td>${row.expected===null?`<span class="muted">${row.expectedRaw!=null?'Unresolved color: '+escape(row.expectedRaw):'Not provided'}</span>`:propertyValue(row.expected,row)}</td><td>${propertyValue(row.actual,row)}</td><td><span class="property-result">${labels[row.status]}</span>${row.delta&&row.status==='different'?`<small>${row.delta>0?'+':''}${number(row.delta)}${row.unit??''}</small>`:''}</td></tr>`).join('')}</tbody></table></div>`;
  return `<section class="property-section"><h3>What differs?</h3><p class="muted">${differences.length?`${differences.length} measured property difference${differences.length===1?'':'s'}.` : pixelBased?'The image differs, but the mapped properties do not establish an exact cause.':'No mapped property difference was found.'}</p>${differences.length?table(differences):''}${matches.length?`<details class="property-extra"><summary>${matches.length} properties match</summary>${table(matches)}</details>`:''}${missing.length?`<details class="property-extra"><summary>Design values missing: ${escape(missing.map(row=>row.label.toLowerCase()).join(', '))}</summary><p class="muted">These are browser measurements only. Supply reference values to compare them.</p>${table(missing)}</details>`:''}<p class="property-note">Positions are capture coordinates, not CSS margins. Color and spacing checks apply to the mapped element, not every child.</p></section>`;
}

function valueText(measurement){
  const value=measurement?.value;
  if(value===null||value===undefined)return 'None';
  if(typeof value==='boolean')return value?'Loaded':'Not loaded';
  const unit=measurement.unit==='percent'?'%':measurement.unit??'';
  const raw=(typeof value==='number'?number(value):String(value))+unit;
  return measurement.operator==='<='?raw+' or less':measurement.tolerance!==undefined?`${raw} (±${measurement.tolerance}${unit})`:raw;
}

export function describeFinding(finding){
  if(isColorProperty(finding.property))finding={...finding,...Object.fromEntries(['expected','actual'].map(key=>[key,{...finding[key],value:normalizeColor(finding[key]?.value)??`Unresolved color: ${finding[key]?.rawValue??finding[key]?.value??'missing'}`}]))};
  const region=name(finding.target.region);
  let title,description;
  if(['pixels','region-pixels'].includes(finding.category)){
    title=`${region} looks different`;
    description='The rendered pixels differ from the reference beyond the configured limit. Compare the images to decide whether this needs a fix.';
  }else if(finding.category==='geometry'){
    const delta=finding.delta;const amount=number(Math.abs(delta));
    const directions={x:delta>0?'too far right':'too far left',y:delta>0?'too low':'too high',width:delta>0?'too wide':'too narrow',height:delta>0?'too tall':'too short'};
    title=directions[finding.property]?`${region} is ${amount}px ${directions[finding.property]}`:`${region} has a different size or position`;
    description=`The ${properties[finding.property]??finding.property} does not match the reference within the allowed tolerance.`;
  }else if(finding.category==='style'){
    title=`${region} uses a different ${properties[finding.property]??name(finding.property).toLowerCase()}`;
    description='The browser’s computed style differs from the expected value. Inspect the element and its inherited styles before changing code.';
  }else if(finding.category==='element'){
    title=`${region}: ${finding.actual.value==='missing'?'element not found':'element needs checking'}`;
    description='The configured selector must identify one visible element. Check whether it is missing, hidden, or matches more than one element.';
  }else if(finding.category==='font'){
    title='A required font did not load';description='Check the font file, font-face declaration and loading state.';
  }else if(finding.category==='asset'){
    title='An image did not load';description='Check the image URL and loading state.';
  }else{
    title='The page reported a browser error';description='Inspect the recorded error and reproduce it in the application.';
  }
  return {title,description,expected:valueText(finding.expected),actual:valueText(finding.actual)};
}

export async function writeReport(dir,report){
  // Keep evidence as adjacent files rather than duplicating image bytes in the workspace.
  const image=async file=>{inside(dir,file);return escape(file.split('\\').join('/'));};
  const [css,script]=await Promise.all([
    fs.readFile(new URL('./report.css',import.meta.url),'utf8'),fs.readFile(new URL('./report-client.js',import.meta.url),'utf8')]);
  const order={style:0,geometry:1,element:2,font:2,asset:2,runtime:2,'region-pixels':3,pixels:4};
  const findings=[...(report.findings??[])].sort((a,b)=>(order[a.category]??5)-(order[b.category]??5));
  const views=findings.map(finding=>{const region=report.regions?.find(r=>r.name===finding.target.region);return {...describeFinding(finding),properties:finding.properties??(region?propertyComparisons(region.actual,region.expected):[])};});
  const navigation=await Promise.all(findings.map(async(finding,index)=>`<button type="button" class="finding-link" data-select-finding="${escape(finding.id)}" aria-pressed="${index===0}"><img alt="" src="${await image(finding.evidence.images.actual)}"><span><span class="finding-region">${escape(name(finding.target.region))}</span><span class="finding-title">${escape(views[index].title)}</span><span class="finding-state" data-finding-state="${escape(finding.id)}">Unreviewed</span></span><span class="finding-number">${index+1}</span></button>`));
  const articles=await Promise.all(findings.map(async(finding,index)=>{
    const view=views[index];const id=escape(finding.id);const region=escape(finding.target.region??'page');
    const pictures={};for(const [key,file] of Object.entries(finding.evidence.images))pictures[key]=await image(file);
    return `<article class="finding-detail" data-finding-id="${id}" ${index?'hidden':''}>
<header class="detail-heading"><div><p class="region-label">${escape(name(finding.target.region))} <span>· Finding ${index+1} of ${findings.length}</span></p><h2>${escape(view.title)}</h2><p class="description">${escape(view.description)}</p></div><span class="status" data-detail-status="${id}">Unreviewed</span></header>
${['font','asset','runtime','pixels'].includes(finding.category)?`<section class="recorded-check"><h3>Recorded check</h3><p>${escape(finding.summary)}</p>${finding.target.resource?`<p><strong>Resource:</strong> <code>${escape(finding.target.resource)}</code></p>`:''}<p><strong>Expected:</strong> ${escape(view.expected)} <span>·</span> <strong>Actual:</strong> ${escape(view.actual)}</p></section>`:''}
${propertyTable(view.properties,finding.evidenceType==='pixel-comparison')}
<section class="evidence-section" aria-label="Visual evidence"><div class="evidence-toolbar"><h3>Compare the affected area</h3><span class="muted">${finding.evidence.scope==='region'?'Affected area':'Full page'} · ${finding.evidence.rect.width} × ${finding.evidence.rect.height}px</span></div>
<div class="comparison" data-evidence-view="compare"><figure><figcaption>Figma reference <span>Expected</span></figcaption><div class="image-surface"><img alt="Figma reference for ${region}" src="${pictures.reference}"></div></figure><figure><figcaption>Browser capture <span>Actual</span></figcaption><div class="image-surface"><img alt="Browser capture for ${region}" src="${pictures.actual}"></div></figure></div>
<details class="pixel-maps" data-pixel-maps><summary>Pixel maps (advanced)</summary><p>These locate changed pixels; they do not identify a CSS cause. ${escape(finding.summary)}</p><div class="comparison"><figure><figcaption>Changed pixels <span>Red = difference, not severity</span></figcaption><div class="image-surface"><img alt="Difference map for ${region}" src="${pictures.diff}"></div></figure><figure><figcaption>Blended images <span>50% reference + 50% browser</span></figcaption><div class="image-surface"><img alt="Overlay for ${region}" src="${pictures.overlay}"></div></figure></div></details></section>
<section class="review-section" aria-label="Review this finding"><div class="section-heading"><h3>Your review</h3><span class="muted">Changes stay in this tab. Export to save.</span></div><div class="review-fields"><label for="decision-${id}">Review decision<select id="decision-${id}" data-review="status" aria-label="Review decision"><option value="unreviewed">Unreviewed</option><option value="confirmed">Confirmed issue</option><option value="not-a-defect">Not a defect</option><option value="ready-to-retest">Ready to retest</option></select></label><label for="severity-${id}">Severity<select id="severity-${id}" data-review="severity" aria-label="Severity"><option value="">Not assigned</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label></div><label class="note-label" for="note-${id}">Review note<textarea id="note-${id}" data-review="comment" placeholder="What should change, or why is this acceptable?" rows="2"></textarea></label></section>
<footer class="handoff"><div><h3>Hand off to development</h3><p class="muted">Copy the location, evidence and your review into a ticket or agent chat.</p></div><div class="handoff-actions"><button type="button" data-copy="ticket">Copy developer ticket</button><button type="button" data-copy="agent">Copy agent instructions</button></div></footer>
<details class="technical"><summary>Technical details</summary><dl><div><dt>Selector</dt><dd><code>${escape(finding.target.selector??'Not mapped')}</code></dd></div><div><dt>Figma node</dt><dd>${escape(finding.target.nodeId??'Not mapped')}</dd></div><div><dt>Finding ID</dt><dd><code>${id}</code></dd></div><div><dt>Occurrences</dt><dd>${finding.occurrences??1}</dd></div><div><dt>Capture bounds</dt><dd><code>${escape(JSON.stringify(finding.evidence.rect))}</code></dd></div></dl></details>
</article>`;
  }));
  const reviewData={schemaVersion:report.findingsVersion??1,runId:report.runId,screen:report.screen,url:report.url,viewport:report.viewport,capturedAt:report.capturedAt,pass:report.pass,session:report.session??null,...(report.comparison?{comparison:report.comparison}:{}),findings,views};
  const json=JSON.stringify(reviewData).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const date=new Date(report.capturedAt);const dateText=Number.isNaN(date.getTime())?report.capturedAt:date.toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC';
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visual review · ${escape(name(report.screen))}</title><style>${css}</style></head><body>
<header class="app-bar"><a class="brand" href="#main"><span class="brand-mark">F</span>Fidelity<span class="brand-context">/ Visual review</span></a><div class="export-actions">${report.artifacts?.result?'<a class="button" href="result.json" download aria-label="Download simple JSON">Simple JSON</a>':''}${report.findings?'<a class="button" href="findings.json" download aria-label="Download findings JSON">Original JSON</a><button class="primary" type="button" id="export-review">Export reviewed JSON</button>':''}</div></header>
<main id="main"><section class="report-heading"><div><div class="title-line"><h1>${escape(name(report.screen))} visual review</h1><span class="run-status ${report.pass?'passed':'needs-review'}">${report.pass?'Configured checks passed':'Needs review'}</span></div><p class="muted page-meta">${escape(report.url)} <span>·</span> ${report.viewport.width} × ${report.viewport.height} <span>·</span> ${escape(dateText)}</p></div><div class="review-progress"><strong><span data-reviewed-count>0</span> / ${findings.length}</strong><span>reviewed</span></div></section>
${report.comparison?`<p class="archive-note">Reference: ${escape(report.comparison.design.frameName??report.comparison.design.figmaUrl??'Exported PNG')} · Version: ${escape(report.comparison.design.version??'not supplied')} · Comparison: ${escape(report.comparison.id)}${report.entryUrl!==report.url?` · Entry: ${escape(report.entryUrl)}`:''}</p>`:''}
${report.exportNote?`<p class="archive-note">${escape(report.exportNote)}</p>`:''}
<div class="workspace"><aside class="finding-sidebar" aria-label="Findings"><div class="sidebar-heading"><h2>Findings <span>${findings.length}</span></h2><button type="button" class="text-button" id="next-unreviewed">Next unreviewed</button></div><label class="search-label">Search findings<input type="search" aria-label="Search findings" placeholder="Search area, selector or issue…" id="finding-search"></label><label class="filter-label">Review status<select id="status-filter"><option value="all">All findings</option><option value="unreviewed">Unreviewed</option><option value="confirmed">Confirmed issue</option><option value="not-a-defect">Not a defect</option><option value="ready-to-retest">Ready to retest</option></select></label><nav class="finding-list" aria-label="Finding list">${navigation.join('')}</nav><p class="no-matches" id="no-matches" hidden>No findings match your search.</p><p class="sidebar-note">Findings are failed checks, not necessarily separate bugs. Severity is assigned by the reviewer.</p></aside>
<div class="detail-workspace">${articles.join('')}<section class="empty-state" id="empty-state" ${findings.length?'hidden':''}><h2>${report.pass?'No configured differences found':report.findings?'No findings selected':'This report has no structured findings'}</h2><p>${report.pass?'The configured visual checks passed. Functional and accessibility testing are separate.':'Choose a finding from the list, or inspect the original checks below.'}</p></section></div></div>
<p class="footer-note">Only configured checks are covered. Review decisions do not change measured pass/fail. ${escape(report.session?.nextAction??'')} Reference and browser text rendering can differ. Inspect the images before confirming a defect. Thresholds and masks were not changed by this review.</p></main>
<div class="copy-panel" id="copy-panel" hidden role="region" aria-label="Copy text"><div class="section-heading"><h2>Copy manually</h2><button type="button" id="close-copy">Close copy panel</button></div><p>Your browser could not access the clipboard. Select the text and copy it.</p><textarea readonly aria-label="Text to copy" rows="10" id="copy-text"></textarea></div><p class="toast" id="toast" role="status" aria-live="polite" hidden></p>
<script type="application/json" id="review-data">${json}</script><script>${script}</script></body></html>`;
  await fs.writeFile(path.join(dir,'report.html'),html);
}
