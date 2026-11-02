/** Proposed middleware v2 contract, draft 0.1, 2026-10-31. Not imported by the running app. */
export type Id = number; // Positive safe integer. Use strings instead if source IDs can exceed JS safe integers.
export type LocalDate = string; // YYYY-MM-DD in the site's calendar.
export type Instant = string; // ISO 8601 UTC, e.g. 2026-11-02T05:00:00Z.
export type Version = string; // Opaque: never increment or compare lexically in the browser.
export type Cursor = string; // Opaque, signed, tenant/site/authorization-bound change-feed position.
export type ShiftCode = 'E' | 'L' | 'N' | 'OFF' | 'S' | 'P';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Monday=0.
export interface DateRange { from: LocalDate; to: LocalDate } // Inclusive from, exclusive to.
export interface CellKey { employeeId: Id; date: LocalDate }
export interface SkillRecord { skillId: string; status: 'valid' | 'missing' | 'expired' | 'unknown'; validUntil: LocalDate | null; version: Version }
export interface Employee {
  id: Id; fullName: string; departmentId: Id; role: string; shiftGroupId: Id | null;
  mobileNumber?: string; radioNumber?: string; skills: SkillRecord[]; version: Version;
}
export interface SkillCheck { skillId: string; constraint: 'hard' | 'soft'; status: 'valid' | 'expiring' | 'expired' | 'missing' | 'unknown'; message: string }
export interface Assignment extends CellKey {
  shiftCode: ShiftCode; areaId: Id | null; version: Version;
  locked: boolean; lockReason: string | null; editable: boolean;
  source: 'planner' | 'hr'; updatedAt: Instant;
  shiftDefinitionVersion: Version;
  resolvedInterval: { startsAt: Instant; endsAt: Instant } | null;
  compatibility: 'ok' | 'warning' | 'blocked' | 'unknown'; skillChecks: SkillCheck[];
  /** Read-only attribution for OFF/S/P; not a working-area assignment. */
  absenceAreaId: Id | null;
  absenceAreaSource: 'prior-assignment' | 'hr' | 'history' | 'unknown' | null;
}
export interface ShiftDefinition {
  code: ShiftCode; label: string; working: boolean;
  startLocal: string | null; endLocal: string | null; endsNextDay: boolean; version: Version;
}
export interface RotationPattern { id: string; name: string; shifts: ShiftCode[]; cycleWeeks: 1 | 2 | 4; version: Version }
export interface OperatingProfile {
  id: string; departmentId: Id; areaId: Id; validFrom: LocalDate; validTo: LocalDate | null;
  windows: { days: Weekday[]; startLocal: string; endLocal: string; endsNextDay: boolean; target: number }[];
  version: Version;
}
export interface DailyTargetRule {
  departmentId: Id | null; areaId: Id; days: Weekday[]; validFrom: LocalDate; validTo: LocalDate | null; target: number;
}
export interface References {
  schemaVersion: '2.0'; siteId: Id; siteTimeZone: string; siteToday: LocalDate;
  referenceVersion: Version; serverTime: Instant;
  departments: { id: Id; name: string }[]; areas: { id: Id; code: string; name: string }[];
  shiftGroups: { id: Id; name: string }[];
  shifts: ShiftDefinition[]; rotations: RotationPattern[];
  skills: { id: string; name: string }[];
  areaRequirements: { areaId: Id; skillId: string; constraint: 'hard' | 'soft'; version: Version }[];
  operatingProfiles: OperatingProfile[]; dailyTargets: DailyTargetRule[];
  limits: { maxBatchOperations: number; maxBatchBytes: number; maxWindowDays: number; maxEmployeePageSize: number };
  refresh: { fallbackPollSeconds: number; reconcileSeconds: number; changeRetentionHours: number };
  sourceStatus: { plannerAsOf: Instant; hrSyncedAt: Instant | null; sourceLagSeconds: number | null };
}
export interface WindowQuery extends DateRange {
  departmentId?: Id; areaId?: Id; employeeIds?: Id[];
  shiftCode?: ShiftCode; // Optional single-day roster filter. Absence aggregates ignore this filter.
  employeeSort: 'name' | 'department' | 'role'; employeePageSize: number;
  employeeCursor?: string; snapshotToken?: string;
}
export interface AbsenceMetric { off: number; pto: number; sick: number; recorded: number; unplanned: number; unattributed: number; rate: number | null }
export interface ScopeAggregates {
  /** Across the full query cohort, never merely the employee page. */
  population: number;
  absencePopulation: number; // Department/area cohort before the optional working-shift filter.
  dates: { date: LocalDate; absence: AbsenceMetric }[];
  areas: { areaId: Id; planned: number; target: number | null; shortage: number | null; coveredDays: number | null; absence: AbsenceMetric }[];
}
export interface WindowSnapshot {
  schemaVersion: '2.0'; siteId: Id; range: DateRange;
  snapshotToken: string; snapshotExpiresAt: Instant;
  planVersion: Version; referenceVersion: Version; changeCursor: Cursor; serverTime: Instant;
  employees: Employee[]; assignments: Assignment[];
  /** Explicit carry-in records outside range needed for overnight-hour calculations. */
  carryInAssignments: Assignment[];
  nextEmployeeCursor: string | null; totalEmployees: number;
  aggregates: ScopeAggregates;
}
export type BatchOperation =
  | (CellKey & { kind: 'put'; clientOperationId: string; expectedVersion: Version | null; shiftCode: ShiftCode; areaId: Id | null })
  | (CellKey & { kind: 'delete'; clientOperationId: string; expectedVersion: Version });
