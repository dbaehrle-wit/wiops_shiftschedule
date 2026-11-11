import {isNonWorkingShift,isWorkingShift} from '../model/types';
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
  Typography,
} from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import type { Area, Assignment, Employee, ShiftCode } from "../model/types";
import {assessAssignmentSkills} from '../model/skills';
import {SkillCheckDetails} from './SkillUi';
import { SHIFT_CODES, SHIFT_COLORS, SHIFT_LABELS } from "../model/shiftDisplay";
import { demoEmployeeStats } from "../model/employeeStats";
import { germanDate, isoWeek, todayIso } from "../utils/date";

export function EmployeeStatsDialog({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const id = useId(),
    stats = useMemo(
      () => demoEmployeeStats(employee.id, todayIso()),
      [employee.id],
    );
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby={id}>
      <DialogTitle id={`${id}-header`} component="div" sx={{ pr: 7 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography id={id} component="h2" variant="h6">
            Statistics · {employee.fullName}
          </Typography>
          <Chip size="small" label="Demo" color="info" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {employee.role ?? "Operator"} - {employee.department} - Last 4 weeks
        </Typography>
        <IconButton
          autoFocus
          aria-label="Close statistics"
          onClick={onClose}
          sx={{ position: "absolute", right: 10, top: 10 }}
        >
          <CloseRounded />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Sample statistics. These figures do not represent actual shifts.
        </Alert>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {germanDate(stats.start)} - {germanDate(stats.end)} - 28 calendar days
        </Typography>
        <Typography component="h3" variant="subtitle2" sx={{ mb: 1 }}>
          Shift distribution
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2,minmax(0,1fr))",
              sm: "repeat(4,minmax(0,1fr))",
            },
            gap: 1,
            mb: 3,
          }}
        >
          {SHIFT_CODES.map((code) => (
            <Box
              key={code}
              sx={{
                p: 1.25,
                bgcolor: SHIFT_COLORS[code],
                borderRadius: 2,
                textAlign: "center",
              }}
            >
              <Typography variant="h5" fontWeight={700}>
                {stats.shifts[code]}
              </Typography>
              <Typography variant="caption">{SHIFT_LABELS[code]}</Typography>
            </Box>
          ))}
        </Box>
        <Typography variant="body2" color="text.secondary">
          Double-click a date in the column header to view daily status and the
          weekly overview.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ShiftEditorDialog({
  employee,
  date,
  assignment,
  areas,
  saving,
  onClose,
  onApply,
}: {
  employee: Employee;
  date: string;
  assignment: Assignment | undefined;
  areas: Area[];
  saving: boolean;
  onClose: () => void;
  onApply: (code: ShiftCode, areaId: number | null) => void;
}) {
  const id = useId();
  const [code, setCode] = useState<ShiftCode | "">(assignment?.shiftCode ?? "");
  const [areaId, setAreaId] = useState<number | "">(assignment?.areaId ?? "");
  const area = areas.find((area) => area.id === assignment?.areaId);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby={id}>
      <DialogTitle id={`${id}-header`} component="div" sx={{ pr: 7 }}>
        <Typography id={id} component="h2" variant="h6">
          Edit shift
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {germanDate(date)} · CW {isoWeek(date).week}
        </Typography>
        <IconButton
          autoFocus
          aria-label="Close shift editor"
          onClick={onClose}
          sx={{ position: "absolute", right: 10, top: 10 }}
        >
          <CloseRounded />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ p: 2, mb: 3, bgcolor: "#f1f5f9", borderRadius: 2 }}>
          <Typography fontWeight={700}>{employee.fullName}</Typography>
          <Typography variant="body2" color="text.secondary">
            {employee.role ?? "Operator"} - {employee.department}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Work area: {area?.name ?? "No area"}
          </Typography>
        </Box>
        {assignment?.locked && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This cell is locked and cannot be changed.
          </Alert>
        )}
        <FormControl fullWidth disabled={saving || assignment?.locked}>
          <InputLabel id={`${id}-shift`}>Shift</InputLabel>
          <Select
            labelId={`${id}-shift`}
            label="Shift"
            value={code}
            onChange={(event) => {
              const code = event.target.value as ShiftCode;
              setCode(code);
              if (isNonWorkingShift(code)) setAreaId("");
            }}
          >
            {SHIFT_CODES.map((code) => (
              <MenuItem key={code} value={code}>
                {SHIFT_LABELS[code]} ({code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl
          fullWidth
          disabled={saving || assignment?.locked || isNonWorkingShift(code)}
          sx={{ mt: 2 }}
        >
          <InputLabel id={`${id}-area`}>Work area</InputLabel>
          <Select
            labelId={`${id}-area`}
            label="Work area"
            value={isNonWorkingShift(code) ? "" : areaId}
            onChange={(event) => setAreaId(Number(event.target.value))}
          >
            {areas.map((area) => (
              <MenuItem key={area.id} value={area.id}>
                {area.code}
                {area.name !== area.code ? ` ? ${area.name}` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.75 }}
        >
          The work area applies to this day only. OFF, sick leave and PTO days have no area.
        </Typography>
        <SkillCheckDetails assessment={assessAssignmentSkills(employee,areas.find(area=>area.id===areaId),code||undefined)}/>
        <Box
          sx={{
            mt: 3,
            p: 2.5,
            border: "1px dashed #cbd5e1",
            borderRadius: 2,
            bgcolor: "#f8fafc",
          }}
        >
          <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 0.75 }}>
            <AutoAwesomeOutlined fontSize="small" color="disabled" />
            <Typography component="h3" variant="subtitle2">
              Shift suggestions
            </Typography>
            <Chip label="Coming soon" size="small" variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Suggestions for this employee and day will appear here.
          </Typography>
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 2 }}
        >
          This change is staged as a draft and saved when you select Save
          Changes.
        </Typography>
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          py: 1.5,
          flexWrap: "wrap",
          gap: 1,
          "& > :not(style) ~ :not(style)": { ml: 0 },
        }}
      >
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={
            !code ||
            (isWorkingShift(code) && !areas.some((area) => area.id === areaId)) ||
            saving ||
            assignment?.locked
          }
          onClick={() =>
            code && onApply(code, isNonWorkingShift(code) ? null : Number(areaId))
          }
        >
          Apply as draft
        </Button>
      </DialogActions>
    </Dialog>
  );
}
