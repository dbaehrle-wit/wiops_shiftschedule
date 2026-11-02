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
const dates=await loadTs('../src/utils/date.ts'),types=await loadTs('../src/model/types.ts');
const assignmentModel=await loadTs('../src/model/assignments.ts',{'./types':types});
const {buildAutoPlan,planningDates,DEFAULT_ROTATIONS,effectiveAssignments,filterPlanningEmployees,coverageForAreas}=await loadTs('../src/model/planning.ts',{'../utils/date':dates,'./types':types,'./assignments':assignmentModel});
const employees=[{id:1,fullName:'A',department:'Freezer',shiftGroup:'A'},{id:2,fullName:'B',department:'Freezer',shiftGroup:'B'},{id:3,fullName:'C',department:'Ambient',shiftGroup:'A'}];
const areas=[{id:1,code:'Com',name:'Com',defaultRequired:2},{id:2,code:'Depal',name:'Depal',defaultRequired:3}];
const config={mode:'manual',department:'all',shiftGroup:'all',startDate:'2026-10-26',endDate:'2026-11-01',manualShift:'E',pattern:DEFAULT_ROTATIONS[0],areaId:null,fallbackAreaId:1,includeWeekends:false,replaceExisting:true};

test('sick leave and PTO clear areas and never count as planned staffing or match an area filter',()=>{
 for(const code of ['S','P']){
  const plan=buildAutoPlan({...config,endDate:config.startDate,manualShift:code,areaId:1},employees,areas,new Map());
  assert.ok(plan.patches.every(patch=>patch.shiftCode===code&&patch.areaId===null));
  const map=effectiveAssignments([{employeeId:1,date:config.startDate,shiftCode:code,areaId:1,version:3}],{});
  assert.equal(filterPlanningEmployees(employees,[config.startDate],map,'all',1).length,0);
  assert.equal(coverageForAreas(areas,employees,[config.startDate],map)[0].planned,0);
  assert.equal(assignmentModel.buildAssignmentPatch(1,config.startDate,{shiftCode:code,areaId:1},undefined,undefined).areaId,null);
 }
});

test('shared assignment resolution preserves locks, versions and unchanged compatibility without mutating the snapshot',()=>{
 const base={employeeId:1,date:'2026-10-26',shiftCode:'E',areaId:1,version:7,locked:true,compatibility:'ok'};
 const edit={employeeId:1,date:base.date,shiftCode:'E',areaId:1,expectedVersion:7};
 assert.equal(assignmentModel.resolveAssignment(base,undefined),base);
 const same=assignmentModel.resolveAssignment(base,edit);assert.equal(same.compatibility,'ok');assert.equal(same.version,7);assert.equal(same.locked,true);
 const changed=assignmentModel.resolveAssignment(base,{...edit,shiftCode:'L'});assert.equal(changed.compatibility,'unknown');assert.equal(changed.expectedVersion,7);assert.equal(base.shiftCode,'E');
 const fresh=assignmentModel.resolveAssignment(undefined,{...edit,expectedVersion:null});assert.equal(fresh.version,0);assert.equal(fresh.expectedVersion,null);
});
test('shared edit patches suppress no-ops and locked edits, normalize OFF, and retain server versions',()=>{
 const base={employeeId:1,date:'2026-10-26',shiftCode:'E',areaId:1,version:7,compatibility:'ok'};
 assert.equal(assignmentModel.buildAssignmentPatch(1,base.date,{shiftCode:'E',areaId:1},base,base),undefined);
 assert.equal(assignmentModel.buildAssignmentPatch(1,base.date,{shiftCode:'L',areaId:2},base,{...base,locked:true}),undefined);
 assert.deepEqual(assignmentModel.buildAssignmentPatch(1,base.date,{shiftCode:'OFF',areaId:2},base,base),{employeeId:1,date:base.date,shiftCode:'OFF',areaId:null,expectedVersion:7});
 assert.equal(assignmentModel.buildAssignmentPatch(1,base.date,{shiftCode:'L',areaId:1},undefined,undefined).expectedVersion,null);
});

