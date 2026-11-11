import {useEffect,useId,useMemo,useState} from 'react';
import {Alert,Box,Button,Checkbox,Chip,Dialog,DialogActions,DialogContent,DialogTitle,FormControl,FormControlLabel,InputLabel,MenuItem,Select,Stack,Table,TableBody,TableCell,TableHead,TableRow,TextField,ToggleButton,ToggleButtonGroup,Typography} from '@mui/material';
import {useAppDispatch,useAppSelector} from '../app/hooks';
import {draftActions} from '../features/draftSlice';
import type {PlannerSnapshot,ShiftCode} from '../model/types';
import {buildAutoPlan,DEFAULT_ROTATIONS,effectiveAssignments,type AutoPlanConfig,type RotationPattern} from '../model/planning';
import {assignmentTextColor,assignmentColor,SHIFT_CODES,SHIFT_COLORS,SHIFT_LABELS} from '../model/shiftDisplay';
import {assessAssignmentSkills,SKILL_STATUS_LABELS} from '../model/skills';
import {PlannerColorLegend} from './SkillUi';
import {datesForView,displayDate} from '../utils/date';

const storageKey='wiops-shiftschedule.rotation-patterns.v1';
function loadPatterns():RotationPattern[] {
 try{
  const saved:unknown=JSON.parse(localStorage.getItem(storageKey)??'null');
  if(Array.isArray(saved)&&saved.length>0&&saved.every(pattern=>pattern&&typeof pattern.id==='string'&&typeof pattern.name==='string'&&[1,2,4].includes(pattern.cycleWeeks)&&Array.isArray(pattern.shifts)&&pattern.shifts.length>0&&pattern.shifts.every((shift:ShiftCode)=>SHIFT_CODES.includes(shift))))return saved;
 }catch{/* Use defaults if browser storage is unavailable or invalid. */}
 return DEFAULT_ROTATIONS;
}

function PatternEditor({pattern,onSave,onClose}:{pattern:RotationPattern;onSave:(pattern:RotationPattern)=>void;onClose:()=>void}) {
 const id=useId(),[name,setName]=useState(pattern.name),[cycleWeeks,setCycleWeeks]=useState(pattern.cycleWeeks),[shifts,setShifts]=useState(pattern.shifts);
 return <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby={`${id}-title`}>
  <DialogTitle id={`${id}-header`} component="div"><Typography id={`${id}-title`} component="h2" variant="h6">Configure rotation</Typography></DialogTitle>
  <DialogContent dividers><Stack spacing={2}>
   <TextField autoFocus label="Pattern name" value={name} onChange={event=>setName(event.target.value)} fullWidth/>
   <FormControl fullWidth><InputLabel id={`${id}-cycle`}>Rotation cycle</InputLabel><Select labelId={`${id}-cycle`} label="Rotation cycle" value={cycleWeeks} onChange={event=>setCycleWeeks(Number(event.target.value) as 1|2|4)}><MenuItem value={1}>Weekly rotation</MenuItem><MenuItem value={2}>Bi-weekly rotation</MenuItem><MenuItem value={4}>Monthly (4 weeks) rotation</MenuItem></Select></FormControl>
   <Typography variant="body2" color="text.secondary">Add shifts in order to build the repeating sequence. Repeat a shift to keep it for another cycle. Employees start at staggered positions in the sequence.</Typography>
   <Stack direction="row" flexWrap="wrap" gap={1}>{SHIFT_CODES.map(code=><Button key={code} variant="outlined" size="small" disabled={shifts.length>=28} onClick={()=>setShifts(current=>[...current,code])}>Add {code}</Button>)}</Stack>
   <Box sx={{p:2,bgcolor:'#f1f5f9',borderRadius:2}}><Typography variant="subtitle2" sx={{mb:1}}>Sequence pipeline</Typography><Stack direction="row" flexWrap="wrap" gap={1}>{shifts.map((code,index)=><Chip key={index} label={`${index+1}. ${code}`} sx={{bgcolor:SHIFT_COLORS[code]}} onDelete={()=>setShifts(current=>current.filter((_,i)=>i!==index))}/>)}{!shifts.length&&<Typography variant="body2" color="text.secondary">Add at least one shift.</Typography>}</Stack></Box>
   <Typography variant="caption" color="text.secondary">Patterns are saved in this browser. Base shift types are E, L, N, OFF, S and P.</Typography>
  </Stack></DialogContent>
  <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={!name.trim()||!shifts.length} onClick={()=>onSave({...pattern,name:name.trim(),shifts,cycleWeeks})}>Save pattern</Button></DialogActions>
 </Dialog>;
}

