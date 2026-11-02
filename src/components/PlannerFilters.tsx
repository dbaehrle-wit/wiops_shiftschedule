import {IconButton,Stack,Tooltip} from '@mui/material';
import FilterAltOffRounded from '@mui/icons-material/FilterAltOffRounded';
import {useAppDispatch,useAppSelector} from '../app/hooks';
import {uiActions} from '../features/uiSlice';
import type {PlannerSnapshot} from '../model/types';
import {PlannerSelect} from './PlannerControls';

export function PlannerFilters({snapshot}:{snapshot:PlannerSnapshot}) {
 const dispatch=useAppDispatch(),ui=useAppSelector(state=>state.ui);
 const departments=[...new Set(snapshot.employees.map(employee=>employee.department))].sort();
 return <Stack direction="row" flexWrap="wrap" alignItems="center" gap={.75} sx={{minWidth:0}} aria-label="Planner filters">
  <PlannerSelect label="Department" value={ui.departmentFilter} options={[{value:'all',label:'All departments'},...departments.map(department=>({value:department,label:department}))]} onChange={value=>dispatch(uiActions.setDepartmentFilter(value))}/>
  <PlannerSelect<number|'all'> label="Area" width={130} value={ui.areaFilter??'all'} options={[{value:'all',label:'All areas'},...snapshot.areas.map(area=>({value:area.id,label:area.code}))]} title="Includes employees assigned to this area during the displayed period; other assignments remain visible for context" onChange={value=>dispatch(uiActions.setAreaFilter(value==='all'?null:value))}/>
  <Tooltip title="Clear filters"><span><IconButton size="small" aria-label="Clear filters" disabled={ui.departmentFilter==='all'&&ui.areaFilter===null&&(ui.view!=='day'||ui.dayShift==='all')} onClick={()=>{dispatch(uiActions.setDepartmentFilter('all'));dispatch(uiActions.setAreaFilter(null));dispatch(uiActions.setDayShift('all'));}}><FilterAltOffRounded fontSize="small"/></IconButton></span></Tooltip>
 </Stack>;
}