test('manual planning uses department and shift group scope with weekdays by default and preserves its inputs',()=>{
 const assignments=new Map(),plan=buildAutoPlan({...config,department:'Freezer',shiftGroup:'A'},employees,areas,assignments);
 assert.equal(plan.employees.length,1);assert.equal(plan.patches.length,5);assert.ok(plan.patches.every(patch=>patch.employeeId===1&&patch.shiftCode==='E'&&patch.areaId===1&&patch.expectedVersion===null));
 assert.equal(assignments.size,0);assert.equal(plan.dates.at(-1),'2026-10-30');
 assert.equal(buildAutoPlan({...config,includeWeekends:true},employees,areas,assignments).patches.length,21);
});
test('rotations stagger stable employee positions and advance on ISO Mondays relative to the start week',()=>{
 const plan=buildAutoPlan({...config,mode:'automatic',startDate:'2026-10-28',endDate:'2026-11-09'},[...employees].reverse(),areas,new Map());
 const at=(id,date)=>plan.cells.find(cell=>cell.employeeId===id&&cell.date===date).shiftCode;
 assert.equal(at(1,'2026-10-28'),'E');assert.equal(at(2,'2026-10-28'),'L');assert.equal(at(3,'2026-10-28'),'N');
 assert.equal(at(1,'2026-11-02'),'L');assert.equal(at(1,'2026-11-09'),'N');
});
test('bi-weekly and four-week rotations hold each shift for the configured number of ISO weeks',()=>{
 for(const cycleWeeks of [2,4]){
  const plan=buildAutoPlan({...config,mode:'automatic',endDate:'2026-12-01',pattern:{...DEFAULT_ROTATIONS[0],cycleWeeks}},employees,areas,new Map());
  const at=date=>plan.cells.find(cell=>cell.employeeId===1&&cell.date===date).shiftCode;
  assert.equal(at(dates.addDays(config.startDate,7*(cycleWeeks-1))),'E');
  assert.equal(at(dates.addDays(config.startDate,7*cycleWeeks)),'L');
 }
});
test('locked cells, draft versions, existing areas and OFF assignments are respected in an atomic draft plan',()=>{
 const base=[{employeeId:1,date:'2026-10-26',shiftCode:'L',areaId:2,version:7},{employeeId:2,date:'2026-10-26',shiftCode:'N',areaId:1,version:3,locked:true}];
 const effective=effectiveAssignments(base,{'1|2026-10-26':{employeeId:1,date:'2026-10-26',shiftCode:'N',areaId:2,expectedVersion:7}});
 const plan=buildAutoPlan({...config,endDate:config.startDate},employees,areas,effective);
 assert.equal(plan.locked,1);assert.equal(plan.patches.length,2);assert.deepEqual(plan.patches[0],{employeeId:1,date:'2026-10-26',shiftCode:'E',areaId:2,expectedVersion:7});
 assert.equal(effective.get('1|2026-10-26').shiftCode,'N');
 const off=buildAutoPlan({...config,endDate:config.startDate,manualShift:'OFF',areaId:2},employees,areas,effective);
 assert.ok(off.patches.every(patch=>patch.areaId===null));
 const keep=buildAutoPlan({...config,endDate:config.startDate,replaceExisting:false},employees,areas,effective);
 assert.equal(keep.preserved,1);assert.equal(keep.locked,1);assert.equal(keep.patches.length,1);
 const newDraft=effectiveAssignments([],{'1|2026-10-26':{employeeId:1,date:'2026-10-26',shiftCode:'N',areaId:1,expectedVersion:null}});
 assert.equal(buildAutoPlan({...config,endDate:config.startDate},employees,areas,newDraft).patches[0].expectedVersion,null);
});
test('unchanged plans create no draft and invalid or oversized date windows fail before staging',()=>{
 const first=buildAutoPlan({...config,endDate:config.startDate},employees,areas,new Map());
 const assignments=new Map(first.patches.map(patch=>[types.assignmentKey(patch.employeeId,patch.date),{...patch,version:1}]));
 assert.equal(buildAutoPlan({...config,endDate:config.startDate},employees,areas,assignments).patches.length,0);
 assert.throws(()=>planningDates('2026-02-30','2026-03-01',true),/valid start/);
 assert.throws(()=>planningDates('2026-01-01','2027-01-02',true),/366/);
 assert.throws(()=>planningDates('2026-11-02','2026-11-01',true),/valid start/);
 assert.throws(()=>buildAutoPlan({...config,startDate:'2026-10-31',endDate:'2026-11-01'},employees,areas,new Map()),/no working days/);
});
test('area filters follow daily assignments including drafts and exclude OFF and unplanned employees',()=>{
 const assignments=effectiveAssignments([{employeeId:1,date:'2026-10-26',shiftCode:'E',areaId:1,version:1},{employeeId:2,date:'2026-10-26',shiftCode:'OFF',areaId:1,version:1}],{'3|2026-10-26':{employeeId:3,date:'2026-10-26',shiftCode:'L',areaId:2,expectedVersion:null}});
 assert.deepEqual(filterPlanningEmployees(employees,['2026-10-26'],assignments,'all',1).map(employee=>employee.id),[1]);
 assert.deepEqual(filterPlanningEmployees(employees,['2026-10-26'],assignments,'Ambient',2).map(employee=>employee.id),[3]);
 assert.equal(filterPlanningEmployees(employees,['2026-10-27'],assignments,'all',2).length,0);
});
test('coverage sums daily staffing gaps so one overstaffed day cannot hide another day shortfall',()=>{
 const assignments=new Map();
 employees.forEach(employee=>assignments.set(`${employee.id}|2026-10-26`,{employeeId:employee.id,date:'2026-10-26',shiftCode:'E',areaId:1,version:1}));
 const [coverage]=coverageForAreas(areas,employees,['2026-10-26','2026-10-27'],assignments);
 assert.equal(coverage.planned,3);assert.equal(coverage.target,4);assert.equal(coverage.gap,2);assert.equal(coverage.coveredDays,1);assert.equal(coverage.shifts.E,3);
});
