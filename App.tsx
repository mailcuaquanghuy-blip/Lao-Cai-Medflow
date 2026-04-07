
import React, { useState, useMemo, useEffect } from 'react';
import { Staff, Patient, Procedure, Appointment, AppointmentStatus, Department, DepartmentType, TimelineViewMode, AttendanceRecord, AttendanceStatus, PatientStatus, PatientReferral, UserAccount, UserRole, AppointmentTemplate, MachineShift, Backup } from './types';
import { MOCK_STAFF, MOCK_PATIENTS, MOCK_PROCEDURES, DEPARTMENTS, DEFAULT_ADMIN } from './constants';

import { checkConflict, findAvailableStaffForSlot, calculateAge, timeStringToMinutes, getRoleLabel, formatDate, getAbbreviation } from './utils/timeUtils';
import { Timeline } from './components/Timeline';
import { DailyReport } from './components/DailyReport';
import { Dashboard } from './components/Dashboard';
import { BookingModal } from './components/BookingModal';
import { StaffManager } from './components/StaffManager';
import { PatientList } from './components/PatientList';
import { PatientScheduling } from './components/PatientScheduling';
import { MachineShiftManager } from './components/MachineShiftManager';
import { PatientModal } from './components/PatientModal';
import { Login } from './components/Login';
import { AccountManager } from './components/AccountManager';
import { BackupManager } from './components/BackupManager';
import { Button } from './components/Button';
import { DateTimePicker } from './components/DateTimePicker';
import { DateInput } from './components/DateInput';
import { Home, Building2, Table2, FileText, CalendarPlus, AlertCircle, LogOut, ShieldCheck, User, UserCog, X, Briefcase, Check, Save, PieChart, Database } from 'lucide-react';

// Firebase imports
import { db } from './firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDocFromServer
} from "firebase/firestore";

