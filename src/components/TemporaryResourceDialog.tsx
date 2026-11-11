import {useId,useState} from 'react';
import {Alert,Button,Dialog,DialogActions,DialogContent,DialogTitle,MenuItem,TextField} from '@mui/material';

export function TemporaryResourceDialog({departments,defaultDepartment,onClose,onAdd}:{departments:string[];defaultDepartment:string;onClose:()=>void;onAdd:(name:string,department:string,role:string)=>void}) {
 const id=useId();
 const [name,setName]=useState(''),[department,setDepartment]=useState(defaultDepartment==='all'?(departments[0]??''):defaultDepartment),[role,setRole]=useState('Operator');
 return <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby={id}>
  <form onSubmit={event=>{event.preventDefault();if(name.trim()&&department&&['Operator','Shift lead'].includes(role))onAdd(name.trim(),department,role.trim());}}>
   <DialogTitle id={id}>Add temporary user / resource</DialogTitle>
   <DialogContent dividers>
    <Alert severity="warning" sx={{mb:2}}>Temporary resources are planning placeholders only. They must be replaced by AMS users later.</Alert>
    <TextField autoFocus required fullWidth label="Name / resource label" value={name} onChange={event=>setName(event.target.value)} sx={{mb:2}}/>
    <TextField required select fullWidth label="Department" value={department} onChange={event=>setDepartment(event.target.value)} sx={{mb:2}}>{departments.map(item=><MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
    <TextField required select fullWidth label="Role" value={role} onChange={event=>setRole(event.target.value)}><MenuItem value="Operator">Operator</MenuItem><MenuItem value="Shift lead">Shift lead</MenuItem></TextField>
    <Alert severity="info" sx={{mt:2}}>Mockup: temporary resources and their shifts are kept for this session only.</Alert>
   </DialogContent>
   <DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={!name.trim()||!department||!['Operator','Shift lead'].includes(role)}>Add temporary resource</Button></DialogActions>
  </form>
 </Dialog>;
}
