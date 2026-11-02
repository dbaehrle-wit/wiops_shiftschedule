import {absenceDescription,absenceRateLabel,type AbsenceMetric} from '../model/absence';

export function AbsenceRate({metric,compact=false,date,area=false}:{metric:AbsenceMetric|undefined;compact?:boolean;date?:string;area?:boolean}) {
 return <span data-absence-date={date} data-absence-rate={metric?.rate??''} aria-label={absenceDescription(metric,area)} title={absenceDescription(metric,area)} style={{fontSize:compact?8:10,lineHeight:1.15,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap',color:'#64748b'}}>{'\u25CC'}{compact?'':' '}{absenceRateLabel(metric)}</span>;
}
