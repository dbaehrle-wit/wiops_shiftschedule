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
const {buildOpsWeek,defaultOpsConfig,DEFAULT_SHIFT_HOURS,validOpsConfig}=await loadTs('../src/model/opsHours.ts',{'./types':types,'../utils/date':dates});
const employees=[{id:1,fullName:'A',department:'Fresh'},{id:2,fullName:'B',department:'Fresh'},{id:3,fullName:'C',department:'Meat'}],areas=[{id:1,code:'Com',name:'Com'}];
const config={shifts:DEFAULT_SHIFT_HOURS,profiles:[{department:'Fresh',areaId:1,windows:[{days:[0,1,2,3,4],startHour:6,endHour:22,target:2}]}]};
const map=rows=>new Map(rows.map(([employeeId,date,shiftCode,areaId=1])=>[`${employeeId}|${date}`,{employeeId,date,shiftCode,areaId,version:1,compatibility:'unknown'}]));
test('ops week has 168 local-hour slots, half-open shift boundaries, and separate department lanes',()=>{
 const lanes=buildOpsWeek('2026-10-29',employees,areas,map([[1,'2026-10-26','E'],[2,'2026-10-26','L'],[3,'2026-10-26','E']]),config),fresh=lanes.find(lane=>lane.department==='Fresh');
 assert.equal(fresh.hours.length,168);assert.equal(fresh.hours[0].date,'2026-10-26');assert.equal(fresh.hours[167].date,'2026-11-01');
 assert.equal(fresh.hours[5].planned,0);assert.deepEqual(fresh.hours[6].employeeIds,[1]);assert.deepEqual(fresh.hours[13].employeeIds,[1]);assert.deepEqual(fresh.hours[14].employeeIds,[2]);assert.equal(fresh.hours[22].planned,0);assert.equal(fresh.staffHours,16);
 assert.equal(lanes.find(lane=>lane.department==='Meat').staffHours,8);
 assert.equal(dates.shiftViewAnchor('2026-10-26','opsHours',1),'2026-11-02');assert.equal(dates.datesForView('2026-10-29','opsHours').length,7);
});
test('night shifts carry into Monday from the previous Sunday and clip at the end of the week',()=>{
 const [lane]=buildOpsWeek('2026-10-26',employees.slice(0,1),areas,map([[1,'2026-10-25','N'],[1,'2026-11-01','N']]),config);
 assert.equal(lane.staffHours,8);assert.ok(lane.hours.slice(0,6).every(hour=>hour.planned===1));assert.equal(lane.hours[6].planned,0);assert.equal(lane.hours[166].planned,1);assert.equal(lane.hours[167].planned,1);
});
test('non-working statuses never count, overlapping assignments count each employee once per area/hour, and outside-operation staffing is retained',()=>{
 const custom={...config,shifts:{...DEFAULT_SHIFT_HOURS,E:{startHour:5,endHour:13}}};
 const [lane]=buildOpsWeek('2026-10-26',employees.slice(0,2),areas,map([[1,'2026-10-25','N'],[1,'2026-10-26','E'],[2,'2026-10-26','S'],[2,'2026-10-27','P'],[2,'2026-10-28','OFF']]),custom);
 assert.equal(lane.hours[5].planned,1);assert.equal(lane.hours[5].operating,false);assert.equal(lane.outsideHours,6);assert.equal(lane.staffHours,13);assert.equal(lane.peak,1);
});
test('operating targets support overnight weekdays, full days, weekends and highest overlapping target',()=>{
 const custom={...config,profiles:[{department:'Fresh',areaId:1,windows:[{days:[6],startHour:22,endHour:6,target:2},{days:[0],startHour:0,endHour:24,target:1},{days:[0],startHour:5,endHour:8,target:4}]}]};
 const [lane]=buildOpsWeek('2026-10-26',employees.slice(0,1),areas,new Map(),custom);
 assert.equal(lane.hours[0].target,2);assert.equal(lane.hours[5].target,4);assert.equal(lane.hours[7].target,4);assert.equal(lane.hours[8].target,1);assert.equal(lane.hours[23].target,1);assert.equal(lane.hours[24].target,null);assert.equal(lane.hours[167].target,2);
});
test('missing windows stay unconfigured and gray with no invented target',()=>{
 const [lane]=buildOpsWeek('2026-10-26',employees.slice(0,1),areas,map([[1,'2026-10-26','E']]),{...config,profiles:[]});
 assert.equal(lane.configured,false);assert.ok(lane.hours.every(hour=>hour.target===null));assert.equal(lane.gapHours,0);assert.equal(lane.outsideHours,8);
});
test('hour settings validate whole-hour boundaries and nonnegative hourly headcounts',()=>{
 assert.equal(validOpsConfig(null),false);assert.equal(validOpsConfig({...config,profiles:[null]}),false);
 assert.deepEqual(defaultOpsConfig([{code:'E',label:'Early',startHour:24,endHour:14}]).shifts.E,DEFAULT_SHIFT_HOURS.E);
 assert.equal(validOpsConfig(config),true);
 for(const hours of [{startHour:6,endHour:6},{startHour:24,endHour:6},{startHour:6.5,endHour:14}])assert.equal(validOpsConfig({...config,shifts:{...config.shifts,E:hours}}),false);
 assert.equal(validOpsConfig({...config,profiles:[{...config.profiles[0],windows:[{days:[7],startHour:6,endHour:14,target:1}]}]}),false);
 assert.equal(validOpsConfig({...config,profiles:[{...config.profiles[0],windows:[{days:[0],startHour:6,endHour:14,target:-1}]}]}),false);
});
