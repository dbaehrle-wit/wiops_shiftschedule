import {createSlice,type PayloadAction} from '@reduxjs/toolkit';
import type {DayTimes} from '../model/dayTimes';
const slice=createSlice({name:'dayTimes',initialState:{} as Record<string,DayTimes>,reducers:{
 setTimes(state,{payload}:PayloadAction<{key:string;times:DayTimes}>){
  if(payload.times.start||payload.times.end)state[payload.key]=payload.times;
  else delete state[payload.key];
 }
}});
export const dayTimesActions=slice.actions;
export default slice.reducer;
