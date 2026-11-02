import {AbsenceRate} from './AbsenceRate';
import type {AbsenceReport} from '../model/absence';
import {usePlannerAssignments} from './usePlannerAssignments';
import {PlannerViewHeader,type PlannerHeaderSlots} from './PlannerViewHeader';
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  ButtonBase,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useAppSelector } from "../app/hooks";
import {
  type PlannerSnapshot,
} from "../model/types";
import { dayAreaSummary } from "../model/dayStats";
import {
  datesForView,
  displayDate,
  germanDate,
  isWeekend,
  weekdayLabel,
} from "../utils/date";
import { DayStatsDialog } from "./DayStatsDialog";

export function AreaOverview({ snapshot, areaFilter=null, headerFilters, headerActions, absence }: { snapshot: PlannerSnapshot; areaFilter?:number|null; absence?:AbsenceReport } & PlannerHeaderSlots) {
  const ui = useAppSelector((state) => state.ui);
  const [detail, setDetail] = useState<{
    date: string;
    areaId?: number;
  } | null>(null);
  const dates = useMemo(() => datesForView(ui.anchor, "areas"), [ui.anchor]);
  const {assignmentFor}=usePlannerAssignments(snapshot.assignments);
  const summaries = useMemo(
    () =>
      dates.map((date) =>
        dayAreaSummary({
          date,
          employees: snapshot.employees,
          areas: snapshot.areas,
          assignmentFor,
        }),
      ),
    [dates, snapshot.employees, snapshot.areas, assignmentFor],
  );
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        border: "1px solid #dbe3ec",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "background.paper",
      }}
    >
      <PlannerViewHeader actions={headerActions} density="normal">
        <Typography fontWeight={700}>Staffing by work area</Typography>
        {headerFilters}
        <Chip
          size="small"
          label="Demo targets"
          color="info"
          variant="outlined"
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: "auto" }}
        >
          Planned employees / daily target · Click a cell for details
        </Typography>
      </PlannerViewHeader>
      <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>
        <Table
          stickyHeader
          aria-label="Planned employees by area and day"
          sx={{ tableLayout: "fixed", minWidth: 210 + dates.length * 84 }}
        >
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  position: "sticky",
                  left: 0,
                  zIndex: 4,
                  width: 210,
                  bgcolor: "#eaf1f8",
                  borderRight: "1px solid #dbe3ec",
                }}
              >
                Area / task
              </TableCell>
              {dates.map((date) => (
                <TableCell
                  key={date}
                  data-header-date={date}
                  tabIndex={0}
                  align="center"
                  title="Double-click: daily status by area"
                  onDoubleClick={() => setDetail({ date })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setDetail({ date });
                    }
                  }}
                  sx={{
                    width: 84,
                    px: 0.5,
                    bgcolor: isWeekend(date)
                      ? "#dfe8f2"
                      : "#eaf1f8",
                    borderRight: "1px solid #dbe3ec",
                    cursor: "pointer",
                    "&:focus-visible": {
                      outline: "2px solid #2563eb",
                      outlineOffset: -2,
                    },
                  }}
                >
                  <Typography fontSize={11} color="text.secondary">
                    {weekdayLabel(date)}
                  </Typography>
                  <Typography fontSize={12} fontWeight={600}>
                    {displayDate(date)}
                  </Typography>
                  <AbsenceRate metric={absence?.byDate[date]} date={date}/>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {snapshot.areas.filter(area=>areaFilter===null||area.id===areaFilter).map((area) => (
              <TableRow key={area.id}>
                <TableCell
                  component="th"
                  scope="row"
                  sx={{
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    bgcolor: "background.paper",
                    borderRight: "1px solid #dbe3ec",
                  }}
                >
                  <Typography fontWeight={700}>{area.code}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {area.defaultRequired != null
                      ? `Demo target: ${area.defaultRequired} per day`
                      : "No target set"}
                  </Typography>
                </TableCell>
                {summaries.map((day) => {
                  const group = day.areas.find(
                      (group) => group.areaId === area.id,
                    ),
                    planned = group?.scheduled ?? 0,
                    required = area.defaultRequired,
                    delta = required == null ? null : planned - required;
                  const background =
                    delta == null
                      ? "#f1f5f9"
                      : delta < 0
                        ? "#fff0d2"
                        : delta === 0
                          ? "#daf0e6"
                          : "#e5efff";
                  const people =
                    group?.people
                      .map(
                        (person) =>
                          `${person.employee.fullName} (${person.shift})`,
                      )
                      .join(", ") || "No employees assigned";
                  return (
                    <TableCell
                      key={day.date}
                      data-area-day={`${area.id}|${day.date}`}
                      data-planned={planned}
                      data-required={required}
                      align="center"
                      sx={{ p: 0.5, borderRight: "1px solid #edf0f4" }}
                    >
                      <ButtonBase
                        aria-label={`${area.code}, ${germanDate(day.date)}: ${planned} scheduled${required == null ? "" : `, target ${required}`}`}
                        title={people}
                        onClick={() =>
                          setDetail({ date: day.date, areaId: area.id })
                        }
                        sx={{
                          width: "100%",
                          minHeight: 76,
                          py: 0.75,
                          bgcolor: background,
                          borderRadius: 1,
                          display: "flex",
                          flexDirection: "column",
                          "&:focus-visible": { outline: "2px solid #2563eb" },
                        }}
                      >
                        <Typography fontSize={20} fontWeight={700}>
                          {planned}
                          <Typography
                            component="span"
                            fontSize={12}
                            color="text.secondary"
                          >
                            {required == null ? "" : ` / ${required}`}
                          </Typography>
                        </Typography>
                        <Typography
                          variant="caption"
                          color={
                            delta != null && delta < 0
                              ? "warning.dark"
                              : "text.secondary"
                          }
                        >
                          {delta == null
                            ? "scheduled"
                            : delta < 0
                              ? `${-delta} short`
                              : delta === 0
                                ? "target met"
                                : `+${delta} over target`}
                        </Typography>
                      </ButtonBase>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Alert severity="info" sx={{ borderRadius: 0 }}>
        Counts reflect daily shift assignments, including drafts. OFF, sick leave and PTO do not
        count toward staffing. Targets are demo values; real staffing data will
        be connected later.
      </Alert>
      {detail && (
        <DayStatsDialog
          key={`${detail.date}|${detail.areaId ?? "all"}`}
          date={detail.date}
          initialAreaId={detail.areaId}
          employees={snapshot.employees}
          areas={snapshot.areas}
          assignmentFor={assignmentFor}
          onClose={() => setDetail(null)}
        />
      )}
    </Box>
  );
}
