import type {Assignment, ShiftCode} from '../model/types';

export interface CellPos {r:number;c:number}
export interface CellRect {r0:number;r1:number;c0:number;c1:number}
export interface CellValue {shiftCode:ShiftCode;areaId:number|null}
export interface SourceCell extends CellPos {value:CellValue}
export interface CellChange extends CellPos {value:CellValue}
export interface DragPlan {
 changes:CellChange[];
 destinations:CellChange[];
 selection:CellPos[];
 error:string|null;
 overwritten:number;
}
export const posKey=({r,c}:CellPos)=>`${r}|${c}`;
export const cellValue=(assignment:Assignment|undefined):CellValue=>({shiftCode:assignment?.shiftCode??'OFF',areaId:assignment?.areaId??null});
export const sameValue=(a:CellValue,b:CellValue)=>a.shiftCode===b.shiftCode&&a.areaId===b.areaId;
export function bounds(positions:CellPos[]):CellRect|null {
 if(!positions.length)return null;
 return positions.reduce((rect,p)=>({r0:Math.min(rect.r0,p.r),r1:Math.max(rect.r1,p.r),c0:Math.min(rect.c0,p.c),c1:Math.max(rect.c1,p.c)}),{r0:positions[0].r,r1:positions[0].r,c0:positions[0].c,c1:positions[0].c});
}
export function rectangle(a:CellPos,b:CellPos):CellPos[] {
 const cells:CellPos[]=[];
 for(let r=Math.min(a.r,b.r);r<=Math.max(a.r,b.r);r++)for(let c=Math.min(a.c,b.c);c<=Math.max(a.c,b.c);c++)cells.push({r,c});
 return cells;
}
export function isRectangle(positions:CellPos[]):boolean {
 const rect=bounds(positions);
 return Boolean(rect&&new Set(positions.map(posKey)).size===(rect.r1-rect.r0+1)*(rect.c1-rect.c0+1));
}
// Snapshot source values before writing: overlapping moves must never read their own changes.
export function planDrag({mode,source,origin,target,rowCount,colCount,getAssignment}:{
 mode:'move'|'copy'|'fill';source:SourceCell[];origin:CellPos;target:CellPos;
 rowCount:number;colCount:number;getAssignment:(pos:CellPos)=>Assignment|undefined;
}):DragPlan {
 const plan:DragPlan={changes:[],destinations:[],selection:[],error:null,overwritten:0};
 const rect=bounds(source);
 if(!rect)return plan;
 if(mode==='fill') {
  if(!isRectangle(source))return {...plan,error:'Select a complete rectangle to fill.'};
  const expanded=rectangle({r:Math.min(rect.r0,target.r),c:Math.min(rect.c0,target.c)},{r:Math.max(rect.r1,target.r),c:Math.max(rect.c1,target.c)});
  const extension=expanded.filter(p=>p.r<rect.r0||p.r>rect.r1||p.c<rect.c0||p.c>rect.c1);
  const values=new Map(source.map(cell=>[posKey(cell),cell.value]));
  const wrap=(n:number,size:number)=>((n%size)+size)%size;
  plan.destinations=extension.map(({r,c})=>({r,c,value:values.get(posKey({r:rect.r0+wrap(r-rect.r0,rect.r1-rect.r0+1),c:rect.c0+wrap(c-rect.c0,rect.c1-rect.c0+1)}))!}));
  plan.selection=expanded;
 }else {
  const dr=target.r-origin.r,dc=target.c-origin.c;
  plan.destinations=source.map(({r,c,value})=>({r:r+dr,c:c+dc,value}));
  plan.selection=plan.destinations.map(({r,c})=>({r,c}));
  if(!dr&&!dc)return {...plan,changes:[],destinations:[]};
 }
 if(plan.destinations.some(p=>p.r<0||p.r>=rowCount||p.c<0||p.c>=colCount))return {...plan,error:'The whole selection must fit inside the visible date range and employee list.'};
 if(plan.destinations.some(p=>getAssignment(p)?.locked))return {...plan,error:'The destination contains a locked cell. Nothing will be changed.'};
 if(mode==='move'&&source.some(p=>getAssignment(p)?.locked))return {...plan,error:'Locked shifts can be copied, but cannot be moved.'};
 const sourceKeys=new Set(source.map(posKey));
 const changes=new Map<string,CellChange>();
 if(mode==='move')for(const {r,c} of source)changes.set(posKey({r,c}),{r,c,value:{shiftCode:'OFF',areaId:null}});
 for(const cell of plan.destinations) {
  changes.set(posKey(cell),cell);
  const before=cellValue(getAssignment(cell));
  if(!sourceKeys.has(posKey(cell))&&before.shiftCode!=='OFF'&&!sameValue(before,cell.value))plan.overwritten++;
 }
 plan.changes=[...changes.values()].filter(cell=>!sameValue(cellValue(getAssignment(cell)),cell.value));
 return plan;
}
