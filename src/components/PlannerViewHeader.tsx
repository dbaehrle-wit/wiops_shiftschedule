import type {ReactNode} from 'react';
import {Stack} from '@mui/material';

export interface PlannerHeaderSlots {headerFilters?:ReactNode;headerActions?:ReactNode}

export function PlannerViewHeader({children,actions,density='compact'}:{children:ReactNode;actions?:ReactNode;density?:'compact'|'normal'|'roomy'}) {
 return <Stack data-planner-table-header direction="row" alignItems="center" flexWrap="wrap" gap={density==='roomy'?1.5:1} sx={{px:1.5,pt:density==='compact' ? .75 : 1.5,pb:density==='roomy'?1:density==='normal'?1.5:.75,bgcolor:'background.paper',borderBottom:'1px solid',borderColor:'divider'}}>
  {children}
  {actions}
 </Stack>;
}
