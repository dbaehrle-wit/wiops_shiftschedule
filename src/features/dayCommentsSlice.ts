import {createSlice,type PayloadAction} from '@reduxjs/toolkit';
// Session-only mockup, scoped by site, employee and date.
export const dayCommentKey=(siteId:number,employeeId:number,date:string)=>`${siteId}|${employeeId}|${date}`;
const slice=createSlice({name:'dayComments',initialState:{} as Record<string,string>,reducers:{
 setComment(state,{payload}:PayloadAction<{key:string;comment:string}>){
  const comment=payload.comment.trim();
  if(comment)state[payload.key]=comment;else delete state[payload.key];
 }
}});
export const dayCommentsActions=slice.actions;
export default slice.reducer;