export interface BatchRequest {
  schemaVersion: '2.0'; requestId: string; observedPlanVersion: Version;
  referenceVersion: Version; atomic: true; operations: BatchOperation[];
  acknowledgedWarnings?: string[];
}
export interface Tombstone extends CellKey { deletedVersion: Version }
export interface BatchSuccess {
  schemaVersion: '2.0'; requestId: string; status: 'committed'; transactionId: string;
  planVersion: Version; referenceVersion: Version; changeCursor: Cursor; committedAt: Instant;
  appliedOperationIds: string[]; assignments: Assignment[]; deleted: Tombstone[];
  warnings: { code: string; message: string; cell?: CellKey }[];
}
export interface Problem {
  type: string; title: string; status: number; detail: string; instance: string;
  code: string; traceId: string; requestId?: string;
  errors?: { code: string; message: string; clientOperationId?: string; cell?: CellKey; path?: string }[];
}
export interface BatchConflict extends Problem {
  status: 409; code: 'VERSION_CONFLICT'; planVersion: Version;
  conflicts: { clientOperationId: string; cell: CellKey; expectedVersion: Version | null; actualVersion: Version | null; current: Assignment | null }[];
}
export type RequestOutcome =
  | { requestId: string; status: 'processing'; retryAfterSeconds: number }
  | { requestId: string; status: 'committed'; response: BatchSuccess }
  | { requestId: string; status: 'failed'; problem: Problem };
export interface ChangeScope { range: DateRange | null; employeeIds: Id[] | null; areaIds: Id[] | null }
interface ChangeBase {
  eventId: string; previousCursor: Cursor; cursor: Cursor; transactionId: string;
  requestId: string | null; planVersion: Version; referenceVersion: Version; occurredAt: Instant;
}
export type PlannerChange =
  | (ChangeBase & { kind: 'assignments.changed'; assignments: Assignment[]; deleted: Tombstone[] })
  | (ChangeBase & { kind: 'checkpoint' })
  | (ChangeBase & { kind: 'planner.invalidated' | 'references.changed'; scope: ChangeScope; reason: string });
export interface ChangePage { changes: PlannerChange[]; nextCursor: Cursor; highWatermark: Cursor; hasMore: boolean }
/** SignalR wake-up hint. Never advances the client's durable pull cursor. */
export interface PushNotice { kind: 'planner.changed'; siteId: Id; highWatermark: Cursor; transactionId: string; requestId: string | null }
export interface OpsHoursResponse {
  siteId: Id; range: DateRange; planVersion: Version; referenceVersion: Version;
  calculationPolicy: 'scheduled-presence-v1'; includesDrafts: boolean;
  lanes: {
    departmentId: Id; areaId: Id;
    /** Actual UTC intervals; DST weeks can contain 167 or 169 hourly bins. */
    hours: { startsAt: Instant; endsAt: Instant; localDate: LocalDate; localHour: string; utcOffset: string; planned: number; target: number | null; operating: boolean }[];
  }[];
}
export interface PlanningPreviewRequest extends DateRange {
  requestId: string; mode: 'manual' | 'rotation'; departmentId?: Id; shiftGroupId?: Id;
  employeeIds?: Id[]; shiftCode?: ShiftCode; rotationId?: string; rotationVersion?: Version;
  includeWeekends: boolean; replaceExisting: boolean;
  areaPolicy: { kind: 'fixed'; areaId: Id } | { kind: 'preserve'; fallbackAreaId: Id };
}
export interface PlanningPreview {
  previewId: string; token: string; expiresAt: Instant;
  planVersion: Version; referenceVersion: Version;
  dependencyScopeVersion: Version; employeeCount: number; operationCount: number;
  skippedLocked: number; operations: BatchOperation[]; warnings: { code: string; message: string }[];
}
export interface PreviewCommit { requestId: string; previewToken: string; acknowledgedWarnings: string[] }
export type PreviewJob =
  | { previewId: string; status: 'queued' | 'running'; statusUrl: string; retryAfterSeconds: number }
  | { previewId: string; status: 'ready'; result: PlanningPreview }
  | { previewId: string; status: 'failed'; problem: Problem };
export interface AggregatePreviewRequest extends DateRange {
  observedPlanVersion: Version; referenceVersion: Version;
  departmentId?: Id; areaId?: Id; employeeIds?: Id[]; shiftCode?: ShiftCode; operations: BatchOperation[];
}
export interface AggregatePreviewResponse {
  planVersion: Version; referenceVersion: Version; includesDrafts: true;
  aggregates: ScopeAggregates; opsHours?: OpsHoursResponse;
  issues: { code: string; severity: 'warning' | 'blocked'; message: string; cell?: CellKey }[];
}
