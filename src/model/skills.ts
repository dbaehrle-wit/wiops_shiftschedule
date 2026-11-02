import {isNonWorkingShift} from './types';
import type {Area,Compatibility,Employee,EmployeeSkill,ShiftCode,SkillDefinition,SkillRequirement} from './types';
import {addDays} from '../utils/date';

export type SkillCheckStatus='valid'|'expiring'|'expired'|'missing'|'unknown';
export interface SkillCheck {skillId:string;name:string;constraint:SkillRequirement['constraint'];status:SkillCheckStatus;severity:Compatibility;validUntil?:string}
export interface SkillAssessment {status:Compatibility|'off';summary:string;checks:SkillCheck[]}
export const SKILL_STATUS_LABELS:Record<Compatibility|'off',string>={ok:'Qualified',warning:'Skill warning',blocked:'Skill requirement not met',unknown:'Skills unchecked',off:'Off - no skills required'};
function credentialStatus(record:EmployeeSkill|undefined,date:string):SkillCheckStatus {
 if(!record)return 'missing';
 if(record.status==='missing'||record.status==='unknown')return record.status;
 if(record.validUntil){
  const valid=/^\d{4}-\d{2}-\d{2}$/.test(record.validUntil)&&!Number.isNaN(Date.parse(`${record.validUntil}T12:00:00Z`))&&new Date(`${record.validUntil}T12:00:00Z`).toISOString().slice(0,10)===record.validUntil;
  if(!valid)return 'unknown';
  if(record.validUntil<date)return 'expired';
  if(record.validUntil<=addDays(date,30))return 'expiring';
  return 'valid';
 }
 return record.status;
}
export function assessAssignmentSkills(employee:Employee,area:Area|undefined,date:string,shift:ShiftCode|undefined,definitions:SkillDefinition[]|undefined):SkillAssessment {
 if(!shift)return {status:'unknown',summary:'Unplanned - no assignment to assess',checks:[]};
 if(isNonWorkingShift(shift))return {status:'off',summary:`${shift==='S'?'Sick leave':shift==='P'?'PTO':'Off'} - no skills required`,checks:[]};
 if(!area)return {status:'unknown',summary:'No work area - skills cannot be checked',checks:[]};
 if(!area.skillRequirements)return {status:'unknown',summary:'Skill requirements have not been supplied for this area',checks:[]};
 if(!area.skillRequirements.length)return {status:'ok',summary:'No skill requirements for this area',checks:[]};
 const checks=area.skillRequirements.map(requirement=>{
  const definition=definitions?.find(skill=>skill.id===requirement.skillId);
  const status=!definition||employee.skills===undefined?'unknown':credentialStatus(employee.skills[requirement.skillId],date);
  const severity:Compatibility=status==='unknown'?'unknown':status==='valid'?'ok':status==='expiring'?'warning':requirement.constraint==='hard'?'blocked':'warning';
  return {...requirement,name:definition?.name??requirement.skillId,status,severity,validUntil:employee.skills?.[requirement.skillId]?.validUntil};
 });
 const status:Compatibility=checks.some(check=>check.severity==='blocked')?'blocked':checks.some(check=>check.severity==='warning')?'warning':checks.some(check=>check.severity==='unknown')?'unknown':'ok';
 const issues=checks.filter(check=>check.severity!=='ok');
 return {status,checks,summary:issues.length?issues.map(check=>`${check.name}: ${check.status} (${check.constraint} requirement)`).join('; '):'Qualified - all area skill requirements met'};
}

// Keep selection renders cheap: reuse assessments until employees, requirements or definitions change.
export function createSkillAssessor(areas:Area[],definitions:SkillDefinition[]|undefined) {
 const areaById=new Map(areas.map(area=>[area.id,area])),cache=new Map<string,SkillAssessment>();
 return (employee:Employee,areaId:number|null|undefined,date:string,shift:ShiftCode|undefined)=>{
  const key=`${employee.id}|${areaId}|${date}|${shift}`;
  let result=cache.get(key);
  if(!result){result=assessAssignmentSkills(employee,areaId==null?undefined:areaById.get(areaId),date,shift,definitions);cache.set(key,result);}
  return result;
 };
}
