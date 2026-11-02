import {useCallback,useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type RefObject} from 'react';
import type {Assignment} from '../model/types';
import {bounds,cellValue,isRectangle,planDrag,posKey,rectangle,type CellChange,type CellPos,type DragPlan,type SourceCell} from '../utils/gridDrag';

export const EMP_W=218,CELL_W=78,ROW_H=48,HEADER_H=64;
export interface GridMetrics {employeeWidth:number;cellWidth:number;rowHeight:number;headerHeight:number}
export const DEFAULT_METRICS:GridMetrics={employeeWidth:EMP_W,cellWidth:CELL_W,rowHeight:ROW_H,headerHeight:HEADER_H};
type Kind='select'|'move'|'fill';
interface Session {
 pointerId:number;kind:Kind;origin:CellPos;anchor:CellPos;source:SourceCell[];selection:CellPos[];
 startX:number;startY:number;x:number;y:number;copy:boolean;toggle:boolean;extend:boolean;
 dragging:boolean;target:CellPos;outside:boolean;signature:string;
}
interface Preview {mode:Kind|'copy';plan:DragPlan|null;positions:CellPos[];source:CellPos[];outside:boolean}
interface Options {
 viewport:RefObject<HTMLDivElement|null>;positions:CellPos[];anchor:CellPos|null;
 rowCount:number;colCount:number;disabled:boolean;contextKey:string;
 getAssignment:(r:number,c:number)=>Assignment|undefined;
 onSelect:(positions:CellPos[],focus:CellPos,anchor:CellPos)=>void;
 onCommit:(changes:CellChange[])=>void;
 metrics?:GridMetrics;
}
const emptyMessage='Drag cells to select a rectangle · Dotted grip to move · Ctrl/⌘ + grip to copy · Blue corner to fill';
function describeSelection(cells:CellPos[]) {
 const rect=bounds(cells);
 return rect?`${rect.r1-rect.r0+1} × ${rect.c1-rect.c0+1} · ${cells.length} cells selected`:'No cells selected';
}
export function useGridDrag({viewport,positions,anchor,rowCount,colCount,disabled,contextKey,getAssignment,onSelect,onCommit,metrics=DEFAULT_METRICS}:Options) {
 const {employeeWidth,cellWidth,rowHeight,headerHeight}=metrics;
 const session=useRef<Session|null>(null);
 const [started,setStarted]=useState(false);
 const [preview,setPreview]=useState<Preview|null>(null);
 const [message,setMessage]=useState(emptyMessage);
 const selectionBounds=bounds(positions);
 const canFill=positions.length>0&&isRectangle(positions)&&positions.some(p=>getAssignment(p.r,p.c))&&!disabled;
 const release=useCallback(()=>{
  const current=session.current;session.current=null;
  if(current&&viewport.current?.hasPointerCapture(current.pointerId))viewport.current.releasePointerCapture(current.pointerId);
  setStarted(false);setPreview(null);
  return current;
 },[viewport]);
 const cancel=useCallback(()=>{if(session.current){release();setMessage('Drag cancelled. No changes made.');}},[release]);
 const refresh=useCallback((autoScroll:boolean)=>{
  const current=session.current,element=viewport.current;
  if(!current||!element)return;
  if(!current.dragging&&Math.hypot(current.x-current.startX,current.y-current.startY)<5)return;
  current.dragging=true;
  const rect=element.getBoundingClientRect();
  const left=rect.left+element.clientLeft,top=rect.top+element.clientTop;
  const right=left+element.clientWidth,bottom=top+element.clientHeight;
  if(autoScroll) {
   const speed=(coordinate:number,min:number,max:number)=>coordinate<min+32?-Math.min(18,(min+32-coordinate)/2):coordinate>max-32?Math.min(18,(coordinate-max+32)/2):0;
   element.scrollLeft+=speed(current.x,left+employeeWidth,right);
   element.scrollTop+=speed(current.y,top+headerHeight,bottom);
  }
  const raw={r:Math.floor((current.y-top+element.scrollTop-headerHeight)/rowHeight),c:Math.floor((current.x-left+element.scrollLeft-employeeWidth)/cellWidth)};
  current.target=current.kind==='move'?raw:{r:Math.max(0,Math.min(rowCount-1,raw.r)),c:Math.max(0,Math.min(colCount-1,raw.c))};
  current.outside=current.x<left+employeeWidth||current.x>=right||current.y<top+headerHeight||current.y>=bottom;
  const mode=current.kind==='move'&&current.copy?'copy':current.kind;
  const signature=`${posKey(current.target)}|${mode}|${current.outside}`;
  if(signature===current.signature)return;
  current.signature=signature;
  if(mode==='select') {
   setPreview({mode,plan:null,positions:rectangle(current.anchor,current.target),source:[],outside:current.outside});
  }else {
   const plan=planDrag({mode,source:current.source,origin:current.origin,target:current.target,rowCount,colCount,getAssignment:p=>getAssignment(p.r,p.c)});
   setPreview({mode,plan,positions:plan.selection,source:current.source,outside:current.outside});
  }
 },[viewport,rowCount,colCount,getAssignment,employeeWidth,cellWidth,rowHeight,headerHeight]);
 const finish=useCallback((event:PointerEvent)=>{
  const current=session.current;
  if(!current||event.pointerId!==current.pointerId)return;
  current.x=event.clientX;current.y=event.clientY;current.copy=event.ctrlKey||event.metaKey;
  refresh(false);
  release();
  if(!current.dragging) {
   if(current.kind==='fill')return;
   const cells=current.extend?rectangle(current.anchor,current.origin):current.toggle
    ? current.selection.some(p=>posKey(p)===posKey(current.origin))?current.selection.filter(p=>posKey(p)!==posKey(current.origin)):[...current.selection,current.origin]
    : [current.origin];
   onSelect(cells,current.origin,current.extend?current.anchor:current.origin);
   return;
  }
  if(current.outside){setMessage('Drop inside the grid to apply changes. Drag cancelled.');return;}
  if(current.kind==='select') {
   const cells=rectangle(current.anchor,current.target);onSelect(cells,current.target,current.anchor);
   setMessage(`${describeSelection(cells)}.`);return;
  }
  const mode=current.kind==='move'&&current.copy?'copy':current.kind;
  const plan=planDrag({mode,source:current.source,origin:current.origin,target:current.target,rowCount,colCount,getAssignment:p=>getAssignment(p.r,p.c)});
  if(plan.error){setMessage(plan.error);return;}
  const first=plan.selection[0],last=plan.selection.at(-1)!;
  if(!plan.changes.length){if(first)onSelect(plan.selection,last,first);setMessage('No changes needed.');return;}
  onCommit(plan.changes);
  onSelect(plan.selection,last,first);
  setMessage(`${mode==='fill'?'Filled':mode==='copy'?'Copied':'Moved'} ${plan.destinations.length} cells${plan.overwritten?`; replaced ${plan.overwritten} existing shifts`:''}. ${mode==='move'?'Vacated source cells are now Off. ':''}Undo with Ctrl/⌘ + Z.`);
 },[refresh,release,rowCount,colCount,getAssignment,onCommit,onSelect]);
 useEffect(()=>{
  if(!started)return;
  let frame=0;
  const tick=()=>{refresh(true);frame=requestAnimationFrame(tick);};
  const move=(event:PointerEvent)=>{const current=session.current;if(current&&event.pointerId===current.pointerId){current.x=event.clientX;current.y=event.clientY;current.copy=event.ctrlKey||event.metaKey;}};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();cancel();}else if(session.current)session.current.copy=event.ctrlKey||event.metaKey;};
  const lost=(event:PointerEvent)=>{if(event.pointerId===session.current?.pointerId)cancel();};
  const hidden=()=>{if(document.hidden)cancel();};
  frame=requestAnimationFrame(tick);
  window.addEventListener('pointermove',move);
  window.addEventListener('pointerup',finish);
  window.addEventListener('pointercancel',lost);
  window.addEventListener('lostpointercapture',lost);
  window.addEventListener('keydown',key,true);
  window.addEventListener('keyup',key,true);
  window.addEventListener('blur',cancel);
  document.addEventListener('visibilitychange',hidden);
  return ()=>{
   cancelAnimationFrame(frame);
   window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);
   window.removeEventListener('pointercancel',lost);window.removeEventListener('lostpointercapture',lost);
   window.removeEventListener('keydown',key,true);window.removeEventListener('keyup',key,true);
   window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden);
  };
 },[started,refresh,finish,cancel]);
 // A view/filter change, incoming snapshot, save, or draft change invalidates a gesture.
 useEffect(()=>{cancel();},[contextKey,getAssignment,disabled,cancel,employeeWidth,cellWidth,rowHeight,headerHeight]);
 useEffect(()=>()=>{const current=session.current;session.current=null;if(current&&viewport.current?.hasPointerCapture(current.pointerId))viewport.current.releasePointerCapture(current.pointerId);},[viewport]);
 const start=useCallback((event:ReactPointerEvent,origin:CellPos,handle?:'fill'|'move')=>{
  if(event.button!==0||!event.isPrimary||disabled||session.current)return;
  event.stopPropagation();
  viewport.current?.focus({preventScroll:true});
  if(event.pointerType==='touch'&&!handle){onSelect([origin],origin,origin);return;}
  event.preventDefault();
  const chosen=positions.some(p=>posKey(p)===posKey(origin));
  const sourcePositions=handle==='fill'||chosen?positions:[origin];
  const kind:Kind=handle==='fill'?'fill':handle==='move'?'move':'select';
  if(kind==='fill'&&!canFill)return;
  const safeAnchor=anchor&&anchor.r>=0&&anchor.r<rowCount&&anchor.c>=0&&anchor.c<colCount?anchor:origin;
  session.current={pointerId:event.pointerId,kind,origin,anchor:event.shiftKey?safeAnchor:origin,
   source:sourcePositions.map(p=>({...p,value:cellValue(getAssignment(p.r,p.c))})),selection:positions,
   startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,copy:event.ctrlKey||event.metaKey,
   toggle:event.ctrlKey||event.metaKey,extend:event.shiftKey,dragging:false,target:origin,outside:false,signature:''};
  viewport.current?.setPointerCapture(event.pointerId);
  setStarted(true);
  if(event.shiftKey)onSelect(rectangle(safeAnchor,origin),origin,safeAnchor);
  else if(!chosen&&!event.ctrlKey&&!event.metaKey)onSelect([origin],origin,origin);
 },[disabled,viewport,positions,getAssignment,canFill,anchor,rowCount,colCount,onSelect]);
 const startSelection=useCallback((event:ReactPointerEvent)=>{
  const element=viewport.current;
  if(!element||(event.target as HTMLElement).closest('button'))return;
  const rect=element.getBoundingClientRect();
  const x=event.clientX-rect.left-element.clientLeft,y=event.clientY-rect.top-element.clientTop;
  if(x<employeeWidth||y<headerHeight||x>=element.clientWidth||y>=element.clientHeight)return;
  const origin={r:Math.floor((y+element.scrollTop-headerHeight)/rowHeight),c:Math.floor((x+element.scrollLeft-employeeWidth)/cellWidth)};
  if(origin.r<0||origin.r>=rowCount||origin.c<0||origin.c>=colCount)return;
  start(event,origin);
 },[viewport,rowCount,colCount,start,employeeWidth,cellWidth,rowHeight,headerHeight]);
 const status=preview?.mode==='select'?`${describeSelection(preview.positions)} · Release to select · Esc to cancel`
  :preview?preview.outside?'Drop inside the grid · Esc to cancel':preview.plan?.error??`${preview.mode==='fill'?'Fill':preview.mode==='copy'?'Copy':'Move'} ${preview.plan?.destinations.length??0} cells${preview.plan?.overwritten?` · Replaces ${preview.plan.overwritten} shifts`:''} · Release to apply · Esc to cancel`
  :message;
 return {start,startSelection,started,preview,status,selectionBounds,canFill};
}
