import test from 'node:test';
import assert from 'node:assert/strict';
import * as properties from '../src/properties.js';
import { checkGeometry } from '../src/runner.js';
import { compactReport } from '../src/findings.js';

test('equivalent CSS colors normalize to a single sRGB color function with alpha',()=>{
 assert.equal(typeof properties.normalizeColor,'function');
 for(const value of ['#f00','#FF0000','rgb(255, 0, 0)','rgb(100% 0% 0%)','hsl(0 100% 50%)','red','color(srgb 1 0 0)'])assert.equal(properties.normalizeColor(value),'color(srgb 1 0 0 / 1)',value);
 for(const value of ['rgba(255, 0, 0, 0.5)','rgb(255 0 0 / 50%)'])assert.equal(properties.normalizeColor(value),'color(srgb 1 0 0 / 0.5)',value);
 assert.equal(properties.normalizeColor('#ff000080'),'color(srgb 1 0 0 / 0.501961)');
 assert.equal(properties.normalizeColor('#f008'),'color(srgb 1 0 0 / 0.533333)');
 assert.equal(properties.normalizeColor('transparent'),'color(srgb 0 0 0 / 0)');
 assert.equal(properties.normalizeColor('rgba(255, 0, 0, 0)'),'color(srgb 0 0 0 / 0)');
 const wide=properties.normalizeColor('color(display-p3 1 0 0)');assert.ok(wide?.startsWith('color(srgb '));
 assert.ok(Number(wide.split(' ')[1])>1);assert.equal(properties.normalizeColor(wide),wide);
 for(const value of ['rgb(300 -20 0)','rgb(120% -10% 0%)','hsl(0 200% 50%)'])assert.equal(properties.normalizeColor(value),'color(srgb 1 0 0 / 1)');
 assert.equal(properties.normalizeColor('hsl(0 100% 120%)'),'color(srgb 1 1 1 / 1)');
 assert.equal(properties.normalizeColor('color(srgb 1.2 -0.1 0)'),'color(srgb 1.2 -0.1 0 / 1)');
});

test('alpha differences remain failures and unsupported colors never pass by string equality',()=>{
 assert.equal(properties.compareStyle('color','#ff000080','rgba(255,0,0,0.5019607843137255)').matches,true);
 assert.equal(properties.compareStyle('color','rgba(255,0,0,0.5)','rgba(255,0,0,1)').matches,false);
 for(const value of ['var(--unknown)','currentColor','not-a-color']){
  assert.equal(properties.normalizeColor(value),null,value);
  const result=properties.compareStyle('color',value,value);assert.equal(result.matches,false);assert.equal(result.method,'color-unavailable');
 }
});

test('issues, property rows and compact JSON use canonical colors while retaining originals in detailed data',()=>{
 const actual={styles:{color:'rgb(196, 50, 36)'}};const expected={styles:{color:'#182238'}};
 const issue=checkGeometry({name:'title'},actual,expected,2)[0];
 assert.equal(issue.expected,'color(srgb 0.094118 0.133333 0.219608 / 1)');assert.equal(issue.actual,'color(srgb 0.768627 0.196078 0.141176 / 1)');
 assert.equal(issue.expectedRaw,'#182238');assert.equal(issue.actualRaw,'rgb(196, 50, 36)');
 const row=properties.propertyComparisons(actual,expected).find(p=>p.property==='color');
 assert.equal(row.expected,'color(srgb 0.094118 0.133333 0.219608 / 1)');assert.equal(row.actual,'color(srgb 0.768627 0.196078 0.141176 / 1)');assert.equal(row.colorFormat,'srgb-css');
 const report={issues:[issue],regions:[{name:'title',actual:{selector:'#title'}}]};
 assert.equal(compactReport(report).differences[0].expected,'color(srgb 0.094118 0.133333 0.219608 / 1)');
});