export type MainTab = 'PATIENT_RECORDS' | 'SCHEDULING' | 'GENERAL_TIMELINE' | 'DAILY_REPORT' | 'DEPT_MANAGER' | 'ACCOUNT_MANAGER' | 'ACCOUNT_BACKUP';
export type ManagerTab = 'PERSONNEL' | 'ATTENDANCE' | 'PROCEDURES';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: undefined, // We don't use Firebase Auth here, but keeping structure
      email: undefined,
      emailVerified: undefined,
      isAnonymous: undefined,
      tenantId: undefined,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error Details: ', JSON.stringify(errInfo, null, 2));
  // We don't want to crash the app, just log it clearly
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = sessionStorage.getItem('medflow_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentDept, setCurrentDept] = useState<Department | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('PATIENT_RECORDS');
  const [managerSubTab, setManagerSubTab] = useState<ManagerTab>('PERSONNEL');
  const [activeDate, setActiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [machineShifts, setMachineShifts] = useState<MachineShift[]>([]);
  const [templates, setTemplates] = useState<AppointmentTemplate[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<Staff[]>(MOCK_STAFF);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>(MOCK_PROCEDURES);
  const [backups, setBackups] = useState<Backup[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Partial<Appointment> | undefined>(undefined);
  const [isPatientEditModalOpen, setIsPatientEditModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Partial<Patient> | null>(null);
  const [referralModal, setReferralModal] = useState<{patientId: string, specialty: string, procedureIds: string[]} | null>(null);
  const [timelineFilters, setTimelineFilters] = useState<{procedureIds?: string[], staffIds?: string[]}>({});

  // Staff Edit State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Partial<Staff> | null>(null);

  const isFirebaseReady = !!db;

  useEffect(() => {
    if (!db || !isFirebaseReady) return;
    
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore connection test successful.");
      } catch (error: any) {
        if (error.message.includes('the client is offline') || error.message.includes('permission-denied')) {
          console.error("Firestore connection test failed:", error.message);
          handleFirestoreError(error, OperationType.GET, "test/connection");
        }
      }
    };
    testConnection();

    const seedData = async () => {
      // Check if patients collection is empty
      const q = query(collection(db, "patients"));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log("Seeding mock patients to Firestore...");
        for (const p of MOCK_PATIENTS) {
          await setDoc(doc(db, "patients", p.id), p);
        }
      }

      // Check if procedures collection is empty or missing mock ones
      const pQ = query(collection(db, "procedures"));
      const pSnapshot = await getDocs(pQ);
      const existingProcs = pSnapshot.docs.map(d => d.data() as Procedure);
      
      for (const p of MOCK_PROCEDURES) {
        if (!existingProcs.find(ep => ep.id === p.id)) {
          console.log(`Seeding missing mock procedure: ${p.name}`);
          await setDoc(doc(db, "procedures", p.id), p);
        }
      }

      // Update old procedures missing deptId
      for (const ep of existingProcs) {
        if (!ep.deptId) {
          const mockProc = MOCK_PROCEDURES.find(p => p.id === ep.id);
          if (mockProc && mockProc.deptId) {
            console.log(`Updating missing deptId for procedure: ${ep.name}`);
            await setDoc(doc(db, "procedures", ep.id), { ...ep, deptId: mockProc.deptId }, { merge: true });
          }
        }
      }

      // Check if staff collection is empty
      const sQ = query(collection(db, "staff"));
      const sSnapshot = await getDocs(sQ);
      if (sSnapshot.empty) {
        console.log("Seeding mock staff to Firestore...");
        for (const s of MOCK_STAFF) {
          await setDoc(doc(db, "staff", s.id), s);
        }
      }

      // Check if users collection is empty
      const uQ = query(collection(db, "users"));
      const uSnapshot = await getDocs(uQ);
      if (uSnapshot.empty) {
        console.log("Seeding default admin to Firestore...");
        await setDoc(doc(db, "users", DEFAULT_ADMIN.id), DEFAULT_ADMIN);
      }
    };

    seedData().catch(console.error);
  }, [isFirebaseReady]);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data() } as UserAccount));
      
      // Auto-patch users to include dept_duoc if missing
      usersData.forEach(u => {
        if (!u.viewableDeptIds.includes('dept_duoc')) {
          const updatedUser = {
            ...u,
            viewableDeptIds: [...u.viewableDeptIds, 'dept_duoc'],
            editableDeptIds: [...u.editableDeptIds, 'dept_duoc']
          };
          setDoc(doc(db, "users", u.id), updatedUser).catch(console.error);
        }
      });

      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "users");
    });
    return () => unsub();
  }, [isFirebaseReady]);

  useEffect(() => {
    if (!db || !currentUser) return;
    const unsub = onSnapshot(collection(db, "patients"), (snapshot) => {
      const patientsData = snapshot.docs.map(doc => ({ ...doc.data() } as Patient));
      setPatients(patientsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "patients");
    });
    return () => unsub();
  }, [isFirebaseReady, activeDate, currentUser]);

  useEffect(() => {
    if (!db || !currentUser) return;
    const unsub = onSnapshot(collection(db, "appointments"), (snapshot) => {
      const apptsData = snapshot.docs.map(doc => ({ ...doc.data() } as Appointment));
      setAppointments(apptsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "appointments");
    });
    return () => unsub();
  }, [isFirebaseReady, currentUser]);

  useEffect(() => {
    if (!db || !currentUser) return;
    const unsub = onSnapshot(collection(db, "templates"), (snapshot) => {
      const templatesData = snapshot.docs.map(doc => ({ ...doc.data() } as AppointmentTemplate));
      setTemplates(templatesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "templates");
    });
    return () => unsub();
  }, [isFirebaseReady, currentUser]);

  useEffect(() => {
    if (!db || !currentUser) return;
    const unsub = onSnapshot(collection(db, "attendance"), (snapshot) => {
      const attData = snapshot.docs.map(doc => ({ ...doc.data() } as AttendanceRecord));
      setAttendanceRecords(attData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "attendance");
    });
    return () => unsub();
  }, [isFirebaseReady, currentUser]);

  useEffect(() => {
    if (!db || !currentUser) return;
    const unsub = onSnapshot(collection(db, "staff"), (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({ ...doc.data() } as Staff));
      setStaff(staffData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "staff");
    });
    return () => unsub();
  }, [isFirebaseReady, currentUser]);

  useEffect(() => {
    if (!db || !currentUser) return;
    const unsub = onSnapshot(collection(db, "machineShifts"), (snapshot) => {
      const shiftsData = snapshot.docs.map(doc => ({ ...doc.data() } as MachineShift));
      setMachineShifts(shiftsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "machineShifts");
    });
    return () => unsub();
  }, [isFirebaseReady, currentUser]);

  useEffect(() => {
    if (!db || !currentUser) return;
    const unsub = onSnapshot(collection(db, "procedures"), (snapshot) => {
      const procData = snapshot.docs.map(doc => ({ ...doc.data() } as Procedure));
      setProcedures(procData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "procedures");
    });
    return () => unsub();
  }, [isFirebaseReady, currentUser]);

  useEffect(() => {
    if (!db || !currentUser || currentUser.role !== UserRole.ADMIN) return;
    const unsub = onSnapshot(collection(db, "backups"), (snapshot) => {
      const backupData = snapshot.docs.map(doc => ({ ...doc.data() } as Backup));
      setBackups(backupData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "backups");
    });
    return () => unsub();
  }, [isFirebaseReady, currentUser]);


  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
    sessionStorage.setItem('medflow_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentDept(null);
    sessionStorage.removeItem('medflow_user');
  };

  const canEditCurrentDept = useMemo(() => {
    if (!currentUser || !currentDept) return false;
    return currentUser.role === UserRole.ADMIN || currentUser.editableDeptIds.includes(currentDept.id);
  }, [currentUser, currentDept]);

  const handleSaveUser = async (user: UserAccount) => {
    if (!db) return;
    try {
      await setDoc(doc(db, "users", user.id), user);
    } catch (e) { console.error(e); }
  };

  const handleDeleteUser = async (id: string) => {
    if (!db) return;
    if (confirm('Xóa tài khoản này?')) {
      await deleteDoc(doc(db, "users", id));
    }
  };

  const deptStaff = currentDept ? staff.filter(s => s.deptId === currentDept.id) : [];

  // Logic Timeline Liên khoa
  const deptAppointments = useMemo(() => {
    if (!currentDept) return [];
    return appointments.filter(a => a.date === activeDate);
  }, [appointments, currentDept, activeDate]);

  const handleSavePatient = async (patient: Patient) => {
    if (!db || !canEditCurrentDept) return;
    try {
      // Ensure no undefined values are sent to Firestore
      const cleanPatient = JSON.parse(JSON.stringify(patient, (key, value) => value === undefined ? null : value));
      await setDoc(doc(db, "patients", patient.id), cleanPatient);
      setIsPatientEditModalOpen(false);
      setEditingPatient(null);
    } catch (error) { console.error(error); }
  };

  const handleDeletePatient = async (patientId: string) => {
    if (!db) return;
    if (!canEditCurrentDept) {
      alert("Bạn không có quyền xóa dữ liệu tại khoa này.");
      return;
    }
    try {
      // Kiểm tra xem bệnh nhân còn thủ thuật nào không
      const q = query(collection(db, "appointments"), where("patientId", "==", patientId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        alert("Không thể xóa bệnh nhân này vì vẫn còn thủ thuật. Vui lòng xóa toàn bộ thủ thuật của bệnh nhân trước khi xóa hồ sơ.");
        return;
      }

      // Xóa hồ sơ bệnh nhân
      await deleteDoc(doc(db, "patients", patientId));
      console.log(`Đã xóa hồ sơ bệnh nhân ${patientId}`);
    } catch (error) { 
      console.error("Lỗi khi xóa bệnh nhân:", error);
      alert("Có lỗi xảy ra khi xóa dữ liệu bệnh nhân.");
    }
  };

  const handleSaveBooking = async (data: Partial<Appointment>) => {
    if (!currentDept || !db || !canEditCurrentDept) return;
    const conflictRes = checkConflict(data.startTime!, data.endTime!, data.date!, data.staffId!, data.patientId, appointments, staff, procedures, attendanceRecords, patients, data.procedureId, data.id, data.assistant1Id, data.assistant2Id, data);
    
    const id = data.id || 'appt_' + Math.random().toString(36).substr(2, 9);
    const baseAppt: any = {
      ...data,
      id: id,
      patientId: data.patientId || '',
      staffId: data.staffId!,
      assistant1Id: data.assistant1Id || null,
      assistant2Id: data.assistant2Id || null,
      procedureId: data.procedureId!,
      deptId: currentDept.id,
      date: data.date!,
      startTime: data.startTime!,
      endTime: data.endTime!,
      status: conflictRes.hasConflict ? AppointmentStatus.CONFLICT : (data.status || AppointmentStatus.PENDING),
      assignedMachineId: data.assignedMachineId || conflictRes.assignedMachineId || null,
      machineShiftId: data.machineShiftId || null,
      conflictDetails: conflictRes.conflictDetails
    };

    // Remove undefined fields
    Object.keys(baseAppt).forEach(key => {
      if (baseAppt[key] === undefined) {
        delete baseAppt[key];
      }
    });

    try {
      await setDoc(doc(db, "appointments", id), baseAppt as Appointment);
      setIsModalOpen(false);
      setEditingAppt(undefined);
    } catch (error) { console.error(error); }
  };
  
  const handleAddMachineShift = async (shift: Omit<MachineShift, 'id'>) => {
    if (!db || !canEditCurrentDept) return;
    try {
      const newShift = { ...shift, id: `shift_${Date.now()}` };
      await setDoc(doc(db, 'machineShifts', newShift.id), newShift);
    } catch (error) { console.error(error); }
  };

  const handleUpdateMachineShift = async (id: string, shift: Partial<MachineShift>, updateLinkedAppointments: boolean) => {
    if (!db || !canEditCurrentDept) return;
    try {
      await updateDoc(doc(db, 'machineShifts', id), shift);
      
      if (updateLinkedAppointments) {
        const linkedAppts = appointments.filter(a => a.machineShiftId === id);
        for (const appt of linkedAppts) {
          const updatedAppt: any = {
            ...appt,
            startTime: shift.startTime || appt.startTime,
            endTime: shift.endTime || appt.endTime,
            staffId: shift.staffId || appt.staffId,
            assistant1Id: shift.assistant1Id !== undefined ? shift.assistant1Id : appt.assistant1Id,
            assistant2Id: shift.assistant2Id !== undefined ? shift.assistant2Id : appt.assistant2Id,
          };
          
          Object.keys(updatedAppt).forEach(key => {
            if (updatedAppt[key] === undefined) {
              delete updatedAppt[key];
            }
          });

          await updateDoc(doc(db, 'appointments', appt.id), updatedAppt);
        }
      }
    } catch (error) { console.error(error); }
  };

  const handleDeleteMachineShift = async (id: string) => {
    if (!db || !canEditCurrentDept) return;
    try {
      await deleteDoc(doc(db, 'machineShifts', id));
      // Also remove machineShiftId from linked appointments
      const linkedAppts = appointments.filter(a => a.machineShiftId === id);
      for (const appt of linkedAppts) {
        await updateDoc(doc(db, 'appointments', appt.id), { machineShiftId: null });
      }
    } catch (error) { console.error(error); }
  };

  const handleUpdateAppointment = async (updatedAppt: Appointment) => {
    if (!db || !canEditCurrentDept) return;
    
    // Mỗi khoa chỉ được sửa đổi thủ thuật của riêng mình
    if (currentUser?.role !== UserRole.ADMIN && updatedAppt.deptId !== currentDept?.id) {
      alert("Bạn không có quyền chỉnh sửa thủ thuật của khoa khác.");
      return;
    }

    const res = checkConflict(updatedAppt.startTime, updatedAppt.endTime, updatedAppt.date, updatedAppt.staffId, updatedAppt.patientId, appointments, staff, procedures, attendanceRecords, patients, updatedAppt.procedureId, updatedAppt.id, updatedAppt.assistant1Id, updatedAppt.assistant2Id, updatedAppt);
    
    const finalAppt: any = { 
      ...updatedAppt, 
      status: res.hasConflict ? AppointmentStatus.CONFLICT : AppointmentStatus.PENDING,
      assignedMachineId: updatedAppt.assignedMachineId || res.assignedMachineId || null,
      conflictDetails: res.conflictDetails
    };

    // Remove undefined fields
    Object.keys(finalAppt).forEach(key => {
      if (finalAppt[key] === undefined) {
        delete finalAppt[key];
      }
    });

    try {
      await updateDoc(doc(db, "appointments", updatedAppt.id), finalAppt);
    } catch (error) { console.error(error); }
  };

  const handleDeleteAppointment = async (apptId: string) => {
    if (!db || !canEditCurrentDept) return;
    
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;

    // Mỗi khoa chỉ được sửa đổi thủ thuật của riêng mình
    if (currentUser?.role !== UserRole.ADMIN && appt.deptId !== currentDept?.id) {
      alert("Bạn không có quyền xóa thủ thuật của khoa khác.");
      return;
    }

    if (confirm('Bạn có chắc chắn muốn xóa chỉ định này?')) {
      try {
        await deleteDoc(doc(db, "appointments", apptId));
      } catch (error) {
        console.error("Lỗi khi xóa chỉ định:", error);
        alert("Có lỗi xảy ra khi xóa chỉ định.");
      }
    }
  };

  const handleCopyToDateRange = async (patientId: string, sourceDate: string, startDate: string, endDate: string) => {
    if (!db || !canEditCurrentDept) return;
    
    // Mỗi khoa chỉ được sao chép thủ thuật của riêng mình
    const sourceAppts = appointments.filter(a => 
      a.patientId === patientId && 
      a.date === sourceDate && 
      (currentUser?.role === UserRole.ADMIN || a.deptId === currentDept?.id)
    );
    
    if (sourceAppts.length === 0) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateRange: string[] = [];
    let current = new Date(start);
    while (current <= end) {
      dateRange.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    const newAppts: Appointment[] = [];
    let currentApptsState = [...appointments];

    dateRange.forEach(targetDate => {
      if (targetDate === sourceDate) return;
      sourceAppts.forEach(source => {
        // Giữ nguyên người thực hiện nhưng kiểm tra xung đột tại ngày mới
        const conflictRes = checkConflict(source.startTime, source.endTime, targetDate, source.staffId, patientId, currentApptsState, staff, procedures, attendanceRecords, patients, source.procedureId, undefined, source.assistant1Id, source.assistant2Id, source);

        const copy: Appointment = {
          ...source,
          id: 'appt_' + Math.random().toString(36).substr(2, 9),
          date: targetDate,
          staffId: source.staffId, 
          assignedMachineId: source.assignedMachineId || conflictRes.assignedMachineId || null, 
          status: conflictRes.hasConflict ? AppointmentStatus.CONFLICT : AppointmentStatus.PENDING,
          conflictDetails: conflictRes.conflictDetails
        };
        newAppts.push(copy);
        currentApptsState.push(copy); 
      });
    });

    if (newAppts.length > 0) {
      for (const appt of newAppts) {
        await setDoc(doc(db, "appointments", appt.id), appt);
      }
      alert(`Đã sao chép thành công.`);
    }
  };

  const handleRecheckConflicts = async () => {
    if (!db || !currentDept) return;
    const currentAppts = appointments.filter(a => a.date === activeDate);
    let updatedCount = 0;

    for (const appt of currentAppts) {
      const conflictRes = checkConflict(
        appt.startTime,
        appt.endTime,
        appt.date,
        appt.staffId,
        appt.patientId,
        appointments,
        staff,
        procedures,
        attendanceRecords,
        patients,
        appt.procedureId,
        appt.id,
        appt.assistant1Id,
        appt.assistant2Id,
        appt
      );

      const newStatus = conflictRes.hasConflict ? AppointmentStatus.CONFLICT : (appt.status === AppointmentStatus.CONFLICT ? AppointmentStatus.PENDING : appt.status);
      
      if (newStatus !== appt.status || JSON.stringify(conflictRes.conflictDetails) !== JSON.stringify(appt.conflictDetails)) {
        const updatedAppt = {
          ...appt,
          status: newStatus,
          conflictDetails: conflictRes.conflictDetails,
          assignedMachineId: appt.assignedMachineId || conflictRes.assignedMachineId || null
        };
        await setDoc(doc(db, "appointments", appt.id), updatedAppt);
        updatedCount++;
      }
    }
    alert(`Đã kiểm tra lại lỗi. Cập nhật ${updatedCount} chỉ định.`);
  };

  const handlePatientReferral = async (patientId: string, specialty: string, procedureIds: string[]) => {
    if (!db || !canEditCurrentDept) return;
    const p = patients.find(pat => pat.id === patientId);
    if (!p) return;
    
    const referralDate = activeDate;
    const dt = new Date();
    const timestamp = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

    const referrals = p.referrals || [];
    const exists = referrals.findIndex(r => r.specialty === specialty);
    const newRef: PatientReferral = { 
      specialty, 
      timestamp, 
      fromDeptId: currentDept?.id || '',
      referralDate,
      status: 'ACTIVE',
      procedureIds
    };
    let newReferrals = exists > -1 ? [...referrals] : [...referrals, newRef];
    if (exists > -1) newReferrals[exists] = newRef;

    try {
      await setDoc(doc(db, "patients", patientId), { ...p, referrals: newReferrals });
      setReferralModal(null);
    } catch (error) { console.error(error); }
  };

  const handleFinishReferral = async (patientId: string, specialty: string) => {
    if (!db || !canEditCurrentDept) return;
    const p = patients.find(pat => pat.id === patientId);
    if (!p) return;

    const dt = new Date();
    const fDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const fTime = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

    const newReferrals = p.referrals?.map(r => {
      const s = (r.specialty || '').toLowerCase();
      const dId = currentDept?.id.toLowerCase() || '';
      const dName = currentDept?.name.toLowerCase() || '';
      const isMatch = r.specialty === specialty || s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                     (s.includes('phcn') && dId.includes('phcn')) ||
                     (s.includes('cdha') && dId.includes('cdha')) ||
                     (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                     (s.includes('duoc') && dId.includes('duoc')) ||
                     (dId === 'dept_phcn' && s === 'dept_phcn') ||
                     (dId === 'dept_cdha' && s === 'dept_cdha') ||
                     (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
      if (isMatch) {
        return { ...r, status: 'FINISHED' as const, finishedDate: fDate || null, finishedTime: fTime || null };
      }
      return r;
    });

    try {
      await setDoc(doc(db, "patients", patientId), { ...p, referrals: newReferrals });
    } catch (error) { console.error(error); }
  };

  const handleUpdateAttendance = async (record: AttendanceRecord) => {
    if (!db || !canEditCurrentDept) return;
    
    try {
      await setDoc(doc(db, "attendance", record.id), record);
      
      // Nếu nhân sự nghỉ, cảnh báo nếu có lịch trong ngày/buổi đó
      if (record.status !== AttendanceStatus.PRESENT) {
        const affectedShifts = machineShifts.filter(shift => 
          shift.date === record.date && 
          (shift.staffId === record.staffId || shift.assistant1Id === record.staffId || shift.assistant2Id === record.staffId)
        );

        const affectedAppts = appointments.filter(appt => 
          appt.date === record.date && 
          (appt.staffId === record.staffId || appt.assistant1Id === record.staffId || appt.assistant2Id === record.staffId)
        );

        let hasConflict = false;

        for (const shift of affectedShifts) {
          const startMin = timeStringToMinutes(shift.startTime);
          if (record.status === AttendanceStatus.OFF_FULL) hasConflict = true;
          else if (record.status === AttendanceStatus.OFF_MORNING && startMin < 720) hasConflict = true;
          else if (record.status === AttendanceStatus.OFF_AFTERNOON && startMin >= 810) hasConflict = true;
        }

        for (const appt of affectedAppts) {
          const startMin = timeStringToMinutes(appt.startTime);
          if (record.status === AttendanceStatus.OFF_FULL) hasConflict = true;
          else if (record.status === AttendanceStatus.OFF_MORNING && startMin < 720) hasConflict = true;
          else if (record.status === AttendanceStatus.OFF_AFTERNOON && startMin >= 810) hasConflict = true;
        }

        if (hasConflict) {
          alert(`Cảnh báo: Nhân sự này đang có lịch hẹn/ca máy trong thời gian nghỉ (${record.date}). Vui lòng kiểm tra và sắp xếp lại nhân sự!`);
        }
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật chấm công:", error);
    }
  };

  const handleCancelFinishReferral = async (patientId: string, specialty: string) => {
    if (!db || !canEditCurrentDept) return;
    const p = patients.find(pat => pat.id === patientId);
    if (!p) return;

    const newReferrals = p.referrals?.map(r => {
      const s = (r.specialty || '').toLowerCase();
      const dId = currentDept?.id.toLowerCase() || '';
      const dName = currentDept?.name.toLowerCase() || '';
      const isMatch = r.specialty === specialty || s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                     (s.includes('phcn') && dId.includes('phcn')) ||
                     (s.includes('cdha') && dId.includes('cdha')) ||
                     (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                     (s.includes('duoc') && dId.includes('duoc')) ||
                     (dId === 'dept_phcn' && s === 'dept_phcn') ||
                     (dId === 'dept_cdha' && s === 'dept_cdha') ||
                     (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
      if (isMatch) {
        return { ...r, status: 'ACTIVE' as const, finishedDate: null, finishedTime: null };
      }
      return r;
    });

    try {
      await setDoc(doc(db, "patients", patientId), { ...p, referrals: newReferrals });
    } catch (error) { console.error(error); }
  };

  const handleCancelReferral = async (patientId: string, specialty: string) => {
    if (!db || !canEditCurrentDept) return;
    const p = patients.find(pat => pat.id === patientId);
    if (!p) return;

    const newReferrals = p.referrals?.filter(r => r.specialty !== specialty);

    try {
      await setDoc(doc(db, "patients", patientId), { ...p, referrals: newReferrals });
    } catch (error) { console.error(error); }
  };

  // Staff Modal handlers
  const openStaffModal = (s?: Staff) => {
    if (s) {
        setEditingStaff({ ...s });
    } else {
        setEditingStaff({
            name: '',
            role: 'Doctor',
            deptId: currentDept?.id,
            capabilityIds: [],
            mainCapabilityIds: [],
            assistantCapabilityIds: []
        });
    }
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = async () => {
    if (!editingStaff || !editingStaff.name || !db) return;
    
    const newStaff: Staff = {
        id: editingStaff.id || `s_${Math.random().toString(36).substr(2,9)}`,
        name: editingStaff.name,
        role: editingStaff.role || 'Doctor',
        deptId: editingStaff.deptId || currentDept?.id || '',
        capabilityIds: editingStaff.capabilityIds || [],
        mainCapabilityIds: editingStaff.mainCapabilityIds || [],
        assistantCapabilityIds: editingStaff.assistantCapabilityIds || []
    };
    
    try {
      await setDoc(doc(db, "staff", newStaff.id), newStaff);
      setIsStaffModalOpen(false);
      setEditingStaff(null);
    } catch (error) {
      console.error("Error saving staff:", error);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!db) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa nhân sự này?')) return;
    
    try {
      await deleteDoc(doc(db, "staff", staffId));
    } catch (error) {
      console.error("Error deleting staff:", error);
    }
  };

  const handleCreateBackup = async (deptId: string, date: string, note: string, isAuto: boolean = false) => {
    if (!db || !currentUser) return;
    
    const dept = DEPARTMENTS.find(d => d.id === deptId);
    const versionName = deptId === 'SYSTEM' ? `Backup_ToanHeThong_${date}` : `Backup_${dept?.name || deptId}_${date}`;

    // 1. Thu thập dữ liệu cần sao lưu
    // User yêu cầu: "Sao lưu là sao lưu toàn bộ thông tin thủ thuật và tất cả thông tin bệnh nhân nhé."
    // Vì vậy ta sẽ lấy toàn bộ dữ liệu hệ thống bất kể deptId được truyền vào là gì.
    
    const snapshot = {
      patients: patients,
      appointments: appointments.filter(a => a.date === date),
      staff: staff,
      attendance: attendanceRecords.filter(r => r.date === date),
      machineShifts: machineShifts.filter(s => s.date === date),
      procedures: procedures // Bao gồm cả danh mục thủ thuật
    };

    const backupId = isAuto ? `backup_${deptId}_${date}_auto` : `backup_${deptId}_${date}_${Date.now()}`;

    const backup: Backup = {
      id: backupId,
      deptId,
      backupDate: date,
      versionName,
      createdAt: new Date().toISOString(),
      snapshot: JSON.stringify(snapshot),
      note,
      createdBy: currentUser.id
    };

    await setDoc(doc(db, "backups", backup.id), backup);
  };

  // Auto-backup logic: Run when Admin is logged in
  useEffect(() => {
    if (!db || !currentUser || currentUser.role !== UserRole.ADMIN) return;

    const checkAndAutoBackup = async () => {
      const now = new Date();
      
      // 1. Auto-backup for yesterday
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toISOString().split('T')[0];

      // Chỉ tạo 1 bản sao lưu hệ thống cho ngày hôm qua
      const hasBackup = backups.some(b => b.deptId === 'SYSTEM' && b.backupDate === yesterday);
      if (!hasBackup) {
        console.log(`Auto-backing up system for ${yesterday}`);
        await handleCreateBackup('SYSTEM', yesterday, 'Sao lưu hệ thống tự động', true);
      }

      // 2. Delete backups older than 5 days
      const fiveDaysAgoDate = new Date(now);
      fiveDaysAgoDate.setDate(fiveDaysAgoDate.getDate() - 5);
      const fiveDaysAgo = fiveDaysAgoDate.toISOString().split('T')[0];

      const oldBackups = backups.filter(b => b.backupDate < fiveDaysAgo);
      if (oldBackups.length > 0) {
        console.log(`Deleting ${oldBackups.length} old backups`);
        for (const b of oldBackups) {
          await deleteDoc(doc(db, "backups", b.id));
        }
      }
    };

    // Delay a bit to ensure all data is loaded
    const timer = setTimeout(() => {
      checkAndAutoBackup();
    }, 5000);

    return () => clearTimeout(timer);
  }, [currentUser, backups.length]);

  const handleRestoreBackup = async (backup: Backup) => {
    if (!db || !currentUser || currentUser.role !== UserRole.ADMIN) {
      alert('Chỉ quản trị viên mới có quyền khôi phục dữ liệu!');
      return;
    }
    const snapshot = JSON.parse(backup.snapshot);
    
    // Khôi phục từng loại dữ liệu
    // Lưu ý: Việc khôi phục này sẽ ghi đè/cập nhật dữ liệu hiện tại
    
    // 1. Khôi phục bệnh nhân
    for (const p of snapshot.patients) {
      await setDoc(doc(db, "patients", p.id), p);
    }

    // 2. Khôi phục chỉ định (Xóa các chỉ định hiện tại của khoa/ngày đó trước khi khôi phục?)
    // Để an toàn, ta sẽ ghi đè các chỉ định có trong snapshot
    for (const a of snapshot.appointments) {
      await setDoc(doc(db, "appointments", a.id), a);
    }

    // 3. Khôi phục nhân sự
    for (const s of snapshot.staff) {
      await setDoc(doc(db, "staff", s.id), s);
    }

    // 4. Khôi phục chấm công
    for (const r of snapshot.attendance) {
      await setDoc(doc(db, "attendance", r.id), r);
    }

    // 5. Khôi phục ca máy
    for (const s of snapshot.machineShifts) {
      await setDoc(doc(db, "machineShifts", s.id), s);
    }

    // 6. Khôi phục danh mục thủ thuật
    if (snapshot.procedures) {
      for (const pr of snapshot.procedures) {
        await setDoc(doc(db, "procedures", pr.id), pr);
      }
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!db) return;
    if (confirm('Xóa bản sao lưu này?')) {
      await deleteDoc(doc(db, "backups", backupId));
    }
  };


  const handleMainCapabilityToggle = (procId: string) => {
    if (!editingStaff) return;
    const current = editingStaff.mainCapabilityIds || [];
    const updated = current.includes(procId) 
        ? current.filter(id => id !== procId)
        : [...current, procId];
    setEditingStaff({ ...editingStaff, mainCapabilityIds: updated });
  };

  const handleAssistantCapabilityToggle = (procId: string) => {
    if (!editingStaff) return;
    const current = editingStaff.assistantCapabilityIds || [];
    const updated = current.includes(procId) 
        ? current.filter(id => id !== procId)
        : [...current, procId];
    setEditingStaff({ ...editingStaff, assistantCapabilityIds: updated });
  };

  if (!isFirebaseReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md space-y-6">
          <AlertCircle size={64} className="text-rose-500 mx-auto" />
          <h1 className="text-3xl font-black uppercase tracking-tight">Cấu hình chưa hoàn tất</h1>
          <p className="text-slate-400 font-medium">Cần API Key Firestore để ứng dụng hoạt động.</p>
        </div>
      </div>
    );
  }

  const handleNavigateToTimeline = (procedureId?: string, staffId?: string) => {
    setTimelineFilters({
      procedureIds: procedureId ? [procedureId] : [],
      staffIds: staffId ? [staffId] : []
    });
    setActiveTab('GENERAL_TIMELINE');
  };

  if (!currentUser) return <Login onLogin={handleLogin} users={users} />;

  if (!currentDept && activeTab !== 'ACCOUNT_MANAGER' && activeTab !== 'ACCOUNT_BACKUP') {
    return (
      <Dashboard 
        departments={DEPARTMENTS.filter(d => currentUser.viewableDeptIds.includes(d.id) || currentUser.editableDeptIds.includes(d.id) || currentUser.role === UserRole.ADMIN)} 
        onSelectDepartment={setCurrentDept} 
        onLogout={handleLogout}
        currentUser={currentUser}
        onManageAccounts={() => setActiveTab('ACCOUNT_MANAGER')}
        onManageBackups={() => setActiveTab('ACCOUNT_BACKUP')}
      />
    );
  }

  const handleUpdateProcedures = async (updatedProcs: Procedure[]) => {
    if (!db || !currentDept) return;
    try {
      // Identify procedures to delete (only within current department)
      const currentDeptProcIds = procedures.filter(p => p.deptId === currentDept.id).map(p => p.id);
      const newIds = updatedProcs.map(p => p.id);
      const idsToDelete = currentDeptProcIds.filter(id => !newIds.includes(id));

      for (const id of idsToDelete) {
        await deleteDoc(doc(db, "procedures", id));
      }

      for (const p of updatedProcs) {
        const procData: any = { ...p };
        Object.keys(procData).forEach(key => {
          if (procData[key] === undefined) {
            delete procData[key];
          }
        });
        await setDoc(doc(db, "procedures", p.id), procData);
      }
    } catch (error) {
      console.error("Error updating procedures:", error);
    }
  };

  const handleUpdateStatus = async (p: Patient, status: PatientStatus, dDate?: string) => {
    if (!db) return;
    if (!canEditCurrentDept) {
      alert("Bạn không có quyền cập nhật trạng thái bệnh nhân tại khoa này.");
      return;
    }
    try {
      const dischargeDateIso = dDate ? new Date(dDate).toISOString() : p.dischargeDate || null;
      const updatedPatient = { ...p, status, dischargeDate: dischargeDateIso };
      await setDoc(doc(db, "patients", p.id), updatedPatient);
    } catch (e) { 
      console.error(e);
      alert("Lỗi khi cập nhật trạng thái bệnh nhân.");
    }
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
          <div className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <button onClick={() => { setCurrentDept(null); setActiveTab('PATIENT_RECORDS'); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><Home size={20} /></button>
                  <div className="h-6 w-px bg-slate-200"></div>
                  <img src="/LogoYDCTLC.jpg" alt="Logo" className="h-8 w-auto object-contain mix-blend-multiply" />
                  {currentDept ? (
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{currentDept.name}</h2>
                  ) : (
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                      {activeTab === 'ACCOUNT_MANAGER' ? 'Quản lý Tài khoản' : activeTab === 'ACCOUNT_BACKUP' ? 'Quản lý Sao lưu' : 'Quản trị Hệ thống'}
                    </h2>
                  )}
              </div>
              <div className="flex items-center gap-4">
                  {currentDept && (
                    <>
                      <button 
                        onClick={() => setActiveTab('DEPT_MANAGER')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border ${activeTab === 'DEPT_MANAGER' ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                      >
                        <Building2 size={16} />
                        Quản lý Khoa
                      </button>
                      <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                          <span className="text-[10px] font-black text-slate-400 px-2 uppercase tracking-widest">Làm việc ngày:</span>
                          <DateInput value={activeDate} onChange={(val) => setActiveDate(val)} className="bg-white border-none rounded shadow-sm text-sm font-bold text-slate-700 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none">{currentUser.fullName}</p>
                    </div>
                    <button onClick={handleLogout} className="p-2.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-all" title="Đăng xuất"><LogOut size={20} /></button>
                  </div>
              </div>
          </div>
          
          {currentDept && (
            <div className="px-6 flex gap-1 overflow-x-auto border-t border-slate-100">
               {[
                   { id: 'PATIENT_RECORDS', label: 'Hồ sơ Bệnh nhân', icon: <FileText size={18} /> },
                   { id: 'SCHEDULING', label: 'Chỉ định thủ thuật', icon: <CalendarPlus size={18} /> },
                   { id: 'GENERAL_TIMELINE', label: 'Timeline Khoa', icon: <Table2 size={18} /> },
                   { id: 'DAILY_REPORT', label: 'Báo cáo thống kê', icon: <PieChart size={18} /> },
               ].map((tab) => (
                   <button key={tab.id} onClick={() => setActiveTab(tab.id as MainTab)} className={`flex items-center gap-2 px-6 py-3 border-b-2 text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}>{tab.icon}{tab.label}</button>
               ))}
            </div>
          )}
      </header>

      <main className="flex-1 p-6 overflow-hidden flex flex-col">
         {activeTab === 'ACCOUNT_MANAGER' && <AccountManager users={users} onSaveUser={handleSaveUser} onDeleteUser={handleDeleteUser} />}
         {activeTab === 'ACCOUNT_BACKUP' && <BackupManager backups={backups} departments={DEPARTMENTS} currentUser={currentUser} onCreateBackup={handleCreateBackup} onRestoreBackup={handleRestoreBackup} onDeleteBackup={handleDeleteBackup} />}
         
         {activeTab === 'PATIENT_RECORDS' && currentDept && <PatientList patients={patients} activeDate={activeDate} currentDept={currentDept} appointments={appointments} procedures={procedures} staff={staff} onAddPatient={() => { setEditingPatient(null); setIsPatientEditModalOpen(true); }} onEditPatient={p => { setEditingPatient(p); setIsPatientEditModalOpen(true); }} onDeletePatient={handleDeletePatient} onUpdateStatus={handleUpdateStatus} onReferral={(pid, s) => { setReferralModal({ patientId: pid, specialty: s, procedureIds: [] }); }} onFinishReferral={handleFinishReferral} onCancelFinishReferral={handleCancelFinishReferral} onCancelReferral={handleCancelReferral} />}

         {activeTab === 'SCHEDULING' && currentDept && <PatientScheduling patients={patients} currentDept={currentDept} appointments={appointments} templates={templates} procedures={procedures} staff={staff} attendanceRecords={attendanceRecords} machineShifts={machineShifts} currentDate={activeDate} currentUser={currentUser} onBookAppointment={(pid, appt) => { setEditingAppt(appt || { patientId: pid, date: activeDate }); setIsModalOpen(true); }} onUpdateAppointment={handleUpdateAppointment} onDeleteAppointment={handleDeleteAppointment} onCopyToDateRange={handleCopyToDateRange} onRecheckConflicts={handleRecheckConflicts} onAddShift={handleAddMachineShift} onUpdateShift={handleUpdateMachineShift} onDeleteShift={handleDeleteMachineShift} />}

         {activeTab === 'GENERAL_TIMELINE' && currentDept && <Timeline date={activeDate} staff={staff} appointments={deptAppointments} procedures={procedures} patients={patients} viewMode="GENERAL" filterText="" currentDept={currentDept} currentUser={currentUser} onAppointmentClick={a => { setEditingAppt(a); setIsModalOpen(true); }} onEmptySlotClick={(rid, t) => { setEditingAppt({ date: activeDate, startTime: t }); setIsModalOpen(true); }} onRecheckConflicts={handleRecheckConflicts} initialFilters={timelineFilters} />}

          {activeTab === 'DAILY_REPORT' && currentDept && (

           <DailyReport 
             appointments={appointments.filter(a => {
               if (a.date !== activeDate) return false;
               const proc = procedures.find(p => p.id === a.procedureId);
               const procedureDeptId = proc?.deptId || a.deptId;
               if (currentDept.type === DepartmentType.SUPPORT) {
                 // Khoa chuyên khoa (SUPPORT): Xem báo cáo các thủ thuật thuộc về khoa mình
                  // Hoặc nếu thủ thuật bị mất, kiểm tra deptId của appointment
                  return procedureDeptId === currentDept.id;
               } else {
                 // Khoa lâm sàng (CLINICAL): Xem báo cáo các thủ thuật do khoa mình chỉ định
                 const patient = patients.find(p => p.id === a.patientId);
                 return patient?.admittedByDeptId === currentDept.id;
               }
             })} 
             procedures={procedures} 
             staff={staff} 
             patients={patients}
             currentDept={currentDept}
             allDepts={DEPARTMENTS}
             onNavigateToTimeline={handleNavigateToTimeline} 
           />
         )}

         {activeTab === 'DEPT_MANAGER' && currentDept && (
             <div className="flex flex-col h-full gap-4">
                 <div className="flex bg-white rounded-lg p-1 w-fit shadow-sm border border-slate-200">
                     {['PERSONNEL', 'ATTENDANCE', 'PROCEDURES'].map(t => <button key={t} onClick={() => setManagerSubTab(t as ManagerTab)} className={`px-6 py-2 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${managerSubTab === t ? 'bg-primary text-white shadow' : 'text-slate-400 hover:bg-slate-100'}`}>{t === 'PERSONNEL' ? 'Nhân sự' : t === 'ATTENDANCE' ? 'Chấm công' : 'Danh mục'}</button>)}
                 </div>
                 <div className="flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        <StaffManager 
                           activeTab={managerSubTab} 
                           staff={staff} 
                           procedures={procedures} 
                           department={currentDept} 
                           attendanceRecords={attendanceRecords} 
                           onEditStaff={openStaffModal}
                           onDeleteStaff={handleDeleteStaff}
                           onUpdateAttendance={handleUpdateAttendance} 
                           onUpdateProcedures={handleUpdateProcedures} 
                           appointments={appointments}
                           onUpdateAppointments={setAppointments}
                           currentUser={currentUser!}
                        />
                 </div>
             </div>
         )}
      </main>

      {isModalOpen && currentDept && <BookingModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingAppt(undefined); }} onSave={handleSaveBooking} onAddPatient={handleSavePatient} staff={staff} patients={patients} procedures={procedures} appointments={appointments} attendanceRecords={attendanceRecords} machineShifts={machineShifts} currentDept={currentDept} initialData={editingAppt} />}

      {isPatientEditModalOpen && currentDept && (
          <PatientModal isOpen={isPatientEditModalOpen} onClose={() => { setIsPatientEditModalOpen(false); setEditingPatient(null); }} onSave={handleSavePatient} initialData={editingPatient} currentDept={currentDept} />
      )}

      {isStaffModalOpen && editingStaff && (
          <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90%] animate-in zoom-in-95 duration-200">
                  <div className="bg-primary p-6 text-white flex justify-between items-center shrink-0">
                      <div>
                        <h3 className="font-black text-xl flex items-center gap-3 uppercase tracking-tight">
                            <UserCog size={24} /> {editingStaff.id ? 'Cập nhật nhân sự' : 'Thêm nhân sự mới'}
                        </h3>
                        <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-1">Hồ sơ chuyên môn bệnh viện</p>
                      </div>
                      <button onClick={() => setIsStaffModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 scrollbar-thin space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Họ và tên đầy đủ</label>
                              <div className="relative">
                                <input 
                                    className="w-full border-2 border-slate-100 rounded-xl p-3 pl-10 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-slate-800 text-sm shadow-sm"
                                    value={editingStaff.name}
                                    onChange={e => setEditingStaff({ ...editingStaff, name: e.target.value })}
                                    placeholder="Nhập tên nhân viên..."
                                />
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                              </div>
                          </div>
                          <div className="space-y-3">
                              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Chức vụ / Vai trò</label>
                              <div className="relative">
                                <select 
                                    className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-slate-800 text-sm appearance-none cursor-pointer shadow-sm"
                                    value={editingStaff.role}
                                    onChange={e => setEditingStaff({ ...editingStaff, role: e.target.value as any })}
                                >
                                    <option value="Doctor">{getRoleLabel('Doctor')}</option>
                                    <option value="Technician">{getRoleLabel('Technician')}</option>
                                    <option value="Nurse">{getRoleLabel('Nurse')}</option>
                                    <option value="PhysicianAssistant">{getRoleLabel('PhysicianAssistant')}</option>
                                    <option value="Pharmacist">{getRoleLabel('Pharmacist')}</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                  <Building2 size={18} />
                                </div>
                              </div>
                          </div>
                      </div>

                      <div className="space-y-6">
                          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                             <div className="p-2 bg-primary/10 text-primary rounded-lg">
                               <Briefcase size={20} />
                             </div>
                             <div>
                               <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">Khả năng chuyên môn (Tay nghề)</h4>
                               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Danh mục các thủ thuật nhân viên được phép thực hiện</p>
                             </div>
                             <div className="ml-auto flex gap-2">
                                <div className="bg-blue-50 px-3 py-1.5 rounded-lg text-[10px] font-black text-blue-600 uppercase tracking-widest border border-blue-100">
                                   Chính: {editingStaff.mainCapabilityIds?.filter(id => procedures.some(p => p.id === id)).length || 0}
                                </div>
                                <div className="bg-emerald-50 px-3 py-1.5 rounded-lg text-[10px] font-black text-emerald-600 uppercase tracking-widest border border-emerald-100">
                                   Phụ: {editingStaff.assistantCapabilityIds?.filter(id => procedures.some(p => p.id === id)).length || 0}
                                </div>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-slate-50/50 rounded-2xl border-2 border-slate-100">
                              {procedures.filter(p => p.deptId === editingStaff.deptId).map(proc => {
                                  const isMain = editingStaff.mainCapabilityIds?.includes(proc.id);
                                  const isAssistant = editingStaff.assistantCapabilityIds?.includes(proc.id);
                                  return (
                                      <div key={proc.id} className={`flex flex-col gap-2 p-3 rounded-xl transition-all border-2 shadow-sm bg-white ${isMain || isAssistant ? 'border-primary/20 ring-2 ring-primary/5' : 'border-transparent hover:border-slate-200 hover:shadow-md'}`}>
                                          <div className="flex items-center gap-2 mb-1">
                                              <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${isMain || isAssistant ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>{getAbbreviation(proc.name)}</div>
                                              <span className={`text-xs tracking-tight ${isMain || isAssistant ? 'font-black text-slate-800' : 'font-bold text-slate-400'}`}>{proc.name}</span>
                                          </div>
                                          <div className="flex gap-3">
                                              <label className="flex items-center gap-1.5 cursor-pointer group">
                                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isMain ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-200' : 'border-slate-200 bg-slate-50 group-hover:border-blue-300'}`}>
                                                      {isMain && <Check size={12} className="text-white" strokeWidth={4} />}
                                                  </div>
                                                  <input 
                                                      type="checkbox"
                                                      className="hidden"
                                                      checked={isMain || false}
                                                      onChange={() => handleMainCapabilityToggle(proc.id)}
                                                  />
                                                  <span className={`text-[9px] font-black uppercase tracking-widest ${isMain ? 'text-blue-600' : 'text-slate-400'}`}>Chính</span>
                                              </label>
                                              <label className="flex items-center gap-1.5 cursor-pointer group">
                                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isAssistant ? 'bg-emerald-600 border-emerald-600 shadow-md shadow-emerald-200' : 'border-slate-200 bg-slate-50 group-hover:border-emerald-300'}`}>
                                                      {isAssistant && <Check size={12} className="text-white" strokeWidth={4} />}
                                                  </div>
                                                  <input 
                                                      type="checkbox"
                                                      className="hidden"
                                                      checked={isAssistant || false}
                                                      onChange={() => handleAssistantCapabilityToggle(proc.id)}
                                                  />
                                                  <span className={`text-[9px] font-black uppercase tracking-widest ${isAssistant ? 'text-emerald-600' : 'text-slate-400'}`}>Phụ</span>
                                              </label>
                                          </div>
                                      </div>
                                  )
                              })}
                          </div>
                      </div>
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-4 shrink-0">
                      <button onClick={() => setIsStaffModalOpen(false)} className="px-6 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-800 transition-colors">HỦY BỎ</button>
                      <Button onClick={handleSaveStaff} className="px-8 h-12 rounded-xl shadow-xl shadow-primary/20 text-sm">
                          <Save size={18} /> LƯU THÔNG TIN
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {referralModal && currentDept && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 max-w-md w-full shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] space-y-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 text-center uppercase tracking-tighter leading-tight">
              GỬI KHÁM CHUYÊN KHOA:<br/>
              <span className="text-primary">{DEPARTMENTS.find(d => d.id === referralModal.specialty)?.name || referralModal.specialty}</span>
            </h3>
            <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-widest -mt-4">Danh sách thủ thuật của chuyên khoa này</p>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chỉ định thủ thuật</label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-thin">
                  {procedures.filter(proc => {
                    const targetDept = DEPARTMENTS.find(d => d.id === referralModal.specialty);
                    return proc.deptId === targetDept?.id;
                  }).map(proc => {
                    const isSelected = referralModal.procedureIds.includes(proc.id);
                    return (
                      <label key={proc.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${isSelected ? 'bg-primary/5 border-primary' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                        <input 
                          type="checkbox" 
                          className="hidden" 
                          checked={isSelected} 
                          onChange={() => {
                            const newIds = isSelected 
                              ? referralModal.procedureIds.filter(id => id !== proc.id)
                              : [...referralModal.procedureIds, proc.id];
                            setReferralModal({...referralModal, procedureIds: newIds});
                          }}
                        />
                        <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${isSelected ? 'bg-primary border-primary' : 'border-slate-300'}`}>
                          {isSelected && <Check size={14} className="text-white" strokeWidth={4} />}
                        </div>
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black ${isSelected ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>{getAbbreviation(proc.name)}</div>
                        <span className={`text-xs ${isSelected ? 'font-black text-slate-800' : 'font-bold text-slate-500'}`}>{proc.name}</span>
                      </label>
                    );
                  })}
                  {procedures.filter(proc => {
                    const targetDept = DEPARTMENTS.find(d => d.id === referralModal.specialty);
                    return proc.deptId === targetDept?.id;
                  }).length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">Chưa có thủ thuật nào được cấu hình cho chuyên khoa này.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setReferralModal(null)} 
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-2xl transition-all uppercase tracking-widest text-xs"
              >
                HỦY
              </button>
              <button 
                onClick={() => handlePatientReferral(referralModal.patientId, referralModal.specialty, referralModal.procedureIds)} 
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200 uppercase tracking-widest text-xs"
                disabled={referralModal.procedureIds.length === 0}
              >
                GỬI NGAY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
