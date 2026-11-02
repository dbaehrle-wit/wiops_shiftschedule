import {AbsenceRate} from './AbsenceRate';
import type {AbsenceReport} from '../model/absence';
import {usePlannerAssignments} from './usePlannerAssignments';
import {buildAssignmentPatch} from '../model/assignments';
import {PlannerViewHeader,type PlannerHeaderSlots} from './PlannerViewHeader';
import {useCallback,useMemo,useState,} from 'react';
import {Alert,Box,Button,ButtonBase,Chip,Link,Stack,Typography} from '@mui/material';
import {useAppDispatch,useAppSelector} from '../app/hooks';
import {draftActions} from '../features/draftSlice';
import {uiActions} from '../features/uiSlice';
import {assignmentKey,isWorkingShift,type Employee,type PlannerSnapshot} from '../model/types';
import {dayAreaSummary} from '../model/dayStats';
import {assignmentColor,SHIFT_LABELS} from '../model/shiftDisplay';
import {germanDate,todayIso,weekdayLabel} from '../utils/date';
import {createSkillAssessor,SKILL_STATUS_LABELS} from '../model/skills';
import {PlannerDateField,PlannerSelect} from './PlannerControls';
import {PlannerColorLegend} from './SkillUi';
import {EmployeeStatsDialog,ShiftEditorDialog} from './PlannerDialogs';
export function DayOverview({snapshot,areaFilter=null,headerFilters,headerActions,absence}:{snapshot:PlannerSnapshot;areaFilter?:number|null;absence?:AbsenceReport} & PlannerHeaderSlots) {
 const dispatch=useAppDispatch();
 const date=useAppSelector(state=>state.ui.anchor);
 const [employeeStats,setEmployeeStats]=useState<Employee|null>(null),[editor,setEditor]=useState<Employee|null>(null);
 const shift=useAppSelector(state=>state.ui.dayShift),colorMode=useAppSelector(state=>state.ui.colorMode);
 const assessSkills=useMemo(()=>createSkillAssessor(snapshot.areas,snapshot.skills),[snapshot.areas,snapshot.skills,snapshot.employees]);
 const {baseAssignments:assignments,assignmentFor:resolve,edits,saving}=usePlannerAssignments(snapshot.assignments);
 const assignmentFor=useCallback((employeeId:number)=>resolve(employeeId,date),[resolve,date]);
 const summary=useMemo(()=>dayAreaSummary({date,employees:snapshot.employees,areas:snapshot.areas,assignmentFor}),[date,snapshot.employees,snapshot.areas,assignmentFor]);
 const departments=useMemo(()=>[...new Set(snapshot.employees.map(employee=>employee.department))].sort(),[snapshot.employees]);
 const groups=useMemo(()=>{
  const validAreas=new Set(snapshot.areas.map(area=>area.id));
  return departments.map(department=>{
   const employees=snapshot.employees.filter(employee=>employee.department===department);
   const byArea=new Map<number|null,Employee[]>(summary.areas.map(area=>[area.areaId,[]]));
   for(const employee of employees){
    const assignment=assignmentFor(employee.id),areaId=isWorkingShift(assignment?.shiftCode)&&assignment?.areaId!=null&&validAreas.has(assignment.areaId)?assignment.areaId:null;
    byArea.get(areaId)?.push(employee);
   }
   return {department,employees,areas:summary.areas.map(area=>({...area,employees:byArea.get(area.areaId)??[]}))};
  });
 },[departments,snapshot.employees,snapshot.areas,summary,assignmentFor]);
 const off=snapshot.employees.filter(employee=>assignmentFor(employee.id)?.shiftCode==='OFF').length;
 const unplanned=snapshot.employees.filter(employee=>!assignmentFor(employee.id)).length;
 return <Box sx={{flex:1,minWidth:0,minHeight:0,display:'flex',flexDirection:'column',border:'1px solid #dbe3ec',borderRadius:2,overflow:'hidden',bgcolor:'#f8fafc'}}>
  <PlannerViewHeader actions={headerActions} density="roomy">
   <Box sx={{mr:'auto'}}><Typography component="h2" variant="h6" fontWeight={700}>Daily staffing</Typography><Typography variant="body2" color="text.secondary">{weekdayLabel(date)}, {germanDate(date)} - Employees by department and work area</Typography></Box>
   {headerFilters}
   <PlannerDateField label="Day" value={date} onChange={value=>{if(/^\d{4}-\d{2}-\d{2}$/.test(value))dispatch(uiActions.setAnchor(value));}}/>
   <PlannerSelect<typeof shift> label="Shift" width={130} value={shift} options={[{value:'all',label:'All shifts'},{value:'E',label:'Early'},{value:'L',label:'Late'},{value:'N',label:'Night'},{value:'OFF',label:'Off'},{value:'S',label:'Sick leave'},{value:'P',label:'PTO'}]} onChange={value=>dispatch(uiActions.setDayShift(value))}/>
   <AbsenceRate metric={absence?.byDate[date]} date={date}/>
   <Button size="small" onClick={()=>dispatch(uiActions.setAnchor(todayIso()))}>Today</Button>
  </PlannerViewHeader>
  <Box sx={{flex:1,minHeight:0,overflow:'auto',p:{xs:1.5,md:2}}}>
   <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{mb:.5}}>
    <Typography component="h3" fontSize={14} fontWeight={700}>Target vs planned by area</Typography>
    <PlannerColorLegend mode={colorMode}/>
   </Stack>
   <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={.5} sx={{mb:1}}>
    <Typography variant="caption" color="text.secondary" fontSize={11}>Planned: active filters, including drafts.</Typography>
    <Typography variant="caption" color="text.secondary" fontSize={11}>Target: daily total for the whole site.</Typography>
   </Stack>
   <Box sx={{display:'grid',gridTemplateColumns:{xs:'repeat(2,minmax(0,1fr))',md:'repeat(4,minmax(0,1fr))'},gap:1,mb:1.5}}>
    {snapshot.areas.filter(area=>areaFilter===null||area.id===areaFilter).map(area=>{
     const planned=summary.areas.find(group=>group.areaId===area.id)?.scheduled??0,target=area.defaultRequired,delta=target==null?null:planned-target;
     return <Box key={area.id} data-day-area={area.id} data-planned={planned} data-target={target} sx={{p:1.25,bgcolor:'background.paper',border:'1px solid #dbe3ec',borderTop:`3px solid ${delta==null?'#94a3b8':delta<0?'#d97706':delta===0?'#059669':'#2563eb'}`,borderRadius:1.5}}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={.5}><Typography component="h4" fontSize={13} fontWeight={700}>{area.code}</Typography><Chip size="small" label={delta==null?'No target':delta<0?`${-delta} short`:delta===0?'Target met':`+${delta} over`} color={delta==null?'default':delta<0?'warning':delta===0?'success':'info'} variant="outlined" sx={{height:20,fontSize:10,'& .MuiChip-label':{px:.75}}}/></Stack>
      <Stack direction="row" justifyContent="space-between" gap={1} sx={{mt:.75}}><Stack direction="row" alignItems="baseline" gap={.5}><Typography variant="caption" color="text.secondary" fontSize={11}>Target</Typography><Typography fontSize={20} fontWeight={700} lineHeight={1.2}>{target??'n/a'}</Typography></Stack><Stack direction="row" alignItems="baseline" gap={.5}><Typography variant="caption" color="text.secondary" fontSize={11}>Planned</Typography><Typography fontSize={20} fontWeight={700} lineHeight={1.2}>{planned}</Typography></Stack></Stack>
     </Box>;
    })}
   </Box>
   <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} sx={{mb:2}}><Typography component="h3" variant="subtitle1" fontWeight={700} sx={{mr:'auto'}}>Employee roster</Typography><Chip size="small" label={`${off} off`}/><Chip size="small" label={`${snapshot.employees.filter(employee=>assignmentFor(employee.id)?.shiftCode==='S').length} sick`}/><Chip size="small" label={`${snapshot.employees.filter(employee=>assignmentFor(employee.id)?.shiftCode==='P').length} PTO`}/><Chip size="small" label={`${unplanned} unplanned`}/></Stack>
   {!snapshot.employees.length&&<Alert severity="info" sx={{mb:2}}>No employees match this day and the active filters. Choose another shift or clear filters.</Alert>}
   <Stack spacing={3}>
    {groups.map(group=><Box component="section" key={group.department} aria-label={`${group.department} department`}>
     <Stack direction="row" alignItems="center" gap={1} sx={{mb:1.25}}><Typography component="h4" variant="subtitle1" fontWeight={700}>{group.department}</Typography><Chip size="small" label={`${group.employees.length} employees`}/></Stack>
     <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'repeat(2,minmax(0,1fr))',xl:'repeat(5,minmax(0,1fr))'},gap:1.5,alignItems:'start'}}>
      {group.areas.filter(area=>areaFilter===null||area.areaId===areaFilter).map(area=><Box key={area.areaId??'none'} sx={{bgcolor:'background.paper',border:'1px solid #dbe3ec',borderRadius:2,overflow:'hidden'}}>
       <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{px:1.5,py:1,bgcolor:'#eef3f9',borderBottom:'1px solid #dbe3ec'}}><Typography component="h5" fontSize={13} fontWeight={700}>{area.areaId===null?'Off / leave / unassigned':area.code}</Typography><Chip size="small" label={area.employees.length} aria-label={`${area.employees.length} employees`}/></Stack>
       <Stack component="ul" spacing={0} sx={{listStyle:'none',m:0,p:0}}>
        {area.employees.map(employee=>{
         const assignment=assignmentFor(employee.id),dirty=Boolean(edits[assignmentKey(employee.id,date)]),assessment=assessSkills(employee,assignment?.areaId,date,assignment?.shiftCode);
         return <Box component="li" key={employee.id} sx={{p:1.25,borderBottom:'1px solid #edf0f4','&:last-child':{borderBottom:0}}}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}><ButtonBase onClick={()=>setEmployeeStats(employee)} sx={{textAlign:'left',justifyContent:'flex-start',borderRadius:.5,'&:focus-visible':{outline:'2px solid #2563eb'}}}><Typography fontSize={13} fontWeight={600}>{employee.fullName}</Typography></ButtonBase><Chip size="small" label={assignment?.shiftCode??'Unplanned'} data-skill-status={assessment.status} title={`${assignment?SHIFT_LABELS[assignment.shiftCode]:'No shift assigned'} - ${assessment.summary}`} onClick={()=>setEditor(employee)} sx={{bgcolor:assignment?assignmentColor(assignment.shiftCode,assessment.status,colorMode):'#f1f5f9',flexShrink:0}}/></Stack>
          <Typography variant="caption" color="text.secondary">{employee.role??'Operator'}{colorMode==='skill'&&isWorkingShift(assignment?.shiftCode)?` - ${SKILL_STATUS_LABELS[assessment.status]}`:''}{dirty?' - Unsaved':''}{assignment?.locked?' - Locked':''}</Typography>
          <Stack spacing={.25} sx={{mt:.5}}>
           {employee.mobileNumber&&<Typography variant="caption" color="text.secondary">Mobile: <Link href={`tel:${employee.mobileNumber.replace(/[^+\d]/g,'')}`} underline="hover" aria-label={`Call ${employee.fullName} on ${employee.mobileNumber}`}>{employee.mobileNumber}</Link></Typography>}
           {employee.radioNumber&&<Typography variant="caption" color="text.secondary">Radio: <Box component="span" sx={{color:'text.primary',fontWeight:600}}>{employee.radioNumber}</Box></Typography>}
           {!employee.mobileNumber&&!employee.radioNumber&&<Typography variant="caption" color="text.secondary">No contact number</Typography>}
          </Stack>
         </Box>;
        })}
       </Stack>
       {!area.employees.length&&<Typography variant="body2" color="text.secondary" sx={{p:1.5}}>No employees assigned</Typography>}
      </Box>)}
     </Box>
    </Box>)}
   </Stack>
   <Typography variant="caption" color="text.secondary" sx={{display:'block',mt:2}}>Click a name for statistics or a shift badge to edit the day assignment. Contact numbers are demo data.</Typography>
  </Box>
  {employeeStats&&<EmployeeStatsDialog employee={employeeStats} onClose={()=>setEmployeeStats(null)}/>}
  {editor&&<ShiftEditorDialog key={`${editor.id}|${date}`} employee={editor} date={date} assignment={assignmentFor(editor.id)} areas={snapshot.areas} skills={snapshot.skills} saving={saving} onClose={()=>setEditor(null)} onApply={(shiftCode,areaId)=>{if(saving||assignmentFor(editor.id)?.locked)return;const patch=buildAssignmentPatch(editor.id,date,{shiftCode,areaId},assignments.get(assignmentKey(editor.id,date)),assignmentFor(editor.id));if(patch)dispatch(draftActions.stageMany([patch]));setEditor(null);}}/>}
 </Box>;
}
