import type {ShiftCode} from './types';
import {addDays} from '../utils/date';
export type DemoDayStatus='Scheduled'|'Off'|'PTO'|'Sick';
export function demoEmployeeStats(employeeId:number,asOf:string) {
 const pattern:ShiftCode[]=['E','E','L','L','N','OFF','OFF'];
 const days=Array.from({length:28},(_,i)=>{
  const shift=pattern[(i+employeeId)%7];
  const status:DemoDayStatus=shift==='OFF'?'Off':(i+employeeId)%17===0?'Sick':(i+employeeId)%11===0?'PTO':'Scheduled';
  return {date:addDays(asOf,i-27),shift,status};
 });
 const shifts={E:0,L:0,N:0,OFF:0,S:0,P:0},statuses:Record<DemoDayStatus,number>={Scheduled:0,Off:0,PTO:0,Sick:0};
 for(const day of days){shifts[day.shift]++;statuses[day.status]++;}
 const weeks=Array.from({length:4},(_,i)=>{
  const group=days.slice(i*7,i*7+7),counts={E:0,L:0,N:0,OFF:0,S:0,P:0};
  group.forEach(day=>counts[day.shift]++);
  return {start:group[0].date,end:group[6].date,counts};
 });
 return {start:days[0].date,end:asOf,shifts,statuses,weeks};
}
