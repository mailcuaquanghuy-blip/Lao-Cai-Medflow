
import { Appointment, AttendanceRecord, AttendanceStatus, Staff, Procedure, Patient, ConflictDetail, DepartmentType } from '../types';
import { BUSINESS_HOURS, OFFICE_SHIFTS, DEPARTMENTS } from '../constants';

export const minutesToPixels = (minutes: number, pixelsPerMinute: number = 2) => {
  return minutes * pixelsPerMinute;
};

export const timeStringToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const minutesToTimeString = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const isInsideOfficeHours = (startMin: number, endMin: number): boolean => {
  return OFFICE_SHIFTS.some(shift => {
    const shiftStart = timeStringToMinutes(shift.start);
    const shiftEnd = timeStringToMinutes(shift.end);
    return startMin >= shiftStart && endMin <= shiftEnd;
  });
};

// ConflictDetail is now imported from types.ts

export const getRoleLabel = (role: string) => {
    switch(role) {
        case 'Doctor': return 'Bác sĩ';
        case 'Technician': return 'KTV';
        case 'Nurse': return 'Điều dưỡng';
        case 'PhysicianAssistant': return 'Y sĩ';
        case 'Pharmacist': return 'Dược sĩ';
        default: return role;
    }
}

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  if (dateStr.includes('/')) return dateStr; // Already formatted
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

