import type {Employee} from './types';

export type EmployeeSort='name'|'department'|'role';
export const EMPLOYEE_SORT_LABELS:Record<EmployeeSort,string>={name:'Name',department:'Department',role:'Role'};
export function nextEmployeeSort(current:EmployeeSort|null):EmployeeSort {
 return current==='name'?'department':current==='department'?'role':'name';
}
const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
export function sortEmployees(employees:Employee[],sort:EmployeeSort|null) {
 if(!sort)return employees;
 const value=(employee:Employee)=>sort==='name'?employee.fullName:sort==='department'?employee.department:employee.role??'Operator';
 return [...employees].sort((a,b)=>collator.compare(value(a),value(b))||collator.compare(a.fullName,b.fullName)||a.id-b.id);
}
