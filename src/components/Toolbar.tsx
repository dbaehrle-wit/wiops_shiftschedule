import {useId} from 'react';
import {Button,FormControl,InputLabel,MenuItem,Select,Stack,ToggleButton,ToggleButtonGroup,Typography} from '@mui/material';
import {useAppDispatch,useAppSelector} from '../app/hooks';
import {uiActions} from '../features/uiSlice';
import {datesForView,germanDate,shiftViewAnchor,weekRangeLabel} from '../utils/date';
import type {Area,Employee,PlannerView,SkillDefinition} from '../model/types';
import {SkillRequirementsButton} from './SkillUi';
import {PlannerSelect} from './PlannerControls';
import {PlannerHelp} from './PlannerHelp';
export function PlannerToolbar({employees,areas,skills,onAutoPlan,saving}:{employees:Employee[];areas:Area[];skills?:SkillDefinition[];onAutoPlan:()=>void;saving:boolean}){
 const dispatch=useAppDispatch();const ui=useAppSelector(s=>s.ui),id=useId();
 const dates=datesForView(ui.anchor,ui.view),start=dates[0],end=dates.at(-1)!;
 return <Stack spacing={1.5} sx={{p:1.5,bgcolor:'background.paper',borderBottom:'1px solid',borderColor:'divider'}}>
  <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5}>
   <Typography variant="h6" fontWeight={700}>WiOps · Shift Planner</Typography>
   <Stack spacing={.25}><Stack direction="row" alignItems="center" gap={.5}>
    <Button size="small" aria-label="Previous period" sx={{minWidth:28}} onClick={()=>dispatch(uiActions.setAnchor(shiftViewAnchor(ui.anchor,ui.view,-1)))}>‹</Button>
    <Typography variant="body2" sx={{textAlign:'center',fontVariantNumeric:'tabular-nums'}}>{germanDate(start)}{start!==end?` - ${germanDate(end)}`:''}</Typography>
    <Button size="small" aria-label="Next period" sx={{minWidth:28}} onClick={()=>dispatch(uiActions.setAnchor(shiftViewAnchor(ui.anchor,ui.view,1)))}>›</Button>
   </Stack><Typography data-testid="calendar-week-range" variant="caption" color="text.secondary" textAlign="center">{weekRangeLabel(start,end)}</Typography></Stack>
   <ToggleButtonGroup size="small" exclusive value={ui.view} onChange={(_,v:PlannerView|null)=>v&&dispatch(uiActions.setView(v))} sx={{maxWidth:'100%',flexWrap:'wrap'}}>
    <ToggleButton value="day">Day</ToggleButton><ToggleButton value="week">1 week</ToggleButton><ToggleButton value="fourWeeks">4 weeks</ToggleButton><ToggleButton value="month">Month</ToggleButton><ToggleButton value="user">Per user</ToggleButton><ToggleButton value="minimal">Minimal · 3 months</ToggleButton><ToggleButton value="areas">Areas</ToggleButton><ToggleButton value="opsHours">Ops hours</ToggleButton>
   </ToggleButtonGroup>
   {ui.view!=='areas'&&ui.view!=='opsHours'&&<PlannerSelect<'shift'|'skill'> label="Color" value={ui.colorMode} options={[{value:'shift',label:'Shift type'},{value:'skill',label:'Skills / requirements'}]} onChange={value=>dispatch(uiActions.setColorMode(value))}/>}
   {ui.view==='user'&&<FormControl size="small" sx={{minWidth:180}}><InputLabel id={`${id}-employee`}>Employee</InputLabel><Select labelId={`${id}-employee`} label="Employee" value={ui.userId??employees[0]?.id??''} onChange={e=>dispatch(uiActions.setUserId(Number(e.target.value)))}>{employees.map(e=><MenuItem key={e.id} value={e.id}>{e.fullName} - {e.role??'Operator'} - {e.department}</MenuItem>)}</Select></FormControl>}
   <Button variant="outlined" disabled={saving} onClick={onAutoPlan}>Auto-plan</Button><SkillRequirementsButton areas={areas} skills={skills}/><PlannerHelp/>
  </Stack>
 </Stack>
}
