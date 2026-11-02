import {OpsHoursView} from './OpsHoursView';
import {SHIFT_LABELS} from '../model/shiftDisplay';
import {useMemo,useState} from 'react';
import {Alert,Box,CircularProgress,Snackbar} from '@mui/material';
import {useGetPlannerQuery,useSaveAssignmentsMutation} from '../api/plannerApi';
import {useAppDispatch,useAppSelector} from '../app/hooks';
import {draftActions} from '../features/draftSlice';
import {assignmentKey} from '../model/types';
import {coverageForAreas,effectiveAssignments,filterPlanningEmployees} from '../model/planning';
import {absenceReport} from '../model/absence';
import {calendarWeeks,datesForView,germanDate} from '../utils/date';
import {PlannerToolbar} from './Toolbar';
import {PlanningGrid} from './PlanningGrid';
import {AreaOverview} from './AreaOverview';
import {DayOverview} from './DayOverview';
import {PlannerHeaderActions} from './PlannerHeaderActions';
import {PlannerFilters} from './PlannerFilters';
import {PlannerKpis} from './PlannerKpis';
import {AutoPlanningDialog} from './AutoPlanningDialog';

export function ShiftPlanner({siteId}:{siteId:number}){
 const dispatch=useAppDispatch(),{data,error,isLoading}=useGetPlannerQuery(siteId);
 const [save]=useSaveAssignmentsMutation(),edits=useAppSelector(state=>state.draft.edits),saving=useAppSelector(state=>state.draft.saving),draftError=useAppSelector(state=>state.draft.error),ui=useAppSelector(state=>state.ui);
 const [notice,setNotice]=useState(''),[autoPlan,setAutoPlan]=useState(false),ops=useMemo(()=>Object.values(edits),[edits]);
 const scoped=useMemo(()=>{
  if(!data)return null;
  const dates=datesForView(ui.anchor,ui.view),assignments=effectiveAssignments(data.assignments,edits);
  const employees=filterPlanningEmployees(data.employees,dates,assignments,ui.departmentFilter,ui.areaFilter).filter(employee=>ui.view!=='day'||ui.dayShift==='all'||assignments.get(assignmentKey(employee.id,ui.anchor))?.shiftCode===ui.dayShift);
  const kpiEmployees=ui.view==='user'?employees.filter(employee=>employee.id===(employees.find(item=>item.id===ui.userId)??employees[0])?.id):employees;
  let absenceEmployees=data.employees.filter(employee=>ui.departmentFilter==='all'||employee.department===ui.departmentFilter);
  if(ui.view==='user')absenceEmployees=absenceEmployees.filter(employee=>employee.id===(employees.find(item=>item.id===ui.userId)??employees[0])?.id);
  const absence=absenceReport(absenceEmployees,dates,assignments,data.areas,ui.areaFilter,ui.view==='user'?calendarWeeks(ui.anchor).flat():dates);
  const areas=data.areas.filter(area=>ui.areaFilter===null||area.id===ui.areaFilter);
  return {absence,snapshot:{...data,employees},coverage:coverageForAreas(areas,kpiEmployees,dates,assignments),dates};
 },[data,edits,ui.anchor,ui.view,ui.departmentFilter,ui.areaFilter,ui.dayShift,ui.userId]);
 async function saveDraft(){
  if(!data||!ops.length)return;
  dispatch(draftActions.setSaving(true));dispatch(draftActions.setDraftError(null));
  try{
   const result=await save({siteId,expectedPlanVersion:data.planVersion,requestId:crypto.randomUUID(),operations:ops}).unwrap();
   if(result.status!=='committed'){dispatch(draftActions.setDraftError(result.errors?.map(item=>item.message).join('; ')||'Save rejected. Reload and reconcile changes.'));return;}
   dispatch(draftActions.clearDraft());setNotice(`${result.assignments.length} assignments saved`);
  }catch(error){dispatch(draftActions.setDraftError(error instanceof Error?error.message:'Save failed'));}
  finally{dispatch(draftActions.setSaving(false));}
 }
 if(isLoading)return <Box sx={{p:4}}><CircularProgress/></Box>;
 if(error||!data||!scoped)return <Alert severity="error">Unable to load planner snapshot</Alert>;
 const headerFilters=<PlannerFilters snapshot={data}/>;
 const headerActions=<PlannerHeaderActions dirty={ops.length} saving={saving} onSave={()=>void saveDraft()} onDiscard={()=>dispatch(draftActions.clearDraft())}/>;
 const scopeLabel=`${germanDate(scoped.dates[0])}${scoped.dates.length>1?` - ${germanDate(scoped.dates.at(-1)!)}`:''} / ${ui.departmentFilter==='all'?'All departments':ui.departmentFilter}${ui.view==='user'?' / Selected employee':''}${ui.view==='day'&&ui.dayShift!=='all'?` / ${SHIFT_LABELS[ui.dayShift]}`:''}`;
 return <Box sx={{height:'100%',minHeight:420,display:'flex',flexDirection:'column',bgcolor:'#f8fafc'}}>
  <PlannerToolbar areas={data.areas} skills={data.skills} employees={scoped.snapshot.employees} onAutoPlan={()=>setAutoPlan(true)} saving={saving}/>
  {draftError&&<Alert severity="error" onClose={()=>dispatch(draftActions.setDraftError(null))}>{draftError}</Alert>}
  <Box sx={{flex:1,minHeight:0,overflow:'auto',display:'flex',flexDirection:'column'}}>
   <Box sx={{p:1,display:'flex',flex:1,minHeight:340,minWidth:0}}>
    {ui.view==='opsHours'?<OpsHoursView snapshot={data} headerFilters={headerFilters} headerActions={headerActions} absence={scoped.absence}/>:ui.view==='day'?<DayOverview snapshot={scoped.snapshot} areaFilter={ui.areaFilter} headerFilters={headerFilters} headerActions={headerActions} absence={scoped.absence}/>:ui.view==='areas'?<AreaOverview snapshot={scoped.snapshot} areaFilter={ui.areaFilter} headerFilters={headerFilters} headerActions={headerActions} absence={scoped.absence}/>:<PlanningGrid snapshot={scoped.snapshot} headerFilters={headerFilters} headerActions={headerActions} absence={scoped.absence}/>}
   </Box>
   <PlannerKpis absence={scoped.absence} coverage={scoped.coverage} scopeLabel={scopeLabel}/>
  </Box>
  {autoPlan&&<AutoPlanningDialog snapshot={data} onClose={()=>setAutoPlan(false)}/>}
  <Snackbar open={Boolean(notice)} onClose={()=>setNotice('')} autoHideDuration={2500} message={notice}/>
 </Box>;
}
