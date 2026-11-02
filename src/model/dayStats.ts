import {isWorkingShift} from './types';
import type {Area,Assignment,Employee,ShiftCode} from './types';
import {addDays,startOfWeek} from '../utils/date';

export const DAY_STATUSES=['Scheduled','Off','PTO','Sick','Unplanned'] as const;
export type DayStatus=typeof DAY_STATUSES[number];
export const STATUS_COLORS:Record<DayStatus,string>={Scheduled:'#75a7ef',Off:'#cbd5e1',PTO:'#5db49a',Sick:'#f6ad76',Unplanned:'#ede9fe'};
export type StatusCounts=Record<DayStatus,number>;
const emptyCounts=():StatusCounts=>({Scheduled:0,Off:0,PTO:0,Sick:0,Unplanned:0});

// Absence statuses remain deterministic demo values until real day statuses are supplied.
export function demoDayStatus(employeeId:number,date:string,shift:ShiftCode|undefined):DayStatus {
 if(!shift)return 'Unplanned';
 if(shift==='OFF')return 'Off';
 if(shift==='S')return 'Sick';
 if(shift==='P')return 'PTO';
 const day=Math.floor(new Date(`${date}T12:00:00Z`).getTime()/86400000),seed=employeeId+day;
 return seed%17===0?'Sick':seed%11===0?'PTO':'Scheduled';
}

export function dayAreaSummary({date,employees,areas,assignmentFor}:{
 date:string;employees:Employee[];areas:Area[];
 assignmentFor:(employeeId:number,date:string)=>Pick<Assignment,'shiftCode'|'areaId'>|undefined;
}) {
 const groups=new Map<number|null,{areaId:number|null;code:string;name:string;counts:StatusCounts;total:number;scheduled:number;people:{employee:Employee;shift:ShiftCode}[]}>(areas.map(area=>[area.id,{areaId:area.id,code:area.code,name:area.name,counts:emptyCounts(),total:0,scheduled:0,people:[]}]));
 const counts=emptyCounts();
 for(const employee of employees) {
  const assignment=assignmentFor(employee.id,date),candidate=isWorkingShift(assignment?.shiftCode)?assignment?.areaId:null;
  const areaId=candidate!=null&&groups.has(candidate)?candidate:null;
  if(!groups.has(areaId))groups.set(null,{areaId:null,code:'No area',name:'Off, leave or unassigned',counts:emptyCounts(),total:0,scheduled:0,people:[]});
  const status=demoDayStatus(employee.id,date,assignment?.shiftCode),group=groups.get(areaId)!;
  group.counts[status]++;group.total++;counts[status]++;
  if(assignment&&isWorkingShift(assignment.shiftCode)){group.scheduled++;group.people.push({employee,shift:assignment.shiftCode});}
 }
 return {date,counts,total:employees.length,areas:[...groups.values()]};
}

export function dayAndWeekSummary(options:Parameters<typeof dayAreaSummary>[0]) {
 const start=startOfWeek(options.date);
 return {...dayAreaSummary(options),week:Array.from({length:7},(_,i)=>dayAreaSummary({...options,date:addDays(start,i)}))};
}
