import {isNonWorkingShift,type Compatibility,type ShiftCode} from './types';
export const SHIFT_CODES:ShiftCode[]=['E','L','N','OFF','S','P'];
export const SHIFT_LABELS:Record<ShiftCode,string>={E:'Early shift',L:'Late shift',N:'Night shift',OFF:'Off',S:'Sick leave',P:'PTO'};
export const SHIFT_COLORS:Record<ShiftCode,string>={E:'#dbeafe',L:'#ffedd5',N:'#f3e8ff',OFF:'#f1f5f9',S:'#ffe4e6',P:'#d1fae5'};
export const COMPACT_COLORS:Record<ShiftCode,string>={E:'#75a7ef',L:'#f4ad63',N:'#b68be3',OFF:'#e2e8f0',S:'#f59aa6',P:'#6fc8af'};
export const COMPAT_COLORS:Record<Compatibility,string>={ok:'#d9f0e6',warning:'#fff0d2',blocked:'#fbdcdb',unknown:'#eff1f4'};
export const COMPACT_SKILL_COLORS:Record<Compatibility,string>={ok:'#5db49a',warning:'#f4c362',blocked:'#ef8e8e',unknown:'#cbd5e1'};

export function assignmentColor(shift:ShiftCode|undefined,status:Compatibility|'off',mode:'shift'|'skill',compact=false) {
 if(!shift)return '#fff';
 if(mode==='shift'||isNonWorkingShift(shift))return (compact?COMPACT_COLORS:SHIFT_COLORS)[shift];
 return (compact?COMPACT_SKILL_COLORS:COMPAT_COLORS)[status==='off'?'unknown':status];
}
