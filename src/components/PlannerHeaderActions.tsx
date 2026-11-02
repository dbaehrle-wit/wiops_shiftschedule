import {Button,IconButton,Stack,Tooltip,Typography} from '@mui/material';
import KeyboardOutlined from '@mui/icons-material/KeyboardOutlined';
import UndoRounded from '@mui/icons-material/UndoRounded';
import RedoRounded from '@mui/icons-material/RedoRounded';
import {useAppDispatch,useAppSelector} from '../app/hooks';
import {draftActions} from '../features/draftSlice';

export function PlannerHeaderActions({dirty,saving,onSave,onDiscard}:{dirty:number;saving:boolean;onSave:()=>void;onDiscard:()=>void}) {
 const dispatch=useAppDispatch(),canUndo=useAppSelector(state=>state.draft.past.length>0),canRedo=useAppSelector(state=>state.draft.future.length>0);
 return <Stack direction="row" alignItems="center" gap={.5} sx={{ml:'auto',flexShrink:0,maxWidth:'100%',flexWrap:'wrap'}} aria-label="Planner editing actions">
  <Tooltip title="Ctrl/Cmd+C/V: copy/paste. Shift+arrows: extend selection. E/L/N/O/S/P: assign shift. Ctrl/Cmd+Z: undo. Ctrl/Cmd+Y or Shift+Z: redo."><IconButton size="small" aria-label="Keyboard shortcuts"><KeyboardOutlined fontSize="small"/></IconButton></Tooltip>
  <Tooltip title="Undo (Ctrl/Cmd + Z)"><span><IconButton size="small" aria-label="Undo" disabled={!canUndo||saving} onClick={()=>dispatch(draftActions.undo())}><UndoRounded fontSize="small"/></IconButton></span></Tooltip>
  <Tooltip title="Redo (Ctrl/Cmd + Y or Shift + Z)"><span><IconButton size="small" aria-label="Redo" disabled={!canRedo||saving} onClick={()=>dispatch(draftActions.redo())}><RedoRounded fontSize="small"/></IconButton></span></Tooltip>
  <Typography variant="caption" sx={{mx:.5,whiteSpace:'nowrap'}} aria-live="polite">{dirty} unsaved</Typography>
  <Button size="small" disabled={!dirty||saving} onClick={onDiscard}>Discard</Button>
  <Button size="small" variant="contained" disabled={!dirty||saving} onClick={onSave}>{saving?'Saving...':'Save Changes'}</Button>
 </Stack>;
}
