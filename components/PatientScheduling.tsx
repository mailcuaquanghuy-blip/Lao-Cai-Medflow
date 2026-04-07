
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Patient, Appointment, Procedure, Staff, AppointmentStatus, Department, DepartmentType, UserAccount, UserRole, AttendanceRecord, ConflictDetail, AppointmentTemplate, TemplateProcedure, AttendanceStatus, MachineShift } from '../types';
import { Button } from './Button';
import { Search, Plus, Calendar, Clock, User, FileText, Bed, Zap, Monitor, GripVertical, AlertTriangle, Cpu, Info, Copy, Building2, Filter, CheckCircle2, Trash2, Lock, Save, FolderOpen, X, ChevronDown, RefreshCw, Check, Link } from 'lucide-react';

import { calculateAge, timeStringToMinutes, minutesToPixels, minutesToTimeString, addMinutesToTime, isInsideOfficeHours, checkConflict, getRoleLabel, formatDate, getAbbreviation } from '../utils/timeUtils';
import { CopyRangeModal } from './CopyRangeModal';
import { MachineShiftManager } from './MachineShiftManager';
import { DateInput } from './DateInput';
import { DEPARTMENTS, MOCK_PROCEDURES } from '../constants';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, collection } from 'firebase/firestore';

type SortField = 'NAME' | 'ROOM_BED' | 'ADMISSION';
type SortDirection = 'ASC' | 'DESC';
interface SortConfig { field: SortField; direction: SortDirection }

interface PatientSchedulingProps {
  patients: Patient[];
  currentDept: Department;
  appointments: Appointment[];
  templates: AppointmentTemplate[];
  procedures: Procedure[];
  staff: Staff[];
  attendanceRecords: AttendanceRecord[];
  machineShifts: MachineShift[];
  currentDate: string;
  currentUser: UserAccount;
  onBookAppointment: (patientId: string, appointment?: Appointment) => void;
  onUpdateAppointment: (appointment: Appointment) => void;
  onDeleteAppointment: (apptId: string) => void;
  onCopyToDateRange: (patientId: string, sourceDate: string, startDate: string, endDate: string) => void;
  onRecheckConflicts?: () => void;
  onAddShift: (shift: Omit<MachineShift, 'id'>) => void;
  onUpdateShift: (id: string, shift: Partial<MachineShift>, updateLinkedAppointments: boolean) => void;
  onDeleteShift: (id: string) => void;
}

const PIXELS_PER_MINUTE = 2.0; 
const START_HOUR = 0; 
const END_HOUR = 24;  

