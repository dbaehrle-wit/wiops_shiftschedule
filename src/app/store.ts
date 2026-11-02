import { configureStore } from '@reduxjs/toolkit';
import { plannerApi } from '../api/plannerApi';
import draft from '../features/draftSlice';
import ui from '../features/uiSlice';
export const createIslandStore=()=>configureStore({reducer:{[plannerApi.reducerPath]:plannerApi.reducer,draft,ui},middleware:getDefault=>getDefault().concat(plannerApi.middleware)});
export type IslandStore=ReturnType<typeof createIslandStore>;
export type RootState=ReturnType<IslandStore['getState']>;
export type AppDispatch=IslandStore['dispatch'];