export const checkConflict = (
  newStart: string,
  newEnd: string,
  newDate: string,
  staffId: string,
  patientId: string | undefined,
  existingAppointments: Appointment[],
  staffList: Staff[],
  procedures: Procedure[],
  attendanceRecords: AttendanceRecord[],
  patients: Patient[],
  procedureId?: string,
  excludeAppointmentId?: string,
  assistant1Id?: string | null,
  assistant2Id?: string | null,
  newApptData?: Partial<Appointment>
): { hasConflict: boolean; reason: string | null; conflictDetails: ConflictDetail[]; assignedMachineId?: string; isOvertime: boolean; isOutsideOfficeHours: boolean } => {
  const startMin = timeStringToMinutes(newStart);
  const endMin = timeStringToMinutes(newEnd);
  const currentProc = procedures.find(p => p.id === procedureId);
  const staff = staffList.find(s => s.id === staffId);
  
  const conflictDetails: ConflictDetail[] = [];

  // Referral check for SUPPORT departments
  if (patientId && procedureId) {
    const currentPatient = patients.find(p => p.id === patientId);
    const proc = procedures.find(p => p.id === procedureId);
    if (currentPatient && proc) {
      const procDept = DEPARTMENTS.find(d => d.id === proc.deptId);
      if (procDept && procDept.type === DepartmentType.SUPPORT) {
        const referral = currentPatient.referrals?.find(r => {
          const s = (r.specialty || '').toLowerCase();
          const dId = procDept.id.toLowerCase();
          const dName = procDept.name.toLowerCase();
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
        if (!referral || !referral.procedureIds?.includes(procedureId)) {
          conflictDetails.push({ message: `Khoa lâm sàng chưa chỉ định thủ thuật này cho bệnh nhân.`, level: 1 });
        }
      }
    }
  }

  // Bed conflict check
  if (patientId && patients.length > 0) {
    const currentPatient = patients.find(p => p.id === patientId);
    if (currentPatient) {
      // Check admission date
      if (currentPatient.admissionDate) {
        const admissionDateObj = new Date(currentPatient.admissionDate);
        const apptDateObj = new Date(`${newDate}T${newStart}:00`);
        if (apptDateObj < admissionDateObj) {
          conflictDetails.push({ message: `Bệnh nhân chưa vào viện vào thời điểm này (Vào viện: ${admissionDateObj.toLocaleString('vi-VN')}).`, level: 1 });
        }
      }

      // Check discharge date
      if (currentPatient.dischargeDate) {
        const dischargeDateObj = new Date(currentPatient.dischargeDate);
        const apptDateObj = new Date(`${newDate}T${newEnd}:00`);
        if (apptDateObj > dischargeDateObj) {
          conflictDetails.push({ message: `Bệnh nhân đã ra viện vào thời điểm này (Ra viện: ${dischargeDateObj.toLocaleString('vi-VN')}).`, level: 1 });
        }
      }

      if (currentPatient.bedNumber) {
        const bedNumber = currentPatient.bedNumber;
        const roomNumber = currentPatient.roomNumber;
        
        const bedConflictAppt = existingAppointments.find(appt => {
          if (appt.date !== newDate || appt.id === excludeAppointmentId || appt.patientId === patientId) return false;
          
          const otherPatient = patients.find(p => p.id === appt.patientId);
          if (!otherPatient) return false;
          
          if (otherPatient.bedNumber === bedNumber && otherPatient.roomNumber === roomNumber && otherPatient.admittedByDeptId === currentPatient.admittedByDeptId) {
            const apptStart = timeStringToMinutes(appt.startTime);
            const apptEnd = timeStringToMinutes(appt.endTime);
            return Math.max(startMin, apptStart) < Math.min(endMin, apptEnd);
          }
          return false;
        });
        
        if (bedConflictAppt) {
          const otherPatient = patients.find(p => p.id === bedConflictAppt.patientId);
          conflictDetails.push({ message: `Trùng giường: Bệnh nhân "${otherPatient?.name}" cũng đang có thủ thuật tại giường này (${bedConflictAppt.startTime}-${bedConflictAppt.endTime}).`, level: 1 });
        }
      }
    }
  }
  
  // Kiểm tra giờ hoạt động của bệnh viện (7h-18h)
  const workdayStartMin = BUSINESS_HOURS.start * 60;
  const workdayEndMin = BUSINESS_HOURS.end * 60;
  const isOvertime = startMin < workdayStartMin || endMin > workdayEndMin;

  if (isOvertime) {
    conflictDetails.push({ message: `Ngoài giờ làm việc của bệnh viện (${BUSINESS_HOURS.start}h - ${BUSINESS_HOURS.end}h).`, level: 2 });
  }

  // Kiểm tra giờ hành chính (7h30-11h30, 13h30-17h30)
  const isOutsideOfficeHours = !isInsideOfficeHours(startMin, endMin);

  if (isOutsideOfficeHours && !isOvertime) {
    conflictDetails.push({ message: `Ngoài giờ hành chính.`, level: 2 });
  }

  if (!staffId) {
    conflictDetails.push({ message: `Chưa chọn người thực hiện.`, level: 1 });
  } else if (staff && procedureId && !staff.mainCapabilityIds?.includes(procedureId)) {
    conflictDetails.push({ message: `${getRoleLabel(staff.role)} ${staff.name} không có kỹ năng thực hiện chính thủ thuật này.`, level: 1 });
  }

  if (assistant1Id && procedureId) {
    const a1 = staffList.find(s => s.id === assistant1Id);
    if (a1 && !a1.assistantCapabilityIds?.includes(procedureId)) {
      conflictDetails.push({ message: `Người phụ 1 (${getRoleLabel(a1.role)} ${a1.name}) không có kỹ năng phụ thủ thuật này.`, level: 1 });
    }
  }

  if (assistant2Id && procedureId) {
    const a2 = staffList.find(s => s.id === assistant2Id);
    if (a2 && !a2.assistantCapabilityIds?.includes(procedureId)) {
      conflictDetails.push({ message: `Người phụ 2 (${getRoleLabel(a2.role)} ${a2.name}) không có kỹ năng phụ thủ thuật này.`, level: 1 });
    }
  }

  const checkStaffAttendance = (id: string, name: string, role: string) => {
    const attendance = attendanceRecords.find(r => r.staffId === id && r.date === newDate);
    if (attendance) {
      const morningEndMin = 12 * 60;
      const afternoonStartMin = 13 * 60 + 30; // 13:30

      if (attendance.status === AttendanceStatus.OFF_FULL) {
        conflictDetails.push({ message: `${getRoleLabel(role)} ${name} nghỉ làm cả ngày ${newDate}.`, level: 1 });
      } else if (attendance.status === AttendanceStatus.OFF_MORNING && startMin < morningEndMin) {
        conflictDetails.push({ message: `${getRoleLabel(role)} ${name} nghỉ buổi sáng.`, level: 1 });
      } else if (attendance.status === AttendanceStatus.OFF_AFTERNOON && endMin > afternoonStartMin) {
        conflictDetails.push({ message: `${getRoleLabel(role)} ${name} nghỉ buổi chiều.`, level: 1 });
      }
    }
  };

  if (staff) checkStaffAttendance(staff.id, staff.name, staff.role);
  if (assistant1Id) {
    const a1 = staffList.find(s => s.id === assistant1Id);
    if (a1) checkStaffAttendance(a1.id, a1.name, a1.role);
  }
  if (assistant2Id) {
    const a2 = staffList.find(s => s.id === assistant2Id);
    if (a2) checkStaffAttendance(a2.id, a2.name, a2.role);
  }

  // Machine conflict check
  let assignedMachineId: string | undefined = newApptData?.assignedMachineId;
  
  if (currentProc?.requireMachine) {
    if (currentProc.availableMachines?.length) {
      const capacity = currentProc.machineCapacity || 1;
    
      // If a specific machine is requested (from UI), check only that machine
      if (assignedMachineId) {
         if (!currentProc.availableMachines.includes(assignedMachineId)) {
            conflictDetails.push({ message: `Máy ${assignedMachineId} không phù hợp cho thủ thuật này.`, level: 1 });
         }

         const machineApps = existingAppointments.filter(appt => 
            appt.date === newDate && 
            appt.id !== excludeAppointmentId && 
            appt.assignedMachineId === assignedMachineId
         );

         if (capacity > 1) {
            // For multi-capacity, appointments must have EXACT same start/end time
            // Check for any appointment on this machine that overlaps but has different time
            const invalidOverlap = machineApps.find(appt => {
               const apptStart = timeStringToMinutes(appt.startTime);
               const apptEnd = timeStringToMinutes(appt.endTime);
               const isOverlapping = Math.max(startMin, apptStart) < Math.min(endMin, apptEnd);
               
               // If overlapping but time is different => Conflict
               return isOverlapping && (apptStart !== startMin || apptEnd !== endMin);
            });

            if (invalidOverlap) {
               const otherPatient = patients.find(p => p.id === invalidOverlap.patientId);
               conflictDetails.push({ message: `Máy ${assignedMachineId} có sức chứa > 1 nhưng đang có ca của BN "${otherPatient?.name || 'khác'}" khác giờ (${invalidOverlap.startTime}-${invalidOverlap.endTime}). Phải xếp cùng khung giờ.`, level: 1 });
            } else {
               // Count valid concurrent appointments (same time)
               const concurrentCount = machineApps.filter(appt => {
                  const apptStart = timeStringToMinutes(appt.startTime);
                  const apptEnd = timeStringToMinutes(appt.endTime);
                  return apptStart === startMin && apptEnd === endMin;
               }).length;

               if (concurrentCount >= capacity) {
                  conflictDetails.push({ message: `Máy ${assignedMachineId} đã đầy (${concurrentCount}/${capacity} chỗ).`, level: 1 });
               }
            }
         } else {
            // Capacity = 1: Any overlap is a conflict
            const overlappingAppt = machineApps.find(appt => {
               const apptStart = timeStringToMinutes(appt.startTime);
               const apptEnd = timeStringToMinutes(appt.endTime);
               return Math.max(startMin, apptStart) < Math.min(endMin, apptEnd);
            });

            if (overlappingAppt) {
               const otherPatient = patients.find(p => p.id === overlappingAppt.patientId);
               conflictDetails.push({ message: `Máy ${assignedMachineId} đang được sử dụng bởi BN "${otherPatient?.name || 'khác'}" trong khung giờ này.`, level: 1 });
            }
         }
      } else {
         // Auto-assign logic (if no machine selected yet)
         // Find a machine that fits
         let foundMachine = false;
         for (const machineCode of currentProc.availableMachines) {
            const machineApps = existingAppointments.filter(appt => 
               appt.date === newDate && 
               appt.id !== excludeAppointmentId && 
               appt.assignedMachineId === machineCode
            );

            if (capacity > 1) {
               // Check for invalid overlaps first
               const hasInvalidOverlap = machineApps.some(appt => {
                  const apptStart = timeStringToMinutes(appt.startTime);
                  const apptEnd = timeStringToMinutes(appt.endTime);
                  const isOverlapping = Math.max(startMin, apptStart) < Math.min(endMin, apptEnd);
                  return isOverlapping && (apptStart !== startMin || apptEnd !== endMin);
               });

               if (!hasInvalidOverlap) {
                  const concurrentCount = machineApps.filter(appt => {
                     const apptStart = timeStringToMinutes(appt.startTime);
                     const apptEnd = timeStringToMinutes(appt.endTime);
                     return apptStart === startMin && apptEnd === endMin;
                  }).length;

                  if (concurrentCount < capacity) {
                     assignedMachineId = machineCode;
                     foundMachine = true;
                     break;
                  }
               }
            } else {
               const hasOverlap = machineApps.some(appt => {
                  const apptStart = timeStringToMinutes(appt.startTime);
                  const apptEnd = timeStringToMinutes(appt.endTime);
                  return Math.max(startMin, apptStart) < Math.min(endMin, apptEnd);
               });

               if (!hasOverlap) {
                  assignedMachineId = machineCode;
                  foundMachine = true;
                  break;
               }
            }
         }

         if (!foundMachine) {
            conflictDetails.push({ message: `Hết máy thực hiện (Tất cả máy thuộc loại này đều đã đầy hoặc không phù hợp khung giờ).`, level: 1 });
         }
      }
    } else {
      conflictDetails.push({ message: `Thủ thuật yêu cầu máy nhưng chưa có máy nào được cấu hình.`, level: 1 });
    }
  }

  if (currentProc?.isPreRequisite) {
    const hasPriorAppt = existingAppointments.some(appt => {
      if (appt.date !== newDate || appt.id === excludeAppointmentId || appt.patientId !== patientId) return false;
      const apptProc = procedures.find(p => p.id === appt.procedureId);
      if (apptProc?.isIndependent) return false;
      const apptStart = timeStringToMinutes(appt.startTime);
      return apptStart < startMin;
    });
    if (hasPriorAppt) {
      conflictDetails.push({ message: `Thủ thuật này bắt buộc phải làm trước các thủ thuật khác.`, level: 1 });
    }
  }

  if (currentProc?.isPostRequisite) {
    const hasSubsequentAppt = existingAppointments.some(appt => {
      if (appt.date !== newDate || appt.id === excludeAppointmentId || appt.patientId !== patientId) return false;
      const apptProc = procedures.find(p => p.id === appt.procedureId);
      if (apptProc?.isIndependent) return false;
      const apptStart = timeStringToMinutes(appt.startTime);
      return apptStart > startMin;
    });
    if (hasSubsequentAppt) {
      conflictDetails.push({ message: `Thủ thuật này bắt buộc phải làm sau cùng.`, level: 1 });
    }
  }

  for (const appt of existingAppointments) {
    if (appt.date !== newDate || appt.id === excludeAppointmentId) continue;

    const apptStart = timeStringToMinutes(appt.startTime);
    const apptEnd = timeStringToMinutes(appt.endTime);
    const apptProc = procedures.find(p => p.id === appt.procedureId);

    if (patientId && appt.patientId === patientId) {
      // Cảnh báo nếu chỉ định cùng một thủ thuật 2 lần trong ngày
      if (appt.procedureId === procedureId) {
        conflictDetails.push({ message: `Bệnh nhân đã được chỉ định thủ thuật "${apptProc?.name}" vào lúc ${appt.startTime}.`, level: 1 });
      }

      // Bỏ qua kiểm tra trùng lịch bệnh nhân nếu một trong hai thủ thuật là độc lập
      if (!currentProc?.isIndependent && !apptProc?.isIndependent) {
        const currentRest = newApptData?.restMinutes ?? currentProc?.restMinutes ?? 0;
        const apptRest = appt.restMinutes ?? apptProc?.restMinutes ?? 0;
        
        const currentPatientEnd = endMin + currentRest;
        const apptPatientEnd = apptEnd + apptRest;

        if (Math.max(startMin, apptStart) < Math.min(currentPatientEnd, apptPatientEnd)) {
          if (Math.max(startMin, apptStart) < Math.min(endMin, apptEnd)) {
            conflictDetails.push({ message: `Bệnh nhân đang có thủ thuật "${apptProc?.name}" (${appt.startTime}-${appt.endTime}).`, level: 1 });
          } else if (startMin >= apptEnd && startMin < apptPatientEnd) {
            conflictDetails.push({ message: `Bệnh nhân đang trong thời gian nghỉ của thủ thuật "${apptProc?.name}".`, level: 1 });
          } else if (apptStart >= endMin && apptStart < currentPatientEnd) {
            conflictDetails.push({ message: `Thời gian nghỉ của thủ thuật này trùng với thủ thuật "${apptProc?.name}".`, level: 1 });
          } else {
            conflictDetails.push({ message: `Xung đột thời gian nghỉ với thủ thuật "${apptProc?.name}".`, level: 1 });
          }
        }
      }
      
      if (!currentProc?.isIndependent) {
        if (apptProc?.isPreRequisite && startMin < apptStart) {
          conflictDetails.push({ message: `Thủ thuật "${apptProc?.name}" bắt buộc phải làm trước.`, level: 1 });
        }

        if (apptProc?.isPostRequisite && startMin > apptStart) {
          conflictDetails.push({ message: `Thủ thuật "${apptProc?.name}" bắt buộc phải làm sau cùng.`, level: 1 });
        }
      }
    }

    const getBusyInterval = (proc: Procedure | undefined, role: 'main' | 'asst1' | 'asst2', baseStart: number, apptData?: Partial<Appointment>) => {
      if (!proc) return { start: baseStart, end: baseStart };
      
      let startOffset = 0;
      let endOffset = 0;

      if (role === 'main') {
        startOffset = apptData?.mainBusyStart ?? proc.mainBusyStart ?? 0;
        endOffset = apptData?.mainBusyEnd ?? proc.mainBusyEnd ?? proc.busyMinutes ?? proc.durationMinutes ?? 0;
      } else if (role === 'asst1') {
        startOffset = apptData?.asst1BusyStart ?? proc.asst1BusyStart ?? 0;
        endOffset = apptData?.asst1BusyEnd ?? proc.asst1BusyEnd ?? proc.assistant1BusyMinutes ?? 0;
      } else if (role === 'asst2') {
        startOffset = apptData?.asst2BusyStart ?? proc.asst2BusyStart ?? 0;
        endOffset = apptData?.asst2BusyEnd ?? proc.asst2BusyEnd ?? proc.assistant2BusyMinutes ?? 0;
      }

      return { start: baseStart + startOffset, end: baseStart + endOffset };
    };

    const checkStaffBusyOverlap = (personId: string, roleInCurrent: 'main' | 'asst1' | 'asst2', label: string) => {
      if (!personId) return;
      
      // Busy interval for this person in the NEW appointment we are checking
      const currentInterval = getBusyInterval(currentProc, roleInCurrent, startMin, newApptData);
      
      // Check if this person is involved in the EXISTING appointment 'appt'
      let roleInAppt: 'main' | 'asst1' | 'asst2' | null = null;
      if (appt.staffId === personId) roleInAppt = 'main';
      else if (appt.assistant1Id === personId) roleInAppt = 'asst1';
      else if (appt.assistant2Id === personId) roleInAppt = 'asst2';
      
      if (roleInAppt) {
        const apptInterval = getBusyInterval(apptProc, roleInAppt, apptStart, appt);
        const isOverlap = Math.max(currentInterval.start, apptInterval.start) < Math.min(currentInterval.end, apptInterval.end);
        
        if (isOverlap) {
          const isSameMachineSession = currentProc?.requireMachine && 
                                       apptProc?.requireMachine && 
                                       (currentProc.machineCapacity || 1) > 1 &&
                                       appt.assignedMachineId === assignedMachineId &&
                                       startMin === apptStart && 
                                       endMin === apptEnd;

          if (!isSameMachineSession) {
            const otherPatient = patients.find(p => p.id === appt.patientId);
            conflictDetails.push({ message: `${label} đang bận thực hiện thủ thuật cho BN "${otherPatient?.name || 'khác'}" (${minutesToTimeString(apptInterval.start)}-${minutesToTimeString(apptInterval.end)}).`, level: 1 });
          }
        }
      }
    };

    checkStaffBusyOverlap(staffId, 'main', 'Nhân sự chính');
    checkStaffBusyOverlap(assistant1Id || '', 'asst1', 'Người phụ 1');
    checkStaffBusyOverlap(assistant2Id || '', 'asst2', 'Người phụ 2');
  }

  // Filter unique conflict messages
  const uniqueConflicts = Array.from(new Map(conflictDetails.map(item => [item.message, item])).values());

  return { 
    hasConflict: uniqueConflicts.some(c => c.level === 1), 
    reason: uniqueConflicts.length > 0 ? uniqueConflicts[0].message : null, 
    conflictDetails: uniqueConflicts, 
    assignedMachineId, 
    isOvertime,
    isOutsideOfficeHours
  };
};

export const findAvailableStaffForSlot = (
    date: string,
    startTime: string,
    endTime: string,
    procedureId: string,
    appointments: Appointment[],
    staffList: Staff[],
    attendanceRecords: AttendanceRecord[],
    procedures: Procedure[],
    patients: Patient[],
    preferredStaffId?: string
): string | null => {
    const eligibleStaff = staffList.filter(s => s.mainCapabilityIds?.includes(procedureId));
    
    // Thử ưu tiên nhân sự cũ trước
    if (preferredStaffId) {
        const preferred = eligibleStaff.find(s => s.id === preferredStaffId);
        if (preferred) {
            const conflict = checkConflict(startTime, endTime, date, preferred.id, 'temp_p', appointments, staffList, procedures, attendanceRecords, patients, procedureId);
            if (!conflict.hasConflict) return preferred.id;
        }
    }

    // Nếu không, tìm nhân sự khác đang rảnh
    for (const staff of eligibleStaff) {
        const conflict = checkConflict(startTime, endTime, date, staff.id, 'temp_p', appointments, staffList, procedures, attendanceRecords, patients, procedureId);
        if (!conflict.hasConflict) return staff.id;
    }

    return null;
};

export const addMinutesToTime = (time: string, minutesToAdd: number): string => {
  const minutes = timeStringToMinutes(time);
  return minutesToTimeString(minutes + minutesToAdd);
};

export const findAvailableSlot = (
    date: string,
    procedure: Procedure,
    staffId: string,
    patientId: string | undefined,
    appointments: Appointment[],
    staffList: Staff[],
    procedures: Procedure[],
    attendanceRecords: AttendanceRecord[],
    patients: Patient[],
    assistant1Id?: string | null,
    assistant2Id?: string | null,
    excludeAppointmentId?: string,
    newApptData?: Partial<Appointment>
): { startTime: string; endTime: string; reason?: string } | null => {
    let firstConflictReason: string | undefined;

    // Chỉ xếp vào giờ hành chính
    for (const shift of OFFICE_SHIFTS) {
      let currentMin = timeStringToMinutes(shift.start);
      const shiftEndLimit = timeStringToMinutes(shift.end);
      
      while (currentMin + procedure.durationMinutes <= shiftEndLimit) {
          const start = minutesToTimeString(currentMin);
          const end = minutesToTimeString(currentMin + procedure.durationMinutes);
          const res = checkConflict(start, end, date, staffId, patientId, appointments, staffList, procedures, attendanceRecords, patients, procedure.id, excludeAppointmentId, assistant1Id, assistant2Id, newApptData);
          if (!res.hasConflict) return { startTime: start, endTime: end };
          
          if (!firstConflictReason && res.conflictDetails.length > 0) {
              const level1Conflict = res.conflictDetails.find(c => c.level === 1);
              if (level1Conflict) firstConflictReason = level1Conflict.message;
          }
          currentMin += 5;
      }
    }

    return firstConflictReason ? { startTime: '', endTime: '', reason: firstConflictReason } : null;
};

export const getAvailableTimeBlocks = (
    date: string,
    procedure: Procedure,
    staffId: string,
    patientId: string | undefined,
    appointments: Appointment[],
    staffList: Staff[],
    procedures: Procedure[],
    attendanceRecords: AttendanceRecord[],
    patients: Patient[],
    assistant1Id?: string | null,
    assistant2Id?: string | null,
    excludeAppointmentId?: string,
    newApptData?: Partial<Appointment>
): { blocks: { start: string; end: string }[]; reason: string | null } => {
    const blocks: { start: string; end: string }[] = [];
    let firstConflictReason: string | null = null;

    for (const shift of OFFICE_SHIFTS) {
        let currentBlockStart: string | null = null;
        let currentBlockEnd: string | null = null;
        
        let currentMin = timeStringToMinutes(shift.start);
        const endLimit = timeStringToMinutes(shift.end);

        while (currentMin + procedure.durationMinutes <= endLimit) {
            const start = minutesToTimeString(currentMin);
            const end = minutesToTimeString(currentMin + procedure.durationMinutes);
            const res = checkConflict(start, end, date, staffId, patientId, appointments, staffList, procedures, attendanceRecords, patients, procedure.id, excludeAppointmentId, assistant1Id, assistant2Id, newApptData);
            
            if (!res.hasConflict) {
                if (!currentBlockStart) {
                    currentBlockStart = start;
                    currentBlockEnd = end;
                } else {
                    currentBlockEnd = end;
                }
            } else {
                if (!firstConflictReason && res.conflictDetails.length > 0) {
                    const level1Conflict = res.conflictDetails.find(c => c.level === 1);
                    if (level1Conflict) firstConflictReason = level1Conflict.message;
                }
                if (currentBlockStart && currentBlockEnd) {
                    blocks.push({ start: currentBlockStart, end: currentBlockEnd });
                    currentBlockStart = null;
                    currentBlockEnd = null;
                }
            }
            currentMin += 5;
        }

        if (currentBlockStart && currentBlockEnd) {
            blocks.push({ start: currentBlockStart, end: currentBlockEnd });
        }
    }

    return { blocks, reason: firstConflictReason };
};

export const getAbbreviation = (name?: string) => {
  if (!name) return '';
  return name
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 3);
};

export const calculateAge = (dob: string): string | number => {
    if (!dob) return '??';
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
};

export const generatePatientCode = (name: string, admissionDateStr: string, deptId: string): string => {
    const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const initials = normalized.split(' ').map(n => n[0]).join('').toUpperCase();
    const d = new Date(admissionDateStr);
    const dateCode = `${d.getDate().toString().padStart(2, '0')}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getFullYear().toString().substr(-2)}`;
    const deptCode = deptId.replace('dept_', '').toUpperCase().substring(0, 4);
    return `${initials}-${dateCode}-${deptCode}`;
};

export const getDaysInMonth = (month: number, year: number): number => new Date(year, month, 0).getDate();
export const getDayOfWeek = (day: number, month: number, year: number): string => {
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const date = new Date(year, month - 1, day);
  return days[date.getDay()];
};

export const getNext7Days = (): string[] => {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + i);
    days.push(nextDay.toISOString().split('T')[0]);
  }
  return days;
};