export function AutoPlanningDialog({snapshot,onClose}:{snapshot:PlannerSnapshot;onClose:()=>void}) {
 const dispatch=useAppDispatch(),ui=useAppSelector(state=>state.ui),edits=useAppSelector(state=>state.draft.edits),saving=useAppSelector(state=>state.draft.saving),id=useId();
 const [patterns,setPatterns]=useState(loadPatterns),[patternEditor,setPatternEditor]=useState<RotationPattern|null>(null),[storageError,setStorageError]=useState(false);
 const [config,setConfig]=useState<AutoPlanConfig>(()=>{
  const dates=datesForView(ui.anchor,ui.view);
  return {mode:'manual',department:ui.departmentFilter,shiftGroup:'all',startDate:dates[0],endDate:dates.at(-1)!,manualShift:ui.view==='day'&&ui.dayShift!=='all'?ui.dayShift:'E',pattern:patterns[0],areaId:ui.areaFilter,fallbackAreaId:snapshot.areas[0]?.id??null,includeWeekends:false,replaceExisting:true};
 });
 const [previewVisible,setPreviewVisible]=useState(false);
 const update=(changes:Partial<AutoPlanConfig>)=>{setConfig(current=>({...current,...changes}));setPreviewVisible(false);};
 const departments=[...new Set(snapshot.employees.map(employee=>employee.department))].sort(),shiftGroups=[...new Set(snapshot.employees.map(employee=>employee.shiftGroup).filter((group):group is string=>Boolean(group)))].sort();
 const assignments=useMemo(()=>effectiveAssignments(snapshot.assignments,edits),[snapshot.assignments,edits]);
 const preview=useMemo(()=>{try{return {plan:buildAutoPlan(config,snapshot.employees,snapshot.areas,assignments),error:''};}catch(error){return {plan:null,error:error instanceof Error?error.message:'Unable to generate preview.'};}},[config,snapshot.employees,snapshot.areas,assignments]);
 useEffect(()=>{setPreviewVisible(false);},[assignments]);
 const savePattern=(pattern:RotationPattern)=>{
  const next=patterns.some(item=>item.id===pattern.id)?patterns.map(item=>item.id===pattern.id?pattern:item):[...patterns,pattern];
  setPatterns(next);update({pattern});setPatternEditor(null);
  try{localStorage.setItem(storageKey,JSON.stringify(next));setStorageError(false);}catch{setStorageError(true);}
 };
 const removePattern=()=>{
  const next=patterns.filter(pattern=>pattern.id!==config.pattern.id);if(!next.length)return;
  setPatterns(next);update({pattern:next[0]});
  try{localStorage.setItem(storageKey,JSON.stringify(next));setStorageError(false);}catch{setStorageError(true);}
 };
 const plan=preview.plan;
 return <>
  <Dialog open onClose={onClose} fullWidth maxWidth="lg" aria-labelledby={`${id}-title`}>
   <DialogTitle id={`${id}-header`} component="div"><Typography id={`${id}-title`} component="h2" variant="h6">Automatic shift planning</Typography><Typography variant="body2" color="text.secondary">Choose a scope and review the plan before applying it as a draft.</Typography></DialogTitle>
   <DialogContent dividers><Stack spacing={2.5}>
    <ToggleButtonGroup exclusive value={config.mode} onChange={(_,value)=>value&&update({mode:value})} fullWidth color="primary" size="small"><ToggleButton value="manual">Manual shift</ToggleButton><ToggleButton value="automatic">Automatic (rotating)</ToggleButton></ToggleButtonGroup>
    <Box sx={{p:2,bgcolor:'#eff6ff',borderRadius:2}}><Typography variant="subtitle2">{config.mode==='manual'?'Manual shift planning':'Automatic rotating planning'}</Typography><Typography variant="body2" color="text.secondary">{config.mode==='manual'?'Apply the same selected shift to every employee in scope across the date range.':'Distribute employees through a repeating sequence. Each employee starts at the next position; rotations advance on Mondays every 1, 2, or 4 weeks.'}</Typography></Box>
    <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'1fr 1fr'},gap:2}}>
     <FormControl size="small"><InputLabel id={`${id}-department`}>Planning department</InputLabel><Select labelId={`${id}-department`} label="Planning department" value={config.department} onChange={event=>update({department:event.target.value})}><MenuItem value="all">All departments</MenuItem>{departments.map(department=><MenuItem key={department} value={department}>{department}</MenuItem>)}</Select></FormControl>
     <FormControl size="small"><InputLabel id={`${id}-group`}>Shift group</InputLabel><Select labelId={`${id}-group`} label="Shift group" value={config.shiftGroup} onChange={event=>update({shiftGroup:event.target.value})}><MenuItem value="all">All groups</MenuItem>{shiftGroups.map(group=><MenuItem key={group} value={group}>{group}</MenuItem>)}</Select></FormControl>
     <TextField size="small" label="Start date" type="date" value={config.startDate} slotProps={{inputLabel:{shrink:true}}} onChange={event=>update({startDate:event.target.value})}/>
     <TextField size="small" label="End date" type="date" value={config.endDate} slotProps={{inputLabel:{shrink:true}}} onChange={event=>update({endDate:event.target.value})}/>
     <FormControl size="small"><InputLabel id={`${id}-area`}>Planning work area</InputLabel><Select labelId={`${id}-area`} label="Planning work area" value={config.areaId??'keep'} onChange={event=>update({areaId:event.target.value==='keep'?null:Number(event.target.value)})}><MenuItem value="keep">Keep existing areas</MenuItem>{snapshot.areas.map(area=><MenuItem key={area.id} value={area.id}>{area.code}</MenuItem>)}</Select></FormControl>
     {config.areaId===null&&<FormControl size="small"><InputLabel id={`${id}-fallback`}>Fallback work area</InputLabel><Select labelId={`${id}-fallback`} label="Fallback work area" value={config.fallbackAreaId??''} onChange={event=>update({fallbackAreaId:Number(event.target.value)})}>{snapshot.areas.map(area=><MenuItem key={area.id} value={area.id}>{area.code}</MenuItem>)}</Select></FormControl>}
    </Box>
    {config.mode==='manual'?<FormControl fullWidth size="small"><InputLabel id={`${id}-shift`}>Manual shift</InputLabel><Select labelId={`${id}-shift`} label="Manual shift" value={config.manualShift} onChange={event=>update({manualShift:event.target.value as ShiftCode})}>{SHIFT_CODES.map(code=><MenuItem key={code} value={code}>{code} - {SHIFT_LABELS[code]}</MenuItem>)}</Select></FormControl>:<Box>
     <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} sx={{mb:1}}><Typography variant="subtitle2" sx={{mr:'auto'}}>Base rotation pattern</Typography><Button size="small" onClick={()=>setPatternEditor(config.pattern)}>Configure</Button><Button size="small" onClick={()=>setPatternEditor({id:crypto.randomUUID(),name:'New rotation',shifts:[],cycleWeeks:1})}>New pattern</Button><Button size="small" color="error" disabled={patterns.length<2} onClick={removePattern}>Delete pattern</Button></Stack>
     <FormControl fullWidth size="small"><InputLabel id={`${id}-pattern`}>Rotation pattern</InputLabel><Select labelId={`${id}-pattern`} label="Rotation pattern" value={config.pattern.id} onChange={event=>update({pattern:patterns.find(pattern=>pattern.id===event.target.value)!})}>{patterns.map(pattern=><MenuItem key={pattern.id} value={pattern.id}>{pattern.name}</MenuItem>)}</Select></FormControl>
     <Stack direction="row" flexWrap="wrap" gap={1} sx={{mt:1}}><Chip size="small" label={`Every ${config.pattern.cycleWeeks} week${config.pattern.cycleWeeks===1?'':'s'}`}/>{config.pattern.shifts.map((code,index)=><Chip key={index} size="small" label={`${index+1}. ${code}`} sx={{bgcolor:SHIFT_COLORS[code]}}/>)}</Stack>
    </Box>}
    <Stack direction="row" flexWrap="wrap" gap={2}><FormControlLabel control={<Checkbox checked={config.includeWeekends} onChange={event=>update({includeWeekends:event.target.checked})}/>} label="Include weekends"/><FormControlLabel control={<Checkbox checked={config.replaceExisting} onChange={event=>update({replaceExisting:event.target.checked})}/>} label="Replace existing shifts (including drafts)"/></Stack>
    <Alert severity="info">Locked cells are always preserved. OFF, sick leave and PTO clear the work area. Planning uses department and shift group scope; it does not enforce staffing targets, skills, or absences.</Alert>
    {storageError&&<Alert severity="warning">Browser storage is unavailable. Pattern changes will remain available only while this dialog is open.</Alert>}
    {preview.error&&<Alert severity="warning">{preview.error}</Alert>}
    {previewVisible&&plan&&<Box><Typography component="h3" variant="subtitle1" fontWeight={700}>Rotation preview</Typography><Typography variant="body2" sx={{mb:1}}>{plan.employees.length} employees - {plan.dates.length} planning days - {plan.patches.length} changes - {plan.locked} locked - {plan.preserved} existing assignments preserved</Typography>
     {!plan.employees.length&&<Alert severity="warning">No employees match this scope.</Alert>}
     <Typography variant="caption" color="text.secondary">Showing the first 6 employees and 14 planning days. Apply uses the entire selected window. Each changed cell shows its new shift and work area.</Typography>
     <Box sx={{mt:1}}><PlannerColorLegend mode={ui.colorMode}/></Box><Box sx={{overflowX:'auto',mt:1}}><Table size="small" aria-label="Auto-planning preview"><TableHead><TableRow><TableCell>Employee</TableCell>{plan.dates.slice(0,14).map(date=><TableCell key={date} sx={{whiteSpace:'nowrap'}}>{displayDate(date)}</TableCell>)}</TableRow></TableHead><TableBody>{plan.employees.slice(0,6).map(employee=><TableRow key={employee.id}><TableCell sx={{whiteSpace:'nowrap'}}>{employee.fullName}<Typography variant="caption" display="block" color="text.secondary">{employee.department} - {employee.shiftGroup??'No group'}</Typography></TableCell>{plan.cells.filter(cell=>cell.employeeId===employee.id).slice(0,14).map(cell=>{
      const kept=cell.status!=='changed',code=kept?cell.previous?.shiftCode:cell.shiftCode,areaId=kept?cell.previous?.areaId:cell.areaId;
      const assessment=assessAssignmentSkills(employee,snapshot.areas.find(area=>area.id===areaId),code);
      return <TableCell key={cell.date} title={cell.previous?`Previously ${cell.previous.shiftCode} / ${snapshot.areas.find(area=>area.id===cell.previous?.areaId)?.code??'No area'}`:'Previously unplanned'} sx={{bgcolor:code?assignmentColor(code,assessment.status,ui.colorMode):undefined,color:assignmentTextColor(code,assessment.status,ui.colorMode),'& .MuiTypography-root':{color:'inherit'},whiteSpace:'nowrap'}}>{code??'Unplanned'}<Typography variant="caption" display="block">{snapshot.areas.find(area=>area.id===areaId)?.code??'No area'}</Typography><Typography variant="caption" display="block" color="text.secondary">{cell.status==='changed'?'Change':cell.status==='locked'?'Locked':cell.status==='preserved'?'Keep existing':'Unchanged'}</Typography>{ui.colorMode==='skill'&&<Typography variant="caption" display="block" title={assessment.summary}>{assessment.status==='off'?assessment.summary:SKILL_STATUS_LABELS[assessment.status]}</Typography>}</TableCell>;
     })}</TableRow>)}</TableBody></Table></Box>
    </Box>}
   </Stack></DialogContent>
   <DialogActions sx={{flexWrap:'wrap',gap:1}}><Button onClick={onClose}>Cancel</Button><Button variant="outlined" disabled={!plan||!plan.employees.length||saving} onClick={()=>setPreviewVisible(true)}>Preview plan</Button><Button variant="contained" disabled={!previewVisible||!plan?.patches.length||saving} onClick={()=>{if(!plan||saving)return;dispatch(draftActions.stageMany(plan.patches));onClose();}}>Apply plan as draft</Button></DialogActions>
  </Dialog>
  {patternEditor&&<PatternEditor pattern={patternEditor} onSave={savePattern} onClose={()=>setPatternEditor(null)}/>}
 </>;
}
