import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { PlannerSnapshot, SaveBatchRequest, SaveBatchResponse } from '../model/types';
import { demoGet, demoSave } from './mock';
const DEMO = import.meta.env.VITE_DEMO !== 'false';
export const plannerApi = createApi({
 reducerPath:'plannerApi',baseQuery:fetchBaseQuery({baseUrl:import.meta.env.VITE_API_BASE || '/api/wiops',credentials:'include'}),
 tagTypes:['Planner'],endpoints:build=>({
  getPlanner:build.query<PlannerSnapshot,number>({
   ...(DEMO
    ? {queryFn:async(siteId:number)=>({data:demoGet(siteId)})}
    : {query:(siteId:number)=>`/sites/${siteId}/shift-planner`}),
   providesTags:['Planner']
  }),
  saveAssignments:build.mutation<SaveBatchResponse,SaveBatchRequest>({
   ...(DEMO
    ? {queryFn:async(req:SaveBatchRequest)=>({data:demoSave(req)})}
    : {query:(body:SaveBatchRequest)=>({url:`/sites/${body.siteId}/shift-planner/assignments:batch`,method:'POST',body})}),
   invalidatesTags:(result)=>result?.status==='committed'?['Planner']:[]
  })
 })
});
export const {useGetPlannerQuery,useSaveAssignmentsMutation}=plannerApi;
