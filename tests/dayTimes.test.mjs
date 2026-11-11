import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
async function loadTs(path,imports={}) {
 const url=new URL(path,import.meta.url),module={exports:{}},require=createRequire(url);
 const code=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInThisContext(`(function(exports,require,module){${code}\n})`,{filename:fileURLToPath(url)})(module.exports,specifier=>imports[specifier]??require(specifier),module);
 return module.exports;
}
const types=await loadTs('../src/model/types.ts');
const {dayTimeSuffix,dayTimeDescription,validDayTime}=await loadTs('../src/model/dayTimes.ts',{'./types':types});
const {default:reducer,dayTimesActions}=await loadTs('../src/features/dayTimesSlice.ts');
test('single overrides match the requested notation while descriptions distinguish start and end',()=>{
 assert.equal(dayTimeSuffix('E',{start:'',end:'11:00'}),'(-11:00)');
 assert.equal(dayTimeSuffix('E',{start:'07:00',end:''}),'(-07:00)');
 assert.equal(dayTimeDescription('E',{start:'07:00',end:''}),'Start: 07:00');
 assert.equal(dayTimeDescription('E',{start:'',end:'11:00'}),'Ende: 11:00');
});
test('both times support overnight shifts and nonworking or empty shifts show no override',()=>{
 assert.equal(dayTimeSuffix('N',{start:'23:00',end:'05:00'}),'(23:00–05:00)');
 for(const code of ['OFF','S','P',undefined])assert.equal(dayTimeSuffix(code,{start:'07:00',end:'11:00'}),'');
 assert.equal(dayTimeSuffix('E',undefined),'');
 assert.equal(dayTimeSuffix('E',{start:'',end:''}),'');
 for(const time of ['','00:00','07:00','23:59'])assert.ok(validDayTime(time));
 for(const time of ['24:00','7:00','12:60','-1:00'])assert.equal(validDayTime(time),false);
});
test('overrides remain scoped to site, employee and day and clearing removes only the selected entry',()=>{
 let state=reducer(undefined,dayTimesActions.setTimes({key:'1|2|2026-11-11',times:{start:'07:00',end:''}}));
 state=reducer(state,dayTimesActions.setTimes({key:'2|2|2026-11-11',times:{start:'',end:'11:00'}}));
 state=reducer(state,dayTimesActions.setTimes({key:'1|2|2026-11-11',times:{start:'',end:''}}));
 assert.equal(state['1|2|2026-11-11'],undefined);
 assert.deepEqual(state['2|2|2026-11-11'],{start:'',end:'11:00'});
});
const {default:draftReducer,draftActions}=await loadTs('../src/features/draftSlice.ts',{'../model/types':types});
test('deleting a temporary resource removes its drafts from undo and redo history without touching AMS users',()=>{
 const patch=(employeeId)=>({employeeId,date:'2026-11-11',shiftCode:'E',areaId:1,expectedVersion:null});
 let state=draftReducer(undefined,draftActions.stageMany([patch(-1),patch(2)]));
 state=draftReducer(state,draftActions.stageMany([{...patch(-1),shiftCode:'L'}]));
 state=draftReducer(state,draftActions.undo());
 state=draftReducer(state,draftActions.removeEmployee(-1));
 for(const map of [state.edits,...state.past,...state.future])assert.ok(Object.values(map).every(op=>op.employeeId!==-1));
 state=draftReducer(state,draftActions.redo());
 assert.ok(state.edits['2|2026-11-11']);
 assert.equal(state.edits['-1|2026-11-11'],undefined);
});