export const PatientScheduling: React.FC<PatientSchedulingProps> = ({
  patients,
  currentDept,
  appointments,
  templates,
  procedures,
  staff,
  attendanceRecords,
  machineShifts,
  currentDate,
  currentUser,
  onBookAppointment,
  onUpdateAppointment,
  onDeleteAppointment,
  onCopyToDateRange,
  onRecheckConflicts,
  onAddShift,
  onUpdateShift,
  onDeleteShift
}) => {
  const [activeTab, setActiveTab] = useState<'SCHEDULING' | 'MACHINE_SHIFTS'>('SCHEDULING');
  const [searchTerm, setSearchTerm] = useState('');
  const [referringDeptFilter, setReferringDeptFilter] = useState<string>('ALL');
  const [procedureFilter, setProcedureFilter] = useState<string>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [filterAdmissionDate, setFilterAdmissionDate] = useState<string>('');
  const [filterDischargeDate, setFilterDischargeDate] = useState<string>('');
  const [showDischarged, setShowDischarged] = useState<boolean>(false);
  const [showUnscheduledOnly, setShowUnscheduledOnly] = useState<boolean>(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([{ field: 'ADMISSION', direction: 'ASC' }]);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  
  const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<AppointmentTemplate | null>(null);
  const [includeStaffInTemplate, setIncludeStaffInTemplate] = useState(true);

  const hasMachineProcedures = useMemo(() => {
    return procedures.some(p => p.deptId === currentDept.id && p.requireMachine && (p.machineCapacity || 1) > 1 && p.availableMachines && p.availableMachines.length > 0);
  }, [procedures, currentDept.id]);

  const allDeptMachines = useMemo(() => {
    const machines = new Set<string>();
    procedures.filter(p => p.deptId === currentDept.id).forEach(p => {
      p.availableMachines?.forEach(m => machines.add(m));
    });
    return Array.from(machines).sort();
  }, [procedures, currentDept.id]);

  useEffect(() => {
    if (!hasMachineProcedures && activeTab === 'MACHINE_SHIFTS') {
      setActiveTab('SCHEDULING');
    }
  }, [hasMachineProcedures, activeTab]);

  useEffect(() => {
    if (selectedTemplateId) {
      const tpl = templates.find(t => t.id === selectedTemplateId);
      if (tpl) {
        setEditingTemplate(JSON.parse(JSON.stringify(tpl)));
      }
    } else {
      setEditingTemplate(null);
    }
  }, [selectedTemplateId]);

  const [dragState, setDragState] = useState<{
    id: string;
    startX: number;
    originalStartMin: number;
    currentStartMin: number;
    duration: number;
  } | null>(null);

  const timelineContainerRef = useRef<HTMLDivElement>(null);

  const isSupportDept = currentDept.type === DepartmentType.SUPPORT;
  const clinicalDepartments = DEPARTMENTS.filter(d => d.type === DepartmentType.CLINICAL);

  const timelineWidth = (END_HOUR - START_HOUR) * 60 * PIXELS_PER_MINUTE;
  
  const visiblePatients = useMemo(() => {
    return patients.filter(p => {
      // Logic lọc theo trạng thái điều trị (Tab Đang điều trị / Ra viện)
      const isDischarged = p.status === 'DISCHARGED';
      const isDischargedBeforeToday = isDischarged && (!p.dischargeDate || currentDate > p.dischargeDate.split('T')[0]);

      if (showDischarged) {
        // Tab "Ra viện": Chỉ hiện BN đã thực sự ra viện (trước hôm nay)
        if (!isDischargedBeforeToday) return false;
      } else {
        // Tab "Đang điều trị": Hiện BN đang điều trị HOẶC ra viện từ hôm nay trở đi
        if (isDischargedBeforeToday) return false;
      }

      if (currentDept.type === DepartmentType.CLINICAL) {
        return p.admittedByDeptId === currentDept.id;
      } else {
        // Logic chuyên khoa: Hiển thị nếu đã được referral HOẶC được admit trực tiếp
        if (p.admittedByDeptId === currentDept.id) return true;
        
        return p.referrals?.some(r => {
            const s = (r.specialty || '').toLowerCase();
            const dId = currentDept.id.toLowerCase();
            const dName = currentDept.name.toLowerCase();
            
            // Unify matching logic
            const isMatch = s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                           (s.includes('phcn') && dId.includes('phcn')) ||
                           (s.includes('cdha') && dId.includes('cdha')) ||
                           (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                           (s.includes('duoc') && dId.includes('duoc')) ||
                           (dId === 'dept_phcn' && s === 'dept_phcn') ||
                           (dId === 'dept_cdha' && s === 'dept_cdha') ||
                           (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
                           
            if (!isMatch) return false;

            const refDate = r.referralDate || p.admissionDate.split('T')[0];
            if (currentDate < refDate) return false;

            // Logic lọc theo trạng thái kết thúc tại chuyên khoa (Tab Đang điều trị / Ra viện)
            const isFinishedBeforeToday = r.status === 'FINISHED' && r.finishedDate && currentDate > r.finishedDate;
            if (showDischarged) {
              if (!isFinishedBeforeToday) return false;
            } else {
              if (isFinishedBeforeToday) return false;
            }

            return true;
        }) ?? false;
      }
    });
  }, [patients, currentDept, currentDate, showDischarged]);

  const patientsMissingDailyProcedures = useMemo(() => {
    if (!isSupportDept) return new Set<string>();
    const missing = new Set<string>();
    visiblePatients.forEach(p => {
      const referral = p.referrals?.find(r => {
        const s = (r.specialty || '').toLowerCase();
        const dId = currentDept.id.toLowerCase();
        const dName = currentDept.name.toLowerCase();
        const isMatch = s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                       (s.includes('phcn') && dId.includes('phcn')) ||
                       (s.includes('cdha') && dId.includes('cdha')) ||
                       (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                       (s.includes('duoc') && dId.includes('duoc')) ||
                       (dId === 'dept_phcn' && s === 'dept_phcn') ||
                       (dId === 'dept_cdha' && s === 'dept_cdha') ||
                       (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
        return isMatch && r.status !== 'FINISHED';
      });
      if (referral) {
        const todayAppts = appointments.filter(a => a.patientId === p.id && a.date === currentDate && a.deptId === currentDept.id);
        if (referral.procedureIds && referral.procedureIds.length > 0) {
          const hasAll = referral.procedureIds.every(pid => todayAppts.some(a => a.procedureId === pid));
          if (!hasAll) {
            missing.add(p.id);
          }
        } else {
          if (todayAppts.length === 0) {
            missing.add(p.id);
          }
        }
      }
    });
    return missing;
  }, [visiblePatients, isSupportDept, currentDept, appointments, currentDate]);

  const filteredPatients = visiblePatients.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (p.bedNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (p.roomNumber && p.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (p.id || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDept = referringDeptFilter === 'ALL' || p.admittedByDeptId === referringDeptFilter;
    const matchesAdmissionDate = !filterAdmissionDate || p.admissionDate.startsWith(filterAdmissionDate);
    const matchesDischargeDate = !filterDischargeDate || (p.dischargeDate && p.dischargeDate.startsWith(filterDischargeDate));
    
    const patientAppts = appointments.filter(a => a.patientId === p.id && a.date === currentDate);
    const matchesProcedure = procedureFilter === 'ALL' || patientAppts.some(a => a.procedureId === procedureFilter);
    const matchesStaff = staffFilter === 'ALL' || patientAppts.some(a => a.staffId === staffFilter || a.assistant1Id === staffFilter || a.assistant2Id === staffFilter);
    
    // Fix: Discharged patients should be visible if showDischarged is true, even if they are "scheduled"
    const isDischarged = p.status === 'DISCHARGED';
    const matchesUnscheduled = !showUnscheduledOnly || patientsMissingDailyProcedures.has(p.id);
    
    return matchesSearch && matchesDept && matchesAdmissionDate && matchesDischargeDate && matchesProcedure && matchesStaff && matchesUnscheduled;
  }).sort((a, b) => {
    // Prioritize patients admitted by current department
    const aIsCurrent = a.admittedByDeptId === currentDept.id;
    const bIsCurrent = b.admittedByDeptId === currentDept.id;
    if (aIsCurrent && !bIsCurrent) return -1;
    if (!aIsCurrent && bIsCurrent) return 1;

    for (const config of sortConfigs) {
      let cmp = 0;
      if (config.field === 'NAME') {
        cmp = a.name.localeCompare(b.name);
      } else if (config.field === 'ROOM_BED') {
        const roomA = a.roomNumber || '';
        const roomB = b.roomNumber || '';
        cmp = roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp === 0) {
          cmp = (a.bedNumber || '').localeCompare(b.bedNumber || '', undefined, { numeric: true, sensitivity: 'base' });
        }
      } else if (config.field === 'ADMISSION') {
        cmp = new Date(a.admissionDate).getTime() - new Date(b.admissionDate).getTime();
      }
      if (cmp !== 0) {
        return config.direction === 'ASC' ? cmp : -cmp;
      }
    }
    return 0;
  });

  const allDynamicConflicts = useMemo(() => {
    const conflicts = new Map<string, ConflictDetail[]>();
    appointments.forEach(a => {
      if (a.date === currentDate) {
        const res = checkConflict(
          a.startTime,
          a.endTime,
          a.date,
          a.staffId,
          a.patientId,
          appointments,
          staff,
          procedures,
          attendanceRecords,
          patients,
          a.procedureId,
          a.id,
          a.assistant1Id,
          a.assistant2Id,
          a
        );
        if (res.conflictDetails.length > 0) {
          conflicts.set(a.id, res.conflictDetails);
        }
      }
    });
    return conflicts;
  }, [appointments, currentDate, staff, procedures, attendanceRecords, patients]);

  const patientIdsWithIssues = useMemo(() => {
    const issuePatients = new Set<string>(patientsMissingDailyProcedures);
    appointments.forEach(a => {
      if (a.date === currentDate) {
        const startMin = timeStringToMinutes(a.startTime);
        const endMin = timeStringToMinutes(a.endTime);
        const hasConflict = allDynamicConflicts.has(a.id) && allDynamicConflicts.get(a.id)!.some(c => c.level === 1);
        const hasWarning = allDynamicConflicts.has(a.id) && allDynamicConflicts.get(a.id)!.some(c => c.level === 2);

        if (hasConflict || hasWarning) {
          issuePatients.add(a.patientId);
        }
      }
    });
    return issuePatients;
  }, [appointments, currentDate, staff, patientsMissingDailyProcedures, allDynamicConflicts]);

  const getPatientAppointmentsForDate = (patientId: string) => {
    return appointments
      .filter(a => a.patientId === patientId && a.date === currentDate)
      .sort((a, b) => {
        const aIsCurrent = a.deptId === currentDept.id;
        const bIsCurrent = b.deptId === currentDept.id;
        
        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;
        
        return a.startTime.localeCompare(b.startTime);
      });
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  const patientAppointments = selectedPatient ? getPatientAppointmentsForDate(selectedPatient.id) : [];

  useEffect(() => {
    if (selectedPatientId && patientAppointments.length > 0 && timelineContainerRef.current) {
      // Find the earliest appointment
      const earliestAppt = patientAppointments.reduce((earliest, current) => {
        return timeStringToMinutes(current.startTime) < timeStringToMinutes(earliest.startTime) ? current : earliest;
      });
      
      const startMin = timeStringToMinutes(earliestAppt.startTime);
      const leftPosition = (startMin - START_HOUR * 60) * PIXELS_PER_MINUTE;
      
      // Scroll to the position, subtracting a bit of padding (e.g., 50px) so it's not right at the edge
      timelineContainerRef.current.scrollTo({
        left: Math.max(0, leftPosition - 50),
        behavior: 'smooth'
      });
    }
  }, [selectedPatientId, currentDate]); // Only run when patient or date changes, not on every appointment update

  const patientAppointmentsWithRow = useMemo(() => {
    return patientAppointments.map((appt, index) => {
      return { ...appt, rowIndex: index };
    });
  }, [patientAppointments]);

  // Kiểm tra xem bệnh nhân đã kết thúc khám tại chuyên khoa này chưa
  const isReferralFinished = useMemo(() => {
    if (!selectedPatient || !isSupportDept) return false;
    const ref = selectedPatient.referrals?.find(r => {
      const s = (r.specialty || '').toLowerCase();
      const dId = currentDept.id.toLowerCase();
      const dName = currentDept.name.toLowerCase();
      return s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
             (s.includes('phcn') && dId.includes('phcn')) ||
             (s.includes('cdha') && dId.includes('cdha')) ||
             (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
             (s.includes('duoc') && dId.includes('duoc')) ||
             (dId === 'dept_phcn' && s === 'dept_phcn') ||
             (dId === 'dept_cdha' && s === 'dept_cdha') ||
             (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
    });
    return ref?.status === 'FINISHED' && ref.finishedDate && currentDate >= ref.finishedDate;
  }, [selectedPatient, currentDept, currentDate, isSupportDept]);

  const duplicateBedNumbers = useMemo(() => {
    const bedCounts = new Map<string, number>();
    filteredPatients.forEach(p => {
      if (p.bedNumber) {
        const bed = p.bedNumber.trim();
        bedCounts.set(bed, (bedCounts.get(bed) || 0) + 1);
      }
    });
    const duplicates = new Set<string>();
    bedCounts.forEach((count, bed) => {
      if (count > 1) duplicates.add(bed);
    });
    return duplicates;
  }, [filteredPatients]);

  const handleSaveTemplate = async () => {
    if (!selectedPatientId || !templateName.trim() || !db) return;
    
    const patientAppointments = appointments.filter(
      a => a.patientId === selectedPatientId && a.date === currentDate && a.deptId === currentDept.id
    );
    
    if (patientAppointments.length === 0) {
      alert('Bệnh nhân chưa có thủ thuật nào trong ngày này để lưu mẫu.');
      return;
    }

    const templateProcedures: TemplateProcedure[] = patientAppointments.map(a => {
      const proc: any = {
        procedureId: a.procedureId,
        staffId: a.staffId || null,
        startTime: a.startTime,
        endTime: a.endTime,
      };
      if (a.assistant1Id !== undefined) proc.assistant1Id = a.assistant1Id;
      if (a.assistant2Id !== undefined) proc.assistant2Id = a.assistant2Id;
      if (a.notes !== undefined) proc.notes = a.notes;
      if (a.assignedMachineId !== undefined) proc.assignedMachineId = a.assignedMachineId;
      if (a.mainBusyStart !== undefined) proc.mainBusyStart = a.mainBusyStart;
      if (a.mainBusyEnd !== undefined) proc.mainBusyEnd = a.mainBusyEnd;
      if (a.asst1BusyStart !== undefined) proc.asst1BusyStart = a.asst1BusyStart;
      if (a.asst1BusyEnd !== undefined) proc.asst1BusyEnd = a.asst1BusyEnd;
      if (a.asst2BusyStart !== undefined) proc.asst2BusyStart = a.asst2BusyStart;
      if (a.asst2BusyEnd !== undefined) proc.asst2BusyEnd = a.asst2BusyEnd;
      if (a.restMinutes !== undefined) proc.restMinutes = a.restMinutes;
      return proc as TemplateProcedure;
    });

    const newTemplate: AppointmentTemplate = {
      id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: templateName.trim(),
      deptId: currentDept.id,
      procedures: templateProcedures
    };

    // Deep clean undefined values
    const cleanTemplate = JSON.parse(JSON.stringify(newTemplate));

    try {
      await setDoc(doc(db, "templates", cleanTemplate.id), cleanTemplate);
      setIsSaveTemplateModalOpen(false);
      setTemplateName('');
      alert('Lưu mẫu thành công!');
    } catch (error) {
      console.error("Error saving template:", error);
      alert(`Có lỗi xảy ra khi lưu mẫu: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!db) return;
    if (confirm('Bạn có chắc chắn muốn xóa mẫu này?')) {
      try {
        await deleteDoc(doc(db, "templates", templateId));
        if (selectedTemplateId === templateId) {
          setSelectedTemplateId(null);
        }
      } catch (error) {
        console.error("Error deleting template:", error);
      }
    }
  };

  const handleSaveEditedTemplate = async () => {
    if (!editingTemplate || !db) return;
    try {
      const cleanTemplate = JSON.parse(JSON.stringify(editingTemplate));
      await setDoc(doc(db, "templates", cleanTemplate.id), cleanTemplate);
      alert('Đã lưu thay đổi mẫu!');
    } catch (error) {
      console.error("Error updating template:", error);
      alert(`Có lỗi xảy ra khi lưu mẫu: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedPatientId || !editingTemplate || !db) return;
    
    const template = editingTemplate;

    // Get current appointments for this patient on this date
    const existingAppointments = appointments.filter(
      a => a.patientId === selectedPatientId && a.date === currentDate && a.deptId === currentDept.id
    );

    // Prepare new appointments
    const newAppointments: Appointment[] = [];
    const updatedAppointments: Appointment[] = [];

    for (const tProc of template.procedures) {
      // Find if there's an existing appointment for the same procedure
      const existingAppt = existingAppointments.find(a => a.procedureId === tProc.procedureId);
      
      let staffId: string | null = null;
      let assistant1Id: string | null | undefined = undefined;
      let assistant2Id: string | null | undefined = undefined;

      // If including staff, check attendance and remove if off
      if (includeStaffInTemplate) {
        const checkStaffAttendance = (sId: string | null | undefined) => {
          if (!sId) return null;
          const record = attendanceRecords.find(r => r.staffId === sId && r.date === currentDate);
          if (!record) return sId;
          
          if (record.status === AttendanceStatus.OFF_FULL) return null;
          
          const startMin = timeStringToMinutes(tProc.startTime);
          if (record.status === AttendanceStatus.OFF_MORNING && startMin < 12 * 60) return null;
          if (record.status === AttendanceStatus.OFF_AFTERNOON && startMin >= 12 * 60) return null;
          
          return sId;
        };

        staffId = checkStaffAttendance(tProc.staffId) || '';
        assistant1Id = checkStaffAttendance(tProc.assistant1Id) || null;
        assistant2Id = checkStaffAttendance(tProc.assistant2Id) || null;
      }

      if (existingAppt) {
        // Update existing
        updatedAppointments.push({
          ...existingAppt,
          startTime: tProc.startTime,
          endTime: tProc.endTime,
          staffId: includeStaffInTemplate ? (staffId || '') : existingAppt.staffId,
          assistant1Id: includeStaffInTemplate ? assistant1Id : existingAppt.assistant1Id,
          assistant2Id: includeStaffInTemplate ? assistant2Id : existingAppt.assistant2Id,
          notes: tProc.notes || existingAppt.notes,
          assignedMachineId: tProc.assignedMachineId || existingAppt.assignedMachineId,
          mainBusyStart: tProc.mainBusyStart,
          mainBusyEnd: tProc.mainBusyEnd,
          asst1BusyStart: tProc.asst1BusyStart,
          asst1BusyEnd: tProc.asst1BusyEnd,
          asst2BusyStart: tProc.asst2BusyStart,
          asst2BusyEnd: tProc.asst2BusyEnd,
          restMinutes: tProc.restMinutes
        });
      } else {
        // Create new
        newAppointments.push({
          id: `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          patientId: selectedPatientId,
          staffId: includeStaffInTemplate ? (staffId || '') : '',
          assistant1Id: includeStaffInTemplate ? assistant1Id : null,
          assistant2Id: includeStaffInTemplate ? assistant2Id : null,
          procedureId: tProc.procedureId,
          deptId: currentDept.id,
          date: currentDate,
          startTime: tProc.startTime,
          endTime: tProc.endTime,
          status: AppointmentStatus.PENDING,
          notes: tProc.notes,
          assignedMachineId: tProc.assignedMachineId,
          mainBusyStart: tProc.mainBusyStart,
          mainBusyEnd: tProc.mainBusyEnd,
          asst1BusyStart: tProc.asst1BusyStart,
          asst1BusyEnd: tProc.asst1BusyEnd,
          asst2BusyStart: tProc.asst2BusyStart,
          asst2BusyEnd: tProc.asst2BusyEnd,
          restMinutes: tProc.restMinutes
        });
      }
    }

    try {
      // Clean undefined values
      const cleanUpdated = JSON.parse(JSON.stringify(updatedAppointments));
      const cleanNew = JSON.parse(JSON.stringify(newAppointments));

      // Save all to Firestore
      for (const appt of cleanUpdated) {
        await setDoc(doc(db, "appointments", appt.id), appt);
      }
      for (const appt of cleanNew) {
        await setDoc(doc(db, "appointments", appt.id), appt);
      }
      setIsLoadTemplateModalOpen(false);
      setSelectedTemplateId(null);
      alert('Áp dụng mẫu thành công! Vui lòng kiểm tra các cảnh báo xung đột (nếu có) trên lịch.');
    } catch (error) {
      console.error("Error applying template:", error);
      alert(`Có lỗi xảy ra khi áp dụng mẫu: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDragStart = (e: React.MouseEvent, appt: Appointment) => {
      if (appt.status === 'COMPLETED') return; 
      if (appt.deptId !== currentDept.id && currentUser.role !== UserRole.ADMIN) return;
      e.preventDefault(); e.stopPropagation();
      const startMin = timeStringToMinutes(appt.startTime);
      const endMin = timeStringToMinutes(appt.endTime);
      setDragState({
          id: appt.id,
          startX: e.clientX,
          originalStartMin: startMin,
          currentStartMin: startMin,
          duration: endMin - startMin
      });
  };

  useEffect(() => {
      if (!dragState) return;
      const handleMouseMove = (e: MouseEvent) => {
          const deltaPixels = e.clientX - dragState.startX;
          const deltaMinutes = deltaPixels / PIXELS_PER_MINUTE;
          let newStart = dragState.originalStartMin + deltaMinutes;
          const minTime = START_HOUR * 60;
          const maxTime = END_HOUR * 60 - dragState.duration;
          if (newStart < minTime) newStart = minTime;
          if (newStart > maxTime) newStart = maxTime;
          setDragState(prev => prev ? ({ ...prev, currentStartMin: newStart }) : null);
      };
      const handleMouseUp = (e: MouseEvent) => {
          if (dragState) {
              const snappedStart = Math.round(dragState.currentStartMin / 5) * 5;
              const newStartTime = minutesToTimeString(snappedStart);
              const newEndTime = minutesToTimeString(snappedStart + dragState.duration);
              const original = appointments.find(a => a.id === dragState.id);
              if (original && original.startTime !== newStartTime) {
                  onUpdateAppointment({ ...original, startTime: newStartTime, endTime: newEndTime });
              }
          }
          setDragState(null);
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [dragState, appointments, onUpdateAppointment]);

  const renderTimeLabels = () => {
    const labels = [];
    for (let i = START_HOUR; i <= END_HOUR; i++) {
        const left = (i - START_HOUR) * 60 * PIXELS_PER_MINUTE;
        labels.push(<div key={i} className="absolute top-0 h-full flex items-center text-[10px] font-bold text-slate-400 pl-1 select-none border-l border-slate-100" style={{ left }}>{i}:00</div>);
    }
    return labels;
  };

  const getBarColor = (index: number, status: string, hasWarning: boolean, hasConflict: boolean, isCurrentDept: boolean = true) => {
      if (!isCurrentDept) return 'bg-slate-50 border-slate-200 text-slate-400 opacity-40 grayscale-[0.5]';
      if (status === 'COMPLETED') return 'bg-emerald-50 border-emerald-400 text-emerald-900';
      if (hasConflict) return 'bg-rose-500 border-rose-700 text-white animate-blink shadow-[0_0_15px_rgba(244,63,94,0.5)]';
      if (hasWarning) return 'bg-amber-500 border-amber-700 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)]';
      const colors = ['bg-blue-50 border-blue-400 text-blue-900', 'bg-amber-50 border-amber-400 text-amber-900', 'bg-cyan-50 border-cyan-400 text-cyan-900'];
      return colors[index % colors.length];
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex gap-2 shrink-0">
        <button 
          onClick={() => setActiveTab('SCHEDULING')} 
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'SCHEDULING' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}
        >
          Chỉ định thủ thuật
        </button>
        {hasMachineProcedures && (
          <button 
            onClick={() => setActiveTab('MACHINE_SHIFTS')} 
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'MACHINE_SHIFTS' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}
          >
            Quản lý ca máy
          </button>
        )}
      </div>

      {activeTab === 'SCHEDULING' ? (
        <div className="flex flex-1 gap-6 overflow-hidden">
          <div className="w-[420px] flex flex-col bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
            <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3 shrink-0">
               <div className="flex items-center justify-between px-1">
                   <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest flex items-center gap-2">
                      <User size={14} className="text-primary" /> Danh sách bệnh nhân
                   </h3>
                   <div className="flex gap-1">
                      {onRecheckConflicts && (
                        <button onClick={onRecheckConflicts} className="text-slate-400 hover:text-primary p-1.5 rounded-lg transition-colors" title="Làm mới / Kiểm tra lỗi">
                           <RefreshCw size={14} />
                        </button>
                      )}
                   </div>
               </div>
           
               <div className="flex flex-col gap-2">
                  {/* Unified Search & Filter Bar */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm focus-within:border-primary/50 transition-all relative">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={14} />
                      <input 
                        className="w-full pl-9 pr-3 py-2 bg-transparent outline-none text-xs font-bold text-slate-700 placeholder:text-slate-400" 
                        placeholder="Tìm tên, phòng, mã..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                      />
                    </div>
                    
                    <div className="h-6 w-px bg-slate-100 mx-1"></div>
                    
                    <div className="">
                      <button 
                        onClick={() => { setIsFilterMenuOpen(!isFilterMenuOpen); setIsSortMenuOpen(false); }} 
                        className={`p-2 rounded-xl transition-all flex items-center justify-center ${isFilterMenuOpen || filterAdmissionDate || showDischarged || procedureFilter !== 'ALL' || staffFilter !== 'ALL' || showUnscheduledOnly ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-50'}`}
                        title="Bộ lọc"
                      >
                        <Filter size={16} />
                      </button>
                      
                      {isFilterMenuOpen && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[280px] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Lọc nâng cao</span>
                            <button onClick={() => setIsFilterMenuOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={16}/></button>
                          </div>
                          
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Ngày vào viện</label>
                            <DateInput 
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary"
                              value={filterAdmissionDate}
                              onChange={val => setFilterAdmissionDate(val)}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Ngày ra viện</label>
                            <DateInput 
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary"
                              value={filterDischargeDate}
                              onChange={val => setFilterDischargeDate(val)}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Thủ thuật đã xếp</label>
                            <select 
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary"
                              value={procedureFilter}
                              onChange={e => setProcedureFilter(e.target.value)}
                            >
                              <option value="ALL">Tất cả thủ thuật</option>
                              {procedures
                                .sort((a, b) => {
                                  const aIsCurrent = a.deptId === currentDept.id;
                                  const bIsCurrent = b.deptId === currentDept.id;
                                  if (aIsCurrent && !bIsCurrent) return -1;
                                  if (!aIsCurrent && bIsCurrent) return 1;
                                  return a.name.localeCompare(b.name);
                                })
                                .map(p => (
                                <option key={p.id} value={p.id}>{p.deptId !== currentDept.id ? `[Khác] ${p.name}` : p.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Nhân sự thực hiện</label>
                            <select 
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary"
                              value={staffFilter}
                              onChange={e => setStaffFilter(e.target.value)}
                            >
                              <option value="ALL">Tất cả nhân sự</option>
                              {staff
                                .sort((a, b) => {
                                  const aIsCurrent = a.deptId === currentDept.id;
                                  const bIsCurrent = b.deptId === currentDept.id;
                                  if (aIsCurrent && !bIsCurrent) return -1;
                                  if (!aIsCurrent && bIsCurrent) return 1;
                                  return a.name.localeCompare(b.name);
                                })
                                .map(s => (
                                <option key={s.id} value={s.id}>{s.deptId !== currentDept.id ? `[Khác] ${s.name}` : s.name} ({s.role})</option>
                              ))}
                            </select>
                          </div>

                          
                          {(filterAdmissionDate || filterDischargeDate || showDischarged || procedureFilter !== 'ALL' || staffFilter !== 'ALL' || showUnscheduledOnly) && (
                            <button 
                              onClick={() => {
                                setFilterAdmissionDate('');
                                setFilterDischargeDate('');
                                setShowDischarged(false);
                                setProcedureFilter('ALL');
                                setStaffFilter('ALL');
                                setShowUnscheduledOnly(false);
                              }}
                              className="text-[10px] font-bold text-rose-500 hover:text-rose-600 text-center pt-2 border-t border-slate-100"
                            >
                              Xóa bộ lọc
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="">
                      <button 
                        onClick={() => { setIsSortMenuOpen(!isSortMenuOpen); setIsFilterMenuOpen(false); }} 
                        className={`p-2 rounded-xl transition-all flex items-center justify-center ${isSortMenuOpen || sortConfigs.length > 0 ? 'bg-amber-50 text-amber-600' : 'text-slate-400 hover:bg-slate-50'}`}
                        title="Sắp xếp"
                      >
                        <ChevronDown size={16} className={isSortMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                      </button>

                      {isSortMenuOpen && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[320px] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Điều kiện sắp xếp</span>
                            <button onClick={() => setIsSortMenuOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={16}/></button>
                          </div>
                          
                          {sortConfigs.length === 0 && (
                            <p className="text-xs text-slate-400 font-bold text-center py-2">Chưa có điều kiện sắp xếp (Mặc định)</p>
                          )}

                          {sortConfigs.map((config, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <select 
                                className="flex-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 outline-none focus:border-primary"
                                value={config.field}
                                onChange={e => {
                                  const newConfigs = [...sortConfigs];
                                  newConfigs[idx].field = e.target.value as SortField;
                                  setSortConfigs(newConfigs);
                                }}
                              >
                                <option value="NAME">Tên bệnh nhân</option>
                                <option value="ROOM_BED">Phòng / Giường</option>
                                <option value="ADMISSION">Thời gian vào viện</option>
                              </select>
                              
                              <button 
                                onClick={() => {
                                  const newConfigs = [...sortConfigs];
                                  newConfigs[idx].direction = config.direction === 'ASC' ? 'DESC' : 'ASC';
                                  setSortConfigs(newConfigs);
                                }}
                                className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-[10px] w-14 text-center uppercase"
                                title="Đổi chiều sắp xếp"
                              >
                                {config.direction === 'ASC' ? 'Tăng' : 'Giảm'}
                              </button>
                              
                              <button 
                                onClick={() => {
                                  const newConfigs = sortConfigs.filter((_, i) => i !== idx);
                                  setSortConfigs(newConfigs);
                                }}
                                className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50"
                                title="Xóa điều kiện này"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          
                          {sortConfigs.length < 3 && (
                            <button 
                              onClick={() => {
                                const usedFields = sortConfigs.map(c => c.field);
                                const availableFields: SortField[] = ['NAME', 'ROOM_BED', 'ADMISSION'];
                                const nextField = availableFields.find(f => !usedFields.includes(f)) || 'NAME';
                                setSortConfigs([...sortConfigs, { field: nextField, direction: 'ASC' }]);
                              }}
                              className="flex items-center justify-center gap-1 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all mt-1"
                            >
                              <Plus size={14} /> Thêm điều kiện
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tab-like Toggle for Treatment Status */}
                  <div className="flex flex-col gap-2 px-1 py-1">
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                      <button 
                        onClick={() => setShowDischarged(false)}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!showDischarged ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Đang điều trị
                      </button>
                      <button 
                        onClick={() => setShowDischarged(true)}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${showDischarged ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Ra viện
                      </button>
                    </div>

                    {isSupportDept && (
                      <label className="flex items-center gap-2 cursor-pointer group px-1">
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${showUnscheduledOnly ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 group-hover:border-amber-500'}`}>
                          {showUnscheduledOnly && <Check size={10} />}
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Chỉ hiện BN chưa xếp lịch xong</span>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={showUnscheduledOnly}
                          onChange={e => setShowUnscheduledOnly(e.target.checked)}
                        />
                      </label>
                    )}
                  </div>

                  {isSupportDept && (
                    <div className="relative group">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={12} />
                      <select 
                        className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-tight outline-none focus:border-primary/50 transition-all appearance-none shadow-sm"
                        value={referringDeptFilter}
                        onChange={e => setReferringDeptFilter(e.target.value)}
                      >
                        <option value="ALL">Tất cả khoa lâm sàng</option>
                        {clinicalDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                    </div>
                  )}
               </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 scrollbar-thin">
            {filteredPatients.map(p => {
                const hasIssue = patientIdsWithIssues.has(p.id);
                const isFinOnDate = p.referrals?.find(r => {
                  const s = (r.specialty || '').toLowerCase();
                  const dId = currentDept.id.toLowerCase();
                  const dName = currentDept.name.toLowerCase();
                  return s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                         (s.includes('phcn') && dId.includes('phcn')) ||
                         (s.includes('cdha') && dId.includes('cdha')) ||
                         (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                         (s.includes('duoc') && dId.includes('duoc')) ||
                         (dId === 'dept_phcn' && s === 'dept_phcn') ||
                         (dId === 'dept_cdha' && s === 'dept_cdha') ||
                         (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
                })?.status === 'FINISHED';
                const isDuplicateBed = duplicateBedNumbers.has(p.bedNumber?.trim());
                
                return (
                  <button key={p.id} onClick={() => setSelectedPatientId(p.id)} className={`w-full text-left p-3 rounded-2xl transition-all border ${selectedPatientId === p.id ? 'bg-blue-50 border-blue-500 shadow-sm shadow-blue-100' : 'border-transparent hover:bg-slate-50 hover:border-slate-100'} ${hasIssue && selectedPatientId !== p.id ? 'bg-rose-50/30' : ''}`}>
                      <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className={`font-bold text-sm uppercase truncate ${selectedPatientId === p.id ? 'text-primary' : 'text-slate-800'}`}>
                                      {p.name}
                                  </span>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mb-1">
                                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                                      <span>{p.gender}</span>
                                      <span>•</span>
                                      <span>{calculateAge(p.dob)} tuổi</span>
                                  </div>
                                  <span className={`text-[10px] font-bold px-1.5 rounded whitespace-nowrap ${isDuplicateBed ? 'animate-pulse text-rose-600 bg-rose-50 border border-rose-200' : 'text-primary bg-primary/5'}`}>G: {p.bedNumber}</span>
                              </div>

                              <div className="flex flex-col gap-0.5">
                                  <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 whitespace-nowrap">
                                    <Clock size={10} className="text-slate-400" />
                                    {new Date(p.admissionDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </div>
                                  {p.dischargeDate && (
                                    <div className="text-[10px] text-rose-500 font-medium flex items-center gap-1 whitespace-nowrap">
                                      <Clock size={10} className="text-rose-400" />
                                      Ra: {new Date(p.dischargeDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </div>
                                  )}
                              </div>
                              
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {patientsMissingDailyProcedures.has(p.id) && (
                                  <div className="text-[8px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 flex items-center gap-1">
                                    <AlertTriangle size={10} /> Thiếu thủ thuật
                                  </div>
                                )}
                                {isFinOnDate && isSupportDept && (
                                  <div className="text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                                    <CheckCircle2 size={10} /> Đã kết thúc
                                  </div>
                                )}
                                {p.status === 'DISCHARGED' && (
                                  <div className="text-[8px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-1.5 rounded border border-rose-100">Đã ra viện</div>
                                )}
                              </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                              {hasIssue && <AlertTriangle size={16} className="text-rose-500 animate-blink shrink-0 mb-1" />}
                              <div className="grid grid-cols-3 gap-1">
                                  {appointments
                                      .filter(a => a.patientId === p.id && a.date === currentDate)
                                  .map(a => {
                                      const proc = procedures.find(pr => pr.id === a.procedureId);
                                      const mockProc = MOCK_PROCEDURES.find(pr => pr.id === a.procedureId);
                                      const procedureDeptId = proc?.deptId || mockProc?.deptId || a.deptId;
                                      const isCurrentDeptProc = procedureDeptId === currentDept.id;
                                      return (proc || mockProc) ? (
                                          <div key={a.id} className={`p-1 rounded-lg shadow-sm border relative flex items-center justify-center ${isCurrentDeptProc ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-40 grayscale'}`} title={proc?.name || mockProc?.name || 'Không xác định'}>
                                              <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${isCurrentDeptProc ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>{getAbbreviation(proc?.name || mockProc?.name)}</div>
                                              {a.machineShiftId && (
                                                  <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 shadow-[0_0_5px_rgba(59,130,246,0.5)] border border-white">
                                                      <Link size={6} strokeWidth={3} />
                                                  </div>
                                              )}
                                          </div>
                                      ) : null;
                                  })
                              }
                          </div>
                      </div>
                      </div>
                  </button>
                );
            })}
            {filteredPatients.length === 0 && (
                <div className="p-10 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    Không có bệnh nhân
                </div>
            )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
        {selectedPatient ? (
          <>
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-slate-50/30 shrink-0">
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Điều trị ngày {new Date(currentDate).toLocaleDateString('vi-VN')}</div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            {selectedPatient.name}
                            {patientIdsWithIssues.has(selectedPatient.id) && <AlertTriangle size={24} className="text-rose-500 animate-blink shrink-0" />}
                        </h2>
                        <span className="text-sm font-bold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1.5 shadow-sm whitespace-nowrap">
                          <Bed size={14} className="text-primary/50 shrink-0" /> 
                          Giường: {selectedPatient.bedNumber} - P: {selectedPatient.roomNumber || '?'}
                        </span>
                        {isReferralFinished && (
                          <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-xl border border-emerald-100 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                             <CheckCircle2 size={14} className="shrink-0" /> Đã hoàn thành khám chuyên khoa
                          </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {isSupportDept && (
                      <Button onClick={() => onBookAppointment(selectedPatient.id)} disabled={isReferralFinished} className={isReferralFinished ? "" : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200"}>
                        {isReferralFinished ? <Lock size={18} /> : <Plus size={18} />}
                        {isReferralFinished ? 'Đã khóa chỉ định' : 'Xếp lịch thủ thuật'}
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => setIsCopyModalOpen(true)} className="bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100" disabled={isReferralFinished}>
                        <Copy size={18} /> Sao chép thủ thuật
                    </Button>
                    {onRecheckConflicts && (
                      <Button variant="secondary" onClick={onRecheckConflicts} className="bg-amber-50 border-amber-100 text-amber-600 hover:bg-amber-100">
                          <RefreshCw size={18} /> Kiểm tra lỗi
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => setIsSaveTemplateModalOpen(true)} className="bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100" disabled={isReferralFinished || patientAppointments.length === 0}>
                        <Save size={18} /> Lưu mẫu
                    </Button>
                    {!isSupportDept && (
                      <div className="flex">
                        <Button onClick={() => onBookAppointment(selectedPatient.id)} className="rounded-r-none border-r border-white/20">
                            <Plus size={18} /> Thêm chỉ định
                        </Button>
                        <Button onClick={() => setIsLoadTemplateModalOpen(true)} className="rounded-l-none px-2" title="Tải mẫu thủ thuật">
                            <ChevronDown size={18} />
                        </Button>
                      </div>
                    )}
                </div>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="shrink-0 min-h-[150px] max-h-[40%] relative overflow-hidden flex flex-col border-b border-slate-200">
                    <div ref={timelineContainerRef} className="flex-1 overflow-auto bg-slate-50/30 relative scrollbar-thin">
                        <div className="relative min-h-full" style={{ width: Math.max(timelineWidth, 800) }}>
                            <div className="h-8 sticky top-0 bg-white/95 backdrop-blur z-20 border-b border-slate-200 shadow-sm">{renderTimeLabels()}</div>
                            <div 
                                className="py-4 relative z-10 px-4" 
                                style={{ height: Math.max(80, (Math.max(-1, ...patientAppointmentsWithRow.map(a => a.rowIndex)) + 1) * 40 + 32) }}
                            >
                                {patientAppointmentsWithRow.map((appt, idx) => {
                                    const proc = procedures.find(pr => pr.id === appt.procedureId);
                                    const staffMember = staff.find(s => s.id === appt.staffId);
                                    const mockProc = MOCK_PROCEDURES.find(p => p.id === appt.procedureId);
                                    const isDragging = dragState?.id === appt.id;
                                    const startMin = isDragging ? dragState.currentStartMin : timeStringToMinutes(appt.startTime);
                                    const endMin = isDragging ? (dragState.currentStartMin + dragState.duration) : timeStringToMinutes(appt.endTime);
                                    const duration = endMin - startMin;
                                    const left = (startMin - START_HOUR * 60) * PIXELS_PER_MINUTE;
                                    const width = Math.max(duration * PIXELS_PER_MINUTE, 60);
                                    const hasConflict = allDynamicConflicts.has(appt.id) && allDynamicConflicts.get(appt.id)!.some(c => c.level === 1);
                                    const hasWarning = allDynamicConflicts.has(appt.id) && allDynamicConflicts.get(appt.id)!.some(c => c.level === 2);
                                    const restMinutes = proc?.restMinutes || 0;
                                    const restWidth = restMinutes * PIXELS_PER_MINUTE;
                                    const top = appt.rowIndex * 40 + 16; // 16px is top padding (py-4)
                                    
                                    const marqueeContent = `(${proc?.name || mockProc?.name || 'Không xác định'}) ${appt.startTime} - ${appt.endTime}, ${staffMember?.name}${appt.assignedMachineId ? `, Máy: ${appt.assignedMachineId}` : ''}`;

                                    return (
                                        <div key={appt.id} className="absolute h-8" style={{ top, left, width: width + restWidth }}>
                                            <div 
                                                className={`absolute top-0 h-8 rounded-md border shadow-sm flex items-center overflow-hidden transition-all z-20 ${getBarColor(idx, appt.status, hasWarning, hasConflict, appt.deptId === currentDept.id)} ${isDragging ? 'cursor-grabbing scale-105 z-50' : 'cursor-pointer'}`} 
                                                style={{ left: 0, width }} 
                                                onClick={() => !isReferralFinished && onBookAppointment(selectedPatient.id, appt)} 
                                                onMouseDown={(e) => !isReferralFinished && handleDragStart(e, appt)}
                                            >
                                                <div className="flex whitespace-nowrap animate-marquee px-2 pointer-events-none select-none min-w-max">
                                                    <span className="font-bold text-[10px] mr-8 shrink-0">{marqueeContent}</span>
                                                    <span className="font-bold text-[10px] mr-8 shrink-0">{marqueeContent}</span>
                                                    <span className="font-bold text-[10px] mr-8 shrink-0">{marqueeContent}</span>
                                                </div>
                                            </div>
                                            {restMinutes > 0 && (
                                                <div 
                                                    className="absolute top-0 h-8 rounded-r-md border-y border-r border-slate-300 bg-slate-200/50 flex items-center justify-center overflow-hidden z-10 pointer-events-none"
                                                    style={{ left: width, width: restWidth }}
                                                >
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap px-1">Nghỉ</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-white overflow-y-auto scrollbar-thin">
                    <div className="sticky top-0 bg-white z-20 p-6 border-b border-slate-100 mb-6">
                        <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2"><FileText size={16} className="text-primary"/> Chi tiết & Cảnh báo trùng</h3>
                    </div>
                    <div className="px-6 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {patientAppointments.map(appt => {
                            const proc = procedures.find(p => p.id === appt.procedureId);
                            const mockProc = MOCK_PROCEDURES.find(p => p.id === appt.procedureId);
                            const staffMember = staff.find(s => s.id === appt.staffId);
                            const procedureDeptId = proc?.deptId || mockProc?.deptId || appt.deptId;
                            const performingDept = DEPARTMENTS.find(d => d.id === procedureDeptId);
                            const startMin = timeStringToMinutes(appt.startTime);
                            const endMin = timeStringToMinutes(appt.endTime);
                            const dynamicConflictDetails = allDynamicConflicts.get(appt.id) || [];
                            const hasConflict = dynamicConflictDetails.some(c => c.level === 1);
                            const hasWarning = dynamicConflictDetails.some(c => c.level === 2);
                            const isMissingStaff = !appt.staffId || !staffMember;
                            const canEdit = appt.deptId === currentDept.id || currentUser.role === UserRole.ADMIN;
                            const displayConflictDetails = dynamicConflictDetails;
                            const isCurrentDeptProc = procedureDeptId === currentDept.id;

                            return (
                                <div key={appt.id} onClick={() => !isReferralFinished && canEdit && onBookAppointment(selectedPatient.id, appt)} className={`border-2 rounded-2xl flex flex-col hover:shadow-xl transition-all bg-white overflow-hidden group ${hasConflict ? 'border-rose-500 bg-rose-50/10' : hasWarning ? 'border-amber-500 bg-amber-50/10' : (isCurrentDeptProc ? 'border-blue-500 shadow-sm shadow-blue-100' : 'border-slate-100')} ${!isCurrentDeptProc ? 'opacity-40 grayscale-[0.5]' : ''} ${isReferralFinished || !canEdit ? 'cursor-default' : 'cursor-pointer'}`}>
                                    <div className={`p-3.5 flex-1`}>
                                        <div className="flex justify-between items-start mb-1.5">
                                          <h4 className={`font-black truncate text-base flex items-center gap-2 ${hasConflict ? 'text-rose-600' : hasWarning ? 'text-amber-600' : 'text-slate-800'}`}>
                                            <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black ${hasConflict ? 'bg-rose-100 text-rose-600' : hasWarning ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'}`}>{getAbbreviation(proc?.name || mockProc?.name)}</div>
                                            {proc?.name || mockProc?.name || 'Không xác định'}
                                          </h4>
                                          <span className={`text-xs font-black px-2 py-0.5 rounded-md ${hasConflict ? 'bg-rose-100 text-rose-700' : hasWarning ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{appt.startTime} - {appt.endTime}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs font-black text-primary uppercase tracking-widest mb-1.5 border-b border-slate-50 pb-1 w-fit">
                                          <Building2 size={14} className="text-primary/60" /> KHOA THỰC HIỆN: {performingDept?.name}
                                        </div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className={`flex flex-col gap-1 text-[13px] font-bold ${isMissingStaff ? 'text-rose-500' : 'text-slate-500'}`}>
                                                <div className="flex items-center gap-1">
                                                    <User size={14} className={isMissingStaff ? 'text-rose-400' : 'text-slate-300'} /> 
                                                    {staffMember?.name || 'Chưa phân công người thực hiện'}
                                                </div>
                                                {appt.assistant1Id && <div className="flex items-center gap-1 text-[12px] text-slate-400 ml-4">Phụ 1: {staff.find(s => s.id === appt.assistant1Id)?.name}</div>}
                                                {appt.assistant2Id && <div className="flex items-center gap-1 text-[12px] text-slate-400 ml-4">Phụ 2: {staff.find(s => s.id === appt.assistant2Id)?.name}</div>}
                                            </div>
                                            {!isReferralFinished && canEdit && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteAppointment(appt.id);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="Xóa chỉ định"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {appt.assignedMachineId && <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-black text-[11px] uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-100"><Cpu size={12}/> Máy: {appt.assignedMachineId}</div>}
                                            {appt.machineShiftId && <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-black text-[11px] uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100"><Link size={12}/> Đã liên kết ca máy</div>}
                                            {hasConflict && <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-black text-[11px] uppercase tracking-widest bg-rose-600 text-white shadow-sm"><AlertTriangle size={12}/> CẢNH BÁO MỨC 1</div>}
                                            {hasWarning && !hasConflict && <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-black text-[11px] uppercase tracking-widest bg-amber-500 text-white shadow-sm"><AlertTriangle size={12}/> CẢNH BÁO MỨC 2</div>}
                                        </div>
                                    </div>
                                    {displayConflictDetails && displayConflictDetails.length > 0 && (
                                        <div className={`p-3 border-t-2 ${hasConflict ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                                            {displayConflictDetails.map((c, mIdx) => (
                                                <p key={mIdx} className={`text-[10px] font-bold flex items-start gap-1 ${c.level === 1 ? 'text-rose-600' : 'text-amber-600'}`}><Info size={10} className="shrink-0 mt-0.5" /> {c.message}</p>
                                            ))}
                                        </div>
                                    )}
                                    {hasConflict && (!displayConflictDetails || displayConflictDetails.length === 0) && (
                                        <div className="p-3 border-t-2 bg-rose-50 border-rose-100">
                                            <p className="text-[10px] font-bold flex items-start gap-1 text-rose-600"><Info size={10} className="shrink-0 mt-0.5" /> Có lỗi xung đột (Vui lòng kiểm tra lại)</p>
                                        </div>
                                    )}
                                    {hasWarning && !hasConflict && (!displayConflictDetails || displayConflictDetails.length === 0) && (
                                        <div className="p-3 border-t-2 bg-amber-50 border-amber-100">
                                            <p className="text-[10px] font-bold flex items-start gap-1 text-amber-600"><Info size={10} className="shrink-0 mt-0.5" /> Có cảnh báo (Vui lòng kiểm tra lại)</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    </div>
                </div>
            </div>

            <CopyRangeModal 
              isOpen={isCopyModalOpen} 
              onClose={() => setIsCopyModalOpen(false)} 
              onConfirm={(start, end) => {
                onCopyToDateRange(selectedPatient.id, currentDate, start, end);
                setIsCopyModalOpen(false);
              }}
              sourceDate={currentDate}
              patientName={selectedPatient.name}
              procedureCount={patientAppointments.length}
            />

            {/* Save Template Modal */}
            {isSaveTemplateModalOpen && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Save size={20} className="text-emerald-500" />
                      Lưu mẫu thủ thuật
                    </h3>
                    <button onClick={() => setIsSaveTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600">
                      Lưu các thủ thuật hiện tại của bệnh nhân trong ngày thành một mẫu để sử dụng lại sau này.
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tên mẫu</label>
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        placeholder="VD: Mẫu nội soi dạ dày đại tràng..."
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setIsSaveTemplateModalOpen(false)}>Hủy</Button>
                    <Button onClick={handleSaveTemplate} disabled={!templateName.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      Lưu mẫu
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Load Template Modal */}
            {isLoadTemplateModalOpen && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <FolderOpen size={20} className="text-blue-500" />
                      Kho mẫu thủ thuật ({currentDept.name})
                    </h3>
                    <button onClick={() => setIsLoadTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Template List */}
                    <div className="w-full md:w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/50">
                      <div className="p-4 border-b border-slate-100 font-medium text-slate-700">Danh sách mẫu</div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {templates.filter(t => t.deptId === currentDept.id).length === 0 ? (
                          <div className="p-4 text-center text-slate-500 text-sm italic">Chưa có mẫu nào được lưu.</div>
                        ) : (
                          templates.filter(t => t.deptId === currentDept.id).map(template => (
                            <div 
                              key={template.id}
                              className={`p-3 rounded-lg cursor-pointer flex justify-between items-center group transition-colors ${selectedTemplateId === template.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-100 text-slate-700'}`}
                              onClick={() => setSelectedTemplateId(template.id)}
                            >
                              <span className="font-medium truncate pr-2">{template.name}</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }}
                                className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Xóa mẫu"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Template Preview */}
                    <div className="w-full md:w-2/3 flex flex-col bg-white">
                      <div className="p-4 border-b border-slate-100 font-medium text-slate-700 flex justify-between items-center">
                        <span>Chi tiết mẫu</span>
                        {selectedTemplateId && (
                           <div className="flex items-center gap-2 text-sm">
                             <input 
                               type="checkbox" 
                               id="includeStaff" 
                               checked={includeStaffInTemplate} 
                               onChange={(e) => setIncludeStaffInTemplate(e.target.checked)}
                               className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                             />
                             <label htmlFor="includeStaff" className="text-slate-600 cursor-pointer">Bao gồm nhân sự</label>
                           </div>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto p-4">
                        {!editingTemplate ? (
                          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                            Chọn một mẫu bên trái để xem chi tiết
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Tên mẫu</label>
                              <input
                                type="text"
                                value={editingTemplate.name}
                                onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              />
                            </div>
                            <div className="space-y-3">
                              {editingTemplate.procedures.map((tProc, idx) => {
                                const proc = procedures.find(p => p.id === tProc.procedureId);
                                const mockProc = MOCK_PROCEDURES.find(p => p.id === tProc.procedureId);
                                return (
                                  <div key={idx} className="p-3 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
                                    <div className="flex justify-between items-center">
                                      <div className="font-medium text-slate-800 flex items-center gap-2">
                                        <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">{getAbbreviation(proc?.name || mockProc?.name)}</div>
                                        {proc?.name || mockProc?.name || 'Thủ thuật không xác định'}
                                      </div>
                                      <button 
                                        onClick={() => {
                                          const newProcs = [...editingTemplate.procedures];
                                          newProcs.splice(idx, 1);
                                          setEditingTemplate({...editingTemplate, procedures: newProcs});
                                        }}
                                        className="text-slate-400 hover:text-rose-500 transition-colors"
                                        title="Xóa thủ thuật khỏi mẫu"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Thời gian</label>
                                        <div className="flex items-center gap-2">
                                          <input 
                                            type="time" 
                                            value={tProc.startTime}
                                            onChange={(e) => {
                                              const newProcs = [...editingTemplate.procedures];
                                              newProcs[idx] = {...tProc, startTime: e.target.value};
                                              setEditingTemplate({...editingTemplate, procedures: newProcs});
                                            }}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                          />
                                          <span className="text-slate-400">-</span>
                                          <input 
                                            type="time" 
                                            value={tProc.endTime}
                                            onChange={(e) => {
                                              const newProcs = [...editingTemplate.procedures];
                                              newProcs[idx] = {...tProc, endTime: e.target.value};
                                              setEditingTemplate({...editingTemplate, procedures: newProcs});
                                            }}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Nhân sự chính</label>
                                        <select
                                          value={tProc.staffId || ''}
                                          onChange={(e) => {
                                            const newProcs = [...editingTemplate.procedures];
                                            newProcs[idx] = {...tProc, staffId: e.target.value};
                                            setEditingTemplate({...editingTemplate, procedures: newProcs});
                                          }}
                                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                          <option value="">-- Chọn nhân sự --</option>
                                          {staff.filter(s => s.deptId === currentDept.id && s.mainCapabilityIds?.includes(tProc.procedureId)).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Người phụ 1</label>
                                        <select
                                          value={tProc.assistant1Id || ''}
                                          onChange={(e) => {
                                            const newProcs = [...editingTemplate.procedures];
                                            newProcs[idx] = {...tProc, assistant1Id: e.target.value};
                                            setEditingTemplate({...editingTemplate, procedures: newProcs});
                                          }}
                                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                          <option value="">-- Chọn người phụ --</option>
                                          {staff.filter(s => s.deptId === currentDept.id && s.assistantCapabilityIds?.includes(tProc.procedureId) && s.id !== tProc.staffId).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Máy thực hiện</label>
                                        <select
                                          value={tProc.assignedMachineId || ''}
                                          onChange={(e) => {
                                            const newProcs = [...editingTemplate.procedures];
                                            newProcs[idx] = {...tProc, assignedMachineId: e.target.value};
                                            setEditingTemplate({...editingTemplate, procedures: newProcs});
                                          }}
                                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                          <option value="">-- Chọn máy --</option>
                                          {(() => {
                                            const proc = procedures.find(p => p.id === tProc.procedureId);
                                            const machines = proc?.availableMachines || [];
                                            return machines.length > 0 ? (
                                              machines.map(mCode => (
                                                <option key={mCode} value={mCode}>{mCode}</option>
                                              ))
                                            ) : (
                                              <option value="" disabled>Không có máy</option>
                                            );
                                          })()}
                                        </select>
                                      </div>
                                      <div className="col-span-1">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Ghi chú</label>
                                        <input 
                                          type="text" 
                                          value={tProc.notes || ''}
                                          onChange={(e) => {
                                            const newProcs = [...editingTemplate.procedures];
                                            newProcs[idx] = {...tProc, notes: e.target.value};
                                            setEditingTemplate({...editingTemplate, procedures: newProcs});
                                          }}
                                          placeholder="Ghi chú..."
                                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                        {editingTemplate && JSON.stringify(editingTemplate) !== JSON.stringify(templates.find(t => t.id === selectedTemplateId)) && (
                          <Button variant="secondary" onClick={handleSaveEditedTemplate} className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 mr-auto">
                            <Save size={18} /> Lưu thay đổi
                          </Button>
                        )}
                        <Button variant="secondary" onClick={() => setIsLoadTemplateModalOpen(false)}>Đóng</Button>
                        <Button 
                          onClick={handleApplyTemplate} 
                          disabled={!selectedTemplateId || !editingTemplate || editingTemplate.procedures.length === 0 || editingTemplate.procedures.some(tp => procedures.find(p => p.id === tp.procedureId)?.requireMachine && !tp.assignedMachineId)} 
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <CheckCircle2 size={18} /> Áp dụng mẫu
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8 text-center bg-slate-50/50">
             <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl border border-slate-100 mb-6 rotate-3"><User size={40} className="text-slate-200" /></div>
             <p className="font-black text-xl text-slate-400 tracking-tight uppercase">Chọn bệnh nhân để lập lịch</p>
          </div>
        )}
      </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden bg-white rounded-3xl shadow-sm border border-slate-200">
          <MachineShiftManager 
            shifts={machineShifts}
            procedures={procedures}
            staff={staff}
            currentDept={currentDept}
            activeDate={currentDate}
            appointments={appointments}
            attendanceRecords={attendanceRecords}
            onAddShift={onAddShift}
            onUpdateShift={onUpdateShift}
            onDeleteShift={onDeleteShift}
          />
        </div>
      )}
    </div>
  );
};
