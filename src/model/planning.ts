import {assignmentKey,isWorkingShift,isNonWorkingShift,type Assignment,type AssignmentPatch,type Employee,type Area,type ShiftCode} from './types';
import {addDays,isWeekend,startOfWeek} from '../utils/date';

import type {ResolvedAssignment} from './assignments';
export {effectiveAssignments} from './assignments';

export function filterPlanningEmployees(employees:Employee[],dates:string[],assignments:Map<string,Assignment>,department:string,areaId:number|null) {
 return employees.filter(employee=>(department==='all'||employee.department===department)&&(areaId===null||dates.some(date=>{
  const assignment=assignments.get(assignmentKey(employee.id,date));
  return assignment&&isWorkingShift(assignment.shiftCode)&&assignment.areaId===areaId;
 })));
}

export function coverageForAreas(areas:Area[],employees:Employee[],dates:string[],assignments:Map<string,Assignment>) {
 return areas.map(area=>{
  const days=dates.map(date=>{
   const counts={E:0,L:0,N:0};
   for(const employee of employees){const assignment=assignments.get(assignmentKey(employee.id,date));if(assignment&&assignment.areaId===area.id&&isWorkingShift(assignment.shiftCode))counts[assignment.shiftCode]++;}
   const planned=counts.E+counts.L+counts.N,target=area.defaultRequired;
   return {date,counts,planned,gap:target==null?null:Math.max(0,target-planned)};
  });
  const planned=days.reduce((sum,day)=>sum+day.planned,0),target=area.defaultRequired==null?null:area.defaultRequired*dates.length;
  return {area,days,planned,target,gap:target==null?null:days.reduce((sum,day)=>sum+(day.gap??0),0),coveredDays:days.filter(day=>day.gap===0).length,shifts:{E:days.reduce((sum,day)=>sum+day.counts.E,0),L:days.reduce((sum,day)=>sum+day.counts.L,0),N:days.reduce((sum,day)=>sum+day.counts.N,0)}};
 });
}

export interface RotationPattern {id:string;name:string;shifts:ShiftCode[];cycleWeeks:1|2|4}
export const DEFAULT_ROTATIONS:RotationPattern[]=[
 {id:'three-week',name:'3-Week Rotation (E/L/N)',shifts:['E','L','N'],cycleWeeks:1},
 {id:'two-week',name:'2-Week Early/Late',shifts:['E','L'],cycleWeeks:1}
];
export interface AutoPlanConfig {
 mode:'manual'|'automatic';department:string;shiftGroup:string;startDate:string;endDate:string;
 manualShift:ShiftCode;pattern:RotationPattern;areaId:number|null;fallbackAreaId:number|null;
 includeWeekends:boolean;replaceExisting:boolean;
}
export interface PlannedCell {employeeId:number;date:string;shiftCode:ShiftCode;areaId:number|null;previous?:Assignment;status:'changed'|'unchanged'|'locked'|'preserved'}
export function planningDates(start:string,end:string,includeWeekends:boolean) {
 const valid=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(`${date}T12:00:00Z`))&&new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)===date;
 if(!valid(start)||!valid(end)||end<start)throw new Error('Choose a valid start and end date.');
 const count=Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/86400000)+1;
 if(count>366)throw new Error('Choose a planning window of up to 366 days.');
 return Array.from({length:count},(_,i)=>addDays(start,i)).filter(date=>includeWeekends||!isWeekend(date));
}
export function buildAutoPlan(config:AutoPlanConfig,employees:Employee[],areas:Area[],assignments:Map<string,ResolvedAssignment>) {
 const dates=planningDates(config.startDate,config.endDate,config.includeWeekends);
 if(!dates.length)throw new Error('The selected window has no working days. Include weekends or extend the range.');
 if(config.mode==='automatic'&&(!config.pattern.shifts.length||!config.pattern.shifts.every(code=>['E','L','N','OFF','S','P'].includes(code))||![1,2,4].includes(config.pattern.cycleWeeks)))throw new Error('Choose a valid rotation pattern.');
 const validAreas=new Set(areas.map(area=>area.id));
 if(config.areaId!==null&&!validAreas.has(config.areaId)||config.fallbackAreaId!==null&&!validAreas.has(config.fallbackAreaId))throw new Error('Choose a valid work area.');
 const scope=employees.filter(employee=>(config.department==='all'||employee.department===config.department)&&(config.shiftGroup==='all'||employee.shiftGroup===config.shiftGroup)).sort((a,b)=>a.id-b.id);
 const cells:PlannedCell[]=[],patches:AssignmentPatch[]=[];
 scope.forEach((employee,index)=>dates.forEach(date=>{
  const weekOffset=Math.round((Date.parse(`${startOfWeek(date)}T12:00:00Z`)-Date.parse(`${startOfWeek(config.startDate)}T12:00:00Z`))/(7*86400000));
  const shiftCode=config.mode==='manual'?config.manualShift:config.pattern.shifts[(index+Math.floor(weekOffset/config.pattern.cycleWeeks))%config.pattern.shifts.length];
  const previous=assignments.get(assignmentKey(employee.id,date));
  const areaId=isNonWorkingShift(shiftCode)?null:config.areaId??(previous?.areaId!=null&&validAreas.has(previous.areaId)?previous.areaId:config.fallbackAreaId);
  if(isWorkingShift(shiftCode)&&areaId===null)throw new Error('Choose a fallback area for unassigned working shifts.');
  const status=previous?.locked?'locked':previous&&!config.replaceExisting?'preserved':previous?.shiftCode===shiftCode&&previous.areaId===areaId?'unchanged':'changed';
  cells.push({employeeId:employee.id,date,shiftCode,areaId,previous,status});
  if(status==='changed')patches.push({employeeId:employee.id,date,shiftCode,areaId,expectedVersion:previous?.expectedVersion!==undefined?previous.expectedVersion:previous?.version??null});
 }));
 return {dates,employees:scope,cells,patches,locked:cells.filter(cell=>cell.status==='locked').length,preserved:cells.filter(cell=>cell.status==='preserved').length};
}
