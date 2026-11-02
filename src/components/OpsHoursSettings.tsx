import {useId,useState} from 'react';
import {Alert,Box,Button,Chip,Dialog,DialogActions,DialogContent,DialogTitle,Stack,TextField,Typography} from '@mui/material';
import type {Area,OperatingWindow} from '../model/types';
import {validOpsConfig,type OpsConfig} from '../model/opsHours';
import {PlannerSelect} from './PlannerControls';

export function OpsHoursSettings({config,departments,areas,initialDepartment,initialAreaId,onSave,onClose}:{config:OpsConfig;departments:string[];areas:Area[];initialDepartment?:string;initialAreaId?:number;onSave:(config:OpsConfig)=>void;onClose:()=>void}) {
 const id=useId(),[draft,setDraft]=useState(()=>structuredClone(config)),[department,setDepartment]=useState(initialDepartment??departments[0]??''),[areaId,setAreaId]=useState(initialAreaId??areas[0]?.id??0);
 const profile=draft.profiles.find(profile=>profile.department===department&&profile.areaId===areaId),windows=profile?.windows??[];
 const updateWindows=(windows:OperatingWindow[])=>setDraft(current=>({...current,profiles:[...current.profiles.filter(profile=>profile.department!==department||profile.areaId!==areaId),{department,areaId,windows}]}));
 const updateWindow=(index:number,changes:Partial<OperatingWindow>)=>updateWindows(windows.map((window,i)=>i===index?{...window,...changes}:window));
 const numeric=(value:string)=>value===''?NaN:Number(value),display=(value:number)=>Number.isFinite(value)?value:'';
 return <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby={`${id}-title`}>
  <DialogTitle id={`${id}-header`} component="div"><Typography id={`${id}-title`} component="h2" variant="h6">Operating hours settings</Typography><Typography variant="body2" color="text.secondary">Whole site-local hours. Settings are saved in this browser for this site.</Typography></DialogTitle>
  <DialogContent dividers><Stack spacing={2.5}>
   <Typography component="h3" variant="subtitle1" fontWeight={700}>Shift times</Typography>
   {(['E','L','N'] as const).map(code=><Stack key={code} direction="row" flexWrap="wrap" alignItems="center" gap={1.5}><Typography sx={{minWidth:90}} fontWeight={700}>{code==='E'?'Early (E)':code==='L'?'Late (L)':'Night (N)'}</Typography>{(['startHour','endHour'] as const).map(field=><TextField key={field} size="small" type="number" label={`${code} ${field==='startHour'?'start':'end'} hour`} value={display(draft.shifts[code][field])} onChange={event=>setDraft(current=>({...current,shifts:{...current.shifts,[code]:{...current.shifts[code],[field]:numeric(event.target.value)}}}))} slotProps={{htmlInput:{min:0,max:field==='startHour'?23:24,step:1}}} sx={{width:130}}/>)}</Stack>)}
   <Alert severity="info">A shift belongs to the date it starts. An end hour earlier than the start continues into the next day. Use 0 to 24 for a full-day operating window; equal start/end hours are invalid.</Alert>
   <Typography component="h3" variant="subtitle1" fontWeight={700}>Operating windows and hourly targets</Typography>
   <Stack direction="row" flexWrap="wrap" gap={1.5}><PlannerSelect label="Operating department" value={department} options={departments.map(value=>({value,label:value}))} width={180} onChange={setDepartment}/><PlannerSelect label="Operating area" value={areaId} options={areas.map(area=>({value:area.id,label:area.code}))} onChange={setAreaId}/></Stack>
   {!windows.length&&<Typography variant="body2" color="text.secondary">No operating windows. This lane will show a gray baseline with no target.</Typography>}
   {windows.map((window,index)=><Box key={index} sx={{p:2,border:'1px solid #dbe3ec',borderRadius:2}}><Stack direction="row" flexWrap="wrap" gap={.75} sx={{mb:2}}>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,dayIndex)=><Chip key={day} label={day} size="small" clickable aria-pressed={window.days.includes(dayIndex)} color={window.days.includes(dayIndex)?'primary':'default'} onClick={()=>updateWindow(index,{days:window.days.includes(dayIndex)?window.days.filter(day=>day!==dayIndex):[...window.days,dayIndex]})}/>)}</Stack><Stack direction="row" flexWrap="wrap" alignItems="center" gap={1.5}>
    {(['startHour','endHour','target'] as const).map(field=><TextField key={field} size="small" type="number" label={`Window ${index+1} ${field==='target'?'target':field==='startHour'?'start hour':'end hour'}`} value={display(window[field])} onChange={event=>updateWindow(index,{[field]:numeric(event.target.value)})} slotProps={{htmlInput:{min:0,max:field==='target'?999:field==='startHour'?23:24,step:1}}} sx={{width:145}}/>)}
    <Button size="small" color="error" onClick={()=>updateWindows(windows.filter((_,i)=>i!==index))}>Remove window</Button>
   </Stack></Box>)}
   <Button variant="outlined" disabled={!department||!areaId} onClick={()=>updateWindows([...windows,{days:[0,1,2,3,4],startHour:6,endHour:22,target:1}])}>Add operating window</Button>
   {!validOpsConfig(draft)&&<Alert severity="warning">Use whole hours (start 0-23, end 0-24), different start/end times, and targets from 0 to 999.</Alert>}
   <Typography variant="caption" color="text.secondary">Overlapping operating windows use the highest target, not their sum. Changing these settings recalculates the chart without changing shift assignments. The chart uses 168 nominal local-hour slots; daylight-saving transitions are not expanded or collapsed.</Typography>
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={!validOpsConfig(draft)} onClick={()=>onSave(draft)}>Save settings</Button></DialogActions>
 </Dialog>;
}
