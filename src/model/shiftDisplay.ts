import {isNonWorkingShift,type ShiftCode} from './types';
import type {SkillStatus} from './skills';
export const SHIFT_CODES:ShiftCode[]=['E','L','N','OFF','S','P'];
export const SHIFT_LABELS:Record<ShiftCode,string>={E:'Early shift',L:'Late shift',N:'Night shift',OFF:'Off',S:'Sick leave',P:'PTO'};
export const SHIFT_COLORS:Record<ShiftCode,string>={E:'#dbeafe',L:'#ffedd5',N:'#f3e8ff',OFF:'#f1f5f9',S:'#ffe4e6',P:'#d1fae5'};
export const COMPACT_COLORS:Record<ShiftCode,string>={E:'#75a7ef',L:'#f4ad63',N:'#b68be3',OFF:'#e2e8f0',S:'#f59aa6',P:'#6fc8af'};
export const SKILL_COLORS:Record<Exclude<SkillStatus,'off'>,string>={notQualified:'#fca5a5',qualified:'#fdba74',intermediate:'#fde047',experienced:'#bef264',expert:'#2e7d32',unknown:'#eff1f4'};

export function assignmentColor(shift:ShiftCode|undefined,status:SkillStatus,mode:'shift'|'skill',compact=false) {
 if(!shift)return '#fff';
 if(mode==='shift'||isNonWorkingShift(shift))return (compact?COMPACT_COLORS:SHIFT_COLORS)[shift];
 return SKILL_COLORS[status==='off'?'unknown':status];
}

export function assignmentTextColor(shift:ShiftCode|undefined,status:SkillStatus,mode:'shift'|'skill') {
 return mode==='skill'&&shift&&!isNonWorkingShift(shift)&&status==='expert'?'#fff':'#17365d';
}
