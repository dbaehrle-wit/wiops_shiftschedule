import AddRounded from '@mui/icons-material/AddRounded';
import {uiActions} from '../features/uiSlice';
import {TemporaryResourceDialog} from './TemporaryResourceDialog';
import type {Employee,Assignment} from '../model/types';
import {OpsHoursView} from './OpsHoursView';
import {SHIFT_LABELS} from '../model/shiftDisplay';
import {useMemo,useRef,useState} from 'react';
import {Alert,Box,Button,CircularProgress,Snackbar} from '@mui/material';
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
 const dispatch=useAppDispatch(),{data:serverData,error,isLoading}=useGetPlannerQuery(siteId);
 const nextTemporaryId=useRef(-1);
 const [temporaryOpen,setTemporaryOpen]=useState(false);
 const [temporaryResources,setTemporaryResources]=useState<Record<number,Employee[]>>({});
 const [temporaryAssignments,setTemporaryAssignments]=useState<Record<number,Assignment[]>>({});
 const data=useMemo(()=>serverData?{...serverData,employees:[...serverData.employees,...(temporaryResources[siteId]??[])],assignments:[...serverData.assignments,...(temporaryAssignments[siteId]??[])]}:undefined,[serverData,temporaryResources,temporaryAssignments,siteId]);
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
   const temporaryIds=new Set((temporaryResources[siteId]??[]).map(employee=>employee.id));
   const remoteOps=ops.filter(op=>!temporaryIds.has(op.employeeId));
   if(remoteOps.length){
    const result=await save({siteId,expectedPlanVersion:data.planVersion,requestId:crypto.randomUUID(),operations:remoteOps}).unwrap();
    if(result.status!=='committed'){dispatch(draftActions.setDraftError(result.errors?.map(item=>item.message).join('; ')||'Save rejected. Reload and reconcile changes.'));return;}
   }
   const localOps=ops.filter(op=>temporaryIds.has(op.employeeId));
   if(localOps.length)setTemporaryAssignments(previous=>{
    const map=new Map((previous[siteId]??[]).map(assignment=>[assignmentKey(assignment.employeeId,assignment.date),assignment]));
    for(const op of localOps){const key=assignmentKey(op.employeeId,op.date);map.set(key,{employeeId:op.employeeId,date:op.date,shiftCode:op.shiftCode,areaId:op.areaId,version:(map.get(key)?.version??0)+1,compatibility:'unknown'});}
    return {...previous,[siteId]:[...map.values()]};
   });
   dispatch(draftActions.clearDraft());setNotice(`${ops.length} assignments saved${localOps.length?' (temporary resources: session only)':''}`);
  }catch(error){dispatch(draftActions.setDraftError(error instanceof Error?error.message:'Save failed'));}
  finally{dispatch(draftActions.setSaving(false));}
 }
 const removeTemporaryResource=(employeeId:number)=>{
  if(saving||!temporaryResources[siteId]?.some(employee=>employee.id===employeeId))return;
  setTemporaryResources(previous=>({...previous,[siteId]:previous[siteId].filter(employee=>employee.id!==employeeId)}));
  setTemporaryAssignments(previous=>({...previous,[siteId]:(previous[siteId]??[]).filter(assignment=>assignment.employeeId!==employeeId)}));
  dispatch(draftActions.removeEmployee(employeeId));
  dispatch(uiActions.clearSelection());
  if(ui.userId===employeeId)dispatch(uiActions.setUserId(null));
  setNotice('Temporary resource removed.');
 };
 if(isLoading)return <Box sx={{p:4}}><CircularProgress/></Box>;
 if(error||!data||!scoped)return <Alert severity="error">Unable to load planner snapshot</Alert>;
 const headerFilters=<PlannerFilters snapshot={data}/>;
 const headerActions=<PlannerHeaderActions dirty={ops.length} saving={saving} onSave={()=>void saveDraft()} onDiscard={()=>dispatch(draftActions.clearDraft())}/>;
 const scopeLabel=`${germanDate(scoped.dates[0])}${scoped.dates.length>1?` - ${germanDate(scoped.dates.at(-1)!)}`:''} / ${ui.departmentFilter==='all'?'All departments':ui.departmentFilter}${ui.view==='user'?' / Selected employee':''}${ui.view==='day'&&ui.dayShift!=='all'?` / ${SHIFT_LABELS[ui.dayShift]}`:''}`;
 return <Box sx={{height:'100%',minHeight:420,display:'flex',flexDirection:'column',bgcolor:'#f8fafc'}}>
  <PlannerToolbar areas={data.areas} employees={scoped.snapshot.employees} onAutoPlan={()=>setAutoPlan(true)} saving={saving}/>
  {draftError&&<Alert severity="error" onClose={()=>dispatch(draftActions.setDraftError(null))}>{draftError}</Alert>}
  <Box sx={{flex:1,minHeight:0,overflow:'auto',display:'flex',flexDirection:'column'}}>
   <Box sx={{p:1,display:'flex',flex:1,minHeight:340,minWidth:0}}>
    {ui.view==='opsHours'?<OpsHoursView snapshot={data} headerFilters={headerFilters} headerActions={headerActions} absence={scoped.absence}/>:ui.view==='day'?<DayOverview snapshot={scoped.snapshot} areaFilter={ui.areaFilter} headerFilters={headerFilters} headerActions={headerActions} absence={scoped.absence}/>:ui.view==='areas'?<AreaOverview snapshot={scoped.snapshot} areaFilter={ui.areaFilter} headerFilters={headerFilters} headerActions={headerActions} absence={scoped.absence}/>:<PlanningGrid onAddTemporary={()=>setTemporaryOpen(true)} onRemoveTemporary={removeTemporaryResource} snapshot={scoped.snapshot} headerFilters={headerFilters} headerActions={headerActions} absence={scoped.absence}/>}
   </Box>
   {['day','areas','opsHours'].includes(ui.view)&&<>   <Box sx={{px:1.5,py:1}}>
    <Button size="small" startIcon={<AddRounded/>} sx={{textTransform:'none',fontSize:11}} onClick={()=>setTemporaryOpen(true)} disabled={saving}>Add temporary Employee</Button>
   </Box></>}
   <PlannerKpis absence={scoped.absence} coverage={scoped.coverage} scopeLabel={scopeLabel}/>
  </Box>
  {temporaryOpen&&<TemporaryResourceDialog departments={[...new Set(data.employees.map(employee=>employee.department))].sort()} defaultDepartment={ui.departmentFilter} onClose={()=>setTemporaryOpen(false)} onAdd={(name,department,role)=>{
   const employee:Employee={id:nextTemporaryId.current--,fullName:name,department,role:role||'Operator',temporary:true};
   setTemporaryResources(previous=>({...previous,[siteId]:[...(previous[siteId]??[]),employee]}));
   if(ui.departmentFilter!=='all'&&ui.departmentFilter!==department)dispatch(uiActions.setDepartmentFilter(department));
   dispatch(uiActions.setAreaFilter(null));
   dispatch(uiActions.setDayShift('all'));
   if(ui.view==='user')dispatch(uiActions.setUserId(employee.id));
   setTemporaryOpen(false);setNotice('Temporary resource added. Replace with an AMS user later.');
  }}/>}
  {autoPlan&&<AutoPlanningDialog snapshot={data} onClose={()=>setAutoPlan(false)}/>}
  <Snackbar open={Boolean(notice)} onClose={()=>setNotice('')} autoHideDuration={2500} message={notice}/>
 </Box>;
}
