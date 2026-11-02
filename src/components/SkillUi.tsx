import {useId,useState} from 'react';
import {Alert,Box,Button,Chip,Dialog,DialogActions,DialogContent,DialogTitle,Stack,Table,TableBody,TableCell,TableHead,TableRow,Typography} from '@mui/material';
import type {Area,SkillDefinition} from '../model/types';
import type {SkillAssessment} from '../model/skills';
import {COMPACT_COLORS,COMPACT_SKILL_COLORS,COMPAT_COLORS,SHIFT_CODES,SHIFT_COLORS,SHIFT_LABELS} from '../model/shiftDisplay';

export function PlannerColorLegend({mode,minimal=false}:{mode:'shift'|'skill';minimal?:boolean}) {
 const palette=minimal?COMPACT_COLORS:SHIFT_COLORS,skillColors=minimal?COMPACT_SKILL_COLORS:COMPAT_COLORS;
 const items=mode==='shift'?SHIFT_CODES.map(code=>({label:`${SHIFT_LABELS[code]} (${code})`,color:palette[code]})):[{label:'Qualified',color:skillColors.ok},{label:'Warning / soft gap',color:skillColors.warning},{label:'Hard requirement gap',color:skillColors.blocked},{label:'Unchecked',color:skillColors.unknown},...(['OFF','S','P'] as const).map(code=>({label:SHIFT_LABELS[code],color:palette[code]}))];
 return <Stack direction="row" flexWrap="wrap" gap={1.25} aria-label={mode==='shift'?'Shift color legend':'Skill color legend'}>{items.map(item=><Stack key={item.label} direction="row" alignItems="center" gap={.5}><Box aria-hidden sx={{width:10,height:10,bgcolor:item.color,border:'1px solid #94a3b8',borderRadius:.5}}/><Typography variant="caption">{item.label}</Typography></Stack>)}</Stack>;
}

export function SkillCheckDetails({assessment}:{assessment:SkillAssessment}) {
 return <Box sx={{mt:2}}><Typography component="h3" variant="subtitle2" sx={{mb:1}}>Skill requirements</Typography><Alert severity={assessment.status==='blocked'?'error':assessment.status==='warning'?'warning':assessment.status==='ok'?'success':'info'}>{assessment.summary}</Alert>
  {!!assessment.checks.length&&<Box sx={{overflowX:'auto',mt:1}}><Table size="small" aria-label="Employee skill checks"><TableHead><TableRow><TableCell>Skill</TableCell><TableCell>Requirement</TableCell><TableCell>Status on this date</TableCell><TableCell>Valid until</TableCell></TableRow></TableHead><TableBody>{assessment.checks.map(check=><TableRow key={check.skillId}><TableCell>{check.name}</TableCell><TableCell>{check.constraint==='hard'?'Hard':'Soft'}</TableCell><TableCell><Chip size="small" label={check.status} color={check.severity==='blocked'?'error':check.severity==='warning'?'warning':check.severity==='ok'?'success':'default'} variant="outlined"/></TableCell><TableCell sx={{whiteSpace:'nowrap'}}>{check.validUntil??'Not recorded'}</TableCell></TableRow>)}</TableBody></Table></Box>}
  <Typography variant="caption" color="text.secondary" sx={{display:'block',mt:1}}>Skills are checked against the selected day and work area. Expiry within 30 days gives a warning. This client check highlights issues without preventing assignments.</Typography>
 </Box>;
}

export function SkillRequirementsButton({areas,skills}:{areas:Area[];skills:SkillDefinition[]|undefined}) {
 const [open,setOpen]=useState(false),id=useId();
 return <><Button size="small" onClick={()=>setOpen(true)} aria-haspopup="dialog">Skill requirements</Button><Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="md" aria-labelledby={`${id}-title`}>
  <DialogTitle id={`${id}-header`} component="div"><Typography id={`${id}-title`} component="h2" variant="h6">Area skill requirements</Typography><Typography variant="body2" color="text.secondary">Hard requirements produce red gaps; soft requirements and expiring credentials produce yellow warnings.</Typography></DialogTitle>
  <DialogContent dividers><Alert severity="info" sx={{mb:2}}>Demo mode uses sample employee qualifications and area requirements. Requirements supplied by the API are used when available; absent data stays unchecked.</Alert><PlannerColorLegend mode="skill"/>
   <Stack spacing={2} sx={{mt:2}}>{areas.map(area=><Box key={area.id} sx={{p:2,border:'1px solid #dbe3ec',borderRadius:2}}><Typography component="h3" variant="subtitle1" fontWeight={700}>{area.code}</Typography>{area.skillRequirements===undefined?<Typography variant="body2" color="text.secondary">Requirements not supplied - unchecked</Typography>:!area.skillRequirements.length?<Typography variant="body2" color="text.secondary">No skill requirements</Typography>:<Stack spacing={1} sx={{mt:1}}>{area.skillRequirements.map(requirement=><Stack key={requirement.skillId} direction="row" alignItems="center" gap={1}><Chip size="small" variant="outlined" label={requirement.constraint==='hard'?'Hard':'Soft'} color={requirement.constraint==='hard'?'error':'warning'}/><Typography variant="body2">{skills?.find(skill=>skill.id===requirement.skillId)?.name??`${requirement.skillId} (definition missing)`}</Typography></Stack>)}</Stack>}</Box>)}</Stack>
  </DialogContent><DialogActions><Button onClick={()=>setOpen(false)}>Close</Button></DialogActions>
 </Dialog></>;
}
