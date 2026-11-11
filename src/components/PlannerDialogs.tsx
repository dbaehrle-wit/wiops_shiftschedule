import {uiActions} from '../features/uiSlice';
import {useAppDispatch,useAppSelector} from '../app/hooks';
import {dayCommentKey} from '../features/dayCommentsSlice';
import {dayTimesActions} from '../features/dayTimesSlice';
import {validDayTime} from '../model/dayTimes';
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
  TextField,
} from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
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
  siteId,
  employee,
  date,
  assignment,
  areas,
  saving,
  onClose,
  onApply,
  dayComment,
  onSaveComment,
}: {
  employee: Employee;
  date: string;
  assignment: Assignment | undefined;
  areas: Area[];
  saving: boolean;
  onClose: () => void;
  onApply: (code: ShiftCode, areaId: number | null) => void;
  siteId: number;
  dayComment: string;
  onSaveComment: (comment: string) => void;
}) {
  const id = useId();
  const [comment, setComment] = useState(dayComment);
  const dispatch=useAppDispatch(),timeKey=dayCommentKey(siteId,employee.id,date);
  const savedTimes=useAppSelector(state=>state.dayTimes[timeKey]);
  const [start,setStart]=useState(savedTimes?.start??''),[end,setEnd]=useState(savedTimes?.end??'');
  const [code, setCode] = useState<ShiftCode | "">(assignment?.shiftCode ?? "");
  const [areaId, setAreaId] = useState<number | "">(assignment?.areaId ?? "");
  const area = areas.find((area) => area.id === assignment?.areaId);
  const saveDayDetails=()=>{
    dispatch(dayTimesActions.setTimes({key:timeKey,times:{start,end}}));
    if(start||end)dispatch(uiActions.setShowDayTimes(true));
    onSaveComment(comment);
  };

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
        <TextField fullWidth multiline minRows={3} label="Tageskommentar"
          value={comment} onChange={event=>setComment(event.target.value)}
          helperText="Mockup: pro Mitarbeiter und Tag, nur für diese Sitzung gespeichert. Leer speichern entfernt den Kommentar."
          sx={{mb:1}} />
        <Typography variant="subtitle2" sx={{mt:2,mb:1}}>Abweichende Start- / Endzeit</Typography>
        <Stack direction={{xs:'column',sm:'row'}} spacing={2} sx={{mb:1}}>
          <TextField fullWidth type="time" label="Startzeit" value={start} onChange={event=>setStart(event.target.value)} slotProps={{inputLabel:{shrink:true}}}/>
          <TextField fullWidth type="time" label="Endzeit" value={end} onChange={event=>setEnd(event.target.value)} slotProps={{inputLabel:{shrink:true}}}/>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{display:'block',mb:1}}>Nur die abweichende Zeit eintragen. Für Nachtschichten darf das Ende am Folgetag liegen. Leeren entfernt die Abweichung. Mockup: nur für diese Sitzung.</Typography>
        <Button onClick={()=>{saveDayDetails();onClose();}} disabled={!validDayTime(start)||!validDayTime(end)||(comment.trim()===dayComment&&start===(savedTimes?.start??'')&&end===(savedTimes?.end??''))} sx={{mb:3}}>
          Kommentar und Zeiten speichern
        </Button>
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
            !validDayTime(start)||!validDayTime(end)||
            !code ||
            (isWorkingShift(code) && !areas.some((area) => area.id === areaId)) ||
            saving ||
            assignment?.locked
          }
          onClick={() => {if(code){saveDayDetails();onApply(code, isNonWorkingShift(code) ? null : Number(areaId));}}}
        >
          Apply as draft
        </Button>
      </DialogActions>
    </Dialog>
  );
}
