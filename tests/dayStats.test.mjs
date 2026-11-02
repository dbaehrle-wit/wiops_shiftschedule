import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';

async function loadTs(path,imports={}) {
 const url=new URL(path,import.meta.url),module={exports:{}},require=createRequire(url);
 const output=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInThisContext(`(function(exports,require,module){${output}\n})`,{filename:fileURLToPath(url)})(module.exports,specifier=>imports[specifier]??require(specifier),module);return module.exports;
}
const dates=await loadTs('../src/utils/date.ts');
const types=await loadTs('../src/model/types.ts');
const {dayAreaSummary,dayAndWeekSummary,demoDayStatus}=await loadTs('../src/model/dayStats.ts',{'../utils/date':dates,'./types':types});
const employees=Array.from({length:6},(_,i)=>({id:i+1,fullName:`Person ${i+1}`,department:'Organisation'}));
const areas=[{id:1,code:'Com',name:'Com',defaultRequired:2},{id:2,code:'Depal',name:'Depal',defaultRequired:3}];
const date='2026-10-31';
test('explicit sick leave and PTO override demo statuses and belong to no area',()=>{
 const assignments=new Map([[1,{shiftCode:'S',areaId:1}],[2,{shiftCode:'P',areaId:2}]]);
 const summary=dayAreaSummary({date,employees:employees.slice(0,2),areas,assignmentFor:id=>assignments.get(id)});
 assert.equal(summary.counts.Sick,1);assert.equal(summary.counts.PTO,1);assert.equal(summary.counts.Scheduled,0);
 assert.equal(summary.areas.find(area=>area.areaId===null).total,2);
 assert.ok(summary.areas.every(area=>area.scheduled===0));
});
function fixture() {
 const assignments=new Map([[1,{shiftCode:'E',areaId:1}],[2,{shiftCode:'L',areaId:1}],[3,{shiftCode:'N',areaId:2}],[4,{shiftCode:'OFF',areaId:1}],[6,{shiftCode:'E',areaId:999}]]);
 return {assignments,options:{date,employees,areas,assignmentFor:(id,day)=>day===date?assignments.get(id):undefined}};
}

test('daily counts group the day assignment, count each person once and exclude OFF from staffing',()=>{
 const {options}=fixture(),summary=dayAreaSummary(options),com=summary.areas.find(area=>area.areaId===1),depal=summary.areas.find(area=>area.areaId===2),none=summary.areas.find(area=>area.areaId===null);
 assert.equal(summary.total,6);assert.equal(summary.areas.reduce((n,area)=>n+area.total,0),6);
 assert.equal(Object.values(summary.counts).reduce((a,b)=>a+b,0),6);
 assert.equal(com.scheduled,2);assert.equal(com.total,2);assert.equal(depal.scheduled,1);assert.equal(none.total,3);
 assert.equal(none.counts.Off,1);assert.equal(none.counts.Unplanned,1);assert.equal(none.scheduled,1);
 assert.deepEqual(com.people.map(person=>person.employee.id),[1,2]);
});
test('moving a person between areas updates the counts without duplicating them',()=>{
 const {assignments,options}=fixture();const before=dayAreaSummary(options);
 assignments.set(2,{shiftCode:'L',areaId:2});const after=dayAreaSummary(options);
 assert.equal(before.areas.find(area=>area.areaId===1).scheduled,2);
 assert.equal(after.areas.find(area=>area.areaId===1).scheduled,1);
 assert.equal(after.areas.find(area=>area.areaId===2).scheduled,2);
 assert.equal(after.total,before.total);
 assignments.set(1,{shiftCode:'OFF',areaId:null});const off=dayAreaSummary(options);
 assert.equal(off.areas.find(area=>area.areaId===1).scheduled,0);assert.equal(off.counts.Off,after.counts.Off+1);
});
test('weekly status overview covers Monday to Sunday and preserves daily totals',()=>{
 const {options}=fixture(),summary=dayAndWeekSummary(options);
 assert.equal(summary.week.length,7);assert.equal(summary.week[0].date,'2026-10-26');assert.equal(summary.week[6].date,'2026-11-01');
 for(const day of summary.week){assert.equal(day.total,6);assert.equal(day.areas.reduce((n,area)=>n+area.total,0),6);}
 assert.deepEqual(summary.week.find(day=>day.date===date).counts,summary.counts);
});
test('no assignments do not create false staffing or a default area',()=>{
 const summary=dayAreaSummary({date,employees,areas,assignmentFor:()=>undefined});
 assert.equal(summary.counts.Unplanned,6);assert.equal(summary.areas.find(area=>area.areaId===1).scheduled,0);
 assert.equal(summary.areas.find(area=>area.areaId===null).total,6);
});
test('demo absence statuses are deterministic while OFF and missing assignments remain authoritative',()=>{
 assert.equal(demoDayStatus(1,date,'OFF'),'Off');assert.equal(demoDayStatus(1,date,undefined),'Unplanned');
 assert.equal(demoDayStatus(1,date,'E'),demoDayStatus(1,date,'E'));
 assert.ok(['Scheduled','PTO','Sick'].includes(demoDayStatus(1,date,'E')));
});
test('area overview uses four-week date windows and matching navigation',()=>{
 const days=dates.datesForView('2026-10-31','areas');assert.equal(days.length,28);assert.equal(days[0],'2026-10-26');assert.equal(days.at(-1),'2026-11-22');
 assert.equal(dates.shiftViewAnchor('2026-10-31','areas',1),'2026-11-28');
});
