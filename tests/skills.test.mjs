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
const {assessAssignmentSkills:assess,createSkillAssessor,employeeAreaSkill,AREA_SKILL_STATES}=await loadTs('../src/model/skills.ts',{'./types':types});
const display=await loadTs('../src/model/shiftDisplay.ts',{'./types':types});
const area={id:1,code:'COM',name:'COM'};
const employee={id:1,fullName:'A',department:'Freezer',areaSkills:{1:'expert',2:'qualified'}};

test('every proficiency state maps to its own color in both regular and compact skill views',()=>{
 assert.deepEqual(AREA_SKILL_STATES,['notQualified','qualified','intermediate','experienced','expert']);
 assert.equal(new Set(AREA_SKILL_STATES.map(state=>display.SKILL_COLORS[state])).size,5);
 for(const state of AREA_SKILL_STATES){
  const result=assess({...employee,areaSkills:{1:state}},area,'E');
  assert.equal(result.status,state);assert.match(result.summary,/COM:/);
  for(const compact of [false,true])assert.equal(display.assignmentColor('E',result.status,'skill',compact),display.SKILL_COLORS[state]);
 }
 assert.equal(display.assignmentTextColor('E','expert','skill'),'#fff');
});

test('levels are independent per area and missing or invalid levels are not qualified',()=>{
 assert.equal(assess(employee,area,'E').status,'expert');
 assert.equal(assess(employee,{...area,id:2},'N').status,'qualified');
 for(const areaSkills of [undefined,{}, {1:'invalid'}])assert.equal(assess({...employee,areaSkills},area,'L').status,'notQualified');
 assert.equal(employeeAreaSkill(employee,3),'notQualified');
});

test('absence colors and shift coloring stay independent of proficiency',()=>{
 for(const code of ['OFF','S','P']){
  const result=assess(employee,area,code);assert.equal(result.status,'off');
  for(const compact of [false,true])assert.equal(display.assignmentColor(code,result.status,'skill',compact),(compact?display.COMPACT_COLORS:display.SHIFT_COLORS)[code]);
  assert.notEqual(display.assignmentTextColor(code,'expert','skill'),'#fff');
 }
 for(const code of ['E','L','N'])assert.equal(display.assignmentColor(code,'expert','shift'),display.SHIFT_COLORS[code]);
});

test('unplanned cells and assignments without an area do not pretend to have an area level',()=>{
 assert.equal(assess(employee,undefined,'E').status,'unknown');
 assert.equal(assess(employee,area,undefined).status,'unknown');
 assert.equal(display.assignmentColor(undefined,'unknown','skill'),'#fff');
});

test('assessment cache handles area edits, shift edits and refreshed employee data',()=>{
 const check=createSkillAssessor([area,{...area,id:2}]);
 const first=check(employee,1,'2026-11-11','E');assert.equal(check(employee,1,'2026-11-11','E'),first);
 assert.equal(check(employee,2,'2026-11-11','E').status,'qualified');
 assert.equal(check(employee,1,'2026-11-11','OFF').status,'off');
 assert.equal(check({...employee,areaSkills:{1:'intermediate'}},1,'2026-11-11','E').status,'intermediate');
});
