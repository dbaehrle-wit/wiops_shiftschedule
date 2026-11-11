import {isNonWorkingShift} from './types';
import type {Area,AreaSkillState,Employee,ShiftCode} from './types';

export type SkillStatus=AreaSkillState|'unknown'|'off';
export interface SkillAssessment {status:SkillStatus;summary:string}
export const AREA_SKILL_STATES:AreaSkillState[]=['notQualified','qualified','intermediate','experienced','expert'];
export const SKILL_STATUS_LABELS:Record<SkillStatus,string>={notQualified:'Not qualified',qualified:'Qualified',intermediate:'Intermediate',experienced:'Experienced',expert:'Expert',unknown:'No area skill to display',off:'No work area'};

/** An absent or invalid level never implies qualification. No restriction or expiry rules. */
export function employeeAreaSkill(employee:Employee,areaId:number):AreaSkillState {
 const state=employee.areaSkills?.[areaId];
 return state&&AREA_SKILL_STATES.includes(state)?state:'notQualified';
}

export function assessAssignmentSkills(employee:Employee,area:Area|undefined,shift:ShiftCode|undefined):SkillAssessment {
 if(!shift)return {status:'unknown',summary:'Unplanned - no assignment to assess'};
 if(isNonWorkingShift(shift))return {status:'off',summary:`${shift==='S'?'Sick leave':shift==='P'?'PTO':'Off'} - no work area`};
 if(!area)return {status:'unknown',summary:'No work area - no area skill to display'};
 const status=employeeAreaSkill(employee,area.id);
 return {status,summary:`${area.code}: ${SKILL_STATUS_LABELS[status]}`};
}

// Key by employee object so refreshed employee data cannot reuse a stale level.
export function createSkillAssessor(areas:Area[]) {
 const areaById=new Map(areas.map(area=>[area.id,area])),cache=new WeakMap<Employee,Map<string,SkillAssessment>>();
 return (employee:Employee,areaId:number|null|undefined,date:string,shift:ShiftCode|undefined)=>{
  let employeeCache=cache.get(employee);
  if(!employeeCache){employeeCache=new Map();cache.set(employee,employeeCache);}
  const key=`${areaId}|${date}|${shift}`;
  let result=employeeCache.get(key);
  if(!result){result=assessAssignmentSkills(employee,areaId==null?undefined:areaById.get(areaId),shift);employeeCache.set(key,result);}
  return result;
 };
}
