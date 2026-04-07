
import { Staff, Patient, Procedure, Appointment, AppointmentStatus, Department, DepartmentType, AttendanceRecord, UserAccount, UserRole } from './types';

export const BUSINESS_HOURS = {
  start: 7,
  end: 18,
};

// Giờ hành chính: 7:30 - 12:00 và 13:30 - 17:00
export const OFFICE_SHIFTS = [
  { start: '07:30', end: '12:00' },
  { start: '13:30', end: '17:00' }
];

export const DEPARTMENTS: Department[] = [
  { id: 'dept_ngoai', name: 'Khoa Ngoại phụ ngũ quan', type: DepartmentType.CLINICAL },
  { id: 'dept_noi', name: 'Khoa Nội nhi', type: DepartmentType.CLINICAL },
  { id: 'dept_chamcuu', name: 'Khoa Châm cứu dưỡng sinh', type: DepartmentType.CLINICAL },
  { id: 'dept_phcn', name: 'Phục hồi chức năng', type: DepartmentType.SUPPORT },
  { id: 'dept_xetnghiem', name: 'Xét nghiệm', type: DepartmentType.SUPPORT },
  { id: 'dept_cdha', name: 'Chẩn đoán hình ảnh', type: DepartmentType.SUPPORT },
  { id: 'dept_duoc', name: 'Khoa Dược', type: DepartmentType.SUPPORT },
];

export const DEFAULT_ADMIN: UserAccount = {
  id: 'u_admin',
  username: 'admin',
  password: 'Huyhuyhuy2@',
  fullName: 'Hệ thống Quản trị',
  role: UserRole.ADMIN,
  viewableDeptIds: DEPARTMENTS.map(d => d.id),
  editableDeptIds: DEPARTMENTS.map(d => d.id)
};

export const MOCK_PROCEDURES: Procedure[] = [
  { id: 'pr_kham', name: 'Khám bệnh', durationMinutes: 10, busyMinutes: 10, isPreRequisite: true, deptId: 'dept_phcn' },
  { id: 'pr1', name: 'Điện châm', durationMinutes: 30, busyMinutes: 5, requireMachine: true, availableMachines: ['DC-01', 'DC-02', 'DC-03', 'DC-04', 'DC-05'], deptId: 'dept_phcn' },
  { id: 'pr_hongngoai', name: 'Hồng ngoại', durationMinutes: 20, busyMinutes: 5, requireMachine: true, availableMachines: ['HN-01', 'HN-02', 'HN-03'], deptId: 'dept_phcn' },
  { id: 'pr_dienxung', name: 'Điện xung', durationMinutes: 25, busyMinutes: 5, requireMachine: true, availableMachines: ['DX-01', 'DX-02'], deptId: 'dept_phcn' },
  { id: 'pr2', name: 'Xoa bóp bấm huyệt', durationMinutes: 45, busyMinutes: 45, deptId: 'dept_phcn' },
  { id: 'pr3', name: 'Tập vận lý trị liệu', durationMinutes: 60, busyMinutes: 10, requireMachine: true, machineCapacity: 2, availableMachines: ['VLTL-01', 'VLTL-02'], deptId: 'dept_phcn' },
  { id: 'pr4', name: 'Siêu âm', durationMinutes: 20, busyMinutes: 20, requireMachine: true, availableMachines: ['SA-01', 'SA-02'], deptId: 'dept_cdha' },
  { id: 'pr5', name: 'Xét nghiệm máu', durationMinutes: 15, busyMinutes: 15, deptId: 'dept_xetnghiem' },
  { id: 'pr6', name: 'Sắc thuốc', durationMinutes: 120, busyMinutes: 0, isIndependent: true, deptId: 'dept_duoc' },
];

export const MOCK_STAFF: Staff[] = [
  { id: 's1', name: 'BS. Nguyễn Văn A', role: 'Doctor', deptId: 'dept_ngoai', capabilityIds: [], mainCapabilityIds: [], assistantCapabilityIds: [] },
  { id: 's2', name: 'BS. Trần Thị B', role: 'Doctor', deptId: 'dept_noi', capabilityIds: [], mainCapabilityIds: [], assistantCapabilityIds: [] },
  { id: 's3', name: 'KTV. Lê Văn C', role: 'Technician', deptId: 'dept_phcn', capabilityIds: ['pr_kham', 'pr1', 'pr2', 'pr3'], mainCapabilityIds: ['pr_kham', 'pr1', 'pr2', 'pr3'], assistantCapabilityIds: ['pr_kham', 'pr1', 'pr2', 'pr3'] },
  { id: 's4', name: 'BS. Phạm Văn D', role: 'Doctor', deptId: 'dept_cdha', capabilityIds: ['pr4'], mainCapabilityIds: ['pr4'], assistantCapabilityIds: ['pr4'] },
  { id: 's5', name: 'KTV. Hoàng Thị E', role: 'Technician', deptId: 'dept_xetnghiem', capabilityIds: ['pr5'], mainCapabilityIds: ['pr5'], assistantCapabilityIds: ['pr5'] },
  { id: 's6', name: 'DS. Trần Văn F', role: 'Technician', deptId: 'dept_duoc', capabilityIds: ['pr6'], mainCapabilityIds: ['pr6'], assistantCapabilityIds: ['pr6'] },
];

export const MOCK_PATIENTS: Patient[] = [
  { id: 'p1', name: 'Nguyễn Thị Lan', dob: '1965-05-12', gender: 'Nữ', code: 'BN001', bedNumber: '101', admissionDate: '2024-02-01T08:00', status: 'TREATING', admittedByDeptId: 'dept_ngoai' },
  { id: 'p2', name: 'Trần Văn Hùng', dob: '1978-08-20', gender: 'Nam', code: 'BN002', bedNumber: '205', admissionDate: '2024-02-05T09:30', status: 'TREATING', admittedByDeptId: 'dept_noi' },
];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];
export const INITIAL_APPOINTMENTS: Appointment[] = [];
