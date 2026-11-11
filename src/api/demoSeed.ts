import {DEFAULT_SHIFT_HOURS} from '../model/opsHours';
import {SHIFT_CODES,SHIFT_LABELS} from '../model/shiftDisplay';
import type {AreaSkillState,Assignment,OperatingProfile,PlannerSnapshot,ShiftCode} from '../model/types';
import {addDays,startOfWeek,todayIso} from '../utils/date';

const DEPARTMENTS=['Freezer','Ambient'];
const NAMES=['Alex Morgan','Sam Taylor','Jamie Lee','Chris Weber','Jordan Smith','Casey Novak'];

function operatingProfiles():OperatingProfile[] {
 return DEPARTMENTS.flatMap(department=>[1,2,3,4].map(areaId=>({department,areaId,windows:areaId===3
  ? [{days:[0,1,2,3,4],startHour:6,endHour:22,target:2}]
  : [
   {days:[6],startHour:14,endHour:24,target:areaId===2?3:areaId===4?1:2},
   {days:[0,1,2,3],startHour:0,endHour:24,target:areaId===2?3:areaId===4?1:2},
   {days:[4],startHour:0,endHour:14,target:areaId===2?3:areaId===4?1:2}
  ]
 })));
}

function plannedShift(index:number,areaId:number,date:string,week:number):ShiftCode {
 const weekday=new Date(`${date}T12:00:00Z`).getUTCDay();
 if(areaId===3)return weekday>=1&&weekday<=5?(['E','L'] as const)[(index+week)%2]:'OFF';
 if(weekday===6)return 'OFF';
 if(weekday===0)return (index+week)%2===0?'L':'N';
 if(weekday===5)return 'E';
 return (['E','L','N'] as const)[(index+week)%3];
}

/** Small deterministic demo roster, with assignments aligned to the operating calendar. */
export function createDemoSnapshot(siteId:number,today=todayIso()):PlannerSnapshot {
 const states:AreaSkillState[]=['notQualified','qualified','intermediate','experienced','expert'];
 const employeeSkills=(index:number):Record<number,AreaSkillState>=>Object.fromEntries([1,2,3,4].map(areaId=>[areaId,states[(index+areaId-1)%states.length]]));
 const employees=NAMES.map((fullName,index)=>({id:1001+index,fullName,department:DEPARTMENTS[index%2],role:index<2?'Shift lead':'Operator',shiftGroup:['Group A','Group B','Group C'][index%3],mobileNumber:`+44 7700 900${String(index).padStart(3,'0')}`,radioNumber:`R-${101+index}`,areaSkills:employeeSkills(index)}));
 const start=addDays(startOfWeek(today),-28),assignments:Assignment[]=[];
 for(const [index,employee] of employees.entries())for(let day=0;day<140;day++){
  const date=addDays(start,day),week=Math.floor(day/7),areaId=(index+week)%4+1,shiftCode=plannedShift(index,areaId,date,week);
  assignments.push({employeeId:employee.id,date,shiftCode,areaId:shiftCode==='OFF'?null:areaId,compatibility:'unknown',version:1});
 }
 return {
  siteId,siteTimeZone:'Europe/Berlin',planVersion:1,operatingProfilesVersion:'two-departments-v1',employees,operatingProfiles:operatingProfiles(),
  areas:[
   {id:1,code:'COM',name:'COM',defaultRequired:2},
   {id:2,code:'Depal',name:'Depal',defaultRequired:3},
   {id:3,code:'Receiving',name:'Receiving',defaultRequired:2},
   {id:4,code:'Matrix',name:'Matrix',defaultRequired:1}
  ],
  shiftTypes:SHIFT_CODES.map(code=>({code,label:SHIFT_LABELS[code],...(code==='E'||code==='L'||code==='N'?DEFAULT_SHIFT_HOURS[code]:{})})),assignments
 };
}
