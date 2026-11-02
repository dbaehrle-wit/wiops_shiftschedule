import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
async function loadTs(path,imports={}){
 const url=new URL(path,import.meta.url),module={exports:{}},require=createRequire(url);
 const code=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInThisContext(`(function(exports,require,module){${code}\n})`,{filename:fileURLToPath(url)})(module.exports,name=>imports[name]??require(name),module);return module.exports;
}
const types=await loadTs('../src/model/types.ts');
const {absenceReport,absenceRateLabel}=await loadTs('../src/model/absence.ts',{'./types':types});
const employees=Array.from({length:5},(_,i)=>({id:i+1,fullName:`Employee ${i+1}`,department:'Freezer'}));
const areas=[{id:1,code:'Com',name:'Com'},{id:2,code:'HBW',name:'HBW'}];
const map=records=>new Map(records.map(([employeeId,date,shiftCode,areaId])=>[`${employeeId}|${date}`,{employeeId,date,shiftCode,areaId,version:1,compatibility:'unknown'}]));
test('absence rate counts actual OFF/P/S, excludes unplanned cells and attributes areas using working history',()=>{
 const assignments=map([[2,'2026-10-30','E',1],[3,'2026-10-30','N',2],[1,'2026-10-31','E',1],[2,'2026-10-31','OFF',null],[3,'2026-10-31','P',null],[4,'2026-10-31','S',null]]);
 const report=absenceReport(employees,['2026-10-31'],assignments,areas);
 assert.equal(report.byDate['2026-10-31'].rate,75);assert.equal(report.total.recorded,4);assert.equal(report.total.unplanned,1);
 assert.equal(report.total.off,1);assert.equal(report.total.pto,1);assert.equal(report.total.sick,1);
 assert.equal(report.byArea[1].rate,50);assert.equal(report.byArea[2].rate,100);assert.equal(report.unattributedAbsences,1);
});
test('area attribution never looks ahead, uses latest working area, and ignores stale absence area fields',()=>{
 const assignments=map([[1,'2026-10-29','E',1],[1,'2026-10-30','L',2],[1,'2026-10-31','S',1],[2,'2026-11-02','E',1],[2,'2026-10-31','P',1]]);
 const report=absenceReport(employees.slice(0,2),['2026-10-31'],assignments,areas);
 assert.equal(report.byArea[1].recorded,0);assert.equal(report.byArea[1].rate,null);assert.equal(report.byArea[2].sick,1);assert.equal(report.unattributedAbsences,1);
});
test('area-filtered date headers count absences even when those employees have no working cell in that period',()=>{
 const assignments=map([[1,'2026-10-30','E',1],[1,'2026-10-31','S',null],[2,'2026-10-31','E',2]]);
 const report=absenceReport(employees,['2026-10-31'],assignments,areas,1);
 assert.equal(report.byDate['2026-10-31'].recorded,1);assert.equal(report.byDate['2026-10-31'].rate,100);
});
test('period rates are weighted employee-days and adjacent calendar dates do not inflate KPI totals',()=>{
 const assignments=map([[1,'2026-10-30','E',1],[1,'2026-10-31','OFF',null],[1,'2026-11-01','P',null],[1,'2026-11-02','E',2]]);
 const report=absenceReport(employees.slice(0,1),['2026-10-31','2026-11-01'],assignments,areas,null,['2026-10-30','2026-10-31','2026-11-01','2026-11-02']);
 assert.equal(report.total.recorded,2);assert.equal(report.total.rate,100);assert.equal(report.byArea[1].recorded,2);assert.equal(report.byArea[2].recorded,0);assert.equal(report.byDate['2026-11-02'].rate,0);
 assert.equal(absenceRateLabel(absenceReport(employees,['2026-10-31'],new Map(),areas).total),'n/a');
});
