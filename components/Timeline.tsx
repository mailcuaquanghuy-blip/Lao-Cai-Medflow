
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Staff, Appointment, AppointmentStatus, Procedure, Patient, TimelineViewMode, Department, UserAccount, UserRole } from '../types';
import { BUSINESS_HOURS, DEPARTMENTS, MOCK_PROCEDURES } from '../constants';
import { timeStringToMinutes, minutesToPixels, calculateAge, isInsideOfficeHours, getRoleLabel } from '../utils/timeUtils';
import { Zap, User, UserCog, Monitor, Filter, Calendar, Bed, Clock, Search, Check, ChevronDown, Printer, Building2, AlertTriangle, Info, Plus, RefreshCw } from 'lucide-react';

interface MultiSelectProps {
  placeholder: string;
  options: { id: string; label: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  icon: React.ReactNode;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ placeholder, options, selectedIds, onChange, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(prev => prev !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative flex-1 min-w-[200px]" ref={wrapperRef}>
       <div 
         className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm cursor-pointer flex items-center justify-between shadow-sm transition-all h-[40px] ${isOpen ? 'ring-2 ring-primary/20 border-primary' : 'border-slate-200 bg-white hover:border-primary/50'}`}
         onClick={() => setIsOpen(!isOpen)}
       >
         <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
             {icon}
         </div>
         <div className="flex-1 truncate select-none">
             <span className={`${selectedIds.length === 0 ? 'text-slate-400' : 'text-slate-800 font-bold'}`}>
                 {selectedIds.length === 0 
                    ? placeholder 
                    : `Đã chọn (${selectedIds.length})`}
             </span>
         </div>
         <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
       </div>

       {isOpen && (
         <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] max-h-[300px] flex flex-col p-2 animate-in fade-in zoom-in-95 duration-100 origin-top">
             <div className="relative mb-2 shrink-0">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                    className="w-full border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="Tìm kiếm..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                />
             </div>
             <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-200 pr-1">
                 {filteredOptions.length === 0 ? (
                     <div className="text-center text-xs text-slate-400 py-4">Không tìm thấy dữ liệu</div>
                 ) : (
                     filteredOptions.map(opt => (
                         <div 
                            key={opt.id} 
                            className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedIds.includes(opt.id) ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleOption(opt.id);
                            }}
                         >
                            <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center transition-all shrink-0 ${selectedIds.includes(opt.id) ? 'bg-primary border-primary shadow-sm' : 'border-slate-300 bg-white'}`}>
                                {selectedIds.includes(opt.id) && <Check size={10} className="text-white" />}
                            </div>
                            <span className={`text-xs leading-tight ${selectedIds.includes(opt.id) ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>{opt.label}</span>
                         </div>
                     ))
                 )}
             </div>
             {selectedIds.length > 0 && (
                 <div className="pt-2 mt-2 border-t border-slate-100 flex justify-end shrink-0">
                     <button 
                        className="text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange([]);
                        }}
                     >
                         Xóa bộ lọc
                     </button>
                 </div>
             )}
         </div>
       )}
    </div>
  );
};

interface TimelineProps {
  date: string;
  staff: Staff[];
  appointments: Appointment[];
  procedures: Procedure[];
  patients: Patient[];
  viewMode: TimelineViewMode;
  filterText: string;
  currentDept?: Department;
  currentUser?: UserAccount;
  onAppointmentClick: (appt: Appointment) => void;
  onEmptySlotClick: (rowId: string, time: string, mode: TimelineViewMode) => void;
  onRecheckConflicts?: () => void;
  initialFilters?: {
    procedureIds?: string[];
    staffIds?: string[];
  };
}

export const Timeline: React.FC<TimelineProps> = ({
  date,
  staff,
  appointments,
  procedures,
  patients,
  viewMode,
  filterText,
  currentDept,
  currentUser,
  onAppointmentClick,
  onEmptySlotClick,
  onRecheckConflicts,
  initialFilters,
}) => {
  const pixelsPerMinute = 1.8;
  const startHour = 0;       
  const endHour = 24;        
  const totalMinutes = (endHour - startHour) * 60;
  const timelineWidth = minutesToPixels(totalMinutes, pixelsPerMinute);

  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<string[]>(initialFilters?.procedureIds || []);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(initialFilters?.staffIds || []);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);

  useEffect(() => {
    if (initialFilters?.procedureIds) {
      setSelectedProcedureIds(initialFilters.procedureIds);
    }
    if (initialFilters?.staffIds) {
      setSelectedStaffIds(initialFilters.staffIds);
    }
  }, [initialFilters]);

  const rows = useMemo(() => {
    switch (viewMode) {
      case 'PROCEDURE':
        return [...procedures]
          .sort((a, b) => {
            const aIsCurrent = !currentDept || a.deptId === currentDept.id;
            const bIsCurrent = !currentDept || b.deptId === currentDept.id;
            if (aIsCurrent && !bIsCurrent) return -1;
            if (!aIsCurrent && bIsCurrent) return 1;
            return a.name.localeCompare(b.name);
          })
          .map(p => ({
            id: p.id,
            title: p.name,
            subtitle: `${p.durationMinutes} phút`,
            color: 'bg-amber-500',
            icon: <Zap size={14} />
          }));
      case 'PATIENT': 
        return patients.filter(p => p.status === 'TREATING').map(p => ({
          id: p.id,
          title: p.name,
          subtitle: `Giường: ${p.bedNumber} - ${calculateAge(p.dob)}t`,
          color: 'bg-emerald-500',
          icon: <User size={14} />
        }));
      case 'STAFF':
        return staff.filter(s => !currentDept || s.deptId === currentDept.id).map(s => ({
          id: s.id,
          title: s.name,
          subtitle: s.role === 'Doctor' ? 'Bác sĩ' : 
                    s.role === 'Technician' ? 'KTV' : 
                    s.role === 'Nurse' ? 'Điều dưỡng' : 
                    s.role === 'PhysicianAssistant' ? 'Y sĩ' : 
                    s.role === 'Pharmacist' ? 'Dược sĩ' : s.role,
          color: s.role === 'Doctor' ? 'bg-indigo-500' : 
                 s.role === 'Pharmacist' ? 'bg-emerald-500' : 
                 s.role === 'PhysicianAssistant' ? 'bg-purple-500' : 'bg-sky-500',
          icon: <UserCog size={14} />
        }));
      default:
        return [];
    }
  }, [viewMode, staff, procedures, patients]);

  const filteredAppointments = useMemo(() => {
    let result = appointments;
    
    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter(a => {
        const p = patients.find(pat => pat.id === a.patientId);
        const s = staff.find(st => st.id === a.staffId);
        const pr = procedures.find(proc => proc.id === a.procedureId);
        return (
          (p?.name?.toLowerCase().includes(lower)) ||
          (s?.name?.toLowerCase().includes(lower)) ||
          (pr?.name?.toLowerCase().includes(lower))
        );
      });
    }

    if (viewMode === 'GENERAL') {
        if (selectedPatientIds.length > 0) {
            result = result.filter(a => selectedPatientIds.includes(a.patientId));
        }
        if (selectedProcedureIds.length > 0) {
            result = result.filter(a => selectedProcedureIds.includes(a.procedureId));
        }
        if (selectedStaffIds.length > 0) {
            result = result.filter(a => selectedStaffIds.includes(a.staffId) || (a.assistant1Id && selectedStaffIds.includes(a.assistant1Id)) || (a.assistant2Id && selectedStaffIds.includes(a.assistant2Id)));
        }
        if (selectedDeptIds.length > 0) {
            result = result.filter(a => {
                const proc = procedures.find(p => p.id === a.procedureId);
                const mockProc = MOCK_PROCEDURES.find(p => p.id === a.procedureId);
                const procedureDeptId = proc?.deptId || mockProc?.deptId || a.deptId;
                return selectedDeptIds.includes(procedureDeptId || '');
            });
        }
    }

    const enriched = result.map(appt => {
        const start = timeStringToMinutes(appt.startTime);
        const end = timeStringToMinutes(appt.endTime);
        const overlaps = result.filter(other => {
            if (appt.id === other.id) return false;
            const oStart = timeStringToMinutes(other.startTime);
            const oEnd = timeStringToMinutes(other.endTime);
            return Math.max(start, oStart) < Math.min(end, oEnd);
        }).length;
        return { ...appt, overlapLevel: overlaps };
    });

    if (viewMode === 'GENERAL') {
        return [...enriched].sort((a, b) => {
            const aIsCurrent = !currentDept || a.deptId === currentDept.id;
            const bIsCurrent = !currentDept || b.deptId === currentDept.id;
            
            if (aIsCurrent && !bIsCurrent) return -1;
            if (!aIsCurrent && bIsCurrent) return 1;
            
            return timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime);
        });
    }
    return enriched;
  }, [appointments, filterText, patients, staff, procedures, viewMode, selectedPatientIds, selectedProcedureIds, selectedStaffIds, selectedDeptIds]);

  const getStatusColor = (status: AppointmentStatus, isOutside: boolean, isCurrentDept: boolean = true) => {
    if (!isCurrentDept) return 'bg-slate-50 border-slate-200 text-slate-400 opacity-40 grayscale-[0.5]';
    if (status === AppointmentStatus.COMPLETED) return 'bg-emerald-100 border-emerald-300 text-emerald-800';
    if (status === AppointmentStatus.IN_PROGRESS) return 'bg-sky-100 border-sky-300 text-sky-800';
    if (status === AppointmentStatus.CONFLICT || isOutside) return 'bg-rose-500 border-rose-700 text-white animate-blink shadow-[0_0_15px_rgba(244,63,94,0.5)]';
    return 'bg-white border-blue-500 text-slate-700 shadow-sm shadow-blue-100';
  };

  const getBarColor = (index: number, status: string, isOutside: boolean, isCurrentDept: boolean = true) => {
      if (!isCurrentDept) return 'bg-slate-50 border-slate-200 text-slate-400 opacity-40 grayscale-[0.5]';
      if (status === 'COMPLETED') return 'bg-emerald-50 border-emerald-400 text-emerald-900';
      if (status === 'CONFLICT' || isOutside) return 'bg-rose-500 border-rose-700 text-white animate-blink shadow-[0_0_20px_rgba(244,63,94,0.6)]';
      
      const colors = [
          'bg-blue-50 border-blue-500 text-blue-900 shadow-sm shadow-blue-100',
          'bg-amber-50 border-blue-500 text-amber-900 shadow-sm shadow-blue-100',
          'bg-cyan-50 border-blue-500 text-cyan-900 shadow-sm shadow-blue-100',
          'bg-violet-50 border-blue-500 text-violet-900 shadow-sm shadow-blue-100'
      ];
      return colors[index % colors.length];
  };

  const renderTimeRuler = (showLabels: boolean = true) => {
    const hours = [];
    for (let i = startHour; i <= endHour; i++) {
      hours.push(
        <div 
          key={i} 
          className={`absolute top-0 bottom-0 border-l ${showLabels ? 'border-slate-300' : 'border-slate-100'} text-[10px] text-slate-400 pl-1 select-none pointer-events-none flex items-end pb-1`}
          style={{ left: minutesToPixels((i - startHour) * 60, pixelsPerMinute) }}
        >
          {showLabels ? `${i}h` : ''}
        </div>
      );
    }
    return hours;
  };

  const handlePrintTimeline = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formattedDate = new Date(date).toLocaleDateString('vi-VN');
    const deptName = currentDept?.name || 'YHCT';

    const tableRows = filteredAppointments.map((appt, idx) => {
      const patient = patients.find(p => p.id === appt.patientId);
      const staffMember = staff.find(s => s.id === appt.staffId);
      const procedure = procedures.find(p => p.id === appt.procedureId);
      const mockProc = MOCK_PROCEDURES.find(p => p.id === appt.procedureId);
      const procedureDeptId = procedure?.deptId || mockProc?.deptId || appt.deptId;
      const performingDept = DEPARTMENTS.find(d => d.id === procedureDeptId);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td><b>${patient?.name || 'Không yêu cầu BN'}</b><br/><small>${patient ? `${patient.gender} • ${calculateAge(patient.dob)}t` : '-'}</small></td>
          <td style="text-align:center">${patient ? `${patient.bedNumber} - P:${patient.roomNumber || '?'}` : '-'}</td>
          <td>${performingDept?.name || '-'}</td>
          <td>${procedure?.name || mockProc?.name || 'Không xác định'}</td>
          <td>${staffMember?.name}</td>
          <td style="text-align:center">${appt.startTime} - ${appt.endTime}</td>
          <td style="text-align:center">${appt.assignedMachineId || '-'}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Timeline Tổng - ${formattedDate}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0ea5e9; padding-bottom: 20px; }
            .header h1 { margin: 0; color: #0ea5e9; text-transform: uppercase; letter-spacing: 2px; }
            .header p { margin: 5px 0 0; font-weight: bold; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
            th, td { border: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; font-size: 13px; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 30px; text-align: right; font-style: italic; font-size: 12px; color: #94a3b8; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Lịch Trình Thủ Thuật Tổng Quát</h1>
            <p>Khoa: ${deptName} | Ngày: ${formattedDate}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>Bệnh nhân</th>
                <th>Giường/Phòng</th>
                <th>Khoa thực hiện</th>
                <th>Thủ thuật</th>
                <th>Nhân viên</th>
                <th>Thời gian</th>
                <th>Máy</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            Xuất lúc: ${new Date().toLocaleString('vi-VN')} - Lào Cai MedFlow Systems
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (viewMode === 'GENERAL') {
    return (
      <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row items-start md:items-center gap-6">
           <div className="shrink-0 flex items-center justify-between w-full md:w-auto gap-4">
               <div>
                   <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tổng hợp hoạt động</div>
                   <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                       Timeline Khoa
                   </h2>
               </div>
               <button onClick={handlePrintTimeline} className="md:hidden p-3 bg-white border border-slate-200 rounded-2xl text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                 <Printer size={20} />
               </button>
           </div>

           <div className="flex-1 w-full border-2 border-blue-400/50 border-dashed bg-blue-50/30 rounded-xl p-3">
               <div className="flex flex-col md:flex-row gap-3">
                   <MultiSelect placeholder="Lọc Bệnh nhân..." options={patients.filter(p => p.status === 'TREATING').map(p => ({ id: p.id, label: p.name }))} selectedIds={selectedPatientIds} onChange={setSelectedPatientIds} icon={<User size={14} />} />
                   <MultiSelect placeholder="Lọc khoa thực hiện..." options={DEPARTMENTS.map(d => ({ id: d.id, label: d.name }))} selectedIds={selectedDeptIds} onChange={setSelectedDeptIds} icon={<Building2 size={14} />} />
                   <MultiSelect placeholder="Lọc Thủ thuật..." options={procedures.map(p => ({ id: p.id, label: p.name }))} selectedIds={selectedProcedureIds} onChange={setSelectedProcedureIds} icon={<Zap size={14} />} />
                   <MultiSelect placeholder="Lọc Nhân viên..." options={staff.filter(s => !currentDept || s.deptId === currentDept.id).map(s => ({ id: s.id, label: s.name }))} selectedIds={selectedStaffIds} onChange={setSelectedStaffIds} icon={<UserCog size={14} />} />
                   <button onClick={handlePrintTimeline} className="hidden md:flex h-[40px] px-4 bg-white border border-slate-200 rounded-lg text-primary hover:bg-primary hover:text-white transition-all shadow-sm items-center gap-2 font-bold text-sm shrink-0">
                     <Printer size={16} /> In báo cáo
                   </button>
                   {onRecheckConflicts && (
                     <button onClick={onRecheckConflicts} className="hidden md:flex h-[40px] px-4 bg-white border border-slate-200 rounded-lg text-amber-600 hover:bg-amber-50 transition-all shadow-sm items-center gap-2 font-bold text-sm shrink-0">
                       <RefreshCw size={16} /> Kiểm tra lỗi
                     </button>
                   )}
                   <button onClick={() => onEmptySlotClick('', '08:00', 'GENERAL')} className="hidden md:flex h-[40px] px-4 bg-primary border border-primary rounded-lg text-white hover:bg-primary/90 transition-all shadow-sm items-center gap-2 font-bold text-sm shrink-0">
                     <Plus size={16} /> Thêm chỉ định
                   </button>
               </div>
           </div>
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-300 relative">
          <table className="min-w-max w-full text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 z-50 shadow-sm border-b border-slate-200 uppercase text-[10px] tracking-wider">
              <tr className="divide-x divide-slate-200 h-10">
                <th className="p-3 w-[200px] sticky left-0 bg-slate-50 z-50 text-left">Bệnh nhân</th>
                <th className="p-3 w-32 text-center">Giường/Phòng</th>
                <th className="p-3 w-32 text-left">Khoa thực hiện</th>
                <th className="p-3 w-48 text-left">Thủ thuật & Cảnh báo</th>
                <th className="p-3 w-32 text-left">Nhân viên</th>
                <th className="p-3 w-24 text-center">Thời gian</th>
                <th className="p-3 w-20 text-center">Máy</th>
                <th className="p-0 min-w-[800px] relative bg-slate-100/50">
                   <div className="h-full w-full relative" style={{ width: timelineWidth }}>
                        {renderTimeRuler(true)}
                   </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredAppointments.map((appt, idx) => {
                const patient = patients.find(p => p.id === appt.patientId);
                const staffMember = staff.find(s => s.id === appt.staffId);
                const procedure = procedures.find(p => p.id === appt.procedureId);
                const mockProc = MOCK_PROCEDURES.find(p => p.id === appt.procedureId);
                const procedureDeptId = procedure?.deptId || mockProc?.deptId || appt.deptId;
                const performingDept = DEPARTMENTS.find(d => d.id === procedureDeptId);
                const startMin = timeStringToMinutes(appt.startTime);
                const endMin = timeStringToMinutes(appt.endTime);
                const duration = endMin - startMin;
                const width = minutesToPixels(duration, pixelsPerMinute);
                const left = minutesToPixels(startMin, pixelsPerMinute);
                const isOutside = !isInsideOfficeHours(startMin, endMin);
                const hasConflict = appt.status === AppointmentStatus.CONFLICT;
                const displayWidth = Math.max(width, 50);
                
                const marqueeContent = `(${procedure?.name || mockProc?.name || 'Không xác định'}) ${appt.startTime} - ${appt.endTime}, ${staffMember?.name}${appt.assistant1Id ? `, Phụ 1: ${staff.find(s => s.id === appt.assistant1Id)?.name}` : ''}${appt.assistant2Id ? `, Phụ 2: ${staff.find(s => s.id === appt.assistant2Id)?.name}` : ''}${appt.assignedMachineId ? `, Máy: ${appt.assignedMachineId}` : ''}`;

                return (
                  <tr key={appt.id} className={`hover:bg-slate-50 transition-all group min-h-[5rem] ${hasConflict || isOutside ? 'bg-rose-50/20' : ''}`}>
                    <td className="p-3 font-medium text-slate-800 sticky left-0 bg-white z-20 group-hover:bg-slate-50 shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-slate-100">
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-primary">{patient?.name || 'Không yêu cầu BN'}</span>
                            <span className="text-[10px] text-slate-400 font-bold">{patient ? `${patient.gender} • ${calculateAge(patient.dob)} tuổi` : '-'}</span>
                        </div>
                    </td>
                    <td className="p-3 text-center border-r border-slate-100">
                        <div className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold">
                            <Bed size={12} /> {patient ? `${patient.bedNumber} - P:${patient.roomNumber || '?'}` : '-'}
                        </div>
                    </td>
                    <td className="p-3 border-r border-slate-100">
                        <div className="flex flex-col">
                            <span className="font-black text-[9px] text-primary uppercase leading-tight">{performingDept?.name || '-'}</span>
                        </div>
                    </td>
                    <td className={`p-3 border-r border-slate-100 ${hasConflict || isOutside ? 'bg-rose-50' : ''}`}>
                        <div className="flex flex-col gap-1">
                            <span className={`font-bold ${hasConflict || isOutside ? 'text-rose-700' : 'text-slate-700'}`}>{procedure?.name || mockProc?.name || 'Không xác định'}</span>
                            {isOutside && (
                                <div className="flex items-center gap-1 text-[9px] text-amber-600 font-black uppercase tracking-tight">
                                    <Clock size={10} /> Ngoài giờ HC
                                </div>
                            )}
                            {hasConflict && appt.conflictDetails && appt.conflictDetails.map((msg, mIdx) => (
                                <div key={mIdx} className="flex items-start gap-1 text-[9px] text-rose-600 font-bold bg-rose-100/50 p-1 rounded mt-0.5">
                                    <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                                    <span>{typeof msg === 'string' ? msg : msg.message}</span>
                                </div>
                            ))}
                            {hasConflict && (!appt.conflictDetails || appt.conflictDetails.length === 0) && (
                                <div className="flex items-start gap-1 text-[9px] text-rose-600 font-bold bg-rose-100/50 p-1 rounded mt-0.5">
                                    <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                                    <span>Có lỗi xung đột (Vui lòng kiểm tra lại)</span>
                                </div>
                            )}
                        </div>
                    </td>
                    <td className="p-3 border-r border-slate-100 text-slate-600">
                        <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-800">{staffMember?.name}</span>
                            {appt.assistant1Id && <span className="text-[10px] text-slate-500">Phụ 1: {staff.find(s => s.id === appt.assistant1Id)?.name}</span>}
                            {appt.assistant2Id && <span className="text-[10px] text-slate-500">Phụ 2: {staff.find(s => s.id === appt.assistant2Id)?.name}</span>}
                        </div>
                    </td>
                    <td className="p-3 text-center font-mono border-r border-slate-100">
                        {appt.startTime} - {appt.endTime}
                    </td>
                     <td className="p-3 text-center border-r border-slate-100">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${appt.assignedMachineId ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                          {appt.assignedMachineId || '-'}
                       </span>
                    </td>
                    <td className="p-0 relative bg-slate-50/20">
                      <div className="relative h-full w-full" style={{ width: timelineWidth }}>
                        {renderTimeRuler(false)}
                        {procedure?.restMinutes ? (
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 rounded-r-lg border-y-2 border-r-2 border-slate-200 bg-slate-200/50 flex items-center overflow-hidden z-0 pointer-events-none"
                            style={{ left: left + displayWidth - 4, width: minutesToPixels(procedure.restMinutes, pixelsPerMinute) + 4, height: 40 }}
                          >
                             <div className="px-2 pl-3 text-[9px] font-bold text-slate-500 whitespace-nowrap">Nghỉ {procedure.restMinutes}p</div>
                          </div>
                        ) : null}
                        <div 
                          onClick={() => onAppointmentClick(appt)} 
                          className={`absolute top-1/2 -translate-y-1/2 rounded-lg border-2 shadow-sm flex items-center overflow-hidden cursor-pointer hover:z-30 hover:scale-[1.02] hover:shadow-md transition-all z-10 ${getBarColor(idx, appt.status, isOutside, !currentDept || appt.deptId === currentDept.id)}`} 
                          style={{ left, width: displayWidth, height: 48 }}
                        >
                           <div className="flex whitespace-nowrap animate-marquee px-2 pointer-events-none select-none min-w-max">
                              <span className="font-black text-[10px] mr-12 shrink-0">{marqueeContent}</span>
                              <span className="font-black text-[10px] mr-12 shrink-0">{marqueeContent}</span>
                              <span className="font-black text-[10px] mr-12 shrink-0">{marqueeContent}</span>
                           </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-slate-300">
        <div className="min-w-max pb-10">
          <div className="flex border-b border-slate-200 sticky top-0 bg-slate-50 z-40 h-12 shadow-sm">
            <div className="w-72 px-6 flex items-center font-bold text-slate-500 bg-slate-50 border-r border-slate-200 sticky left-0 z-50 text-xs uppercase tracking-wider">
               {viewMode === 'STAFF' && 'Nhân sự'}
               {viewMode === 'PROCEDURE' && 'Thủ thuật'}
               {viewMode === 'PATIENT' && 'Bệnh nhân'}
            </div>
            <div className="relative h-full" style={{ width: timelineWidth }}>
              {renderTimeRuler(true)}
            </div>
          </div>

          {rows.map((row) => (
            <div key={row.id} className="flex border-b border-slate-100 hover:bg-slate-50/50 transition-all group min-h-[90px]">
              <div className="w-72 p-4 border-r border-slate-200 bg-white sticky left-0 z-10 flex items-center gap-4 group-hover:bg-slate-50/80 shadow-[2px_0_10px_-5px_rgba(0,0,0,0.05)]">
                <div className={`w-1.5 h-10 rounded-full shrink-0 ${row.color}`}></div>
                <div className="overflow-hidden">
                  <div className="text-sm font-bold text-slate-800 truncate" title={row.title}>{row.title}</div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 truncate mt-0.5">
                    {row.icon}
                    {row.subtitle}
                  </div>
                </div>
              </div>

              <div className="relative h-auto min-h-[90px] cursor-crosshair" style={{ width: timelineWidth }} onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
                  const minutesFromStart = x / pixelsPerMinute;
                  const clickedMinutes = startHour * 60 + minutesFromStart;
                  const roundedMinutes = Math.floor(clickedMinutes / 15) * 15;
                  const hours = Math.floor(roundedMinutes / 60);
                  const minutes = roundedMinutes % 60;
                  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                  onEmptySlotClick(row.id, timeString, viewMode);
                }}>
                {renderTimeRuler(false)}
                {filteredAppointments.filter(a => {
                    if (viewMode === 'STAFF') return a.staffId === row.id || a.assistant1Id === row.id || a.assistant2Id === row.id;
                    if (viewMode === 'PROCEDURE') return a.procedureId === row.id;
                    if (viewMode === 'PATIENT') return a.patientId === row.id;
                    return false;
                }).map(appt => {
                    const startMin = timeStringToMinutes(appt.startTime);
                    const endMin = timeStringToMinutes(appt.endTime);
                    const width = minutesToPixels(endMin - startMin, pixelsPerMinute);
                    const left = minutesToPixels(startMin, pixelsPerMinute);
                    const patient = patients.find(p => p.id === appt.patientId);
                    const procedure = procedures.find(p => p.id === appt.procedureId);
                    const mockProc = MOCK_PROCEDURES.find(p => p.id === appt.procedureId);
                    const staffMember = staff.find(s => s.id === appt.staffId);
                    const isOutside = !isInsideOfficeHours(startMin, endMin);
                    const hasConflict = appt.status === AppointmentStatus.CONFLICT;

                    const displayWidth = Math.max(width, 100);

                    return (
                      <React.Fragment key={appt.id}>
                        {procedure?.restMinutes ? (
                          <div 
                            className="absolute top-4 bottom-4 rounded-r-lg border-y border-r border-slate-200 bg-slate-200/50 flex items-center overflow-hidden z-10 pointer-events-none"
                            style={{ left: left + displayWidth - 4, width: minutesToPixels(procedure.restMinutes, pixelsPerMinute) + 4 }}
                          >
                             <div className="px-2 pl-3 text-[9px] font-bold text-slate-500 whitespace-nowrap truncate">Nghỉ {procedure.restMinutes}p</div>
                          </div>
                        ) : null}
                        <div onClick={(e) => { e.stopPropagation(); onAppointmentClick(appt); }} className={`absolute top-3 bottom-3 rounded-lg border px-3 py-2 cursor-pointer hover:shadow-lg hover:z-50 hover:scale-[1.02] transition-all z-20 flex flex-col justify-between overflow-hidden ${getStatusColor(appt.status, isOutside, !currentDept || appt.deptId === currentDept.id)}`} style={{ left, width: displayWidth }}>
                         <div className={`font-bold text-xs truncate ${hasConflict || isOutside ? 'text-white' : 'text-slate-900'}`}>
                            {viewMode !== 'PATIENT' ? (patient?.name || 'Không yêu cầu BN') : staffMember?.name}
                            {viewMode === 'STAFF' && appt.assistant1Id === row.id && <span className="ml-1 text-[9px] bg-white/30 px-1 rounded">Phụ 1</span>}
                            {viewMode === 'STAFF' && appt.assistant2Id === row.id && <span className="ml-1 text-[9px] bg-white/30 px-1 rounded">Phụ 2</span>}
                         </div>
                         <div className={`text-[10px] font-medium truncate flex items-center gap-1 ${hasConflict || isOutside ? 'text-white/80' : 'text-slate-500'}`}>
                            <Zap size={10} />{viewMode !== 'PROCEDURE' ? (procedure?.name || mockProc?.name || 'Không xác định') : staffMember?.name}
                            {viewMode !== 'STAFF' && (appt.assistant1Id || appt.assistant2Id) && (
                                <span className="ml-1 text-[9px] opacity-70">
                                    (Phụ: {[
                                        staff.find(s => s.id === appt.assistant1Id)?.name,
                                        staff.find(s => s.id === appt.assistant2Id)?.name
                                    ].filter(Boolean).join(', ')})
                                </span>
                            )}
                         </div>
                         <div className="absolute top-2 right-2 text-[9px] font-mono font-bold opacity-50 bg-slate-100 px-1 rounded text-slate-800">{appt.startTime}</div>
                      </div>
                      </React.Fragment>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
