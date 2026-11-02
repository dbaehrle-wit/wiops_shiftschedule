import {useCallback,useMemo} from 'react';
import {useAppSelector} from '../app/hooks';
import {assignmentKey,type Assignment} from '../model/types';
import {indexAssignments,resolveAssignment} from '../model/assignments';

// One draft-overlay policy across all views, without rebuilding the whole effective map per cell.
export function usePlannerAssignments(assignments:Assignment[]) {
 const edits=useAppSelector(state=>state.draft.edits),saving=useAppSelector(state=>state.draft.saving);
 const baseAssignments=useMemo(()=>indexAssignments(assignments),[assignments]);
 const assignmentFor=useCallback((employeeId:number,date:string)=>{
  const key=assignmentKey(employeeId,date);
  return resolveAssignment(baseAssignments.get(key),edits[key]);
 },[baseAssignments,edits]);
 return {baseAssignments,assignmentFor,edits,saving};
}
