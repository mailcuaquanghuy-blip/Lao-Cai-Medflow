
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Staff, Patient, Procedure, Appointment, AppointmentStatus, Department, DepartmentType, AttendanceRecord, AttendanceStatus, ConflictDetail, MachineShift } from '../types';
import { Button } from './Button';

import { checkConflict, addMinutesToTime, calculateAge, findAvailableSlot, timeStringToMinutes, minutesToTimeString, getAvailableTimeBlocks, getRoleLabel, formatDate, getAbbreviation } from '../utils/timeUtils';
// Fix: Added LogOut to lucide-react imports
import { AlertTriangle, Calendar, User, Activity, Search, UserPlus, Zap, Bed, Clock, Info, CheckCircle2, Monitor, Building2, Stethoscope, LogOut, ChevronDown } from 'lucide-react';
import { DEPARTMENTS } from '../constants';
import { TimeInput } from './TimeInput';
import { DateInput } from './DateInput';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apptData: Partial<Appointment>, isRecurring: boolean) => void;
  onAddPatient: (patient: Patient) => void;
  staff: Staff[];
  patients: Patient[];
  procedures: Procedure[];
  appointments: Appointment[];
  attendanceRecords: AttendanceRecord[];
  machineShifts: MachineShift[];
  currentDept: Department;
  initialData?: Partial<Appointment>;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onAddPatient,
  staff,
  patients,
  procedures,
  appointments,
  attendanceRecords,
  machineShifts,
  currentDept,
  initialData,
}) => {
  const [formData, setFormData] = useState<Partial<Appointment>>({
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '08:30',
    status: AppointmentStatus.PENDING,
    assignedMachineId: '',
    ...initialData,
  });
  
  const [conflictData, setConflictData] = useState<{
    hasConflict: boolean;
    conflictDetails: ConflictDetail[];
    assignedMachineId?: string;
    isOvertime: boolean;
    isOutsideOfficeHours: boolean;
  }>({ hasConflict: false, conflictDetails: [], isOvertime: false, isOutsideOfficeHours: false });

  const [isAddingNewPatient, setIsAddingNewPatient] = useState(false);
  const [newPatientData, setNewPatientData] = useState({ name: '', dob: '', bedNumber: '', roomNumber: '' });
  const [bedConflictMsg, setBedConflictMsg] = useState<string | null>(null);
  const [isProcDropdownOpen, setIsProcDropdownOpen] = useState(false);
  const [procSearchTerm, setProcSearchTerm] = useState('');

  const currentProc = useMemo(() => procedures.find(p => p.id === formData.procedureId), [formData.procedureId, procedures]);
  
  const isMachineShiftRequired = useMemo(() => {
    return currentProc?.requireMachine && (currentProc.machineCapacity || 1) > 1;
  }, [currentProc]);

  const availableShifts = useMemo(() => {
    if (!isMachineShiftRequired || !formData.date || !currentProc) return [];
    return machineShifts.filter(s => s.procedureId === currentProc.id && s.date === formData.date);
  }, [isMachineShiftRequired, formData.date, currentProc, machineShifts]);

  const selectedPatient = useMemo(() => patients.find(p => p.id === formData.patientId), [formData.patientId, patients]);
  const patientDept = useMemo(() => DEPARTMENTS.find(d => d.id === selectedPatient?.admittedByDeptId), [selectedPatient]);

  const duplicateBedNumbers = useMemo(() => {
    const counts = new Map<string, number>();
    patients.filter(p => p.status === 'TREATING').forEach(p => {
      const bed = p.bedNumber?.trim();
      if (bed) counts.set(bed, (counts.get(bed) || 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([_, count]) => count > 1).map(([bed]) => bed));
  }, [patients]);

  const isDuplicateBed = selectedPatient && duplicateBedNumbers.has(selectedPatient.bedNumber?.trim());

  // Kiểm tra ngày ra viện
  const isAfterDischarge = useMemo(() => {
    if (selectedPatient?.dischargeDate && formData.date) {
      const dischargeStr = selectedPatient.dischargeDate.split('T')[0];
      return formData.date > dischargeStr;
    }
    return false;
  }, [selectedPatient, formData.date]);

  const eligibleStaff = useMemo(() => {
    const deptStaff = staff.filter(s => s.deptId === currentDept.id);
    if (!formData.procedureId) return deptStaff;
    return deptStaff.filter(s => s.mainCapabilityIds?.includes(formData.procedureId!));
  }, [staff, currentDept.id, formData.procedureId]);

  const eligibleAssistants = useMemo(() => {
    const deptStaff = staff.filter(s => s.deptId === currentDept.id);
    if (!formData.procedureId) return deptStaff;
    return deptStaff.filter(s => s.assistantCapabilityIds?.includes(formData.procedureId!));
  }, [staff, currentDept.id, formData.procedureId]);

  const allDeptMachines = useMemo(() => {
    const machines = new Set<string>();
    procedures.filter(p => p.deptId === currentDept.id).forEach(p => {
      p.availableMachines?.forEach(m => machines.add(m));
    });
    return Array.from(machines).sort();
  }, [procedures, currentDept.id]);

  const availableMachines = useMemo(() => {
    return currentProc?.availableMachines || [];
  }, [currentProc]);

  const filteredProcedures = useMemo(() => {
    let procs = [...procedures];

    if (currentDept.type === DepartmentType.SUPPORT && selectedPatient) {
      const referral = selectedPatient.referrals?.find(r => {
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

      if (referral && referral.procedureIds && referral.procedureIds.length > 0) {
        procs = procs.filter(p => referral.procedureIds!.includes(p.id));
      } else {
        procs = [];
      }
    }

    // Sort procedures: current department first, then others
    return procs.sort((a, b) => {
      const aIsCurrent = a.deptId === currentDept.id;
      const bIsCurrent = b.deptId === currentDept.id;
      
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;
      
      // Secondary sort by name
      return a.name.localeCompare(b.name);
    });
  }, [procedures, currentDept, selectedPatient]);

  useEffect(() => {
    if (isMachineShiftRequired) {
      const shift = machineShifts.find(s => 
        s.procedureId === formData.procedureId && 
        s.date === formData.date && 
        s.startTime <= formData.startTime && 
        s.endTime >= formData.endTime
      );
      if (shift) {
        setFormData(prev => ({
          ...prev,
          assignedMachineId: shift.machineId,
          machineShiftId: shift.id,
          staffId: shift.staffId,
          assistant1Id: shift.assistant1Id || '',
          assistant2Id: shift.assistant2Id || ''
        }));
      }
    }
  }, [isMachineShiftRequired, machineShifts, formData.procedureId, formData.date, formData.startTime, formData.endTime]);

  const availableTimeData = useMemo(() => {
    if (!formData.date || !currentProc || !formData.staffId) return { blocks: [], reason: null };
    return getAvailableTimeBlocks(
      formData.date,
      currentProc,
      formData.staffId,
      formData.patientId,
      appointments,
      staff,
      procedures,
      attendanceRecords,
      patients,
      formData.assistant1Id,
      formData.assistant2Id,
      formData.id,
      formData
    );
  }, [formData.date, currentProc, formData.staffId, formData.patientId, appointments, staff, procedures, attendanceRecords, patients, formData.assistant1Id, formData.assistant2Id, formData.id, formData.assignedMachineId]);

  const availableTimeBlocks = availableTimeData.blocks;
  const unavailableReason = availableTimeData.reason;

  const selectedMachineActiveSlots = useMemo(() => {
    if (!formData.assignedMachineId || !formData.date || !currentProc || (currentProc.machineCapacity || 1) <= 1) return [];
    
    const machineApps = appointments.filter(appt => 
        appt.date === formData.date && 
        appt.id !== formData.id && 
        appt.assignedMachineId === formData.assignedMachineId
    );

    const slotsMap = new Map<string, number>();
    machineApps.forEach(appt => {
      const key = `${appt.startTime} - ${appt.endTime}`;
      slotsMap.set(key, (slotsMap.get(key) || 0) + 1);
    });

    return Array.from(slotsMap.entries()).map(([time, count]) => ({ time, count }));
  }, [formData.assignedMachineId, formData.date, currentProc, appointments, formData.id]);

  const lockedStaff = useMemo(() => {
    if (!formData.assignedMachineId || !formData.date || !formData.startTime || !formData.endTime || !currentProc) return null;
    if ((currentProc.machineCapacity || 1) <= 1) return null;
    
    const existingAppt = appointments.find(a => 
      a.date === formData.date && 
      a.assignedMachineId === formData.assignedMachineId && 
      a.startTime === formData.startTime && 
      a.endTime === formData.endTime &&
      a.id !== formData.id
    );
    
    if (existingAppt) {
      return {
        staffId: existingAppt.staffId,
        assistant1Id: existingAppt.assistant1Id,
        assistant2Id: existingAppt.assistant2Id
      };
    }
    return null;
  }, [formData.assignedMachineId, formData.date, formData.startTime, formData.endTime, currentProc, appointments, formData.id]);

  useEffect(() => {
    if (lockedStaff) {
      setFormData(prev => {
        if (prev.staffId !== lockedStaff.staffId || prev.assistant1Id !== lockedStaff.assistant1Id || prev.assistant2Id !== lockedStaff.assistant2Id) {
          return {
            ...prev,
            staffId: lockedStaff.staffId,
            assistant1Id: lockedStaff.assistant1Id,
            assistant2Id: lockedStaff.assistant2Id
          };
        }
        return prev;
      });
    }
  }, [lockedStaff]);

  useEffect(() => {
    if (formData.procedureId && formData.staffId && formData.date && !formData.id && !initialData?.startTime) {
        const proc = procedures.find(p => p.id === formData.procedureId);
        if (proc) {
            const slot = findAvailableSlot(formData.date, proc, formData.staffId, formData.patientId || '', appointments, staff, procedures, attendanceRecords, patients, formData.assistant1Id, formData.assistant2Id, formData.id, formData);
            if (slot && slot.startTime) {
                setFormData(prev => ({ ...prev, startTime: slot.startTime, endTime: slot.endTime }));
            } else {
                // Set default time to trigger checkConflict and show warnings
                const defaultStart = '07:30';
                const defaultEnd = addMinutesToTime(defaultStart, proc.durationMinutes);
                setFormData(prev => ({ ...prev, startTime: defaultStart, endTime: defaultEnd }));
            }
        }
    }
  }, [formData.procedureId, formData.staffId, formData.date, formData.assistant1Id, formData.assistant2Id]);

  useEffect(() => {
    if (formData.procedureId && formData.startTime) {
      const proc = procedures.find(p => p.id === formData.procedureId);
      if (proc) {
        const calculatedEndTime = addMinutesToTime(formData.startTime, proc.durationMinutes);
        setFormData(prev => ({
          ...prev,
          endTime: calculatedEndTime
        }));
      }
    }
  }, [formData.procedureId, formData.startTime]);

  useEffect(() => {
    if (formData.startTime && formData.endTime && formData.patientId && formData.date) {
      const result = checkConflict(
        formData.startTime,
        formData.endTime,
        formData.date,
        formData.staffId || '',
        formData.patientId,
        appointments,
        staff,
        procedures,
        attendanceRecords,
        patients,
        formData.procedureId,
        formData.id,
        formData.assistant1Id,
        formData.assistant2Id,
        formData
      );
      
      // Merge logic chặn ra viện vào conflict data
      if (isAfterDischarge) {
        result.hasConflict = true;
        result.conflictDetails.push({ message: `Bệnh nhân đã ra viện vào ngày ${new Date(selectedPatient!.dischargeDate!).toLocaleDateString('vi-VN')}. Không thể chỉ định sau ngày này.`, level: 1 });
      }

      if (!formData.staffId) {
        result.hasConflict = true;
        result.conflictDetails.push({ message: `Chưa chọn người thực hiện.`, level: 1 });
      }

      const currentProc = procedures.find(p => p.id === formData.procedureId);
      if (currentProc?.requireMachine && !formData.assignedMachineId && !result.assignedMachineId) {
        result.hasConflict = true;
        result.conflictDetails.push({ message: `Chưa chọn máy thực hiện.`, level: 1 });
      }

      if (formData.staffId && currentProc) {
        const mainStaff = staff.find(s => s.id === formData.staffId);
        if (mainStaff && !mainStaff.mainCapabilityIds?.includes(formData.procedureId || '')) {
          result.hasConflict = true;
          result.conflictDetails.push({ message: `Nhân sự ${mainStaff.name} không phù hợp thực hiện chính thủ thuật này.`, level: 1 });
        }
      }

      if (formData.assistant1Id && currentProc) {
        const asst1 = staff.find(s => s.id === formData.assistant1Id);
        if (asst1 && !asst1.assistantCapabilityIds?.includes(formData.procedureId || '')) {
          result.hasConflict = true;
          result.conflictDetails.push({ message: `Nhân sự ${asst1.name} không phù hợp phụ thủ thuật này.`, level: 1 });
        }
      }

      if (formData.assistant2Id && currentProc) {
        const asst2 = staff.find(s => s.id === formData.assistant2Id);
        if (asst2 && !asst2.assistantCapabilityIds?.includes(formData.procedureId || '')) {
          result.hasConflict = true;
          result.conflictDetails.push({ message: `Nhân sự ${asst2.name} không phù hợp phụ thủ thuật này.`, level: 1 });
        }
      }

      if (formData.assignedMachineId && currentProc) {
        if (!currentProc.availableMachines?.includes(formData.assignedMachineId)) {
          result.hasConflict = true;
          result.conflictDetails.push({ message: `Máy ${formData.assignedMachineId} không phù hợp với thủ thuật này.`, level: 1 });
        }
      }

      setConflictData(result);
      
      if (!formData.assignedMachineId && result.assignedMachineId) {
          setFormData(prev => ({ ...prev, assignedMachineId: result.assignedMachineId }));
      }
    }
  }, [formData.startTime, formData.endTime, formData.staffId, formData.patientId, formData.date, formData.assignedMachineId, isAfterDischarge, selectedPatient, formData.assistant1Id, formData.assistant2Id, formData.mainBusyStart, formData.mainBusyEnd, formData.asst1BusyStart, formData.asst1BusyEnd, formData.asst2BusyStart, formData.asst2BusyEnd]);

  const handleBedCheck = (val: string) => {
    setNewPatientData({ ...newPatientData, bedNumber: val });
    const existing = patients.find(p => p.status === 'TREATING' && p.bedNumber.toUpperCase() === val.toUpperCase());
    if (existing) {
      setBedConflictMsg(`Giường ${val} đã có BN ${existing.name}. Tiếp tục cho nằm ghép?`);
    } else {
      setBedConflictMsg(null);
    }
  };

  const handleCreatePatient = () => {
    const { name, dob, bedNumber, roomNumber } = newPatientData;
    if (!name || !bedNumber) return;
    let finalBed = bedNumber;
    const sameBedPatients = patients.filter(p => p.status === 'TREATING' && p.bedNumber.startsWith(bedNumber));
    if (sameBedPatients.length > 0) {
      const suffix = String.fromCharCode(65 + sameBedPatients.length); 
      finalBed = `${bedNumber}${suffix}`;
    }
    const newId = 'p_' + Math.random().toString(36).substr(2, 5);
    const admissionDate = new Date().toISOString();
    const p: Patient = { id: newId, name, dob: dob || '1990-01-01', code: 'N/A', gender: 'Nam', bedNumber: finalBed, roomNumber, admissionDate, status: 'TREATING', admittedByDeptId: currentDept.id };
    onAddPatient(p);
    setFormData({ ...formData, patientId: newId });
    setIsAddingNewPatient(false);
  };

  const renderFieldWarnings = (keywords: string[]) => {
    const relevantConflicts = conflictData.conflictDetails.filter(d => 
      keywords.some(k => d.message.toLowerCase().includes(k.toLowerCase()))
    );
    if (relevantConflicts.length === 0) return null;
    return (
      <div className="mt-1 space-y-1">
        {relevantConflicts.map((d, i) => (
          <p key={i} className={`text-[10px] font-bold flex items-start gap-1 ${d.level === 1 ? 'text-rose-500' : 'text-amber-500'}`}>
            <AlertTriangle size={10} className="mt-0.5 shrink-0" /> {d.message}
          </p>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[95vh]"
        >
          <div className="bg-white border-b border-slate-100 p-6 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                <Activity className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {formData.id ? 'Cập nhật chỉ định' : 'Chỉ định thủ thuật'}
                </h2>
                <p className="text-sm font-medium text-slate-500">Hệ thống quản lý lâm sàng MedFlow</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600"
            >
              <LogOut className="w-6 h-6 rotate-180" />
            </button>
          </div>

          <form className="p-0 overflow-hidden flex-1 flex flex-col" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-3 divide-x divide-slate-100 flex-1 overflow-hidden">
              {/* CỘT 1: THÔNG TIN BỆNH NHÂN */}
              <div className="flex flex-col overflow-hidden bg-slate-50/50">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <User size={16} className="text-primary" /> Thông tin bệnh nhân
                  </h3>
                  {!isAddingNewPatient && (
                    <button 
                      type="button" 
                      onClick={() => setIsAddingNewPatient(true)} 
                      className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1.5 transition-all bg-primary/5 px-3 py-1.5 rounded-lg"
                    >
                      <UserPlus size={14} /> THÊM MỚI
                    </button>
                  )}
                </div>
                <div className="p-6 space-y-6 overflow-y-auto flex-1 scrollbar-thin">
                  {isAddingNewPatient ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 border border-blue-500 bg-white rounded-2xl space-y-4 shadow-sm shadow-blue-100"
                    >
                      <div className="space-y-2">
                         <label className="text-xs font-semibold text-slate-600">Họ tên bệnh nhân</label>
                         <input 
                           placeholder="Nhập họ và tên..." 
                           className="w-full p-3.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium transition-all bg-slate-50/50" 
                           value={newPatientData.name} 
                           onChange={e => setNewPatientData({...newPatientData, name: e.target.value})} 
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-semibold text-slate-600">Ngày sinh</label>
                         <DateInput 
                           className="w-full p-3.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium bg-slate-50/50" 
                           value={newPatientData.dob} 
                           onChange={val => setNewPatientData({...newPatientData, dob: val})} 
                         />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <label className="text-xs font-semibold text-slate-600">Giường</label>
                           <input 
                             placeholder="Số giường..." 
                             className="w-full p-3.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium bg-slate-50/50" 
                             value={newPatientData.bedNumber} 
                             onChange={e => handleBedCheck(e.target.value)} 
                           />
                         </div>
                         <div className="space-y-2">
                           <label className="text-xs font-semibold text-slate-600">Buồng</label>
                           <input 
                             placeholder="Số buồng..." 
                             className="w-full p-3.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium bg-slate-50/50" 
                             value={newPatientData.roomNumber} 
                             onChange={e => setNewPatientData({...newPatientData, roomNumber: e.target.value})} 
                           />
                         </div>
                      </div>
                      {bedConflictMsg && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium flex items-center gap-2.5">
                          <Info size={16} className="shrink-0" /> {bedConflictMsg}
                        </div>
                      )}
                      <div className="flex gap-3 justify-end pt-2">
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => setIsAddingNewPatient(false)} 
                          className="rounded-xl px-4"
                        >
                          HỦY
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleCreatePatient} 
                          className="rounded-xl px-4"
                        >
                          XÁC NHẬN
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chọn bệnh nhân</label>
                        <div className="relative group">
                          <select 
                            required 
                            className={`w-full p-4 pr-12 border rounded-2xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-semibold text-slate-800 appearance-none transition-all shadow-sm group-hover:border-slate-300 ${formData.patientId ? 'border-blue-500 shadow-sm shadow-blue-100' : 'border-slate-200'}`} 
                            value={formData.patientId || ''} 
                            onChange={e => setFormData({ ...formData, patientId: e.target.value })}
                          >
                            <option value="">-- Tìm kiếm bệnh nhân --</option>
                            {patients
                              .sort((a, b) => {
                                const aIsCurrent = a.admittedByDeptId === currentDept.id;
                                const bIsCurrent = b.admittedByDeptId === currentDept.id;
                                if (aIsCurrent && !bIsCurrent) return -1;
                                if (!aIsCurrent && bIsCurrent) return 1;
                                return a.name.localeCompare(b.name);
                              })
                              .map(p => (
                                <option key={p.id} value={p.id}>{p.name} - {p.bedNumber}</option>
                              ))}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors group-hover:text-primary">
                            <Search size={20} />
                          </div>
                        </div>
                      </div>

                      {selectedPatient && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="grid grid-cols-2 gap-4"
                        >
                          <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-1.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giới tính</p>
                            <p className="text-sm font-semibold text-slate-700">
                              {selectedPatient.gender === 'Nam' ? 'Nam' : 'Nữ'}
                            </p>
                          </div>
                          <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-1.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Khoa điều trị</p>
                            <p className="text-sm font-semibold text-slate-700 truncate" title={patientDept?.name}>{patientDept?.name || 'N/A'}</p>
                          </div>
                          <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-1.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Buồng bệnh</p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-700">{selectedPatient.roomNumber || 'N/A'}</p>
                              {isDuplicateBed && (
                                <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-1.5 rounded border border-rose-100 animate-pulse">TRÙNG GIƯỜNG</span>
                              )}
                            </div>
                          </div>
                          <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-1.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giường bệnh</p>
                            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <Bed size={16} className="text-primary" /> {selectedPatient.bedNumber}
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {/* TỔNG HỢP CẢNH BÁO */}
                      <div className="pt-6 border-t border-slate-100">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-4">
                          <AlertTriangle size={16} className="text-amber-500" /> Kiểm tra an toàn
                        </label>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin pr-2">
                          {conflictData.conflictDetails.length > 0 ? (
                            conflictData.conflictDetails.map((d, i) => (
                              <motion.div 
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                key={i} 
                                className={`p-4 rounded-2xl text-xs font-medium flex items-start gap-3 shadow-sm border ${d.level === 1 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}
                              >
                                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                                <span className="leading-relaxed">{d.message}</span>
                              </motion.div>
                            ))
                          ) : (
                            <div className="p-5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl text-xs font-medium flex items-center gap-3 shadow-sm">
                              <CheckCircle2 size={20} className="shrink-0" /> 
                              <span>Hệ thống không phát hiện xung đột. Có thể thực hiện chỉ định.</span>
                            </div>
                          )}
                          {conflictData.isOutsideOfficeHours && (
                            <div className="p-4 bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl text-xs font-medium flex items-center gap-3 shadow-sm">
                              <Clock size={18} className="shrink-0" /> Ngoài giờ hành chính.
                            </div>
                          )}
                          {conflictData.isOvertime && (
                            <div className="p-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-xs font-medium flex items-center gap-3 shadow-sm">
                              <Clock size={18} className="shrink-0" /> Ngoài giờ làm việc bệnh viện (7h-18h).
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* CỘT 2: CHỈ ĐỊNH THỦ THUẬT */}
              <div className="flex flex-col overflow-hidden bg-white">
                <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Activity size={16} className="text-primary" /> Chỉ định thủ thuật
                  </h3>
                </div>
                <div className="p-6 space-y-8 overflow-y-auto flex-1 scrollbar-thin">
                  {/* Nhóm 1: Thông tin cơ bản */}
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Khoa thực hiện</label>
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-slate-700 text-sm flex items-center gap-3 shadow-sm">
                        <Building2 size={18} className="text-primary/60" /> {currentDept.name}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tên thủ thuật</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsProcDropdownOpen(!isProcDropdownOpen)}
                          className={`w-full p-4 border rounded-2xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-semibold text-sm transition-all hover:border-slate-300 flex items-center justify-between shadow-sm ${currentProc && currentProc.deptId === currentDept.id ? 'border-blue-500 shadow-sm shadow-blue-100' : 'border-slate-200'}`}
                        >
                          <div className="flex items-center gap-2">
                            {currentProc ? (
                              <>
                                <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black bg-primary/10 text-primary">{getAbbreviation(currentProc.name)}</div>
                                <span>{currentProc.name}</span>
                              </>
                            ) : (
                              <span className="text-slate-400">-- Chọn thủ thuật --</span>
                            )}
                          </div>
                          <ChevronDown size={18} className={`text-slate-400 transition-transform ${isProcDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                          {isProcDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 z-[60] overflow-hidden flex flex-col max-h-[300px]"
                            >
                              <div className="p-3 border-b border-slate-50 sticky top-0 bg-white z-10">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                  <input
                                    autoFocus
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-primary transition-all"
                                    placeholder="Tìm thủ thuật..."
                                    value={procSearchTerm}
                                    onChange={e => setProcSearchTerm(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="overflow-y-auto scrollbar-thin">
                                {filteredProcedures.filter(p => p.deptId === currentDept.id && p.name.toLowerCase().includes(procSearchTerm.toLowerCase())).length > 0 ? (
                                  filteredProcedures.filter(p => p.deptId === currentDept.id && p.name.toLowerCase().includes(procSearchTerm.toLowerCase())).map(p => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => {
                                        setFormData({ ...formData, procedureId: p.id, staffId: '', assistant1Id: '', assistant2Id: '', assignedMachineId: '', machineShiftId: undefined });
                                        setIsProcDropdownOpen(false);
                                        setProcSearchTerm('');
                                      }}
                                      className={`w-full p-4 text-left hover:bg-slate-50 flex items-center gap-3 transition-all ${formData.procedureId === p.id ? 'bg-primary/5 text-primary' : 'text-slate-700'}`}
                                    >
                                      <div className={`p-2 rounded-lg flex items-center justify-center text-[10px] font-black w-8 h-8 ${formData.procedureId === p.id ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                                        {getAbbreviation(p.name)}
                                      </div>
                                      <span className="text-sm font-bold">{p.name}</span>
                                    </button>
                                  ))
                                ) : (
                                  <div className="p-8 text-center text-slate-400 italic text-xs font-bold">Không tìm thấy thủ thuật</div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    {currentProc?.requireMachine && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          <Monitor size={14} className="text-primary" /> Máy thực hiện
                        </label>
                        <div className="relative group">
                          <select 
                            className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-semibold text-sm transition-all hover:border-slate-300 appearance-none shadow-sm disabled:bg-slate-50" 
                            value={formData.assignedMachineId || ''} 
                            onChange={e => setFormData({ ...formData, assignedMachineId: e.target.value })}
                            disabled={isMachineShiftRequired}
                          >
                            <option value="">-- Chọn máy --</option>
                            {formData.procedureId && availableMachines.length > 0 ? (
                              availableMachines.map(mCode => {
                                const isSuggested = conflictData.assignedMachineId === mCode;
                                let label = mCode;
                                if (isSuggested) label += ` - Gợi ý`;
                                return <option key={mCode} value={mCode}>{label}</option>;
                              })
                            ) : formData.procedureId ? (
                              <option value="" disabled>Không có máy cho thủ thuật này</option>
                            ) : (
                              <option value="" disabled>Vui lòng chọn thủ thuật trước</option>
                            )}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-primary transition-colors">
                            <Monitor size={18} />
                          </div>
                          {isMachineShiftRequired && (
                            <div className="absolute right-12 top-1/2 -translate-y-1/2 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight border border-amber-200">Theo ca máy</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Nhóm 2: Đội ngũ thực hiện */}
                  <div className="pt-8 border-t border-slate-100 space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đội ngũ thực hiện</h4>
                      <div className="h-px flex-1 bg-slate-100 ml-4"></div>
                    </div>
                    
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          <Stethoscope size={14} className="text-primary" /> Người thực hiện chính
                        </label>
                        <div className="relative group">
                          <select 
                            required 
                            className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-semibold text-sm disabled:bg-slate-50 transition-all hover:border-slate-300 appearance-none shadow-sm" 
                            value={formData.staffId || ''} 
                            onChange={e => setFormData({ ...formData, staffId: e.target.value })} 
                            disabled={!formData.procedureId || !!lockedStaff?.staffId || isMachineShiftRequired}
                          >
                            <option value="">-- Chọn nhân sự --</option>
                            {eligibleStaff.map(s => {
                              let label = `${s.name} (${getRoleLabel(s.role)})`;
                              return <option key={s.id} value={s.id}>{label}</option>;
                            })}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-primary transition-colors">
                            <Stethoscope size={18} />
                          </div>
                          {(lockedStaff?.staffId || isMachineShiftRequired) && (
                            <div className="absolute right-12 top-1/2 -translate-y-1/2 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight border border-amber-200">Đã khóa</div>
                          )}
                        </div>
                      </div>

                      {currentProc && (
                        <div className="grid grid-cols-2 gap-5">
                          {((currentProc.asst1BusyEnd !== undefined && currentProc.asst1BusyEnd > 0) || (currentProc.assistant1BusyMinutes !== undefined && currentProc.assistant1BusyMinutes > 0)) && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                <User size={14} className="text-primary" /> Người phụ 1
                              </label>
                              <div className="relative group">
                                <select 
                                  className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-semibold text-sm disabled:bg-slate-50 transition-all hover:border-slate-300 appearance-none shadow-sm" 
                                  value={formData.assistant1Id || ''} 
                                  onChange={e => setFormData({ ...formData, assistant1Id: e.target.value })} 
                                  disabled={!formData.procedureId || !!lockedStaff?.assistant1Id || isMachineShiftRequired}
                                >
                                  <option value="">-- Chọn người phụ 1 --</option>
                                  {eligibleAssistants.filter(s => s.id !== formData.staffId && s.id !== formData.assistant2Id).map(s => {
                                    let label = `${s.name} (${getRoleLabel(s.role)})`;
                                    return <option key={s.id} value={s.id}>{label}</option>;
                                  })}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-primary transition-colors">
                                  <User size={18} />
                                </div>
                                {(lockedStaff?.assistant1Id || isMachineShiftRequired) && (
                                  <div className="absolute right-12 top-1/2 -translate-y-1/2 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight border border-amber-200">Đã khóa</div>
                                )}
                              </div>
                            </div>
                          )}
                          {((currentProc.asst2BusyEnd !== undefined && currentProc.asst2BusyEnd > 0) || (currentProc.assistant2BusyMinutes !== undefined && currentProc.assistant2BusyMinutes > 0)) && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                <User size={14} className="text-primary" /> Người phụ 2
                              </label>
                              <div className="relative group">
                                <select 
                                  className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-semibold text-sm disabled:bg-slate-50 transition-all hover:border-slate-300 appearance-none shadow-sm" 
                                  value={formData.assistant2Id || ''} 
                                  onChange={e => setFormData({ ...formData, assistant2Id: e.target.value })} 
                                  disabled={!formData.procedureId || !!lockedStaff?.assistant2Id || isMachineShiftRequired}
                                >
                                  <option value="">-- Chọn người phụ 2 --</option>
                                  {eligibleAssistants.filter(s => s.id !== formData.staffId && s.id !== formData.assistant1Id).map(s => {
                                    let label = `${s.name} (${getRoleLabel(s.role)})`;
                                    return <option key={s.id} value={s.id}>{label}</option>;
                                  })}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-primary transition-colors">
                                  <User size={18} />
                                </div>
                                {(lockedStaff?.assistant2Id || isMachineShiftRequired) && (
                                  <div className="absolute right-12 top-1/2 -translate-y-1/2 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight border border-amber-200">Đã khóa</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* CỘT 3: THỜI GIAN THỰC HIỆN */}
              <div className="flex flex-col overflow-hidden bg-slate-50/50">
                <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Clock size={16} className="text-primary" /> Thời gian thực hiện
                  </h3>
                </div>
                <div className="p-6 space-y-8 overflow-y-auto flex-1 scrollbar-thin">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Ngày thực hiện</label>
                    <DateInput 
                      className="w-full p-4 border border-slate-200 rounded-2xl bg-white font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm shadow-sm transition-all hover:border-slate-300" 
                      value={formData.date} 
                      onChange={val => setFormData({ ...formData, date: val })} 
                    />
                  </div>

                  {/* Khung giờ trống */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                      <Zap size={16} className="text-emerald-500" /> Khung giờ trống gợi ý
                    </label>
                    <div className="p-5 bg-white border border-emerald-100 rounded-2xl shadow-sm">
                      {!formData.staffId ? (
                        <p className="text-xs text-amber-600 font-medium italic flex items-center gap-2">
                          <Info size={14} /> Chọn nhân sự để xem gợi ý...
                        </p>
                      ) : availableTimeBlocks.length > 0 ? (
                        <div className="flex flex-wrap gap-2.5">
                          {availableTimeBlocks.slice(0, 8).map((block, idx) => (
                            <button 
                              key={idx} 
                              type="button" 
                              onClick={() => setFormData(prev => ({ ...prev, startTime: block.start, endTime: addMinutesToTime(block.start, currentProc?.durationMinutes || 30) }))} 
                              className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm active:scale-95"
                            >
                              {block.start}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-rose-500 font-medium italic flex items-center gap-2">
                          <AlertTriangle size={14} /> Không có khung giờ trống phù hợp.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ca máy */}
                  {isMachineShiftRequired && (
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Monitor size={16} className="text-indigo-500" /> Ca làm việc của máy
                      </label>
                      <div className="p-5 bg-white border border-indigo-100 rounded-2xl shadow-sm">
                        <div className="flex flex-wrap gap-2.5">
                          {availableShifts.map((shift) => {
                            const shiftAppts = appointments.filter(a => a.machineShiftId === shift.id && a.id !== formData.id);
                            const isFull = shiftAppts.length >= (currentProc?.machineCapacity || 1);
                            const isSelected = formData.machineShiftId === shift.id;
                            return (
                              <button 
                                key={shift.id} 
                                type="button" 
                                disabled={isFull} 
                                onClick={() => {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    machineShiftId: shift.id,
                                    assignedMachineId: shift.machineId,
                                    startTime: shift.startTime, 
                                    endTime: shift.endTime,
                                    staffId: shift.staffId,
                                    assistant1Id: shift.assistant1Id || undefined,
                                    assistant2Id: shift.assistant2Id || undefined
                                  }));
                                }} 
                                className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex flex-col items-start gap-1 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : isFull ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'}`}
                              >
                                <span>{shift.startTime} - {shift.endTime} <span className="opacity-60 ml-1">({shiftAppts.length}/{currentProc?.machineCapacity})</span></span>
                                <span className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-indigo-400'}`}>
                                  Máy: {shift.machineId}
                                </span>
                              </button>
                            );
                          })}
                          {availableShifts.length === 0 && <p className="text-xs text-slate-400 italic font-medium">Chưa có ca nào được tạo cho ngày này.</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {!isMachineShiftRequired && formData.assignedMachineId && selectedMachineActiveSlots.length > 0 && (
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Monitor size={16} className="text-indigo-500" /> Ca làm việc của máy
                      </label>
                      <div className="p-5 bg-white border border-indigo-100 rounded-2xl shadow-sm">
                        <div className="flex flex-wrap gap-2.5">
                          {selectedMachineActiveSlots.map((slot, idx) => {
                            const isFull = slot.count >= (currentProc?.machineCapacity || 1);
                            const isSelected = formData.startTime + ' - ' + formData.endTime === slot.time;
                            return (
                              <button 
                                key={idx} 
                                type="button" 
                                disabled={isFull} 
                                onClick={() => {
                                  const [start, end] = slot.time.split(' - ');
                                  const existingAppt = appointments.find(a => a.date === formData.date && a.assignedMachineId === formData.assignedMachineId && a.startTime === start && a.endTime === end && a.id !== formData.id);
                                  setFormData(prev => ({ ...prev, startTime: start, endTime: end, ...(existingAppt ? { staffId: existingAppt.staffId, assistant1Id: existingAppt.assistant1Id, assistant2Id: existingAppt.assistant2Id } : {}) }));
                                }} 
                                className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : isFull ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'}`}
                              >
                                {slot.time} <span className="opacity-60 ml-1">({slot.count}/{currentProc?.machineCapacity})</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Giờ bắt đầu</label>
                      <TimeInput 
                        className={`w-full p-4 border border-slate-200 rounded-2xl bg-white font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm shadow-sm transition-all hover:border-slate-300 ${isMachineShiftRequired ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`} 
                        value={formData.startTime} 
                        onChange={val => !isMachineShiftRequired && setFormData({ ...formData, startTime: val })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Giờ kết thúc</label>
                      <TimeInput 
                        className={`w-full p-4 border border-slate-200 rounded-2xl bg-white font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm shadow-sm transition-all hover:border-slate-300 ${isMachineShiftRequired ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`} 
                        value={formData.endTime} 
                        onChange={val => !isMachineShiftRequired && setFormData({ ...formData, endTime: val })} 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Thời gian nghỉ sau TT (phút)</label>
                    <input 
                      type="number" 
                      className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-semibold text-sm shadow-sm transition-all hover:border-slate-300" 
                      value={formData.restMinutes ?? currentProc?.restMinutes ?? 0} 
                      onChange={e => setFormData({...formData, restMinutes: Number(e.target.value)})} 
                    />
                  </div>

                  {currentProc && (
                    <div className="space-y-6 pt-8 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thời gian bận nhân sự (phút)</label>
                        <div className="h-px flex-1 bg-slate-100 ml-4"></div>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-bold text-slate-400 w-16 uppercase tracking-widest">CHÍNH:</span>
                          <div className="flex-1 flex gap-4">
                            <div className="flex-1 space-y-1.5">
                              <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Từ</p>
                              <input type="number" className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none shadow-sm transition-all hover:border-slate-300" placeholder="0" value={formData.mainBusyStart ?? currentProc.mainBusyStart ?? 0} onChange={e => setFormData({...formData, mainBusyStart: Number(e.target.value)})} />
                            </div>
                            <div className="flex-1 space-y-1.5">
                              <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Đến</p>
                              <input type="number" className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none shadow-sm transition-all hover:border-slate-300" placeholder="30" value={formData.mainBusyEnd ?? currentProc.mainBusyEnd ?? currentProc.busyMinutes ?? currentProc.durationMinutes} onChange={e => setFormData({...formData, mainBusyEnd: Number(e.target.value)})} />
                            </div>
                          </div>
                        </div>
                        {((currentProc.asst1BusyEnd !== undefined && currentProc.asst1BusyEnd > 0) || (currentProc.assistant1BusyMinutes !== undefined && currentProc.assistant1BusyMinutes > 0)) && (
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold text-slate-400 w-16 uppercase tracking-widest">PHỤ 1:</span>
                            <div className="flex-1 flex gap-4">
                              <div className="flex-1 space-y-1.5">
                                <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Từ</p>
                                <input type="number" className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none shadow-sm transition-all hover:border-slate-300" placeholder="0" value={formData.asst1BusyStart ?? currentProc.asst1BusyStart ?? 0} onChange={e => setFormData({...formData, asst1BusyStart: Number(e.target.value)})} />
                              </div>
                              <div className="flex-1 space-y-1.5">
                                <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Đến</p>
                                <input type="number" className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none shadow-sm transition-all hover:border-slate-300" placeholder="0" value={formData.asst1BusyEnd ?? currentProc.asst1BusyEnd ?? currentProc.assistant1BusyMinutes ?? 0} onChange={e => setFormData({...formData, asst1BusyEnd: Number(e.target.value)})} />
                              </div>
                            </div>
                          </div>
                        )}
                        {((currentProc.asst2BusyEnd !== undefined && currentProc.asst2BusyEnd > 0) || (currentProc.assistant2BusyMinutes !== undefined && currentProc.assistant2BusyMinutes > 0)) && (
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold text-slate-400 w-16 uppercase tracking-widest">PHỤ 2:</span>
                            <div className="flex-1 flex gap-4">
                              <div className="flex-1 space-y-1.5">
                                <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Từ</p>
                                <input type="number" className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none shadow-sm transition-all hover:border-slate-300" placeholder="0" value={formData.asst2BusyStart ?? currentProc.asst2BusyStart ?? 0} onChange={e => setFormData({...formData, asst2BusyStart: Number(e.target.value)})} />
                              </div>
                              <div className="flex-1 space-y-1.5">
                                <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Đến</p>
                                <input type="number" className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none shadow-sm transition-all hover:border-slate-300" placeholder="0" value={formData.asst2BusyEnd ?? currentProc.asst2BusyEnd ?? currentProc.assistant2BusyMinutes ?? 0} onChange={e => setFormData({...formData, asst2BusyEnd: Number(e.target.value)})} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white flex gap-4 justify-end shrink-0 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
              <button 
                type="button" 
                onClick={onClose} 
                className="px-8 py-3 text-slate-500 font-bold text-xs hover:text-slate-800 transition-all uppercase tracking-widest hover:bg-slate-50 rounded-xl"
              >
                HỦY BỎ
              </button>
              <Button 
                onClick={() => {
                  const finalData = { ...formData };
                  if (currentProc) {
                    if (finalData.mainBusyStart === undefined) finalData.mainBusyStart = currentProc.mainBusyStart ?? 0;
                    if (finalData.mainBusyEnd === undefined) finalData.mainBusyEnd = currentProc.mainBusyEnd ?? currentProc.busyMinutes ?? currentProc.durationMinutes;
                    if (finalData.asst1BusyStart === undefined) finalData.asst1BusyStart = currentProc.asst1BusyStart ?? 0;
                    if (finalData.asst1BusyEnd === undefined) finalData.asst1BusyEnd = currentProc.asst1BusyEnd ?? currentProc.assistant1BusyMinutes ?? 0;
                    if (finalData.asst2BusyStart === undefined) finalData.asst2BusyStart = currentProc.asst2BusyStart ?? 0;
                    if (finalData.asst2BusyEnd === undefined) finalData.asst2BusyEnd = currentProc.asst2BusyEnd ?? currentProc.assistant2BusyMinutes ?? 0;
                    if (finalData.restMinutes === undefined) finalData.restMinutes = currentProc.restMinutes ?? 0;
                  }
                  onSave(finalData, false);
                }} 
                disabled={!formData.patientId || !formData.procedureId || !formData.staffId || (isMachineShiftRequired && !formData.machineShiftId) || (currentProc?.requireMachine && !formData.assignedMachineId)} 
                className="px-12 h-14 rounded-2xl shadow-xl shadow-primary/20 text-sm font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                XÁC NHẬN CHỈ ĐỊNH
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
