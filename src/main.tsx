import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {Provider} from 'react-redux';
import {createTheme,ThemeProvider,CssBaseline} from '@mui/material';
import {createIslandStore} from './app/store';
import {ShiftPlanner} from './components/ShiftPlanner';
import type {IslandBootstrap} from './model/types';
const theme=createTheme({palette:{primary:{main:'#235baa'},background:{default:'#f8fafc'}},shape:{borderRadius:9},typography:{fontFamily:'Inter,Arial,sans-serif'}});
export function mountShiftPlanner(element:HTMLElement,config:IslandBootstrap):()=>void{
 const store=createIslandStore();const root:Root=createRoot(element);
 root.render(<React.StrictMode><Provider store={store}><ThemeProvider theme={theme}><CssBaseline/><ShiftPlanner siteId={config.siteId}/></ThemeProvider></Provider></React.StrictMode>);
 return ()=>root.unmount();
}
// Standalone demo shell. Real EVE registry calls mountShiftPlanner on its widget container.
const demo=document.getElementById('root');if(demo)mountShiftPlanner(demo,{siteId:1});
