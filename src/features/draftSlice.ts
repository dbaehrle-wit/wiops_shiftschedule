import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AssignmentPatch } from '../model/types';
import { assignmentKey } from '../model/types';
type PatchMap = Record<string,AssignmentPatch>;
interface DraftState { edits:PatchMap; past:PatchMap[]; future:PatchMap[]; saving:boolean; error:string|null; }
const initialState:DraftState={edits:{},past:[],future:[],saving:false,error:null};
const slice=createSlice({name:'draft',initialState,reducers:{
 stageMany(state,action:PayloadAction<AssignmentPatch[]>) {state.past.push({...state.edits}); if(state.past.length>50)state.past.shift();state.future=[];for(const edit of action.payload)state.edits[assignmentKey(edit.employeeId,edit.date)]=edit;state.error=null;},
 undo(state){const previous=state.past.pop();if(previous){state.future.push({...state.edits});state.edits=previous;}},
 redo(state){const next=state.future.pop();if(next){state.past.push({...state.edits});state.edits=next;}},
 removeEmployee(state,action:PayloadAction<number>){
  for(const map of [state.edits,...state.past,...state.future])for(const key of Object.keys(map))if(map[key].employeeId===action.payload)delete map[key];
 },
 clearDraft(state){state.edits={};state.past=[];state.future=[];state.error=null;},
 setSaving(state,action:PayloadAction<boolean>){state.saving=action.payload;},
 setDraftError(state,action:PayloadAction<string|null>){state.error=action.payload;}
}});
export const draftActions=slice.actions;export default slice.reducer;
