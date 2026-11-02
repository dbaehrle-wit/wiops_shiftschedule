import {useId,type ReactNode} from 'react';
import {FormControl,InputLabel,MenuItem,Select,TextField} from '@mui/material';
import {compactFieldSx} from '../styles/compactControls';

interface Option<T extends string|number> {value:T;label:ReactNode}
export function PlannerSelect<T extends string|number>({label,value,options,onChange,width=150,title}:{label:string;value:T;options:Option<T>[];onChange:(value:T)=>void;width?:number;title?:string}) {
 const id=useId();
 return <FormControl size="small" sx={{...compactFieldSx,width,mt:.5}}>
  <InputLabel id={`${id}-label`}>{label}</InputLabel>
  <Select labelId={`${id}-label`} label={label} value={value} title={title} onChange={event=>onChange(event.target.value as T)}>
   {options.map(option=><MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
  </Select>
 </FormControl>;
}

export function PlannerDateField({label,value,onChange,width=150}:{label:string;value:string;onChange:(value:string)=>void;width?:number}) {
 return <TextField size="small" sx={{...compactFieldSx,width,mt:.5}} type="date" label={label} value={value} slotProps={{inputLabel:{shrink:true}}} onChange={event=>onChange(event.target.value)}/>;
}
