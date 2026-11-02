import {AbsenceRate} from './AbsenceRate';
import {absenceRateLabel,absenceDescription,type AbsenceReport} from '../model/absence';
import {useId,useState} from 'react';
import {Box,Button,ButtonBase,Chip,Dialog,DialogActions,DialogContent,DialogTitle,IconButton,Stack,Tooltip,Typography} from '@mui/material';
import CheckRounded from '@mui/icons-material/CheckRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import RemoveRounded from '@mui/icons-material/RemoveRounded';
import OpenInFullRounded from '@mui/icons-material/OpenInFullRounded';
import {SHIFT_COLORS} from '../model/shiftDisplay';
import type {coverageForAreas} from '../model/planning';

export function PlannerKpis({coverage,scopeLabel,absence}:{coverage:ReturnType<typeof coverageForAreas>;scopeLabel:string;absence:AbsenceReport}) {
 const [open,setOpen]=useState(false),id=useId();
 return <>
  <Stack component="section" aria-label="Staffing coverage KPIs" direction="row" alignItems="center" gap={1} sx={{flexShrink:0,height:42,px:1.5,borderTop:'1px solid #dbe3ec',bgcolor:'background.paper',minWidth:0}}>
   <Typography variant="caption" fontWeight={800} sx={{flexShrink:0}}>KPIs</Typography>
   <Tooltip title="Target / Planned assignments in the displayed period"><Typography variant="caption" color="text.secondary" sx={{flexShrink:0}}>T/P</Typography></Tooltip>
   <Stack direction="row" alignItems="center" gap={.75} sx={{flex:1,minWidth:0,overflowX:'auto',scrollbarWidth:'thin'}}>
    {coverage.map(item=>{
     const status=item.gap===null?'No target':item.gap>0?`${item.gap} staffing gap`:'Covered',StatusIcon=item.gap===null?RemoveRounded:item.gap>0?CloseRounded:CheckRounded;
     return <Tooltip key={item.area.id} title={`${item.area.code}: Target ${item.target??'not set'} / Planned ${item.planned}. ${status}. ${item.coveredDays}/${item.days.length} days covered. ${absenceDescription(absence.byArea[item.area.id],true)} Click for details.`}>
      <ButtonBase data-kpi-area={item.area.id} data-planned={item.planned} data-gap={item.gap} aria-label={`${item.area.code}: Target ${item.target??'not set'}, Planned ${item.planned}, ${status}. Absence ${absenceRateLabel(absence.byArea[item.area.id])}. Show KPI details`} onClick={()=>setOpen(true)} sx={{gap:.75,px:1,py:.5,borderRadius:1,whiteSpace:'nowrap',flexShrink:0,'&:hover':{bgcolor:'#f1f5f9'},'&:focus-visible':{outline:'2px solid #2563eb',outlineOffset:-2}}}>
       <Typography component="span" fontSize={12} fontWeight={700}>{item.area.code==='Depal'?'Dep':(item.area.code==='Receive'||item.area.code==='Receiving')?'Rec':item.area.code}</Typography><Typography component="span" fontSize={12} sx={{fontVariantNumeric:'tabular-nums'}}>{item.target??'n/a'}/{item.planned}</Typography><StatusIcon aria-hidden sx={{fontSize:17,color:item.gap===null?'text.secondary':item.gap>0?'warning.dark':'success.main'}}/>
       <AbsenceRate metric={absence.byArea[item.area.id]} area/>
      </ButtonBase>
     </Tooltip>;
    })}
   </Stack>
   <Button size="small" startIcon={<OpenInFullRounded sx={{fontSize:'16px !important'}}/>} aria-label="Expand staffing KPIs" aria-haspopup="dialog" aria-expanded={open} aria-controls={open?`${id}-dialog`:undefined} onClick={()=>setOpen(true)} sx={{flexShrink:0,minWidth:0,fontSize:11}}>Expand</Button>
  </Stack>
  <Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="lg" aria-labelledby={`${id}-title`} aria-describedby={`${id}-scope`} slotProps={{paper:{id:`${id}-dialog`,sx:{borderRadius:3}}}}>
   <DialogTitle id={`${id}-header`} component="div" sx={{pr:7}}><Typography id={`${id}-title`} component="h2" variant="h6" fontWeight={800}>Staffing coverage KPIs</Typography><Typography id={`${id}-scope`} variant="body2" color="text.secondary">{scopeLabel}. Includes drafts. Targets are demo daily headcounts for the whole site.</Typography><IconButton autoFocus aria-label="Close KPI details" onClick={()=>setOpen(false)} sx={{position:'absolute',right:12,top:12}}><CloseRounded/></IconButton></DialogTitle>
   <DialogContent dividers sx={{bgcolor:'#f8fafc'}}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{mb:2}}><Typography variant="body2" color="text.secondary">Gaps are calculated per day. Surplus staffing on one day does not cover a shortage on another.</Typography><Chip size="small" label="Demo targets" variant="outlined" sx={{flexShrink:0}}/></Stack>
    <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'repeat(2,minmax(0,1fr))',lg:'repeat(4,minmax(0,1fr))'},gap:1.5}}>
     {coverage.map(item=><Box key={item.area.id} data-kpi-detail-area={item.area.id} sx={{p:2,bgcolor:'background.paper',border:'1px solid #dbe3ec',borderRadius:2}}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{mb:1}}><Typography fontWeight={800}>{item.area.code}</Typography><Chip size="small" color={item.gap==null?'default':item.gap>0?'warning':'success'} variant="outlined" label={item.gap==null?'No target':item.gap>0?`${item.gap} staffing gap`:'Covered'}/></Stack>
      <Typography variant="body2" sx={{mb:.5}}><strong>{item.planned}</strong> planned / {item.target??'n/a'} target assignments</Typography>
      <Typography variant="caption" color="text.secondary">{item.area.defaultRequired??'No'} target per day - {item.gap===null?'No coverage target':`${item.coveredDays}/${item.days.length} days covered`}</Typography>
      <Typography variant="body2" sx={{mt:1}} title={absenceDescription(absence.byArea[item.area.id],true)}>Absence <strong>{absenceRateLabel(absence.byArea[item.area.id])}</strong></Typography>
      <Typography variant="caption" color="text.secondary">OFF {absence.byArea[item.area.id]?.off??0} / PTO {absence.byArea[item.area.id]?.pto??0} / Sick {absence.byArea[item.area.id]?.sick??0}</Typography>
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{mt:1.25}}>{(['E','L','N'] as const).map(code=><Chip size="small" key={code} label={`${code}: ${item.shifts[code]}`} sx={{bgcolor:SHIFT_COLORS[code]}}/>)}</Stack>
     </Box>)}
    </Box>
    <Typography variant="caption" color="text.secondary" sx={{display:'block',mt:2}}>Absence = (OFF + PTO + sick leave) / recorded employee-days. Unplanned cells are excluded. Area attribution uses the most recent working area on or before each date; shift filters do not apply. {absence.unattributedAbsences} absent employee-days have no area history and are not attributed to an area.</Typography>
   </DialogContent><DialogActions><Button onClick={()=>setOpen(false)}>Collapse</Button></DialogActions>
  </Dialog>
 </>;
}
