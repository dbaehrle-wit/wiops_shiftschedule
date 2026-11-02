import {memo,type PointerEvent} from 'react';
import type {ShiftCode} from '../model/types';
import {SHIFT_LABELS} from '../model/shiftDisplay';
import type {CellPos} from '../utils/gridDrag';
import '../styles/plannerGrid.css';

interface Props {
 r:number;c:number;date:string;dateLabel:string;employeeName:string;areaCode:string|undefined;
 shift:ShiftCode|undefined;displayShift:ShiftCode|undefined;left:number;width:number;height:number;
 dirty:boolean;selected:boolean;target:boolean;invalid:boolean;source:boolean;locked:boolean;saving:boolean;
 canMove:boolean;canFill:boolean;backgroundColor:string;skillSummary?:string;skillStatus?:string;
 onDragStart?: (event:PointerEvent,position:CellPos,handle:'move'|'fill')=>void;
}

// Unchanged cells skip rendering when focus, selection, a menu, or a draft elsewhere changes.
export const CompactPlannerCell=memo(function CompactPlannerCell({r,c,date,dateLabel,employeeName,areaCode,shift,displayShift,left,width,height,dirty,selected,target,invalid,source,locked,saving,canMove,canFill,onDragStart,backgroundColor,skillSummary,skillStatus}:Props) {
 return <div role="gridcell" className="compact-planner-cell" data-cell={`${r}:${c}`} data-date={date} data-shift={shift??''} data-dirty={dirty||undefined}
  data-skill-status={skillStatus} data-target={target||undefined} data-invalid={target&&invalid||undefined} data-source={source||undefined} data-empty={!displayShift||undefined} data-saving={saving||undefined}
  aria-colindex={c+2} aria-selected={selected} aria-readonly={locked||saving||undefined}
  aria-label={`${employeeName}, ${dateLabel}, ${displayShift?SHIFT_LABELS[displayShift]:'Unplanned'}, ${areaCode??'No area'}${dirty?', unsaved':''}${locked?', locked':''}${skillSummary?`, ${skillSummary}`:''}`}
  title={`${employeeName} · ${dateLabel} · ${displayShift?`${SHIFT_LABELS[displayShift]} (${displayShift})`:'Unplanned'} · ${areaCode??'No area'}${dirty?' · unsaved':''} · Double-click to edit${skillSummary?` - ${skillSummary}`:''}`}
  style={{left,width,height,backgroundColor}}>
  {locked&&<span className="compact-cell-lock" aria-hidden>🔒</span>}
  {canMove&&<button type="button" tabIndex={-1} className="move-grip compact-move-grip" aria-label={`Drag ${shift} to move; Control or Command drag to copy`} title="Move selection · Ctrl/Cmd to copy" onPointerDown={event=>onDragStart?.(event,{r,c},'move')}>⠿</button>}
  {dirty&&<span className="compact-cell-dirty" aria-hidden>●</span>}
  {canFill&&<button type="button" tabIndex={-1} className="compact-fill-handle" aria-label="Drag to fill selection" title="Fill pattern" onPointerDown={event=>onDragStart?.(event,{r,c},'fill')}/>}
 </div>;
});
