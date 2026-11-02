import {isNonWorkingShift} from '../model/types';
import {createDemoSnapshot} from './demoSeed';
import type { Assignment, PlannerSnapshot, SaveBatchRequest, SaveBatchResponse } from '../model/types';
let snapshot: PlannerSnapshot | undefined;
export function demoGet(siteId:number) { snapshot ??= createDemoSnapshot(siteId); return structuredClone(snapshot); }
export function demoSave(req:SaveBatchRequest):SaveBatchResponse {
 const current=demoGet(req.siteId);const map=new Map(current.assignments.map(a=>[`${a.employeeId}|${a.date}`,a]));
 const errors=req.operations.flatMap(op=>{const old=map.get(`${op.employeeId}|${op.date}`);return old && old.version!==op.expectedVersion?[{employeeId:op.employeeId,date:op.date,code:'VERSION_CONFLICT',message:'Assignment modified by another user'}]:[];});
 if(req.expectedPlanVersion!==current.planVersion || errors.length) return {requestId:req.requestId,status:'conflict',planVersion:current.planVersion,assignments:[],errors:errors.length?errors:[{employeeId:0,date:'',code:'PLAN_VERSION',message:'Plan changed. Reload required.'}]};
 const changed:Assignment[]=[];
 for(const op of req.operations){const old=map.get(`${op.employeeId}|${op.date}`);const next:Assignment={...old,...op,version:(old?.version??0)+1,compatibility:isNonWorkingShift(op.shiftCode)?'unknown':'ok'};map.set(`${op.employeeId}|${op.date}`,next);changed.push(next);}
 snapshot={...current,planVersion:current.planVersion+1,assignments:[...map.values()]};
 return {requestId:req.requestId,status:'committed',planVersion:snapshot.planVersion,assignments:changed};
}
