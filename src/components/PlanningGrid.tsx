import {AbsenceRate} from './AbsenceRate';
import type {AbsenceReport} from '../model/absence';
import {EMPLOYEE_SORT_LABELS,nextEmployeeSort,sortEmployees} from '../model/employeeSort';
import {usePlannerAssignments} from './usePlannerAssignments';
import {PlannerViewHeader,type PlannerHeaderSlots} from './PlannerViewHeader';
import {useCallback,useEffect,useId,useMemo,useRef,useState,type KeyboardEvent,type MouseEvent} from 'react';
import {Box,Button,ButtonBase,Divider,ListSubheader,Menu,MenuItem,Typography} from '@mui/material';
import ArrowDropDownRounded from '@mui/icons-material/ArrowDropDownRounded';
import {useVirtualizer} from '@tanstack/react-virtual';
import {useAppDispatch,useAppSelector} from '../app/hooks';
import {draftActions} from '../features/draftSlice';
import {uiActions} from '../features/uiSlice';
import {assignmentKey,isWorkingShift,isNonWorkingShift,type AssignmentPatch,type Employee,type PlannerSnapshot,type ShiftCode} from '../model/types';
import {assignmentTextColor,assignmentColor,SHIFT_CODES,SHIFT_COLORS,SHIFT_LABELS} from '../model/shiftDisplay';
import {calendarWeeks,datesForView,displayDate,germanDate,isoWeek,isWeekend,monthLabel,todayIso,weekdayLabel} from '../utils/date';
import {posKey,rectangle,sameValue,type CellChange,type CellPos as Pos} from '../utils/gridDrag';
import {useGridDrag,type GridMetrics} from './useGridDrag';
import {EmployeeStatsDialog,ShiftEditorDialog} from './PlannerDialogs';
import {DayStatsDialog} from './DayStatsDialog';
import {createSkillAssessor} from '../model/skills';
import {PlannerColorLegend} from './SkillUi';
import {CompactPlannerCell} from './CompactPlannerCell';
interface GridCell {employee:Employee;date:string}
interface GridRow {employee:Employee;week?:string[];key:string}
export function PlanningGrid({snapshot,headerFilters,headerActions,absence}:{snapshot:PlannerSnapshot;absence?:AbsenceReport} & PlannerHeaderSlots) {
 const dispatch=useAppDispatch(),ui=useAppSelector(s=>s.ui);
 const {baseAssignments:data,assignmentFor,edits,saving}=usePlannerAssignments(snapshot.assignments);
 const calendar=ui.view==='user',minimal=ui.view==='minimal',statusId=useId();
 const scrollRef=useRef<HTMLDivElement>(null);
 const [viewportWidth,setViewportWidth]=useState(1000);
 const [menu,setMenu]=useState<{x:number;y:number}|null>(null);
 const [employeeMenu,setEmployeeMenu]=useState<{x:number;y:number;employeeId:number}|null>(null);
 const [statsEmployee,setStatsEmployee]=useState<Employee|null>(null);
 const [statsDate,setStatsDate]=useState<string|null>(null);
 const [editor,setEditor]=useState<GridCell|null>(null);
 const [feedback,setFeedback]=useState<string|null>(null);
 const dates=useMemo(()=>datesForView(ui.anchor,ui.view),[ui.anchor,ui.view]);
 const weeks=useMemo(()=>calendarWeeks(ui.anchor),[ui.anchor]);
 const dateMetadata=useMemo(()=>new Map((calendar?weeks.flat():dates).map(date=>[date,{label:germanDate(date),display:displayDate(date),weekday:weekdayLabel(date)}])),[calendar,weeks,dates]);
 const activeEmployee=snapshot.employees.find(e=>e.id===ui.userId)??snapshot.employees[0];
 const rows=useMemo<GridRow[]>(()=>calendar
  ? activeEmployee?weeks.map(week=>({employee:activeEmployee,week,key:week[0]})):[]
  : sortEmployees(snapshot.employees,ui.employeeSort).map(employee=>({employee,key:String(employee.id)})),[calendar,activeEmployee,weeks,snapshot.employees,ui.employeeSort]);
 const columnCount=calendar?7:dates.length;
 const metrics=useMemo<GridMetrics>(()=>({employeeWidth:calendar?180:minimal?198:218,cellWidth:calendar?Math.max(100,Math.floor((viewportWidth-180)/7)):minimal?24:78,rowHeight:calendar?96:minimal?32:48,headerHeight:64}),[calendar,minimal,viewportWidth]);
 const {employeeWidth:EMP_W,cellWidth:CELL_W,rowHeight:ROW_H,headerHeight:HEADER_H}=metrics;
 useEffect(()=>{
  const element=scrollRef.current;if(!element)return;
  const observer=new ResizeObserver(()=>setViewportWidth(element.clientWidth));observer.observe(element);
  return ()=>observer.disconnect();
 },[]);
 useEffect(()=>{setMenu(null);setEmployeeMenu(null);setEditor(null);setStatsDate(null);setFeedback(null);scrollRef.current?.scrollTo({left:0,top:0});},[ui.view,ui.anchor,ui.userId,ui.departmentFilter,ui.areaFilter,ui.employeeSort]);
 const assessSkills=useMemo(()=>createSkillAssessor(snapshot.areas),[snapshot.areas,snapshot.employees]);
 const areasById=useMemo(()=>new Map(snapshot.areas.map(area=>[area.id,area])),[snapshot.areas]);
 const selected=useMemo(()=>new Set(ui.selection),[ui.selection]);
 const cellAt=useCallback((r:number,c:number):GridCell|undefined=>{
  const row=rows[r];if(!row||c<0||c>=columnCount)return;
  return {employee:row.employee,date:row.week?.[c]??dates[c]};
 },[rows,columnCount,dates]);
 const resolveAssignment=useCallback((cell:GridCell)=>assignmentFor(cell.employee.id,cell.date),[assignmentFor]);
 const statsAssignment=useCallback((employeeId:number,date:string)=>{
  const employee=snapshot.employees.find(employee=>employee.id===employeeId);return employee?resolveAssignment({employee,date}):undefined;
 },[snapshot.employees,resolveAssignment]);
 const getAssignment=useCallback((r:number,c:number)=>{const cell=cellAt(r,c);return cell?resolveAssignment(cell):undefined;},[cellAt,resolveAssignment]);
 const positions=useMemo(()=>{
  const result:Pos[]=[];rows.forEach((_,r)=>{for(let c=0;c<columnCount;c++){const cell=cellAt(r,c)!;if(selected.has(assignmentKey(cell.employee.id,cell.date)))result.push({r,c});}});return result;
 },[rows,columnCount,cellAt,selected]);
 const selectPositions=useCallback((cells:Pos[],focus:Pos,anchor:Pos)=>{
  const keys=cells.flatMap(p=>{const cell=cellAt(p.r,p.c);return cell?[assignmentKey(cell.employee.id,cell.date)]:[];});
  dispatch(uiActions.setSelection({keys,focus,anchor}));
 },[dispatch,cellAt]);
 const stageCells=useCallback((cells:GridCell[],shiftCode:ShiftCode,areaOverride?:number|null)=>{
  if(saving)return;
  const patches:AssignmentPatch[]=cells.flatMap(cell=>{
   const current=resolveAssignment(cell);if(current?.locked)return [];
   const value={shiftCode,areaId:isNonWorkingShift(shiftCode)?null:areaOverride!==undefined?areaOverride:current?.areaId??snapshot.areas[0]?.id??null};
   if(current&&sameValue(current,value))return [];
   return [{employeeId:cell.employee.id,date:cell.date,...value,expectedVersion:data.get(assignmentKey(cell.employee.id,cell.date))?.version??null}];
  });
  if(patches.length)dispatch(draftActions.stageMany(patches));
 },[saving,resolveAssignment,snapshot.areas,data,dispatch]);
 const stage=useCallback((cells:Pos[],code:ShiftCode)=>stageCells(cells.flatMap(p=>{const cell=cellAt(p.r,p.c);return cell?[cell]:[];}),code),[cellAt,stageCells]);
 const stageArea=(areaId:number)=>{
  if(saving)return;
  const patches:AssignmentPatch[]=positions.flatMap(p=>{
   const cell=cellAt(p.r,p.c),current=getAssignment(p.r,p.c);
   if(!cell||!current||current.locked||isNonWorkingShift(current.shiftCode)||current.areaId===areaId)return [];
   return [{employeeId:cell.employee.id,date:cell.date,shiftCode:current.shiftCode,areaId,expectedVersion:data.get(assignmentKey(cell.employee.id,cell.date))?.version??null}];
  });
  if(patches.length)dispatch(draftActions.stageMany(patches));setMenu(null);
 };
 const commitDrag=useCallback((changes:CellChange[])=>{
  const patches=changes.flatMap(({r,c,value})=>{const cell=cellAt(r,c);return cell?[{employeeId:cell.employee.id,date:cell.date,...value,expectedVersion:data.get(assignmentKey(cell.employee.id,cell.date))?.version??null}]:[];});
  if(patches.length)dispatch(draftActions.stageMany(patches));
 },[cellAt,data,dispatch]);
 const drag=useGridDrag({viewport:scrollRef,positions,anchor:ui.anchorCell,rowCount:rows.length,colCount:columnCount,disabled:saving||Boolean(editor||statsEmployee||statsDate||menu||employeeMenu),contextKey:`${snapshot.siteId}|${ui.view}|${ui.anchor}|${ui.userId}|${ui.departmentFilter}|${ui.areaFilter}|${ui.employeeSort}`,getAssignment,onSelect:selectPositions,onCommit:commitDrag,metrics});
 const rowV=useVirtualizer({count:rows.length,getScrollElement:()=>scrollRef.current,estimateSize:()=>ROW_H,overscan:minimal?3:6,scrollMargin:HEADER_H,scrollPaddingStart:HEADER_H});
 const colV=useVirtualizer({horizontal:true,count:columnCount,getScrollElement:()=>scrollRef.current,estimateSize:()=>CELL_W,overscan:3,scrollMargin:EMP_W,scrollPaddingStart:EMP_W});
 useEffect(()=>{rowV.measure();colV.measure();},[ROW_H,CELL_W,rowV,colV]);
 const previewCells=useMemo(()=>new Set(drag.preview?.positions.map(posKey)),[drag.preview]);
 const previewValues=useMemo(()=>new Map(drag.preview?.plan?.destinations.map(p=>[posKey(p),p.value])),[drag.preview]);
 const sourceCells=useMemo(()=>new Set(drag.preview?.source.map(posKey)),[drag.preview]);
 const invalidDrop=Boolean(drag.preview&&(drag.preview.outside||drag.preview.plan?.error));
 const groups=useMemo(()=>{
  if(calendar)return [{start:0,count:7,label:monthLabel(ui.anchor)}];
  const result:{start:number;count:number;label:string}[]=[];
  dates.forEach((date,c)=>{if(c===0||date.slice(0,7)!==dates[c-1].slice(0,7))result.push({start:c,count:1,label:monthLabel(date)});else result[result.length-1].count++;});return result;
 },[calendar,dates,ui.anchor]);
 const select=useCallback((r:number,c:number,extend=false,toggle=false)=>{
  const cell=cellAt(r,c);if(!cell)return;
  const anchor=extend&&ui.anchorCell&&cellAt(ui.anchorCell.r,ui.anchorCell.c)?ui.anchorCell:{r,c};
  const key=assignmentKey(cell.employee.id,cell.date);
  if(toggle){dispatch(uiActions.setSelection({keys:selected.has(key)?ui.selection.filter(k=>k!==key):[...ui.selection,key],focus:{r,c},anchor}));return;}
  selectPositions(extend?rectangle(anchor,{r,c}):[{r,c}],{r,c},anchor);
 },[cellAt,ui.anchorCell,ui.selection,selected,selectPositions,dispatch]);
 const focusCell=useCallback((r:number,c:number,extend:boolean)=>{
  const rr=Math.max(0,Math.min(rows.length-1,r)),cc=Math.max(0,Math.min(columnCount-1,c));
  select(rr,cc,extend);rowV.scrollToIndex(rr,{align:'auto'});colV.scrollToIndex(cc,{align:'auto'});
 },[rows.length,columnCount,select,rowV,colV]);
 const clearSelection=()=>{dispatch(uiActions.clearSelection());setMenu(null);setFeedback('Selection cleared.');scrollRef.current?.focus({preventScroll:true});};
 const positionAt=(clientX:number,clientY:number):Pos|undefined=>{
  const element=scrollRef.current;if(!element)return;
  const rect=element.getBoundingClientRect(),x=clientX-rect.left-element.clientLeft,y=clientY-rect.top-element.clientTop;
  if(x<EMP_W||y<HEADER_H||x>=element.clientWidth||y>=element.clientHeight)return;
  const pos={r:Math.floor((y+element.scrollTop-HEADER_H)/ROW_H),c:Math.floor((x+element.scrollLeft-EMP_W)/CELL_W)};
  return cellAt(pos.r,pos.c)?pos:undefined;
 };
 const onMenu=(event:MouseEvent<HTMLDivElement>,r:number,c:number)=>{
  event.preventDefault();event.stopPropagation();const cell=cellAt(r,c);if(!cell)return;
  if(!selected.has(assignmentKey(cell.employee.id,cell.date)))select(r,c);
  setFeedback(null);setMenu({x:event.clientX,y:event.clientY});
 };
 const contextRef=useRef('');
 useEffect(()=>{contextRef.current=`${ui.view}|${ui.anchor}|${ui.userId}|${saving}|${ui.departmentFilter}|${ui.areaFilter}|${ui.employeeSort}`;},[ui.view,ui.anchor,ui.userId,saving,ui.departmentFilter,ui.areaFilter,ui.employeeSort]);
 const onKeys=(event:KeyboardEvent<HTMLDivElement>)=>{
  if(drag.started){event.preventDefault();return;}
  if(menu||editor||statsEmployee||statsDate||saving||!rows.length)return;
  const focus=ui.focus??{r:0,c:0},ctrl=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();
  if(event.key==='Escape'){event.preventDefault();clearSelection();return;}
  if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){
   event.preventDefault();if(!positions.length)select(focus.r,focus.c);
   const bounds=scrollRef.current?.querySelector(`[data-cell="${focus.r}:${focus.c}"]`)?.getBoundingClientRect();if(bounds)setMenu({x:bounds.left,y:bounds.bottom});return;
  }
  if(ctrl&&(key==='z'||key==='y')){event.preventDefault();dispatch(key==='z'&&!event.shiftKey?draftActions.undo():draftActions.redo());return;}
  if(ctrl&&key==='c'){
   event.preventDefault();if(!positions.length)return;
   const minR=Math.min(...positions.map(p=>p.r)),maxR=Math.max(...positions.map(p=>p.r)),minC=Math.min(...positions.map(p=>p.c)),maxC=Math.max(...positions.map(p=>p.c));
   const values=new Map(positions.map(p=>[posKey(p),getAssignment(p.r,p.c)?.shiftCode??'OFF']));
   const text=Array.from({length:maxR-minR+1},(_,r)=>Array.from({length:maxC-minC+1},(_,c)=>values.get(posKey({r:r+minR,c:c+minC}))??'').join('\t')).join('\n');
   if(!navigator.clipboard){setFeedback('Clipboard unavailable. Use Ctrl/Cmd + the drag handle to copy.');return;}
   void navigator.clipboard.writeText(text).catch(()=>setFeedback('Copy is not allowed. Check browser clipboard permissions.'));return;
  }
  if(ctrl&&key==='v'){
   event.preventDefault();if(!navigator.clipboard){setFeedback('Clipboard unavailable.');return;}
   const context=contextRef.current;
   void navigator.clipboard.readText().then(text=>{
    if(contextRef.current!==context)return;
    const patches:AssignmentPatch[]=[];
    text.trim().split(/\r?\n/).forEach((line,r)=>line.split('\t').forEach((text,c)=>{
     const cell=cellAt(focus.r+r,focus.c+c),code=text.trim().toUpperCase() as ShiftCode;
     if(!cell||!SHIFT_CODES.includes(code)||resolveAssignment(cell)?.locked)return;
     const base=data.get(assignmentKey(cell.employee.id,cell.date));
     patches.push({employeeId:cell.employee.id,date:cell.date,shiftCode:code,areaId:isNonWorkingShift(code)?null:resolveAssignment(cell)?.areaId??snapshot.areas[0]?.id??null,expectedVersion:base?.version??null});
    }));
    if(patches.length)dispatch(draftActions.stageMany(patches));
   }).catch(()=>setFeedback('Paste is not allowed. Check browser clipboard permissions.'));return;
  }
  const deltas:Record<string,[number,number]>={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
  if(deltas[event.key]){event.preventDefault();const [dr,dc]=deltas[event.key];focusCell(focus.r+dr,focus.c+dc,event.shiftKey);return;}
  if(event.key==='Enter'){event.preventDefault();const cell=cellAt(focus.r,focus.c);if(cell)setEditor(cell);return;}
  const code=({e:'E',l:'L',n:'N',o:'OFF',s:'S',p:'P'} as Record<string,ShiftCode>)[key];
  if(code&&!ctrl&&!event.altKey){event.preventDefault();stage(positions.length?positions:[focus],code);}
 };
 const today=todayIso();
 const lockedSelected=positions.filter(p=>getAssignment(p.r,p.c)?.locked).length;
 return <Box sx={{flex:1,minWidth:0,minHeight:0,display:'flex',flexDirection:'column',border:'1px solid',borderColor:'divider',borderRadius:2,overflow:'hidden'}}>
  <PlannerViewHeader actions={headerActions} density="compact">
   <Typography variant="caption" color="text.secondary">{positions.length?`${positions.length} cells selected`:'Double-click to edit shift'}</Typography>
   <Button size="small" endIcon={<ArrowDropDownRounded/>} disabled={!positions.length||saving} aria-haspopup="menu" aria-expanded={Boolean(menu)} onClick={event=>{const bounds=event.currentTarget.getBoundingClientRect();setMenu({x:bounds.left,y:bounds.bottom});}}>Assign</Button>
   {headerFilters}
   <Box sx={{ml:'auto'}}><PlannerColorLegend mode={ui.colorMode} minimal={minimal}/></Box>
  </PlannerViewHeader>
  <Box ref={scrollRef} role="grid" data-grid-dragging={Boolean(drag.preview)} aria-label={calendar?'Employee monthly calendar':minimal?'Minimal view: three months':'Shift planning'} aria-rowcount={rows.length+1} aria-colcount={columnCount+1} aria-describedby={statusId} tabIndex={0} onKeyDown={onKeys} onPointerDown={event=>{if(!menu&&!editor&&!statsEmployee&&!statsDate){setFeedback(null);drag.startSelection(event);}}}
   onContextMenu={event=>{const target=(event.target as HTMLElement).closest<HTMLElement>('[data-cell]');if(!target||!event.currentTarget.contains(target))return;const [r,c]=target.dataset.cell!.split(':').map(Number);onMenu(event,r,c);}}
   onDoubleClick={event=>{if((event.target as HTMLElement).closest('button'))return;const pos=positionAt(event.clientX,event.clientY);if(pos){event.preventDefault();setEditor(cellAt(pos.r,pos.c)!);}}}
   sx={{width:'100%',flex:1,minHeight:0,overflow:'auto',outline:'none',cursor:drag.preview?(invalidDrop?'not-allowed':drag.preview.mode==='copy'?'copy':drag.preview.mode==='move'?'grabbing':'crosshair'):undefined,'&:focus-visible':{outline:'2px solid #2563eb',outlineOffset:-2}}}>
   <Box sx={{position:'relative',width:EMP_W+colV.getTotalSize(),height:HEADER_H+rowV.getTotalSize(),minWidth:'100%'}}>
    <Box role="row" aria-rowindex={1} sx={{position:'sticky',top:0,height:HEADER_H,zIndex:6,bgcolor:'#eaf1f8',borderBottom:'1px solid #dbe3ec'}}>
     <Box role="columnheader" aria-colindex={1} aria-sort={calendar?undefined:ui.employeeSort==='name'?'ascending':ui.employeeSort?'other':'none'} sx={{position:'sticky',left:0,width:EMP_W,height:HEADER_H,zIndex:8,bgcolor:'#eaf1f8',borderRight:'1px solid #dbe3ec'}}>
      {calendar&&activeEmployee?<ButtonBase onClick={()=>setStatsEmployee(activeEmployee)} aria-label={`Statistics for ${activeEmployee.fullName}`} sx={{width:'100%',height:'100%',px:2,alignItems:'flex-start',justifyContent:'center',flexDirection:'column',textAlign:'left'}}><Typography noWrap fontSize={13} fontWeight={700} sx={{maxWidth:'100%'}}>{activeEmployee.fullName}</Typography><Typography noWrap variant="caption" color="text.secondary">{activeEmployee.role??'Operator'} · {activeEmployee.department} · Statistics ↗</Typography></ButtonBase> :<ButtonBase onClick={()=>dispatch(uiActions.cycleEmployeeSort())} onKeyDown={event=>event.stopPropagation()} aria-label={`Sort employees by ${nextEmployeeSort(ui.employeeSort)}`} title={`Next sort: ${EMPLOYEE_SORT_LABELS[nextEmployeeSort(ui.employeeSort)]}. Cycle: name, department, role.`} sx={{px:2,width:'100%',height:'100%',alignItems:'flex-start',justifyContent:'center',flexDirection:'column',textAlign:'left','&:hover':{bgcolor:'#dbe7f5'},'&:focus-visible':{outline:'2px solid #2563eb',outlineOffset:-2}}}><Typography component="span" fontSize={13} fontWeight={700}>Employees <Typography component="span" fontSize={10} color="primary.main">{ui.employeeSort?EMPLOYEE_SORT_LABELS[ui.employeeSort]:'Sort'}</Typography></Typography><Typography variant="caption" color="text.secondary">Click a name for statistics</Typography></ButtonBase>}
     </Box>
     {groups.map(group=><Box key={group.start} title={group.label} sx={{position:'absolute',top:0,left:EMP_W+group.start*CELL_W,width:group.count*CELL_W,height:22,px:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',borderLeft:'1px solid #bdcde0',bgcolor:'#dbe7f5',fontSize:11,fontWeight:700,lineHeight:'22px'}}>{group.label}</Box>)}
     {colV.getVirtualItems().map(col=>{
      const date=calendar?weeks[0][col.index]:dates[col.index],info=dateMetadata.get(date)!,weekend=calendar?col.index>=5:isWeekend(date);
      return <Box role="columnheader" tabIndex={calendar?-1:0} data-header-date={calendar?undefined:date} aria-colindex={col.index+2} aria-label={calendar?info.weekday:info.label} key={col.key}
       title={calendar?'Day details: double-click the date in a calendar cell':`${info.label} · Double-click for daily status by area`}
       onDoubleClick={event=>{event.preventDefault();event.stopPropagation();if(!calendar)setStatsDate(date);}}
       onKeyDown={event=>{if(!calendar&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();setStatsDate(date);}}}
       sx={{position:'absolute',top:22,left:col.start,width:col.size,height:HEADER_H-22,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',bgcolor:weekend?'#dfe8f2':'#eaf1f8',borderLeft:'1px solid #dbe3ec',cursor:calendar?'default':'pointer','&:hover':{bgcolor:calendar?undefined:'#cddff4'},'&:focus-visible':{outline:'2px solid #2563eb',outlineOffset:-2}}}>
       <Typography fontSize={minimal?9:11} color="text.secondary">{minimal?info.weekday.slice(0,1):info.weekday}</Typography>{!calendar&&<Typography fontSize={minimal?11:12} fontWeight={600}>{minimal?Number(date.slice(8)):info.display}</Typography>}
       {!calendar&&<AbsenceRate metric={absence?.byDate[date]} compact={minimal} date={date}/> }
      </Box>;
     })}
    </Box>
    {rowV.getVirtualItems().map(row=>{const item=rows[row.index],employee=item.employee;return <Box role="row" aria-rowindex={row.index+2} key={item.key} sx={{position:'absolute',top:row.start,left:0,height:row.size,width:'100%',borderBottom:'1px solid #edf0f4'}}>
     <ButtonBase component="button" aria-label={calendar?`Statistics for ${employee.fullName}, CW ${isoWeek(item.week![0]).week}`:`Statistics for ${employee.fullName}`} onClick={()=>setStatsEmployee(employee)} onContextMenu={event=>{event.preventDefault();event.stopPropagation();setEmployeeMenu({x:event.clientX,y:event.clientY,employeeId:employee.id});}} title="Open employee statistics · Right-click for user month view" sx={{position:'sticky',left:0,width:EMP_W,height:ROW_H,px:2,zIndex:4,bgcolor:'background.paper',borderRight:'1px solid #dbe3ec',display:'flex',flexDirection:'column',alignItems:'flex-start',justifyContent:'center',textAlign:'left','&:hover':{bgcolor:'#eff6ff'},'&:focus-visible':{outline:'2px solid #2563eb',outlineOffset:-2}}}>
      <Typography noWrap fontSize={minimal?12:13} fontWeight={600} sx={{maxWidth:'100%'}}>{calendar?`CW ${isoWeek(item.week![0]).week}`:employee.fullName}</Typography>{!minimal&&<Typography noWrap fontSize={11} color="text.secondary">{calendar?`${displayDate(item.week![0])} – ${displayDate(item.week![6])}`:`${employee.role??'Operator'} · ${employee.department}`}</Typography>}
     </ButtonBase>
     {colV.getVirtualItems().map(col=>{
      const pos={r:row.index,c:col.index},cell=cellAt(pos.r,pos.c)!,date=cell.date,key=assignmentKey(employee.id,date),coordinate=posKey(pos),assignment=getAssignment(pos.r,pos.c);
      const dateLabel=dateMetadata.get(date)!.label;
      const dirty=Boolean(edits[key]),chosen=drag.preview?.mode==='select'?previewCells.has(coordinate):selected.has(key);
      const target=drag.preview?.mode!=='select'&&previewCells.has(coordinate),previewValue=previewValues.get(coordinate),code=previewValue?.shiftCode??assignment?.shiftCode;
      const areaId=previewValue?previewValue.areaId:assignment?.areaId,area=areaId==null?undefined:areasById.get(areaId);
      const source=drag.preview?.mode==='move'&&sourceCells.has(coordinate)&&!previewValue,outsideMonth=calendar&&date.slice(0,7)!==ui.anchor.slice(0,7);
      const assessment=assessSkills(employee,areaId,date,code),skillSummary=ui.colorMode==='skill'?assessment.summary:undefined;
      const bg=assignmentColor(code,assessment.status,ui.colorMode,minimal);
      const fillHandle=drag.canFill&&drag.selectionBounds?.r1===pos.r&&drag.selectionBounds.c1===pos.c&&!drag.preview;
      if(minimal){const canMove=chosen&&Boolean(assignment)&&!saving&&!drag.preview;return <CompactPlannerCell key={key} r={pos.r} c={pos.c} date={date} dateLabel={dateLabel} employeeName={employee.fullName} backgroundColor={bg} skillSummary={skillSummary} skillStatus={assessment.status} areaCode={area?.code} shift={assignment?.shiftCode} displayShift={code} left={col.start+2} width={col.size-4} height={ROW_H-6} dirty={dirty} selected={chosen} target={target} invalid={target&&invalidDrop} source={Boolean(source)} locked={Boolean(assignment?.locked)} saving={saving} canMove={canMove} canFill={Boolean(fillHandle)} onDragStart={canMove||fillHandle?drag.start:undefined}/>;}
      return <Box key={key} role="gridcell" data-skill-status={assessment.status} data-cell={`${pos.r}:${pos.c}`} data-date={date} data-shift={assignment?.shiftCode??''} data-dirty={dirty||undefined} data-outside-month={outsideMonth||undefined} aria-colindex={col.index+2} aria-selected={chosen} aria-readonly={assignment?.locked||saving||undefined}
       aria-label={`${employee.fullName}, ${dateLabel}, ${code?SHIFT_LABELS[code]:'Unplanned'}, ${area?.code??'No area'}${dirty?', unsaved':''}${assignment?.locked?', locked':''}${skillSummary?`, ${skillSummary}`:''}`}
       title={`${employee.fullName} · ${dateLabel} · ${code?`${SHIFT_LABELS[code]} (${code})`:'Unplanned'} · ${area?.code??'No area'}${dirty?' · unsaved':''} · Double-click to edit${skillSummary?` - ${skillSummary}`:''}`}
       sx={{position:'absolute',top:calendar?3:minimal?3:4,left:col.start+(minimal?2:4),width:col.size-(minimal?4:8),height:ROW_H-(minimal?6:8),borderRadius:minimal?'3px':calendar?'10px':'8px',bgcolor:bg,backgroundImage:!code&&minimal?'repeating-linear-gradient(135deg,transparent,transparent 3px,#e2e8f0 3px,#e2e8f0 4px)':undefined,
        border:target?`2px dashed ${invalidDrop?'#dc2626':'#0891b2'}`:chosen?'2px solid #2563eb':'1px solid #dae2eb',boxShadow:chosen?'0 0 0 1px #2563eb':undefined,
        opacity:source?0.4:outsideMonth?0.55:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:calendar?'flex-end':'center',pb:calendar?1:0,cursor:drag.preview?'inherit':saving?'wait':'cell',userSelect:'none',touchAction:'pan-x pan-y',fontWeight:650,fontSize:12,color:assignmentTextColor(code,assessment.status,ui.colorMode),'&:hover':{filter:drag.preview?undefined:'brightness(.97)'}}}>
       {calendar&&<ButtonBase aria-label={`Day details for ${dateLabel}`} title="Double-click date: daily status by area" onDoubleClick={event=>{event.preventDefault();event.stopPropagation();setStatsDate(date);}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();setStatsDate(date);}}} sx={{position:'absolute',top:5,left:7,px:.25,bgcolor:ui.colorMode==='skill'&&assessment.status==='expert'?'#ffffffed':undefined,borderRadius:.5,fontSize:12,fontWeight:date===today?800:500,color:date===today?'primary.main':'text.secondary','&:hover':{bgcolor:'#ffffff90'}}}>{outsideMonth?dateLabel.slice(0,5):Number(date.slice(8))}{date===today?' · Today':''} <AbsenceRate metric={absence?.byDate[date]} date={date}/></ButtonBase>}
       {!minimal&&<Box component="span" sx={{pointerEvents:'none',fontSize:calendar?16:12}}>{code??'—'}</Box>}{!minimal&&isWorkingShift(code)&&<Typography component="span" noWrap data-cell-area sx={{fontSize:calendar?12:10,maxWidth:'100%',lineHeight:1.25,pointerEvents:'none'}}>{area?.code??(code?'No area':'')}</Typography>}
       {assignment?.locked&&<Box component="span" aria-hidden sx={{position:'absolute',top:1,left:minimal?0:4,fontSize:minimal?8:10}}>🔒</Box>}
       {chosen&&assignment&&!saving&&!drag.preview&&<Box component="button" type="button" tabIndex={-1} className="move-grip" aria-label={`Drag ${assignment.shiftCode} to move; Control or Command drag to copy`} title="Move selection - Ctrl/Cmd to copy" onPointerDown={event=>drag.start(event,pos,'move')} sx={{position:'absolute',left:0,bottom:calendar?7:3,width:minimal?11:18,height:minimal?17:22,p:0,border:0,bgcolor:'transparent',color:'#526b88',fontSize:minimal?12:17,lineHeight:1,cursor:'grab',touchAction:'none'}}>⠿</Box>}
       {dirty&&<Box component="span" aria-hidden sx={{position:'absolute',top:2,right:minimal?1:4,color:'#dd6b20',fontSize:minimal?7:11,pointerEvents:'none'}}>●</Box>}
       {fillHandle&&<Box component="button" type="button" tabIndex={-1} aria-label="Drag to fill selection" title="Fill pattern" onPointerDown={event=>drag.start(event,pos,'fill')} sx={{position:'absolute',right:minimal?-3:-5,bottom:minimal?-3:-5,width:minimal?10:16,height:minimal?10:16,p:0,border:'2px solid white',borderRadius:'3px',bgcolor:'#2563eb',boxShadow:'0 0 0 1px #2563eb',zIndex:3,cursor:'crosshair',touchAction:'none'}}/>}
      </Box>;
     })}
    </Box>;})}
   </Box>
  </Box>
  <Typography id={statusId} role="status" aria-live="polite" variant="caption" sx={{px:1.5,py:.75,minHeight:32,borderTop:'1px solid',borderColor:'divider',bgcolor:invalidDrop?'#fff1f2':drag.preview?'#ecfeff':'background.paper',color:invalidDrop?'error.main':'text.secondary'}}>{saving?'Saving changes…':feedback??drag.status}</Typography>
  <Menu open={Boolean(menu)} onClose={()=>setMenu(null)} anchorReference="anchorPosition" anchorPosition={menu?{top:menu.y,left:menu.x}:undefined} slotProps={{list:{'aria-label':'Shift assignment'}}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();}}>
   <ListSubheader sx={{lineHeight:'32px'}}>{positions.length} cells selected{lockedSelected?` · ${lockedSelected} locked`:''}</ListSubheader>
   {SHIFT_CODES.map(code=><MenuItem key={code} disabled={saving||positions.length===0||lockedSelected===positions.length} onClick={()=>{stage(positions,code);setMenu(null);}}><Box component="span" sx={{width:12,height:12,mr:1.5,bgcolor:SHIFT_COLORS[code],border:'1px solid #cbd5e1',borderRadius:.5}}/>{SHIFT_LABELS[code]} ({code})</MenuItem>)}
   <Divider/><ListSubheader sx={{lineHeight:'32px'}}>Change work area</ListSubheader>{snapshot.areas.map(area=><MenuItem key={area.id} disabled={saving||!positions.some(p=>{const assignment=getAssignment(p.r,p.c);return assignment&&!assignment.locked&&isWorkingShift(assignment.shiftCode);})} onClick={()=>stageArea(area.id)}>Area: {area.code}</MenuItem>)}
   <Divider/><MenuItem disabled={!positions.length} onClick={clearSelection}>Clear selection</MenuItem>
  </Menu>
  <Menu open={Boolean(employeeMenu)} onClose={()=>setEmployeeMenu(null)} anchorReference="anchorPosition" anchorPosition={employeeMenu?{top:employeeMenu.y,left:employeeMenu.x}:undefined} slotProps={{list:{'aria-label':'Employee options'}}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();}}>
   <MenuItem onClick={()=>{if(employeeMenu){dispatch(uiActions.setUserId(employeeMenu.employeeId));dispatch(uiActions.setView('user'));}setEmployeeMenu(null);}}>Go to user / month view</MenuItem>
  </Menu>
  {statsEmployee&&<EmployeeStatsDialog employee={statsEmployee} onClose={()=>setStatsEmployee(null)}/>}
  {statsDate&&<DayStatsDialog date={statsDate} employees={snapshot.employees} areas={snapshot.areas} assignmentFor={statsAssignment} onClose={()=>setStatsDate(null)}/>}
  {editor&&<ShiftEditorDialog key={`${editor.employee.id}|${editor.date}`} employee={editor.employee} date={editor.date} assignment={resolveAssignment(editor)} areas={snapshot.areas} saving={saving} onClose={()=>setEditor(null)} onApply={(code,areaId)=>{stageCells([editor],code,areaId);setEditor(null);}}/>}
 </Box>;
}
