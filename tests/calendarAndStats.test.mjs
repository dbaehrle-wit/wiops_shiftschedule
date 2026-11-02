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
 const evaluate=runInThisContext(`(function(exports,require,module){${output}\n})`,{filename:fileURLToPath(url)});
 evaluate(module.exports,specifier=>imports[specifier]??require(specifier),module);return module.exports;
}
const date=await loadTs('../src/utils/date.ts');
const {demoEmployeeStats}=await loadTs('../src/model/employeeStats.ts',{'../utils/date':date});

test('weekend classification does not depend on translated weekday labels',()=>{
 assert.equal(date.isWeekend('2026-10-31'),true);
 assert.equal(date.isWeekend('2026-11-01'),true);
 assert.equal(date.isWeekend('2026-11-02'),false);
});

test('cached display formatting preserves date-only labels across month, year and daylight-saving boundaries',()=>{
 assert.equal(date.germanDate('2026-01-02'),'2 Jan 2026');
 assert.equal(date.germanDate('2026-12-31'),'31 Dec 2026');
 assert.equal(date.displayDate('2026-10-31'),'31 Oct');
 assert.equal(date.weekdayLabel('2026-10-31'),'Sat');
 assert.equal(date.monthLabel('2026-10-31'),'October 2026');
 assert.equal(date.germanDate('2026-03-29'),'29 Mar 2026');
 assert.equal(date.germanDate('2026-10-25'),'25 Oct 2026');
});

test('person calendar contains the full month in Monday-to-Sunday rows',()=>{
 const weeks=date.calendarWeeks('2026-10-30');
 assert.equal(weeks.length,5);assert.ok(weeks.every(week=>week.length===7));
 assert.equal(weeks[0][0],'2026-09-28');assert.equal(weeks.at(-1).at(-1),'2026-11-01');
 const days=weeks.flat();assert.equal(new Set(days).size,35);
 assert.equal(days.filter(day=>day.startsWith('2026-10')).length,31);
 for(let i=1;i<days.length;i++)assert.equal(days[i],date.addDays(days[i-1],1));
});
test('person calendar supports four and six weeks, leap February and year boundaries',()=>{
 assert.equal(date.calendarWeeks('2021-02-15').length,4);
 assert.equal(date.calendarWeeks('2020-08-01').length,6);
 assert.ok(date.calendarWeeks('2024-02-01').flat().includes('2024-02-29'));
 const january=date.calendarWeeks('2027-01-01').flat();assert.equal(january[0],'2026-12-28');assert.equal(january.at(-1),'2027-01-31');
});
test('calendar week labels use the ISO week year at New Year',()=>{
 assert.deepEqual(date.isoWeek('2021-01-01'),{year:2020,week:53});
 assert.deepEqual(date.isoWeek('2024-12-30'),{year:2025,week:1});
 assert.deepEqual(date.isoWeek('2026-10-30'),{year:2026,week:44});
 assert.equal(date.weekRangeLabel('2020-12-28','2021-01-10'),'CW 53/2020 – CW 1/2021');
});
test('minimal mode spans three complete calendar months, including leap years',()=>{
 for(const [anchor,count,end] of [['2026-10-30',92,'2026-12-31'],['2026-12-10',90,'2027-02-28'],['2024-01-15',91,'2024-03-31']]){
  const days=date.datesForView(anchor,'minimal');assert.equal(days.length,count);assert.equal(days[0],`${anchor.slice(0,7)}-01`);assert.equal(days.at(-1),end);
 }
});
test('period navigation advances full months without skipping short months',()=>{
 assert.equal(date.shiftViewAnchor('2026-01-31','user',1),'2026-02-01');
 assert.equal(date.shiftViewAnchor('2026-03-31','month',-1),'2026-02-01');
 assert.equal(date.shiftViewAnchor('2026-11-30','minimal',1),'2027-02-01');
 assert.equal(date.shiftViewAnchor('2026-10-26','week',1),'2026-11-02');
 assert.equal(date.shiftViewAnchor('2026-10-26','fourWeeks',-1),'2026-09-28');
});
test('day view contains exactly the anchor date and navigates across month and year boundaries',()=>{
 assert.deepEqual(date.datesForView('2026-10-31','day'),['2026-10-31']);
 assert.equal(date.shiftViewAnchor('2026-10-31','day',1),'2026-11-01');
 assert.equal(date.shiftViewAnchor('2027-01-01','day',-1),'2026-12-31');
 assert.equal(date.shiftViewAnchor('2024-02-28','day',1),'2024-02-29');
});
test('demo statistics cover 28 days with consistent shift, status and weekly totals',()=>{
 const stats=demoEmployeeStats(1001,'2026-10-30');
 assert.equal(stats.start,'2026-10-03');assert.equal(stats.end,'2026-10-30');
 assert.equal(Object.values(stats.shifts).reduce((a,b)=>a+b,0),28);
 assert.equal(Object.values(stats.statuses).reduce((a,b)=>a+b,0),28);
 assert.equal(stats.weeks.length,4);
 for(const week of stats.weeks)assert.equal(Object.values(week.counts).reduce((a,b)=>a+b,0),7);
 for(const code of ['E','L','N','OFF'])assert.equal(stats.weeks.reduce((total,week)=>total+week.counts[code],0),stats.shifts[code]);
 assert.deepEqual(demoEmployeeStats(1001,'2026-10-30'),stats);
});
