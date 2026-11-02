import {assignmentKey,isNonWorkingShift,type Assignment,type AssignmentPatch,type ShiftCode} from './types';

export type ResolvedAssignment=Assignment & {expectedVersion?:number|null};
export const indexAssignments=(assignments:Assignment[])=>new Map(assignments.map(assignment=>[assignmentKey(assignment.employeeId,assignment.date),assignment]));

export function resolveAssignment(base:ResolvedAssignment|undefined,edit:AssignmentPatch|undefined):ResolvedAssignment|undefined {
 if(!edit)return base;
 const unchanged=base?.shiftCode===edit.shiftCode&&base.areaId===edit.areaId;
 return {...base,...edit,version:base?.version??0,locked:base?.locked,compatibility:unchanged?base.compatibility:'unknown',expectedVersion:base?.expectedVersion!==undefined?base.expectedVersion:base?.version??edit.expectedVersion};
}

export function effectiveAssignments(assignments:Assignment[],edits:Record<string,AssignmentPatch>) {
 const result=new Map<string,ResolvedAssignment>(assignments.map(assignment=>[assignmentKey(assignment.employeeId,assignment.date),{...assignment,expectedVersion:assignment.version}]));
 for(const edit of Object.values(edits)){
  const key=assignmentKey(edit.employeeId,edit.date);
  result.set(key,resolveAssignment(result.get(key),edit)!);
 }
 return result;
}

export function buildAssignmentPatch(employeeId:number,date:string,value:{shiftCode:ShiftCode;areaId:number|null},base:Assignment|undefined,current:Assignment|undefined):AssignmentPatch|undefined {
 if(current?.locked)return;
 const next={...value,areaId:isNonWorkingShift(value.shiftCode)?null:value.areaId};
 if(current?.shiftCode===next.shiftCode&&current.areaId===next.areaId)return;
 return {employeeId,date,...next,expectedVersion:base?.version??null};
}
