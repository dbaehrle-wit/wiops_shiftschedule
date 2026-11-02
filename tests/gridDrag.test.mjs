import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';
import ts from 'typescript';

// Load the same pure TypeScript planner used by the UI without adding a test framework.
const code=ts.transpileModule(await readFile(new URL('../src/utils/gridDrag.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {planDrag,rectangle,isRectangle}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const posKey=({r,c})=>`${r}|${c}`;
const value=(shiftCode,areaId=null)=>({shiftCode,areaId});
function setup(cells,positions) {
 const grid=new Map(cells.map(([r,c,shiftCode,areaId=null,locked=false])=>[posKey({r,c}),{employeeId:100+r,date:`day-${c}`,shiftCode,areaId,locked,version:3,compatibility:'ok'}]));
 const source=positions.map(p=>({...p,value:value(grid.get(posKey(p))?.shiftCode??'OFF',grid.get(posKey(p))?.areaId??null)}));
 return {source,rowCount:20,colCount:28,getAssignment:p=>grid.get(posKey(p)),grid};
}
const changes=plan=>new Map(plan.changes.map(p=>[posKey(p),p.value]));

test('fill repeats an entire horizontal shift/area pattern',()=>{
 const context=setup([[0,0,'E',1],[0,1,'N',3]],[{r:0,c:0},{r:0,c:1}]);
 const plan=planDrag({...context,mode:'fill',origin:{r:0,c:1},target:{r:0,c:5}});
 assert.equal(plan.error,null);
 assert.deepEqual(plan.destinations.map(p=>p.value),[value('E',1),value('N',3),value('E',1),value('N',3)]);
 assert.equal(plan.selection.length,6);
 assert.equal(plan.changes.length,4);
});
test('fill repeats a two-dimensional pattern vertically without modifying its source',()=>{
 const context=setup([[1,1,'E',1],[1,2,'L',2],[2,1,'N',3],[2,2,'OFF']],rectangle({r:1,c:1},{r:2,c:2}));
 const plan=planDrag({...context,mode:'fill',origin:{r:2,c:2},target:{r:5,c:2}});
 assert.deepEqual(plan.destinations.map(p=>p.value),[value('E',1),value('L',2),value('N',3),value('OFF'),value('E',1),value('L',2)]);
 assert.ok(plan.changes.every(p=>p.r>=3));
});
test('fill backwards aligns the repeated pattern to the original selection',()=>{
 const context=setup([[3,2,'E',1],[3,3,'L',2]],[{r:3,c:2},{r:3,c:3}]);
 const plan=planDrag({...context,mode:'fill',origin:{r:3,c:3},target:{r:3,c:0}});
 assert.deepEqual(plan.destinations.map(p=>[p.c,p.value]),[[0,value('E',1)],[1,value('L',2)]]);
 const vertical=setup([[2,0,'E',1],[3,0,'N',2]],[{r:2,c:0},{r:3,c:0}]);
 const up=planDrag({...vertical,mode:'fill',origin:{r:3,c:0},target:{r:0,c:0}});
 assert.deepEqual(up.destinations.map(p=>[p.r,p.value]),[[0,value('E',1)],[1,value('N',2)]]);
});
test('diagonal corner fill expands one cell into complete 2x2, 3x3 and 4x4 rectangles',()=>{
 const context=setup([[0,0,'N',3]],[{r:0,c:0}]);
 for(const size of [2,3,4]) {
  const plan=planDrag({...context,mode:'fill',origin:{r:0,c:0},target:{r:size-1,c:size-1}});
  assert.equal(plan.error,null);
  assert.equal(plan.selection.length,size*size);
  assert.equal(plan.destinations.length,size*size-1);
  assert.ok(plan.destinations.every(p=>p.value.shiftCode==='N'&&p.value.areaId===3));
 }
});
test('diagonal fill tiles a two-dimensional pattern and respects locked cells in the added corner',()=>{
 const context=setup([[1,1,'E',1],[1,2,'L',2],[2,1,'N',3],[2,2,'OFF']],rectangle({r:1,c:1},{r:2,c:2}));
 const plan=planDrag({...context,mode:'fill',origin:{r:2,c:2},target:{r:4,c:4}});
 assert.equal(plan.selection.length,16);
 const result=changes(plan);
 assert.deepEqual(result.get('3|3'),value('E',1));
 assert.deepEqual(result.get('3|4'),value('L',2));
 assert.deepEqual(result.get('4|3'),value('N',3));
 context.grid.set('4|4',{...context.getAssignment({r:2,c:2}),locked:true});
 const blocked=planDrag({...context,mode:'fill',origin:{r:2,c:2},target:{r:4,c:4}});
 assert.match(blocked.error,/locked cell/);
 assert.deepEqual(blocked.changes,[]);
});
test('overlapping moves use the source snapshot and destination values win over clearing',()=>{
 const context=setup([[0,0,'E',1],[0,1,'L',2],[0,2,'N',3]],[{r:0,c:0},{r:0,c:1}]);
 const plan=planDrag({...context,mode:'move',origin:{r:0,c:0},target:{r:0,c:1}});
 assert.deepEqual([...changes(plan)],[['0|0',value('OFF')],['0|1',value('E',1)],['0|2',value('L',2)]]);
 assert.equal(plan.overwritten,1);
 assert.equal(context.getAssignment({r:0,c:0}).shiftCode,'E');
});
test('copy preserves source cells and supports a sparse multi-selection',()=>{
 const context=setup([[0,0,'E',1],[1,2,'N',3]],[{r:0,c:0},{r:1,c:2}]);
 const plan=planDrag({...context,mode:'copy',origin:{r:0,c:0},target:{r:2,c:3}});
 assert.deepEqual([...changes(plan)],[['2|3',value('E',1)],['3|5',value('N',3)]]);
 assert.deepEqual(plan.selection,[{r:2,c:3},{r:3,c:5}]);
});
test('locked destination blocks the entire operation',()=>{
 const context=setup([[0,0,'E',1],[0,1,'L',2],[1,1,'N',3,true]],[{r:0,c:0},{r:0,c:1}]);
 for(const mode of ['move','copy','fill']) {
  const plan=planDrag({...context,mode,origin:{r:0,c:0},target:{r:1,c:0}});
  assert.match(plan.error,/locked cell/);
  assert.deepEqual(plan.changes,[]);
 }
});
test('locked sources can be copied or used as fill patterns, but never moved',()=>{
 const context=setup([[0,0,'E',1,true]],[{r:0,c:0}]);
 const move=planDrag({...context,mode:'move',origin:{r:0,c:0},target:{r:0,c:1}});
 assert.match(move.error,/cannot be moved/);
 for(const mode of ['copy','fill'])assert.equal(planDrag({...context,mode,origin:{r:0,c:0},target:{r:0,c:1}}).error,null);
});
test('no-op drops and unchanged fills do not create undo entries',()=>{
 const context=setup([[0,0,'E',1],[0,1,'E',1]],[{r:0,c:0}]);
 for(const mode of ['move','copy','fill'])assert.deepEqual(planDrag({...context,mode,origin:{r:0,c:0},target:{r:0,c:0}}).changes,[]);
 assert.deepEqual(planDrag({...context,mode:'fill',origin:{r:0,c:0},target:{r:0,c:1}}).changes,[]);
});
test('blocks partially out-of-bounds transfers instead of truncating the selection',()=>{
 const context=setup([[0,0,'E'],[0,1,'L']],[{r:0,c:0},{r:0,c:1}]);
 for(const target of [{r:0,c:27},{r:-1,c:0},{r:20,c:0},{r:0,c:-1}]) {
  const plan=planDrag({...context,mode:'move',origin:{r:0,c:0},target});
  assert.match(plan.error,/whole selection must fit/);assert.deepEqual(plan.changes,[]);
 }
});
test('sparse selections can move, but do not offer a fill rectangle',()=>{
 const source=[{r:0,c:0},{r:1,c:1}];
 assert.equal(isRectangle(source),false);
 const plan=planDrag({...setup([[0,0,'E'],[1,1,'L']],source),mode:'fill',origin:{r:0,c:0},target:{r:2,c:1}});
 assert.match(plan.error,/complete rectangle/);
});

// A move/fill is one draft action; undo must restore every affected cell together.
async function loadTsModule(relativePath,imports={}) {
 const url=new URL(relativePath,import.meta.url),module={exports:{}};
 const require=createRequire(url);
 const output=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const evaluate=runInThisContext(`(function(exports,require,module){${output}\n})`,{filename:fileURLToPath(url)});
 evaluate(module.exports,specifier=>imports[specifier]??require(specifier),module);
 return module.exports;
}
const model=await loadTsModule('../src/model/types.ts');
const draftModule=await loadTsModule('../src/features/draftSlice.ts',{'../model/types':model});
test('one undo/redo restores a full drag operation including pre-existing drafts',()=>{
 const {default:reducer,draftActions}=draftModule;
 const existing={employeeId:100,date:'day-0',shiftCode:'N',areaId:3,expectedVersion:3};
 let state=reducer(undefined,draftActions.stageMany([existing]));
 const before=state;
 const context=setup([[0,0,'N',3],[0,1,'L',2]],[{r:0,c:0},{r:0,c:1}]);
 const plan=planDrag({...context,mode:'move',origin:{r:0,c:0},target:{r:0,c:1}});
 const patches=plan.changes.map(p=>({employeeId:100+p.r,date:`day-${p.c}`,...p.value,expectedVersion:context.getAssignment(p)?.version??null}));
 state=reducer(state,draftActions.stageMany(patches));
 assert.equal(state.past.length,before.past.length+1);
 const after=state;
 state=reducer(state,draftActions.undo());assert.deepEqual(state.edits,before.edits);
 state=reducer(state,draftActions.redo());assert.deepEqual(state.edits,after.edits);
 assert.equal(state.edits['100|day-2'].expectedVersion,null);
});
