import {memo,useCallback,useEffect,useId,useMemo,useRef,useState} from 'react';
import {Alert,Box,Button,Chip,Dialog,DialogActions,DialogContent,DialogTitle,Stack,Typography} from '@mui/material';
import {useVirtualizer} from '@tanstack/react-virtual';
import {useAppSelector} from '../app/hooks';
import {effectiveAssignments} from '../model/assignments';
import {buildOpsWeek,defaultOpsConfig,hourLabel,validOpsConfig,type OpsConfig,type OpsLane} from '../model/opsHours';
import type {PlannerSnapshot} from '../model/types';
import type {AbsenceReport} from '../model/absence';
import {addDays,displayDate,startOfWeek,weekdayLabel} from '../utils/date';
import {PlannerViewHeader,type PlannerHeaderSlots} from './PlannerViewHeader';
import {PlannerSelect} from './PlannerControls';
import {OpsHoursSettings} from './OpsHoursSettings';
import {AbsenceRate} from './AbsenceRate';
import '../styles/opsHours.css';

const LABEL_WIDTH=190,HEADER_HEIGHT=48,LANE_HEIGHT=100,GROUP_HEIGHT=30;
const storageKey=(snapshot:PlannerSnapshot)=>`wiops-shiftschedule.ops-hours.v1.${snapshot.siteId}${snapshot.operatingProfilesVersion?`.${snapshot.operatingProfilesVersion}`:''}`;
function loadConfig(snapshot:PlannerSnapshot) {
 try{const value:unknown=JSON.parse(localStorage.getItem(storageKey(snapshot))??'null');if(validOpsConfig(value))return value;}catch{/* Fall back to the supplied settings. */}
 return defaultOpsConfig(snapshot.shiftTypes,snapshot.operatingProfiles);
}
const HourlyLane=memo(function HourlyLane({lane,hourWidth,maximum,onSelect}:{lane:OpsLane;hourWidth:number;maximum:number;onSelect:(department:string,areaId:number,index:number)=>void}) {
 const [focusHour,setFocusHour]=useState(0),id=useId(),baseline=80,scale=62/maximum;
 const targetPath=lane.hours.flatMap((hour,index)=>hour.operating?[`M${index*hourWidth},${baseline-hour.target!*scale}H${(index+1)*hourWidth}`]:[]).join(' ');
 return <svg className="ops-lane" data-ops-lane={`${lane.department}|${lane.area.id}`} role="img" tabIndex={0} aria-label={`${lane.department}, ${lane.area.code}: hourly planned headcount, peak ${lane.peak}. Use left/right arrows then Enter for hour details. ${lane.hours[focusHour].date} ${hourLabel(focusHour%24)}: ${lane.hours[focusHour].planned} planned.`} width={168*hourWidth} height={LANE_HEIGHT} style={{left:LABEL_WIDTH}} onClick={event=>{const index=Math.floor((event.clientX-event.currentTarget.getBoundingClientRect().left)/hourWidth);if(index>=0&&index<168)onSelect(lane.department,lane.area.id,index);}} onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setFocusHour(hour=>Math.max(0,Math.min(167,hour+(event.key==='ArrowRight'?1:-1))));}if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(lane.department,lane.area.id,focusHour);}}}>
  {lane.hours.map((hour,index)=>{
   const x=index*hourWidth,height=hour.planned*scale,description=`${lane.department} / ${lane.area.code} - ${hour.date} ${hourLabel(hour.hour)}-${hourLabel(hour.hour+1)}: ${hour.planned} planned. ${hour.operating?`Operating; target ${hour.target}`:lane.configured?'Non-operating; no target':'Operating hours not configured'}`;
   return <g key={index} id={`${id}-${index}`} className="ops-hour" data-ops-hour={index} data-planned={hour.planned} data-operating={hour.operating} data-target={hour.target??''}><title>{description}</title><rect x={x} y={0} width={hourWidth} height={baseline} fill={hour.operating?'#e8f3ff':'#f1f3f5'}/><path d={`M${x},0V${baseline}`} stroke={index%24===0?'#94a3b8':'#dbe3ec'} strokeWidth={index%24===0?1:.4}/>{hour.planned>0&&<rect data-ops-bar x={x+Math.min(1,hourWidth/5)} y={baseline-height} width={Math.max(1,hourWidth-2)} height={height} rx={1} fill={!hour.operating?'#94a3b8':hour.planned<hour.target!?'#e6a23c':'#4285d4'}/>}<path d={`M${x},${baseline}H${x+hourWidth}`} stroke={hour.operating?'#89a8ca':'#b8c1cc'} strokeWidth={2}/>{(hourWidth>=12||index%6===0)&&<text x={x+hourWidth/2} y={Math.max(9,baseline-height-4)} textAnchor="middle" fill="#42566f" fontSize={hourWidth>=12?10:8} pointerEvents="none">{hour.planned}</text>}</g>;
  })}
  <path d={targetPath} stroke="#163b64" strokeWidth={1.5} strokeDasharray="4 2" fill="none" pointerEvents="none"/>
  <rect className="ops-focus-column" x={focusHour*hourWidth+1} y={1} width={Math.max(1,hourWidth-2)} height={baseline-2} fill="none" pointerEvents="none"/>
 </svg>;
});

