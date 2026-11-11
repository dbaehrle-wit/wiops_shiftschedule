import {useId,useState} from 'react';
import {Alert,Box,Button,Chip,Dialog,DialogActions,DialogContent,DialogTitle,Stack,Table,TableBody,TableCell,TableHead,TableRow,Typography} from '@mui/material';
import type {Area,Employee} from '../model/types';
import {AREA_SKILL_STATES,employeeAreaSkill,SKILL_STATUS_LABELS,type SkillAssessment} from '../model/skills';
import {COMPACT_COLORS,SKILL_COLORS,SHIFT_CODES,SHIFT_COLORS,SHIFT_LABELS} from '../model/shiftDisplay';

export function PlannerColorLegend({mode,minimal=false}:{mode:'shift'|'skill';minimal?:boolean}) {
 const palette=minimal?COMPACT_COLORS:SHIFT_COLORS;
 const items=mode==='shift'?SHIFT_CODES.map(code=>({label:`${SHIFT_LABELS[code]} (${code})`,color:palette[code]})):[...AREA_SKILL_STATES.map(state=>({label:SKILL_STATUS_LABELS[state],color:SKILL_COLORS[state]})),...(['OFF','S','P'] as const).map(code=>({label:SHIFT_LABELS[code],color:palette[code]}))];
 return <Stack direction="row" flexWrap="wrap" gap={1.25} aria-label={mode==='shift'?'Shift color legend':'Skill color legend'}>{items.map(item=><Stack key={item.label} direction="row" alignItems="center" gap={.5}><Box aria-hidden sx={{width:10,height:10,bgcolor:item.color,border:'1px solid #94a3b8',borderRadius:.5}}/><Typography variant="caption">{item.label}</Typography></Stack>)}</Stack>;
}

export function SkillCheckDetails({assessment}:{assessment:SkillAssessment}) {
 const color=assessment.status==='off'?undefined:SKILL_COLORS[assessment.status];
 return <Box sx={{mt:2}}><Typography component="h3" variant="subtitle2" sx={{mb:1}}>Area skill level</Typography>
  <Alert severity={assessment.status==='notQualified'?'error':assessment.status==='unknown'||assessment.status==='off'?'info':'success'}>{assessment.summary}</Alert>
  {color&&<Chip size="small" label={SKILL_STATUS_LABELS[assessment.status]} sx={{mt:1,bgcolor:color,color:assessment.status==='expert'?'#fff':'#17365d'}}/>}
  <Typography variant="caption" color="text.secondary" sx={{display:'block',mt:1}}>The level belongs to the employee and selected work area. Missing levels mean not qualified. Skill colors do not prevent assignments.</Typography>
 </Box>;
}

export function AreaSkillsButton({areas,employees}:{areas:Area[];employees:Employee[]}) {
 const [open,setOpen]=useState(false),id=useId();
 return <><Button size="small" onClick={()=>setOpen(true)} aria-haspopup="dialog">Area skills</Button><Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="md" aria-labelledby={`${id}-title`}>
  <DialogTitle id={`${id}-header`} component="div"><Typography id={`${id}-title`} component="h2" variant="h6">Employee area skills</Typography><Typography variant="body2" color="text.secondary">Each employee has an independent skill level for every work area.</Typography></DialogTitle>
  <DialogContent dividers><PlannerColorLegend mode="skill"/>
   <Box sx={{overflowX:'auto',mt:2}}><Table size="small" aria-label="Employee area skills"><TableHead><TableRow><TableCell>Employee</TableCell>{areas.map(area=><TableCell key={area.id}>{area.code}</TableCell>)}</TableRow></TableHead><TableBody>{employees.map(employee=><TableRow key={employee.id}><TableCell sx={{whiteSpace:'nowrap'}}>{employee.fullName}<Typography variant="caption" display="block" color="text.secondary">{employee.department}</Typography></TableCell>{areas.map(area=>{const state=employeeAreaSkill(employee,area.id);return <TableCell key={area.id}><Chip size="small" label={SKILL_STATUS_LABELS[state]} sx={{bgcolor:SKILL_COLORS[state],color:state==='expert'?'#fff':'#17365d'}}/></TableCell>;})}</TableRow>)}</TableBody></Table></Box>
   {!employees.length&&<Typography variant="body2" sx={{mt:2}}>No employees match the active filters.</Typography>}
  </DialogContent><DialogActions><Button onClick={()=>setOpen(false)}>Close</Button></DialogActions>
 </Dialog></>;
}
