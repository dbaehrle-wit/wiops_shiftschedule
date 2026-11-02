import {isWorkingShift,type Assignment,type Employee,type Area,type OperatingProfile,type ShiftType} from './types';
import {addDays,startOfWeek} from '../utils/date';

export type WorkingCode='E'|'L'|'N';
export interface ShiftHours {startHour:number;endHour:number}
export interface OpsConfig {shifts:Record<WorkingCode,ShiftHours>;profiles:OperatingProfile[]}
export const DEFAULT_SHIFT_HOURS:OpsConfig['shifts']={E:{startHour:6,endHour:14},L:{startHour:14,endHour:22},N:{startHour:22,endHour:6}};
export function defaultOpsConfig(shifts:ShiftType[],profiles:OperatingProfile[]=[]):OpsConfig {
 return {shifts:Object.fromEntries((['E','L','N'] as const).map(code=>{const shift=shifts.find(shift=>shift.code===code);return [code,shift?.startHour!==undefined&&shift.endHour!==undefined&&validHours(shift.startHour,shift.endHour)?{startHour:shift.startHour,endHour:shift.endHour}:{...DEFAULT_SHIFT_HOURS[code]}];})) as OpsConfig['shifts'],profiles};
}
const validHours=(start:number,end:number)=>Number.isInteger(start)&&start>=0&&start<24&&Number.isInteger(end)&&end>=0&&end<=24&&start!==end;
export function validOpsConfig(value:unknown):value is OpsConfig {
 const config=value as OpsConfig|undefined;
 return Boolean(config&&config.shifts&&(['E','L','N'] as const).every(code=>config.shifts[code]&&validHours(config.shifts[code].startHour,config.shifts[code].endHour))&&Array.isArray(config.profiles)&&config.profiles.every(profile=>profile&&typeof profile.department==='string'&&Number.isInteger(profile.areaId)&&Array.isArray(profile.windows)&&profile.windows.every(window=>window&&validHours(window.startHour,window.endHour)&&Number.isInteger(window.target)&&window.target>=0&&window.target<=999&&Array.isArray(window.days)&&window.days.every(day=>Number.isInteger(day)&&day>=0&&day<=6))));
}
export interface OpsHour {date:string;hour:number;planned:number;target:number|null;operating:boolean;employeeIds:number[]}
export interface OpsLane {department:string;area:Area;hours:OpsHour[];configured:boolean;peak:number;staffHours:number;gapHours:number;outsideHours:number}

function targetAt(index:number,profile:OperatingProfile|undefined) {
 let target:number|null=null;
 const day=Math.floor(index/24);
 for(const startDay of [day-1,day])for(const window of profile?.windows??[]){
  if(!window.days.includes((startDay+7)%7))continue;
  const start=startDay*24+window.startHour,end=startDay*24+window.endHour+(window.endHour<window.startHour?24:0);
  if(index>=start&&index<end)target=Math.max(target??0,window.target);
 }
 return target;
}

// A fixed 168-slot site-local wall-clock week. Assignments belong to their shift-start date.
// Overnight shifts include carry-in from the preceding Sunday; OFF/S/P never create staffing.
export function buildOpsWeek(anchor:string,employees:Employee[],areas:Area[],assignments:Map<string,Assignment>,config:OpsConfig):OpsLane[] {
 const start=startOfWeek(anchor),startTime=Date.parse(`${start}T12:00:00Z`),departments=[...new Set(employees.map(employee=>employee.department))].sort();
 const employeeById=new Map(employees.map(employee=>[employee.id,employee]));
 const contributions=new Map<string,Set<number>[]>();
 for(const assignment of assignments.values()){
  const employee=employeeById.get(assignment.employeeId);if(!employee||!isWorkingShift(assignment.shiftCode)||assignment.areaId===null)continue;
  const day=Math.round((Date.parse(`${assignment.date}T12:00:00Z`)-startTime)/86400000);if(day< -1||day>6)continue;
  const times=config.shifts[assignment.shiftCode];
  const from=day*24+times.startHour,to=day*24+times.endHour+(times.endHour<times.startHour?24:0);
  const key=`${employee.department}|${assignment.areaId}`,slots=contributions.get(key)??Array.from({length:168},()=>new Set<number>());
  for(let hour=Math.max(0,from);hour<Math.min(168,to);hour++)slots[hour].add(employee.id);
  contributions.set(key,slots);
 }
 return departments.flatMap(department=>areas.map(area=>{
  const profile=config.profiles.find(profile=>profile.department===department&&profile.areaId===area.id),slots=contributions.get(`${department}|${area.id}`);
  const hours=Array.from({length:168},(_,index)=>{
   const target=targetAt(index,profile),employeeIds=[...(slots?.[index]??[])];
   return {date:addDays(start,Math.floor(index/24)),hour:index%24,planned:employeeIds.length,target,operating:target!==null,employeeIds};
  });
  return {department,area,hours,configured:profile!==undefined,peak:Math.max(0,...hours.map(hour=>hour.planned)),staffHours:hours.reduce((sum,hour)=>sum+hour.planned,0),gapHours:hours.filter(hour=>hour.operating&&hour.planned<hour.target!).length,outsideHours:hours.filter(hour=>!hour.operating).reduce((sum,hour)=>sum+hour.planned,0)};
 }));
}

export const hourLabel=(hour:number)=>`${String(hour).padStart(2,'0')}:00`;
