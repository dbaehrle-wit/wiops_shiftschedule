import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PlannerView, ShiftCode } from '../model/types';
import { startOfWeek, todayIso } from '../utils/date';
import {nextEmployeeSort,type EmployeeSort} from '../model/employeeSort';
interface CellPos {r:number;c:number}
interface UiState {showDayTimes:boolean;view:PlannerView;anchor:string;userId:number|null;departmentFilter:string;areaFilter:number|null;dayShift:'all'|ShiftCode;employeeSort:EmployeeSort|null;colorMode:'shift'|'skill';focus:CellPos|null;anchorCell:CellPos|null;selection:string[];}
const initialState:UiState={showDayTimes:false,view:'week',anchor:startOfWeek(todayIso()),userId:null,departmentFilter:'all',areaFilter:null,dayShift:'all',employeeSort:null,colorMode:'shift',focus:null,anchorCell:null,selection:[]};
const slice=createSlice({name:'ui',initialState,reducers:{
 setView(state,action:PayloadAction<PlannerView>){state.view=action.payload;state.selection=[];state.focus=null;state.anchorCell=null;},
 setAnchor(state,action:PayloadAction<string>){state.anchor=action.payload;state.selection=[];state.focus=null;state.anchorCell=null;},
 setUserId(state,action:PayloadAction<number|null>){state.userId=action.payload;state.selection=[];state.focus=null;state.anchorCell=null;},
 setDepartmentFilter(state,action:PayloadAction<string>){state.departmentFilter=action.payload;state.userId=null;state.selection=[];state.focus=null;state.anchorCell=null;},
 setAreaFilter(state,action:PayloadAction<number|null>){state.areaFilter=action.payload;state.userId=null;state.selection=[];state.focus=null;state.anchorCell=null;},
 setDayShift(state,action:PayloadAction<'all'|ShiftCode>){state.dayShift=action.payload;state.selection=[];state.focus=null;state.anchorCell=null;},
 cycleEmployeeSort(state){state.employeeSort=nextEmployeeSort(state.employeeSort);state.selection=[];state.focus=null;state.anchorCell=null;},
 setShowDayTimes(state,action:PayloadAction<boolean>){state.showDayTimes=action.payload;},
 setColorMode(state,action:PayloadAction<'shift'|'skill'>){state.colorMode=action.payload;},
 setSelection(state,action:PayloadAction<{keys:string[];focus:CellPos;anchor?:CellPos}>){state.selection=action.payload.keys;state.focus=action.payload.focus;state.anchorCell=action.payload.anchor??action.payload.focus;},
 clearSelection(state){state.selection=[];state.focus=null;state.anchorCell=null;}
}});
export const uiActions=slice.actions;export default slice.reducer;
