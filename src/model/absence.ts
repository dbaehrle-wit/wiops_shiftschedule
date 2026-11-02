import {assignmentKey,isNonWorkingShift,isWorkingShift,type Area,type Assignment,type Employee} from './types';

export interface AbsenceMetric {absent:number;recorded:number;off:number;pto:number;sick:number;unplanned:number;unattributed:number;rate:number|null}
export interface AbsenceReport {byDate:Record<string,AbsenceMetric>;byArea:Record<number,AbsenceMetric>;total:AbsenceMetric;unattributedAbsences:number}
const empty=():AbsenceMetric=>({absent:0,recorded:0,off:0,pto:0,sick:0,unplanned:0,unattributed:0,rate:null});
function count(metric:AbsenceMetric,assignment:Assignment|undefined,unattributed=false) {
 if(!assignment){metric.unplanned++;return;}
 metric.recorded++;
 if(isNonWorkingShift(assignment.shiftCode)){
  metric.absent++;if(assignment.shiftCode==='OFF')metric.off++;else if(assignment.shiftCode==='P')metric.pto++;else metric.sick++;
  if(unattributed)metric.unattributed++;
 }
 metric.rate=metric.recorded?metric.absent/metric.recorded*100:null;
}

// Absence assignments intentionally have no work area. Use only prior/current working history,
// never future assignments, as a transparent proxy until backend area attribution is available.
export function absenceReport(employees:Employee[],dates:string[],assignments:Map<string,Assignment>,areas:Area[],areaFilter:number|null=null,headerDates:string[]=dates):AbsenceReport {
 const validAreas=new Set(areas.map(area=>area.id)),employeeIds=new Set(employees.map(employee=>employee.id));
 const history=new Map<number,{date:string;areaId:number}[]>();
 for(const assignment of assignments.values())if(employeeIds.has(assignment.employeeId)&&isWorkingShift(assignment.shiftCode)&&assignment.areaId!==null&&validAreas.has(assignment.areaId)){
  const entries=history.get(assignment.employeeId)??[];entries.push({date:assignment.date,areaId:assignment.areaId});history.set(assignment.employeeId,entries);
 }
 for(const entries of history.values())entries.sort((a,b)=>a.date.localeCompare(b.date));
 const previousArea=(employeeId:number,date:string)=>{
  const entries=history.get(employeeId)??[];let low=0,high=entries.length;
  while(low<high){const mid=(low+high)>>>1;if(entries[mid].date<=date)low=mid+1;else high=mid;}
  return entries[low-1]?.areaId??null;
 };
 const report:AbsenceReport={byDate:{},byArea:Object.fromEntries(areas.map(area=>[area.id,empty()])),total:empty(),unattributedAbsences:0},period=new Set(dates);
 for(const date of new Set([...dates,...headerDates])){
  const day=empty();report.byDate[date]=day;
  for(const employee of employees){
   const assignment=assignments.get(assignmentKey(employee.id,date));
   const areaId=isWorkingShift(assignment?.shiftCode)?assignment!.areaId!==null&&validAreas.has(assignment!.areaId)?assignment!.areaId:null:previousArea(employee.id,date);
   if(period.has(date)&&areaId===null&&isNonWorkingShift(assignment?.shiftCode))report.unattributedAbsences++;
   if(areaFilter!==null&&areaId!==areaFilter)continue;
   count(day,assignment,areaId===null);
   if(period.has(date)){
    count(report.total,assignment,areaId===null);
    if(areaId!==null)count(report.byArea[areaId],assignment);
   }
  }
 }
 return report;
}

export function absenceRateLabel(metric:AbsenceMetric|undefined) {return metric?.rate==null?'n/a':`${Math.round(metric.rate)}%`;}
export function absenceDescription(metric:AbsenceMetric|undefined,area=false) {
 if(!metric)return 'Absence rate: no recorded assignments.';
 return `Absence ${absenceRateLabel(metric)}: ${metric.absent}/${metric.recorded} recorded employee-days (OFF ${metric.off}, PTO ${metric.pto}, Sick ${metric.sick}). ${metric.unplanned} unplanned excluded.${area?' Area uses the most recent working-area assignment on or before each date.':''}${metric.unattributed?` ${metric.unattributed} absence(s) have no prior area history and are not attributed to an area.`:''} Department scope; shift filters do not apply. Includes drafts.`;
}
