export type ISODate = string; // site-local calendar date, YYYY-MM-DD (not UTC timestamp)
export type ShiftCode = 'E' | 'L' | 'N' | 'OFF' | 'S' | 'P';
export function isWorkingShift(code:ShiftCode|''|undefined):code is 'E'|'L'|'N' { return code==='E'||code==='L'||code==='N'; }
export function isNonWorkingShift(code:ShiftCode|''|undefined) { return code==='OFF'||code==='S'||code==='P'; }
export type Compatibility = 'ok' | 'warning' | 'blocked' | 'unknown';
export type PlannerView = 'day' | 'week' | 'fourWeeks' | 'month' | 'user' | 'minimal' | 'areas' | 'opsHours';
export type AreaSkillLevel = 'qualified' | 'intermediate' | 'experienced' | 'expert';
export type AreaSkillState = 'notQualified' | AreaSkillLevel;
export interface Employee { id: number; fullName: string; role?: string; department: string; shiftGroup?: string; mobileNumber?: string; radioNumber?: string; defaultShift?: ShiftCode; areaSkills?:Partial<Record<number,AreaSkillState>>; }
export interface Area { id: number; code: string; name: string; defaultRequired?:number; }
export interface ShiftType { code: ShiftCode; label: string; startHour?:number; endHour?:number; }
export interface OperatingWindow {days:number[];startHour:number;endHour:number;target:number}
export interface OperatingProfile {department:string;areaId:number;windows:OperatingWindow[]}
export interface Assignment { employeeId: number; date: ISODate; shiftCode: ShiftCode; areaId: number | null; compatibility: Compatibility; version: number; locked?: boolean; }
export interface PlannerSnapshot { siteId: number; siteTimeZone: string; planVersion: number; employees: Employee[]; areas: Area[]; operatingProfiles?:OperatingProfile[]; operatingProfilesVersion?:string; shiftTypes: ShiftType[]; assignments: Assignment[]; }
export interface AssignmentPatch { employeeId: number; date: ISODate; shiftCode: ShiftCode; areaId: number | null; expectedVersion: number | null; }
export interface SaveBatchRequest { requestId: string; siteId: number; expectedPlanVersion: number; operations: AssignmentPatch[]; }
export interface SaveBatchResponse { requestId: string; status: 'committed' | 'conflict' | 'rejected'; planVersion: number; assignments: Assignment[]; errors?: { employeeId: number; date: ISODate; code: string; message: string }[]; }
export interface IslandBootstrap { siteId: number; apiBaseUrl?: string; accessToken?: string; onEvent?: (type: string, payload: unknown) => void; }
export const assignmentKey = (employeeId: number, date: string) => `${employeeId}|${date}`;