export function OpsHoursView({snapshot,headerFilters,headerActions,absence}:{snapshot:PlannerSnapshot;absence?:AbsenceReport}&PlannerHeaderSlots) {
 const ui=useAppSelector(state=>state.ui),edits=useAppSelector(state=>state.draft.edits),viewport=useRef<HTMLDivElement>(null),id=useId();
 const [config,setConfig]=useState(()=>loadConfig(snapshot)),[settings,setSettings]=useState(false),[storageError,setStorageError]=useState(false),[zoom,setZoom]=useState(0),[width,setWidth]=useState(1200),[selected,setSelected]=useState<{department:string;areaId:number;index:number}|null>(null);
 const week=startOfWeek(ui.anchor),dates=useMemo(()=>Array.from({length:7},(_,day)=>addDays(week,day)),[week]);
 const employees=useMemo(()=>snapshot.employees.filter(employee=>ui.departmentFilter==='all'||employee.department===ui.departmentFilter),[snapshot.employees,ui.departmentFilter]);
 const areas=useMemo(()=>snapshot.areas.filter(area=>ui.areaFilter===null||area.id===ui.areaFilter),[snapshot.areas,ui.areaFilter]);
 const assignments=useMemo(()=>effectiveAssignments(snapshot.assignments,edits),[snapshot.assignments,edits]);
 const lanes=useMemo(()=>buildOpsWeek(week,employees,areas,assignments,config),[week,employees,areas,assignments,config]);
 const departments=useMemo(()=>[...new Set(snapshot.employees.map(employee=>employee.department))].sort(),[snapshot.employees]);
 const rows=useMemo(()=>[...new Set(lanes.map(lane=>lane.department))].flatMap(department=>[{kind:'department' as const,key:department,department},...lanes.filter(lane=>lane.department===department).map(lane=>({kind:'area' as const,key:`${department}|${lane.area.id}`,lane}))]),[lanes]);
 const maximum=lanes.reduce((maximum,lane)=>Math.max(maximum,lane.peak,...lane.hours.map(hour=>hour.target??0)),1);
 const hourWidth=zoom||Math.max(6,(width-LABEL_WIDTH)/168),chartWidth=LABEL_WIDTH+hourWidth*168;
 const virtualizer=useVirtualizer({count:rows.length,getScrollElement:()=>viewport.current,estimateSize:index=>rows[index].kind==='department'?GROUP_HEIGHT:LANE_HEIGHT,overscan:3,scrollMargin:HEADER_HEIGHT,scrollPaddingStart:HEADER_HEIGHT});
 useEffect(()=>{const element=viewport.current;if(!element)return;const observer=new ResizeObserver(()=>setWidth(element.clientWidth));observer.observe(element);return ()=>observer.disconnect();},[]);
 useEffect(()=>{setSelected(null);viewport.current?.scrollTo({top:0,left:0});},[ui.anchor,ui.departmentFilter,ui.areaFilter]);
 useEffect(()=>{virtualizer.measure();},[rows,virtualizer]);
 const onSelect=useCallback((department:string,areaId:number,index:number)=>setSelected({department,areaId,index}),[]);
 const selectedLane=selected?lanes.find(lane=>lane.department===selected.department&&lane.area.id===selected.areaId):undefined,hour=selectedLane&&selected?selectedLane.hours[selected.index]:undefined;
 const saveSettings=(next:OpsConfig)=>{setConfig(next);setSettings(false);try{localStorage.setItem(storageKey(snapshot),JSON.stringify(next));setStorageError(false);}catch{setStorageError(true);}};
 return <Box sx={{flex:1,minWidth:0,minHeight:0,display:'flex',flexDirection:'column',border:'1px solid #dbe3ec',borderRadius:2,overflow:'hidden',bgcolor:'background.paper'}}>
  <PlannerViewHeader actions={headerActions}><Typography component="h2" variant="subtitle1" fontWeight={700}>Ops hours</Typography>{headerFilters}<PlannerSelect<number> label="Hour scale" value={zoom} width={135} options={[{value:0,label:'Fit week'},{value:12,label:'12 px / hour'},{value:20,label:'20 px / hour'}]} onChange={setZoom}/><Button size="small" onClick={()=>setSettings(true)}>Configure hours</Button></PlannerViewHeader>
  <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5} sx={{px:1.5,py:.75,borderBottom:'1px solid #dbe3ec'}}>
   <Typography variant="caption" color="text.secondary" sx={{mr:'auto'}}>168 site-local hours - {snapshot.siteTimeZone} - Includes drafts and overnight carry-in</Typography>
   <Stack direction="row" alignItems="center" gap={.5}><Box sx={{width:12,height:12,bgcolor:'#e8f3ff',border:'1px solid #a9c5e5'}}/><Typography variant="caption">Operating</Typography></Stack><Stack direction="row" alignItems="center" gap={.5}><Box sx={{width:12,height:12,bgcolor:'#f1f3f5',border:'1px solid #b8c1cc'}}/><Typography variant="caption">Non-operating</Typography></Stack><Stack direction="row" alignItems="center" gap={.5}><Box sx={{width:16,borderTop:'2px dashed #163b64'}}/><Typography variant="caption">Hourly target</Typography></Stack><Typography variant="caption" color="text.secondary">Amber bars: below target. Click an hour for details.</Typography>
  </Stack>
  {storageError&&<Alert severity="warning">Settings could not be saved in browser storage.</Alert>}
  {!lanes.length&&<Alert severity="info">No department/area lanes match the active filters.</Alert>}
  <Box ref={viewport} data-ops-scroll sx={{flex:1,minHeight:0,overflow:'auto'}}>
   <Box sx={{position:'relative',width:chartWidth,height:HEADER_HEIGHT+virtualizer.getTotalSize()}}>
    <Box sx={{position:'sticky',top:0,height:HEADER_HEIGHT,zIndex:6,bgcolor:'#eaf1f8',borderBottom:'1px solid #bdcde0'}}>
     <Box sx={{position:'sticky',left:0,zIndex:8,width:LABEL_WIDTH,height:HEADER_HEIGHT,px:1.5,bgcolor:'#eaf1f8',display:'flex',flexDirection:'column',justifyContent:'center',borderRight:'1px solid #bdcde0'}}><Typography fontSize={12} fontWeight={700}>Department / area</Typography><Typography variant="caption" color="text.secondary">Headcount scale: 0-{maximum}</Typography></Box>
     {dates.map((date,day)=><Box key={date} data-ops-date={date} sx={{position:'absolute',left:LABEL_WIDTH+day*24*hourWidth,top:0,width:24*hourWidth,height:24,borderLeft:'1px solid #bdcde0',px:.75,display:'flex',alignItems:'center',justifyContent:'space-between',gap:.5,overflow:'hidden'}}><Typography noWrap fontSize={11} fontWeight={700}>{weekdayLabel(date)} {displayDate(date)}</Typography><AbsenceRate metric={absence?.byDate[date]} date={date}/></Box>)}
     {Array.from({length:168},(_,index)=>index).filter(index=>hourWidth>=16||index%6===0).map(index=><Box key={index} sx={{position:'absolute',left:LABEL_WIDTH+index*hourWidth,top:25,width:hourWidth,fontSize:9,lineHeight:'20px',textAlign:'center',color:'text.secondary'}}>{String(index%24).padStart(2,'0')}</Box>)}
    </Box>
    {virtualizer.getVirtualItems().map(item=>{
     const row=rows[item.index];return <Box key={row.key} sx={{position:'absolute',top:item.start,left:0,width:chartWidth,height:item.size,borderBottom:'1px solid #dbe3ec',bgcolor:row.kind==='department'?'#eaf1f8':'white'}}>
      <Box sx={{position:'sticky',left:0,zIndex:4,width:LABEL_WIDTH,height:'100%',px:1.5,bgcolor:row.kind==='department'?'#eaf1f8':'white',borderRight:'1px solid #bdcde0',display:'flex',flexDirection:'column',justifyContent:'center'}}>{row.kind==='department'?<Typography fontSize={12} fontWeight={800}>{row.department}</Typography>:<><Typography fontSize={13} fontWeight={700}>{row.lane.area.code}</Typography><Typography variant="caption" color="text.secondary">Peak {row.lane.peak} - {row.lane.staffHours} staff-h</Typography><Typography variant="caption" color={row.lane.gapHours?'warning.dark':'text.secondary'}>{row.lane.configured?`${row.lane.gapHours} operating hours short`:'No operating hours set'}</Typography></>}</Box>
      {row.kind==='area'&&<HourlyLane lane={row.lane} hourWidth={hourWidth} maximum={maximum} onSelect={onSelect}/>}
     </Box>;
    })}
   </Box>
  </Box>
  {settings&&<OpsHoursSettings initialDepartment={ui.departmentFilter==='all'?undefined:ui.departmentFilter} initialAreaId={ui.areaFilter??undefined} config={config} departments={departments} areas={snapshot.areas} onClose={()=>setSettings(false)} onSave={saveSettings}/>}
  <Dialog open={Boolean(hour)} onClose={()=>setSelected(null)} fullWidth maxWidth="sm" aria-labelledby={`${id}-hour-title`}>
   <DialogTitle id={`${id}-hour-header`} component="div"><Typography id={`${id}-hour-title`} component="h2" variant="h6">Hourly staffing</Typography>{hour&&<Typography variant="body2" color="text.secondary">{selectedLane?.department} / {selectedLane?.area.code} - {displayDate(hour.date)} {hourLabel(hour.hour)}-{hourLabel(hour.hour+1)}</Typography>}</DialogTitle>
   <DialogContent dividers>{hour&&<><Stack direction="row" flexWrap="wrap" gap={1} sx={{mb:2}}><Chip label={`${hour.planned} planned`}/><Chip label={hour.operating?`Target ${hour.target}`:'Non-operating - no target'} color={hour.operating?'info':'default'}/></Stack><Typography variant="body2" color="text.secondary" sx={{mb:1}}>Scheduled presence during this hour. OFF, PTO and sick leave are excluded.</Typography><Stack spacing={1}>{hour.employeeIds.map(employeeId=>{const employee=snapshot.employees.find(employee=>employee.id===employeeId);return <Typography key={employeeId} variant="body2">{employee?.fullName??employeeId} - {employee?.role??'Operator'}</Typography>;})}{!hour.employeeIds.length&&<Typography variant="body2">No employees planned.</Typography>}</Stack></>}</DialogContent><DialogActions><Button onClick={()=>setSelected(null)}>Close</Button></DialogActions>
  </Dialog>
 </Box>;
}
