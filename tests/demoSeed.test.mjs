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
const types=await loadTs('../src/model/types.ts'),dates=await loadTs('../src/utils/date.ts');
const display=await loadTs('../src/model/shiftDisplay.ts',{'./types':types});
const ops=await loadTs('../src/model/opsHours.ts',{'./types':types,'../utils/date':dates});
const {createDemoSnapshot}=await loadTs('../src/api/demoSeed.ts',{'../model/opsHours':ops,'../model/shiftDisplay':display,'../utils/date':dates});
const snapshot=createDemoSnapshot(1,'2026-10-31');
test('demo roster has six unique names across exactly Freezer and Ambient with the four requested areas',()=>{
 assert.equal(snapshot.employees.length,6);assert.equal(new Set(snapshot.employees.map(employee=>employee.fullName)).size,6);
 assert.deepEqual([...new Set(snapshot.employees.map(employee=>employee.department))].sort(),['Ambient','Freezer']);
 for(const department of ['Ambient','Freezer'])assert.equal(snapshot.employees.filter(employee=>employee.department===department).length,3);
 assert.deepEqual(snapshot.areas.map(area=>area.code),['COM','Depal','Receiving','Matrix']);assert.equal(snapshot.assignments.length,840);
 assert.equal(new Set(snapshot.assignments.map(assignment=>`${assignment.employeeId}|${assignment.date}`)).size,840);
 assert.deepEqual(snapshot.shiftTypes.filter(shift=>types.isWorkingShift(shift.code)).map(({code,startHour,endHour})=>({code,startHour,endHour})),[{code:'E',startHour:6,endHour:14},{code:'L',startHour:14,endHour:22},{code:'N',startHour:22,endHour:6}]);
 assert.ok(snapshot.areas.flatMap(area=>area.skillRequirements).every(requirement=>snapshot.skills.some(skill=>skill.id===requirement.skillId)));
});
test('both departments have continuous Sunday 14 to Friday 14 operations and weekday-only Receiving 06 to 22',()=>{
 const lanes=ops.buildOpsWeek('2026-10-26',snapshot.employees,snapshot.areas,new Map(),ops.defaultOpsConfig(snapshot.shiftTypes,snapshot.operatingProfiles));
 assert.equal(lanes.length,8);
 for(const lane of lanes){
  assert.equal(lane.hours.filter(hour=>hour.operating).length,lane.area.id===3?80:120);
  lane.hours.forEach((hour,index)=>{
   const day=Math.floor(index/24),expected=lane.area.id===3?day<=4&&hour.hour>=6&&hour.hour<22:day<=3||day===4&&hour.hour<14||day===6&&hour.hour>=14;
   assert.equal(hour.operating,expected,`${lane.department}/${lane.area.code} ${day} ${hour.hour}`);
  });
 }
});
test('seed assignments respect operating hours, including overnight carry-in and weekly area rotations',()=>{
 const assignments=new Map(snapshot.assignments.map(assignment=>[`${assignment.employeeId}|${assignment.date}`,assignment]));
 for(const start of ['2026-10-19','2026-10-26','2026-11-02','2026-11-09']){
  const lanes=ops.buildOpsWeek(start,snapshot.employees,snapshot.areas,assignments,ops.defaultOpsConfig(snapshot.shiftTypes,snapshot.operatingProfiles));
  assert.ok(lanes.every(lane=>lane.outsideHours===0));
 }
 for(const assignment of snapshot.assignments){
  if(assignment.areaId===3){assert.ok(['E','L'].includes(assignment.shiftCode));assert.ok(!dates.isWeekend(assignment.date));}
  if(assignment.shiftCode==='OFF')assert.equal(assignment.areaId,null);
 }
 assert.deepEqual(createDemoSnapshot(1,'2026-10-31'),snapshot);
});
