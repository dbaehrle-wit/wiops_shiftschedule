import type { PlannerView } from '../model/types';
const fromIso = (s: string) => new Date(`${s}T12:00:00Z`); // date-only arithmetic; no browser-local timezone conversion
// Reuse formatters: constructing Intl formatters in every grid cell is expensive.
const dayFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'2-digit',month:'short'});
const monthDayFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',month:'short'});
const monthFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',month:'long',year:'numeric'});
const weekdayFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',weekday:'short'});
export function isoDate(d: Date) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`; }
export function todayIso() { return isoDate(new Date()); } // demo default; real site-day comes from middleware
export function addDays(s: string, n: number) { const d = fromIso(s); d.setUTCDate(d.getUTCDate()+n); return isoDate(d); }
export function isWeekend(s:string) { const day=fromIso(s).getUTCDay();return day===0||day===6; }
export function startOfWeek(s: string) { const dow = (fromIso(s).getUTCDay()+6)%7; return addDays(s,-dow); }
export function startOfMonth(s:string) { return `${s.slice(0,7)}-01`; }
export function addMonths(s:string,n:number) {
 const d=fromIso(s),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(day,last));return isoDate(d);
}
export function isoWeek(s:string) {
 const d=fromIso(startOfWeek(s));d.setUTCDate(d.getUTCDate()+3);
 const year=d.getUTCFullYear(),first=new Date(Date.UTC(year,0,1,12));
 return {year,week:Math.ceil(((d.getTime()-first.getTime())/86400000+1)/7)};
}
export function weekRangeLabel(start:string,end:string) {
 const a=isoWeek(start),b=isoWeek(end);
 return a.year===b.year?`CW ${a.week} – CW ${b.week} · ${a.year}`:`CW ${a.week}/${a.year} – CW ${b.week}/${b.year}`;
}
export function calendarWeeks(anchor:string):string[][] {
 const monthStart=startOfMonth(anchor),last=addDays(addMonths(monthStart,1),-1);
 const first=startOfWeek(monthStart),end=addDays(startOfWeek(last),6),weeks:string[][]=[];
 for(let day=first;day<=end;day=addDays(day,7))weeks.push(Array.from({length:7},(_,i)=>addDays(day,i)));
 return weeks;
}
export function shiftViewAnchor(anchor:string,view:PlannerView,direction:number) {
 if(view==='day')return addDays(anchor,direction);
 return view==='week'||view==='fourWeeks'||view==='areas'||view==='opsHours'?addDays(anchor,direction*(view==='week'||view==='opsHours'?7:28)):addMonths(startOfMonth(anchor),direction*(view==='minimal'?3:1));
}
export function datesForView(anchor: string, view: PlannerView): string[] {
  if(view==='day')return [anchor];
  let start = startOfWeek(anchor), count = 7;
  if(view==='fourWeeks'||view==='areas') count=28;
  if(view==='month'||view==='user') { const d=fromIso(anchor); start=isoDate(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1))); count = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); }
  if(view==='minimal') {start=startOfMonth(anchor);count=Math.round((fromIso(addMonths(start,3)).getTime()-fromIso(start).getTime())/86400000);}
  return Array.from({length:count},(_,i)=>addDays(start,i));
}
export function displayDate(s: string) { return dayFormatter.format(fromIso(s)); }
export function germanDate(s:string) { return `${Number(s.slice(8,10))} ${monthDayFormatter.format(fromIso(s))} ${s.slice(0,4)}`; }
export function monthLabel(s:string) { return monthFormatter.format(fromIso(s)); }
export function weekdayLabel(s:string) { return weekdayFormatter.format(fromIso(s)); }
