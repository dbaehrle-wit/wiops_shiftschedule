import {isWorkingShift,type ShiftCode} from './types';
export interface DayTimes {start:string;end:string}
export function validDayTime(value:string){return value===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(value);}
export function dayTimeSuffix(shift:ShiftCode|undefined,times:DayTimes|undefined){
 if(!isWorkingShift(shift)||!times||(!times.start&&!times.end))return '';
 return times.start&&times.end?`(${times.start}–${times.end})`:`(-${times.start||times.end})`;
}
export function dayTimeDescription(shift:ShiftCode|undefined,times:DayTimes|undefined){
 if(!dayTimeSuffix(shift,times))return '';
 return [times?.start?`Start: ${times.start}`:'',times?.end?`Ende: ${times.end}`:''].filter(Boolean).join(' · ');
}
