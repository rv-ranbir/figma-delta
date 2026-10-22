import test from 'node:test';
import assert from 'node:assert/strict';
import * as findings from '../src/findings.js';

test('compact JSON keeps actionable differences and session stop state without repeated matching properties',()=>{
 assert.equal(typeof findings.compactReport,'function');
 const report={runId:'run-one',screen:'desktop',url:'http://localhost',viewport:{width:100,height:100},pass:false,pixels:{mismatchPercent:1.2},issues:[{kind:'style'}],
  coverage:{geometryRegions:1,styleRegions:1,note:'Configured checks only'},session:{id:'session-one',status:'iteration-limit',nextAction:'STOP'},
  findings:[{id:'finding-one',category:'style',target:{region:'title',selector:'#title',nodeId:'1:2',resource:null},property:'marginTop',expected:{value:12,unit:'px',tolerance:0.5,operator:'within'},actual:{value:24,unit:'px'},delta:12,occurrences:1,summary:'margin differs',properties:[{property:'color',status:'match'}],hypotheses:[],guidance:'inspect',review:{status:'unreviewed'}}],
  artifacts:{directory:'run-folder',report:null,json:'run-folder/report.json',result:'run-folder/result.json'}};
 const result=findings.compactReport(report);
 assert.equal(result.differences[0].expected,12);assert.equal(result.differences[0].actual,24);assert.equal(result.differences[0].delta,12);
 assert.equal(result.differences[0].selector,'#title');assert.equal(result.differences[0].comparison,'within');assert.equal(result.differences[0].tolerance,0.5);
 assert.equal(result.session.status,'iteration-limit');assert.equal(result.session.nextAction,'STOP');assert.equal(result.coverage.note,'Configured checks only');
 assert.equal(result.differences[0].properties,undefined);assert.equal(result.issues,undefined);assert.equal(result.regions,undefined);assert.equal(result.measures,undefined);
 report.findings=[];report.issues=[];report.pass=true;assert.deepEqual(findings.compactReport(report).differences,[]);
});

test('compact read of legacy reports retains known expected/actual values without inventing finding IDs',()=>{
 const report={screen:'desktop',pass:false,issues:[{kind:'geometry',region:'title',property:'x',expected:10,actual:20,delta:10}],regions:[{name:'title',actual:{selector:'#title'}}]};
 const result=findings.compactReport(report);
 assert.equal(result.differences[0].id,null);assert.equal(result.differences[0].selector,'#title');
 assert.equal(result.differences[0].expected,10);assert.equal(result.differences[0].actual,20);assert.equal(result.session,null);
});
