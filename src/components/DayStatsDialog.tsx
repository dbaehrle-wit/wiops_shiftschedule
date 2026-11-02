import { useId, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import type { Area, Assignment, Employee } from "../model/types";
import {
  DAY_STATUSES,
  STATUS_COLORS,
  dayAndWeekSummary,
} from "../model/dayStats";
import { germanDate, isoWeek, weekdayLabel } from "../utils/date";

export function DayStatsDialog({
  date,
  employees,
  areas,
  assignmentFor,
  initialAreaId,
  onClose,
}: {
  date: string;
  employees: Employee[];
  areas: Area[];
  assignmentFor: (employeeId: number, date: string) => Assignment | undefined;
  initialAreaId?: number | null;
  onClose: () => void;
}) {
  const id = useId(),
    [areaFilter, setAreaFilter] = useState<number | "all">(
      initialAreaId === undefined ? "all" : (initialAreaId ?? -1),
    );
  const summary = useMemo(
    () => dayAndWeekSummary({ date, employees, areas, assignmentFor }),
    [date, employees, areas, assignmentFor],
  );
  const statuses = DAY_STATUSES.filter(
    (status) =>
      status !== "Unplanned" ||
      summary.week.some((day) => day.counts.Unplanned > 0),
  );
  const selectedArea = summary.areas.find(
    (area) => area.areaId === (areaFilter === -1 ? null : areaFilter),
  );
  const people =
    areaFilter === "all"
      ? summary.areas.flatMap((area) => area.people)
      : (selectedArea?.people ?? []);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby={id}>
      <DialogTitle id={`${id}-header`} component="div" sx={{ pr: 7 }}>
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
          <Typography id={id} component="h2" variant="h6">
            Day details · {germanDate(date)}
          </Typography>
          <Chip label="Demo" size="small" color="info" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {weekdayLabel(date)} · CW {isoWeek(date).week} · Status counts by area
        </Typography>
        <IconButton
          autoFocus
          aria-label="Close day details"
          onClick={onClose}
          sx={{ position: "absolute", right: 10, top: 10 }}
        >
          <CloseRounded />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Assigned sick leave and PTO are included; other absence statuses are sample data. Each employee is
          counted once per day; unsaved shift changes are included.
        </Alert>
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
          {statuses.map((status) => (
            <Chip
              key={status}
              label={`${status}: ${summary.counts[status]}`}
              sx={{ bgcolor: STATUS_COLORS[status] }}
            />
          ))}
        </Stack>
        <Typography component="h3" variant="subtitle1" fontWeight={700}>
          Daily status by area
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {summary.total} employees · The work area assigned for that day is
          used. Off and unassigned employees appear under “No area”.
        </Typography>
        <Box sx={{ overflowX: "auto", mb: 3 }}>
          <Table size="small" aria-label="Daily status by area">
            <TableHead>
              <TableRow>
                <TableCell>Area / task</TableCell>
                {statuses.map((status) => (
                  <TableCell key={status} align="right">
                    {status}
                  </TableCell>
                ))}
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.areas.map((area) => (
                <TableRow
                  key={area.areaId ?? "none"}
                  data-area-id={area.areaId ?? "none"}
                  selected={
                    areaFilter !== "all" &&
                    area.areaId === (areaFilter === -1 ? null : areaFilter)
                  }
                >
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Typography fontSize={13} fontWeight={600}>
                      {area.code}
                    </Typography>
                    {area.name !== area.code && (
                      <Typography variant="caption" color="text.secondary">
                        {area.name}
                      </Typography>
                    )}
                  </TableCell>
                  {statuses.map((status) => (
                    <TableCell key={status} align="right" data-status={status}>
                      {area.counts[status]}
                    </TableCell>
                  ))}
                  <TableCell align="right" data-total sx={{ fontWeight: 700 }}>
                    {area.total}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor: "#f1f5f9" }}>
                <TableCell>
                  <strong>Total</strong>
                </TableCell>
                {statuses.map((status) => (
                  <TableCell key={status} align="right">
                    <strong>{summary.counts[status]}</strong>
                  </TableCell>
                ))}
                <TableCell align="right">
                  <strong>{summary.total}</strong>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
        <Stack
          direction="row"
          flexWrap="wrap"
          gap={2}
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1 }}
        >
          <Box>
            <Typography component="h3" variant="subtitle1" fontWeight={700}>
              Weekly overview · CW {isoWeek(date).week}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {germanDate(summary.week[0].date)} –{" "}
              {germanDate(summary.week[6].date)}
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id={`${id}-area`}>Area</InputLabel>
            <Select
              labelId={`${id}-area`}
              label="Area"
              value={areaFilter}
              onChange={(event) =>
                setAreaFilter(
                  event.target.value === "all"
                    ? "all"
                    : Number(event.target.value),
                )
              }
            >
              <MenuItem value="all">All areas</MenuItem>
              {areas.map((area) => (
                <MenuItem key={area.id} value={area.id}>
                  {area.code}
                </MenuItem>
              ))}
              {summary.areas.some((area) => area.areaId === null) && (
                <MenuItem value={-1}>No area</MenuItem>
              )}
            </Select>
          </FormControl>
        </Stack>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" aria-label="Weekly status overview">
            <TableHead>
              <TableRow>
                <TableCell>Day</TableCell>
                {statuses.map((status) => (
                  <TableCell key={status} align="right">
                    {status}
                  </TableCell>
                ))}
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.week.map((day) => {
                const area =
                    areaFilter === "all"
                      ? null
                      : day.areas.find(
                          (area) =>
                            area.areaId ===
                            (areaFilter === -1 ? null : areaFilter),
                        ),
                  counts = areaFilter === "all" ? day.counts : area?.counts,
                  total = areaFilter === "all" ? day.total : (area?.total ?? 0);
                return (
                  <TableRow
                    key={day.date}
                    selected={day.date === date}
                    data-summary-date={day.date}
                  >
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {weekdayLabel(day.date)} · {germanDate(day.date)}
                    </TableCell>
                    {statuses.map((status) => (
                      <TableCell key={status} align="right">
                        {counts?.[status] ?? 0}
                      </TableCell>
                    ))}
                    <TableCell align="right">{total}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        <Box sx={{ mt: 3 }}>
          <Typography component="h3" variant="subtitle1" fontWeight={700}>
            Scheduled on {germanDate(date)}
            {selectedArea ? ` · ${selectedArea.code}` : ""}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {people.length} employees with an assigned shift
          </Typography>
          <Stack
            direction="row"
            flexWrap="wrap"
            gap={0.75}
            sx={{ mt: 1, maxHeight: 180, overflowY: "auto" }}
          >
            {people.map(({ employee, shift }) => (
              <Chip
                key={employee.id}
                title={employee.department}
                size="small"
                label={`${employee.fullName} · ${shift}`}
              />
            ))}
            {!people.length && (
              <Typography variant="body2" color="text.secondary">
                No employees are scheduled for this selection.
              </Typography>
            )}
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
