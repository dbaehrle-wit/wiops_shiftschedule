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
const dates=await loadTs('../src/utils/date.ts');
const types=await loadTs('../src/model/types.ts');
const {assessAssignmentSkills:assess,createSkillAssessor}=await loadTs('../src/model/skills.ts',{'../utils/date':dates,'./types':types});
const display=await loadTs('../src/model/shiftDisplay.ts',{'./types':types});
const definitions=[{id:'safety',name:'Safety'},{id:'forklift',name:'Forklift'}];
const area={id:1,code:'HBW',name:'HBW',skillRequirements:[{skillId:'safety',constraint:'hard'},{skillId:'forklift',constraint:'soft'}]};
const employee={id:1,fullName:'A',department:'Fresh',skills:{safety:{status:'valid'},forklift:{status:'valid'}}};
test('sick leave and PTO need no skills and retain their absence colors in skill mode',()=>{
 for(const code of ['S','P']){
  const assessment=assess({...employee,skills:{}},area,'2026-10-31',code,definitions);
  assert.equal(assessment.status,'off');assert.deepEqual(assessment.checks,[]);
  assert.equal(display.assignmentColor(code,assessment.status,'skill'),display.SHIFT_COLORS[code]);
  assert.equal(display.assignmentColor(code,assessment.status,'skill',true),display.COMPACT_COLORS[code]);
 }
});
test('all views share color rules while OFF stays neutral and compact palettes remain distinct',()=>{
 assert.equal(display.assignmentColor('E','blocked','shift'),display.SHIFT_COLORS.E);
 assert.equal(display.assignmentColor('E','blocked','skill'),display.COMPAT_COLORS.blocked);
 assert.equal(display.assignmentColor('OFF','off','skill'),display.SHIFT_COLORS.OFF);
 assert.equal(display.assignmentColor('N','warning','skill',true),display.COMPACT_SKILL_COLORS.warning);
 assert.equal(display.assignmentColor('N','ok','shift',true),display.COMPACT_COLORS.N);
 assert.equal(display.assignmentColor(undefined,'unknown','skill'),'#fff');
});
test('matching all area requirements is qualified while missing hard and soft requirements produce different severities',()=>{
 assert.equal(assess(employee,area,'2026-10-31','E',definitions).status,'ok');
 const missingHard={...employee,skills:{forklift:{status:'valid'}}};
 const hard=assess(missingHard,area,'2026-10-31','E',definitions);assert.equal(hard.status,'blocked');assert.match(hard.summary,/Safety: missing \(hard requirement\)/);
 const soft=assess({...employee,skills:{safety:{status:'valid'}}},area,'2026-10-31','L',definitions);assert.equal(soft.status,'warning');assert.match(soft.summary,/Forklift: missing \(soft requirement\)/);
});
test('credentials are checked against each assignment date with inclusive expiry and a 30-day warning window',()=>{
 const expiring={...employee,skills:{...employee.skills,safety:{status:'valid',validUntil:'2026-12-01'}}};
 assert.equal(assess(expiring,area,'2026-10-31','E',definitions).status,'ok');
 assert.equal(assess(expiring,area,'2026-11-01','E',definitions).status,'warning');
 assert.equal(assess(expiring,area,'2026-12-01','E',definitions).checks[0].status,'expiring');
 assert.equal(assess(expiring,area,'2026-12-02','E',definitions).status,'blocked');
});
test('an expired hard requirement wins over soft gaps and changing the assigned area changes the assessment',()=>{
 const person={...employee,skills:{safety:{status:'expired'},forklift:{status:'missing'}}};
 assert.equal(assess(person,area,'2026-10-31','N',definitions).status,'blocked');
 assert.equal(assess(person,{...area,skillRequirements:[{skillId:'forklift',constraint:'soft'}]},'2026-10-31','N',definitions).status,'warning');
});
test('missing skill data or area requirements is unchecked, and explicit no requirements is qualified',()=>{
 assert.equal(assess({...employee,skills:undefined},area,'2026-10-31','E',definitions).status,'unknown');
 assert.equal(assess(employee,{...area,skillRequirements:undefined},'2026-10-31','E',definitions).status,'unknown');
 assert.equal(assess(employee,area,'2026-10-31','E',undefined).status,'unknown');
 assert.equal(assess(employee,undefined,'2026-10-31','E',definitions).status,'unknown');
 assert.equal(assess(employee,{...area,skillRequirements:[]},'2026-10-31','E',definitions).status,'ok');
});
test('OFF is always neutral and unplanned cells do not pretend to have verified requirements',()=>{
 const missing={...employee,skills:{}};
 assert.equal(assess(missing,area,'2026-10-31','OFF',definitions).status,'off');
 assert.deepEqual(assess(missing,area,'2026-10-31',undefined,definitions).checks,[]);
 assert.equal(assess(missing,area,'2026-10-31',undefined,definitions).status,'unknown');
});
test('invalid expiry records stay unchecked rather than being treated as valid or normalized to another day',()=>{
 for(const validUntil of ['not-a-date','2026-02-30'])assert.equal(assess({...employee,skills:{...employee.skills,safety:{status:'valid',validUntil}}},area,'2026-10-31','E',definitions).status,'unknown');
});
test('cached assessments distinguish employee, area, date and shift, including proposed drag destinations',()=>{
 const check=createSkillAssessor([area,{...area,id:2,skillRequirements:[]}],definitions);
 const first=check(employee,1,'2026-10-31','E');assert.equal(check(employee,1,'2026-10-31','E'),first);
 assert.notEqual(check(employee,2,'2026-10-31','E'),first);
 assert.notEqual(check(employee,1,'2026-11-01','E'),first);
 assert.equal(check(employee,1,'2026-10-31','OFF').status,'off');
});
