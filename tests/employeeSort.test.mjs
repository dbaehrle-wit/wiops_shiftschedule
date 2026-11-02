import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
const url=new URL('../src/model/employeeSort.ts',import.meta.url),module={exports:{}},require=createRequire(url);
const code=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
runInThisContext(`(function(exports,require,module){${code}\n})`,{filename:fileURLToPath(url)})(module.exports,require,module);
const {nextEmployeeSort,sortEmployees}=module.exports;
const employees=[{id:1,fullName:'Alex 10',department:'Meat',role:'Shift lead'},{id:2,fullName:'Alex 2',department:'Ambient',role:'Operator'},{id:3,fullName:'Casey',department:'Freezer'},{id:4,fullName:'alex 2',department:'Ambient',role:'Operator'}];
test('employee header cycles name, department, role, then name again',()=>{
 assert.equal(nextEmployeeSort(null),'name');assert.equal(nextEmployeeSort('name'),'department');assert.equal(nextEmployeeSort('department'),'role');assert.equal(nextEmployeeSort('role'),'name');
});
test('sorting uses natural names, deterministic ties, department/role groups and does not mutate snapshots',()=>{
 assert.deepEqual(sortEmployees(employees,'name').map(employee=>employee.id),[2,4,1,3]);
 assert.deepEqual(sortEmployees(employees,'department').map(employee=>employee.id),[2,4,3,1]);
 assert.deepEqual(sortEmployees(employees,'role').map(employee=>employee.id),[2,4,3,1]);
 assert.deepEqual(employees.map(employee=>employee.id),[1,2,3,4]);assert.equal(sortEmployees(employees,null),employees);
});
