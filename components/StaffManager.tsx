
import React, { useState, useMemo } from 'react';
import { Staff, Procedure, AttendanceRecord, AttendanceStatus, Department, Patient, Appointment, UserAccount, UserRole } from '../types';
import { 
  UserCog, Check, X, Settings2, CalendarOff, Save, Briefcase, Plus, Trash2, User, Stethoscope, Pencil, 
  UserPlus, Users, Search, ArrowLeft, Bed, Clock, LogOut, Activity, Zap, Lock, Info, Printer,
  Sun, Dumbbell, Waves, Droplet, FlaskConical, HeartPulse, Thermometer, Syringe, Pill, Microscope, Bone, Brain, Eye, Ear, Wind, HandHelping
} from 'lucide-react';
import { Button } from './Button';
import { getDaysInMonth, getDayOfWeek, getRoleLabel } from '../utils/timeUtils';
import { ManagerTab } from '../App';

interface StaffManagerProps {
  activeTab: ManagerTab;
  staff: Staff[];
  procedures: Procedure[];
  department: Department;
  attendanceRecords: AttendanceRecord[];
  appointments: Appointment[];
  currentUser: UserAccount;
  onEditStaff: (s?: Staff) => void;
  onDeleteStaff: (id: string) => void;
  onUpdateAttendance: (record: AttendanceRecord) => void;
  onUpdateProcedures: (procedures: Procedure[]) => void;
  onUpdateAppointments: (appointments: Appointment[]) => void;
}

import { getAbbreviation } from '../utils/timeUtils';

export const StaffManager: React.FC<StaffManagerProps> = ({
  activeTab,
  staff,
  procedures,
  department,
  attendanceRecords,
  appointments,
  currentUser,
  onEditStaff,
  onDeleteStaff,
  onUpdateAttendance,
  onUpdateProcedures,
  onUpdateAppointments,
}) => {
  
  // Attendance State
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  // Personnel Management State
  const [personnelSearch, setPersonnelSearch] = useState('');

  // Machine Config State
  const [machineGen, setMachineGen] = useState({ prefix: '', start: 1, end: 10, suffix: '' });
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);

  const departmentStaff = staff.filter(s => s.deptId === department.id);


  // --- Procedure Logic ---
  const handleAddProcedure = () => {
    const newProc: Procedure = {
        id: `pr_${Math.random().toString(36).substr(2, 9)}`,
        name: 'Thủ thuật mới',
        durationMinutes: 30,
        restMinutes: 0,
        deptId: department.id,
        requireMachine: false,
        machineCapacity: 1,
        availableMachines: [],
        isPreRequisite: false,
        mainBusyStart: 0,
        mainBusyEnd: 30,
        asst1BusyStart: 0,
        asst1BusyEnd: 0,
        asst2BusyStart: 0,
        asst2BusyEnd: 0
    };
    setEditingProcedure(newProc);
  };

  const handleUpdateProcedure = (id: string, field: keyof Procedure, value: any) => {
    const proc = procedures.find(p => p.id === id);
    if (!proc || proc.deptId !== department.id) return;

    if (field === 'requireMachine' && value === false) {
        onUpdateProcedures(procedures.map(p => p.id === id ? { ...p, [field]: value, availableMachines: [] } : p));
    } else {
        onUpdateProcedures(procedures.map(p => p.id === id ? { ...p, [field]: value } : p));
    }
  };

  const handleDeleteProcedure = (id: string) => {
      const proc = procedures.find(p => p.id === id);
      if (!proc || proc.deptId !== department.id) return;

      if (confirm('Bạn có chắc muốn xóa thủ thuật này?')) {
          onUpdateProcedures(procedures.filter(p => p.id !== id));
      }
  };

  const handleGenerateMachines = () => {
      if (!editingProcedure) return;
      
      const newCodes: string[] = [];
      const { prefix, start, end, suffix } = machineGen;
      
      for (let i = start; i <= end; i++) {
          const code = `${prefix}${i.toString().padStart(2, '0')}${suffix}`;
          if (!editingProcedure.availableMachines?.includes(code)) {
              newCodes.push(code);
          }
      }

      if (newCodes.length === 0) return;

      setEditingProcedure({
          ...editingProcedure,
          availableMachines: [...(editingProcedure.availableMachines || []), ...newCodes]
      });
  };

  const handleRemoveMachine = (code: string) => {
      if (!editingProcedure) return;
      setEditingProcedure({
          ...editingProcedure,
          availableMachines: editingProcedure.availableMachines?.filter(c => c !== code) || []
      });
  };

  // --- Attendance Logic ---
  const getAttendanceStatus = (staffId: string, day: number) => {
    const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const record = attendanceRecords.find(r => r.staffId === staffId && r.date === dateStr);
    return record?.status || AttendanceStatus.PRESENT;
  };

  const handleCellClick = (staffId: string, day: number) => {
    const currentStatus = getAttendanceStatus(staffId, day);
    let nextStatus: AttendanceStatus;
    
    switch (currentStatus) {
        case AttendanceStatus.PRESENT: nextStatus = AttendanceStatus.OFF_FULL; break;
        case AttendanceStatus.OFF_FULL: nextStatus = AttendanceStatus.OFF_MORNING; break;
        case AttendanceStatus.OFF_MORNING: nextStatus = AttendanceStatus.OFF_AFTERNOON; break;
        case AttendanceStatus.OFF_AFTERNOON: nextStatus = AttendanceStatus.PRESENT; break;
        default: nextStatus = AttendanceStatus.OFF_FULL;
    }

    const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const existing = attendanceRecords.find(r => r.staffId === staffId && r.date === dateStr);
    
    const newRecord: AttendanceRecord = {
        id: existing ? existing.id : `att_${Math.random().toString(36).substr(2,9)}`,
        staffId,
        date: dateStr,
        status: nextStatus
    };

    onUpdateAttendance(newRecord);
  };

  const getCellColor = (status: AttendanceStatus) => {
      switch(status) {
          case AttendanceStatus.OFF_FULL: return 'bg-yellow-400';
          case AttendanceStatus.OFF_MORNING: return 'bg-orange-200';
          case AttendanceStatus.OFF_AFTERNOON: return 'bg-purple-200';
          default: return '';
      }
  };

  const getCellLabel = (status: AttendanceStatus) => {
    switch(status) {
        case AttendanceStatus.OFF_FULL: return 'N'; // Nghỉ
        case AttendanceStatus.OFF_MORNING: return 'S'; // Nghỉ Sáng
        case AttendanceStatus.OFF_AFTERNOON: return 'C'; // Nghỉ Chiều
        default: return ''; // Đi làm
    }
  };

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handlePrintAttendance = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bảng chấm công Tháng ${selectedMonth}/${selectedYear}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 20px; font-size: 18px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #ccc; padding: 4px; text-align: center; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .weekend { background-color: #fff3e0; color: #e65100; }
            .off-full { background-color: #facc15; }
            .off-morning { background-color: #fed7aa; }
            .off-afternoon { background-color: #e9d5ff; }
            .name-col { text-align: left; padding-left: 8px; white-space: nowrap; }
            @media print {
              @page { size: landscape; margin: 10mm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Bảng chấm công Tháng ${selectedMonth} năm ${selectedYear} - ${department.name}</h1>
          <table>
            <thead>
              <tr>
                <th rowspan="2" style="width: 30px;">STT</th>
                <th rowspan="2" style="width: 150px;">Họ và tên</th>
                <th rowspan="2" style="width: 80px;">Chức vụ</th>
                ${daysArray.map(d => `<th>${d}</th>`).join('')}
              </tr>
              <tr>
                ${daysArray.map(d => {
                  const dow = getDayOfWeek(d, selectedMonth, selectedYear);
                  const isWeekend = dow === 'CN' || dow === 'T7';
                  return `<th class="${isWeekend ? 'weekend' : ''}">${dow}</th>`;
                }).join('')}
              </tr>
            </thead>
            <tbody>
              ${departmentStaff.map((s, idx) => {
                  let rowHtml = `<tr>
                      <td>${idx + 1}</td>
                      <td class="name-col">${s.name}</td>
                      <td>${s.role === 'Doctor' ? 'Bác sĩ' : s.role === 'Technician' ? 'Kỹ thuật viên' : s.role === 'Nurse' ? 'Điều dưỡng' : s.role === 'PhysicianAssistant' ? 'Y sĩ' : s.role === 'Pharmacist' ? 'Dược sĩ' : s.role}</td>`;
                  
                  daysArray.forEach(d => {
                    const status = getAttendanceStatus(s.id, d);
                    let className = '';
                    let label = '';
                    if (status === AttendanceStatus.OFF_FULL) { className = 'off-full'; label = 'N'; }
                    else if (status === AttendanceStatus.OFF_MORNING) { className = 'off-morning'; label = 'S'; }
                    else if (status === AttendanceStatus.OFF_AFTERNOON) { className = 'off-afternoon'; label = 'C'; }
                    
                    rowHtml += `<td class="${className}">${label}</td>`;
                  });
                  
                  rowHtml += `</tr>`;
                  return rowHtml;
              }).join('')}
            </tbody>
          </table>
          <div style="margin-top: 20px; font-size: 11px;">
            <strong>Ghi chú:</strong> N: Nghỉ cả ngày | S: Nghỉ sáng | C: Nghỉ chiều
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };



  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full relative">
      <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
        
        {activeTab === 'PERSONNEL' && (
            <div className="flex-1 overflow-y-auto p-6">
                 <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 w-64 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                        <Search size={16} className="text-gray-400" />
                        <input 
                            placeholder="Tìm nhân viên..." 
                            className="bg-transparent border-none outline-none text-sm w-full"
                            value={personnelSearch}
                            onChange={(e) => setPersonnelSearch(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => onEditStaff()}>
                        <UserPlus size={18} /> Thêm nhân sự
                    </Button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {departmentStaff.filter(s => s.name.toLowerCase().includes(personnelSearch.toLowerCase())).map(s => (
                        <div 
                            key={s.id} 
                            onClick={() => onEditStaff(s)}
                            className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-xl hover:border-primary/20 transition-all cursor-pointer group"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black ${s.role === 'Doctor' ? 'bg-indigo-50 text-indigo-600' : s.role === 'Pharmacist' ? 'bg-emerald-50 text-emerald-600' : 'bg-teal-50 text-teal-600'}`}>
                                    {s.name.charAt(0)}
                                </div>
                                <div className="flex gap-2">
                                    <div 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteStaff(s.id);
                                        }}
                                        className="p-3 bg-slate-50 rounded-2xl text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                        title="Xóa nhân sự"
                                    >
                                        <Trash2 size={18} />
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-300 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                        <Pencil size={18} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-xl mb-1 tracking-tight">{s.name}</h3>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                                    {s.role === 'Doctor' ? <Stethoscope size={14} className="text-primary/60" /> : <User size={14} className="text-primary/60" />}
                                    <span>
                                        {s.role === 'Doctor' ? 'Bác sĩ' : 
                                         s.role === 'Technician' ? 'Kỹ thuật viên' : 
                                         s.role === 'Nurse' ? 'Điều dưỡng' : 
                                         s.role === 'PhysicianAssistant' ? 'Y sĩ' : 
                                         s.role === 'Pharmacist' ? 'Dược sĩ' : s.role}
                                    </span>
                                </div>
                                <div className="pt-4 border-t border-slate-50 flex items-center gap-2">
                                    <span className="text-[10px] font-black bg-blue-50 px-3 py-1 rounded-lg text-blue-600 uppercase tracking-widest">
                                        {s.mainCapabilityIds?.filter(id => procedures.some(p => p.id === id)).length || 0} chính
                                    </span>
                                    <span className="text-[10px] font-black bg-emerald-50 px-3 py-1 rounded-lg text-emerald-600 uppercase tracking-widest">
                                        {s.assistantCapabilityIds?.filter(id => procedures.some(p => p.id === id)).length || 0} phụ
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>
        )}

        {activeTab === 'ATTENDANCE' && (
            <div className="flex flex-col h-full">
                <div className="p-4 bg-white border-b border-gray-200 flex gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-gray-700">Tháng:</label>
                        <select 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                            {Array.from({length: 12}, (_, i) => i+1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-gray-700">Năm:</label>
                        <select 
                             value={selectedYear} 
                             onChange={(e) => setSelectedYear(Number(e.target.value))}
                             className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <Button size="sm" variant="secondary" onClick={handlePrintAttendance} className="ml-2">
                        <Printer size={16} /> In bảng công
                    </Button>
                    <div className="flex gap-4 text-xs ml-auto">
                        <div className="flex items-center gap-1"><div className="w-4 h-4 bg-yellow-400 border border-gray-300"></div> Nghỉ cả ngày (N)</div>
                        <div className="flex items-center gap-1"><div className="w-4 h-4 bg-orange-200 border border-gray-300"></div> Nghỉ sáng (S)</div>
                        <div className="flex items-center gap-1"><div className="w-4 h-4 bg-purple-200 border border-gray-300"></div> Nghỉ chiều (C)</div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 bg-gray-100">
                    <div className="bg-white shadow-sm border border-gray-300 w-max">
                        <div className="bg-yellow-300 text-center font-bold py-2 border-b border-gray-300 text-gray-900 uppercase tracking-wide">
                            Bảng chấm công Tháng {selectedMonth} năm {selectedYear}
                        </div>

                        <div className="grid" style={{ gridTemplateColumns: `50px 200px 100px repeat(${daysInMonth}, 36px)` }}>
                            <div className="bg-cyan-300 border-r border-b border-gray-300 p-2 text-xs font-bold text-center flex items-center justify-center row-span-2">STT</div>
                            <div className="bg-cyan-300 border-r border-b border-gray-300 p-2 text-xs font-bold text-center flex items-center justify-center row-span-2">Họ và tên</div>
                            <div className="bg-cyan-300 border-r border-b border-gray-300 p-2 text-xs font-bold text-center flex items-center justify-center row-span-2">Chức vụ</div>
                            
                            {daysArray.map(day => (
                                <div key={day} className="bg-cyan-300 border-r border-b border-gray-300 text-[10px] font-bold text-center h-8 flex items-center justify-center">
                                    {day}
                                </div>
                            ))}

                            {daysArray.map(day => {
                                const dow = getDayOfWeek(day, selectedMonth, selectedYear);
                                const isWeekend = dow === 'CN' || dow === 'T7';
                                return (
                                    <div key={`dow-${day}`} className={`border-r border-b border-gray-300 text-[9px] font-bold text-center h-6 flex items-center justify-center ${isWeekend ? 'bg-orange-100 text-orange-700' : 'bg-cyan-100'}`}>
                                        {dow}
                                    </div>
                                );
                            })}
                            
                            {departmentStaff.map((s, index) => (
                                <React.Fragment key={s.id}>
                                    <div className="border-r border-b border-gray-300 p-1 text-center text-sm text-gray-600 bg-white">{index + 1}</div>
                                    <div className="border-r border-b border-gray-300 p-1 px-2 text-sm font-medium text-gray-800 bg-white truncate">{s.name}</div>
                                    <div className="border-r border-b border-gray-300 p-1 text-center text-xs text-gray-500 bg-white truncate">{s.role === 'Doctor' ? 'Bác sĩ' : s.role === 'Technician' ? 'KTV' : s.role === 'Nurse' ? 'Điều dưỡng' : s.role === 'PhysicianAssistant' ? 'Y sĩ' : s.role === 'Pharmacist' ? 'Dược sĩ' : s.role}</div>
                                    
                                    {daysArray.map(day => {
                                        const status = getAttendanceStatus(s.id, day);
                                        const dow = getDayOfWeek(day, selectedMonth, selectedYear);
                                        const isWeekend = dow === 'CN';

                                        return (
                                            <button 
                                                key={`${s.id}-${day}`}
                                                onClick={() => handleCellClick(s.id, day)}
                                                className={`border-r border-b border-gray-300 text-center text-[10px] font-bold hover:brightness-95 transition-all flex items-center justify-center
                                                    ${getCellColor(status)} 
                                                    ${status === AttendanceStatus.PRESENT && isWeekend ? 'bg-gray-50' : ''}
                                                `}
                                                title={`Ngày ${day}: ${status}`}
                                            >
                                                {getCellLabel(status)}
                                            </button>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'PROCEDURES' && (
            <div className="p-6 overflow-y-auto">
                 <div className="flex justify-between items-center mb-6">
                    <p className="text-gray-500 text-sm italic">Mẹo: "Chặn trước" chặn các thủ thuật trước nó. "Chặn sau" chặn các thủ thuật sau nó.</p>
                    <div className="flex gap-2">
                        <Button size="sm" variant="danger" onClick={() => {
                            if (window.confirm('Bạn có chắc chắn muốn xóa TẤT CẢ thủ thuật của khoa này? Hành động này không thể hoàn tác.')) {
                                onUpdateProcedures(procedures.filter(p => p.deptId !== department.id));
                            }
                        }}>
                            <Trash2 size={16} /> Xóa tất cả
                        </Button>
                        <Button size="sm" onClick={handleAddProcedure}>
                            <Plus size={16} /> Thêm thủ thuật
                        </Button>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {procedures
                        .filter(proc => proc.deptId === department.id)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(proc => (
                        <div 
                            key={proc.id} 
                            onClick={() => setEditingProcedure(proc)} 
                            className={`bg-white border rounded-2xl p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group flex flex-col gap-3 ${proc.deptId === department.id ? 'border-blue-500 shadow-sm shadow-blue-100' : 'border-slate-200 opacity-40 grayscale-[0.5]'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors font-black text-xs">
                                        {getAbbreviation(proc.name)}
                                    </div>
                                    <h4 className="font-black text-slate-800 text-sm group-hover:text-primary transition-colors">{proc.name}</h4>
                                </div>
                                <div className="flex gap-1">
                                    {proc.isPreRequisite && <span title="Chặn trước" className="flex items-center"><Lock size={14} className="text-amber-500" /></span>}
                                    {proc.isPostRequisite && <span title="Chặn sau" className="flex items-center"><Lock size={14} className="text-rose-500" /></span>}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <Clock size={14} className="text-slate-400" /> {proc.durationMinutes} phút
                                {proc.restMinutes ? (
                                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 ml-1">
                                        + {proc.restMinutes}p nghỉ
                                    </span>
                                ) : null}
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-slate-100">
                                <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase">
                                    <User size={12} /> Chính
                                </div>
                                {(proc.asst1BusyEnd || 0) > 0 && (
                                    <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase">
                                        <Users size={12} /> Phụ 1
                                    </div>
                                )}
                                {(proc.asst2BusyEnd || 0) > 0 && (
                                    <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase">
                                        <Users size={12} /> Phụ 2
                                    </div>
                                )}
                                {proc.isIndependent && (
                                    <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-[10px] font-black uppercase">
                                        Độc lập
                                    </div>
                                )}
                                {proc.requireMachine && (
                                    <div className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase ml-auto">
                                        <Zap size={12} /> Máy ({proc.availableMachines?.length || 0})
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                 </div>
                 {procedures.filter(p => p.deptId === department.id).length === 0 && (
                     <div className="p-8 text-center text-gray-400">Chưa có thủ thuật nào.</div>
                 )}
            </div>
        )}

      </div>

      {editingProcedure && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                          <Settings2 className="text-primary" /> 
                          {procedures.some(p => p.id === editingProcedure.id) ? 'Chỉnh sửa thủ thuật' : 'Thêm thủ thuật mới'}
                      </h3>
                      <button onClick={() => setEditingProcedure(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                          <X size={24} />
                      </button>
                  </div>

                  <div className="p-6 overflow-y-auto flex-1 space-y-6 scrollbar-thin">
                      <div className="space-y-4">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Thông tin chung</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-1.5 md:col-span-2">
                                  <label className="text-[10px] font-black text-slate-500 uppercase">Tên thủ thuật</label>
                                  <input 
                                      className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold focus:border-primary outline-none transition-all"
                                      value={editingProcedure.name}
                                      onChange={e => setEditingProcedure({...editingProcedure, name: e.target.value})}
                                  />
                              </div>

                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-slate-500 uppercase">Thời gian thực hiện (phút)</label>
                                  <input 
                                      type="number"
                                      className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold focus:border-primary outline-none transition-all"
                                      value={editingProcedure.durationMinutes}
                                      onChange={e => setEditingProcedure({...editingProcedure, durationMinutes: Number(e.target.value)})}
                                  />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-slate-500 uppercase">Thời gian nghỉ sau TT (phút)</label>
                                  <input 
                                      type="number"
                                      className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold focus:border-primary outline-none transition-all"
                                      value={editingProcedure.restMinutes || 0}
                                      onChange={e => setEditingProcedure({...editingProcedure, restMinutes: Number(e.target.value)})}
                                  />
                              </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-4">
                              <label className="flex items-center gap-2 cursor-pointer group">
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${editingProcedure.isPreRequisite ? 'bg-amber-500 border-amber-500' : 'border-slate-300 group-hover:border-amber-400'}`}>
                                      {editingProcedure.isPreRequisite && <Check size={12} className="text-white" strokeWidth={4} />}
                                  </div>
                                  <input type="checkbox" className="hidden" checked={editingProcedure.isPreRequisite || false} onChange={e => setEditingProcedure({...editingProcedure, isPreRequisite: e.target.checked})} />
                                  <span className="text-xs font-bold text-slate-700">Chặn trước (Bắt buộc làm trước)</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer group">
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${editingProcedure.isPostRequisite ? 'bg-rose-500 border-rose-500' : 'border-slate-300 group-hover:border-rose-400'}`}>
                                      {editingProcedure.isPostRequisite && <Check size={12} className="text-white" strokeWidth={4} />}
                                  </div>
                                  <input type="checkbox" className="hidden" checked={editingProcedure.isPostRequisite || false} onChange={e => setEditingProcedure({...editingProcedure, isPostRequisite: e.target.checked})} />
                                  <span className="text-xs font-bold text-slate-700">Chặn sau (Làm sau cùng)</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer group">
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${editingProcedure.isIndependent ? 'bg-purple-500 border-purple-500' : 'border-slate-300 group-hover:border-purple-400'}`}>
                                      {editingProcedure.isIndependent && <Check size={12} className="text-white" strokeWidth={4} />}
                                  </div>
                                  <input type="checkbox" className="hidden" checked={editingProcedure.isIndependent || false} onChange={e => setEditingProcedure({...editingProcedure, isIndependent: e.target.checked})} />
                                  <span className="text-xs font-bold text-slate-700">Thủ thuật độc lập (VD: Sắc thuốc)</span>
                              </label>
                          </div>
                      </div>

                      <div className="space-y-4">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Nhân sự & Thời gian bận</h4>
                          
                          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4">
                              <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                                          <User size={16} />
                                      </div>
                                      <span className="font-black text-xs uppercase tracking-widest text-slate-700">Nhân sự chính</span>
                                  </div>
                                  <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded uppercase">Bắt buộc</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Bắt đầu bận (phút thứ)</label>
                                      <input 
                                          type="number" min="0" max={editingProcedure.durationMinutes}
                                          value={editingProcedure.mainBusyStart ?? 0}
                                          onChange={(e) => setEditingProcedure({...editingProcedure, mainBusyStart: Number(e.target.value)})}
                                          className="w-full p-3 border-2 border-white rounded-xl text-sm font-bold focus:border-blue-400 outline-none"
                                      />
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Kết thúc bận (phút thứ)</label>
                                      <input 
                                          type="number" min="0" max={editingProcedure.durationMinutes}
                                          value={editingProcedure.mainBusyEnd ?? editingProcedure.durationMinutes}
                                          onChange={(e) => setEditingProcedure({...editingProcedure, mainBusyEnd: Number(e.target.value)})}
                                          className="w-full p-3 border-2 border-white rounded-xl text-sm font-bold focus:border-blue-400 outline-none"
                                      />
                                  </div>
                              </div>
                          </div>

                          {/* Assistant 1 */}
                          <div className={`p-4 rounded-2xl border transition-all space-y-4 ${editingProcedure.asst1BusyEnd && editingProcedure.asst1BusyEnd > 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                              <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${editingProcedure.asst1BusyEnd && editingProcedure.asst1BusyEnd > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                                          <Users size={16} />
                                      </div>
                                      <span className="font-black text-xs uppercase tracking-widest text-slate-700">Người phụ 1</span>
                                  </div>
                                  <button 
                                      onClick={() => {
                                          setEditingProcedure({
                                              ...editingProcedure,
                                              asst1BusyEnd: (editingProcedure.asst1BusyEnd || 0) > 0 ? 0 : editingProcedure.durationMinutes,
                                              asst1BusyStart: 0
                                          });
                                      }}
                                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${editingProcedure.asst1BusyEnd && editingProcedure.asst1BusyEnd > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                                  >
                                      {(editingProcedure.asst1BusyEnd || 0) > 0 ? 'Đang bật' : 'Đang tắt'}
                                  </button>
                              </div>
                              {(editingProcedure.asst1BusyEnd || 0) > 0 && (
                                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                      <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Bắt đầu bận (phút thứ)</label>
                                          <input 
                                              type="number" min="0" max={editingProcedure.durationMinutes}
                                              value={editingProcedure.asst1BusyStart ?? 0}
                                              onChange={(e) => setEditingProcedure({...editingProcedure, asst1BusyStart: Number(e.target.value)})}
                                              className="w-full p-3 border-2 border-white rounded-xl text-sm font-bold focus:border-emerald-400 outline-none"
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Kết thúc bận (phút thứ)</label>
                                          <input 
                                              type="number" min="0" max={editingProcedure.durationMinutes}
                                              value={editingProcedure.asst1BusyEnd ?? editingProcedure.durationMinutes}
                                              onChange={(e) => setEditingProcedure({...editingProcedure, asst1BusyEnd: Number(e.target.value)})}
                                              className="w-full p-3 border-2 border-white rounded-xl text-sm font-bold focus:border-emerald-400 outline-none"
                                          />
                                      </div>
                                  </div>
                              )}
                          </div>

                          {/* Assistant 2 */}
                          <div className={`p-4 rounded-2xl border transition-all space-y-4 ${editingProcedure.asst2BusyEnd && editingProcedure.asst2BusyEnd > 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                              <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${editingProcedure.asst2BusyEnd && editingProcedure.asst2BusyEnd > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                                          <Users size={16} />
                                      </div>
                                      <span className="font-black text-xs uppercase tracking-widest text-slate-700">Người phụ 2</span>
                                  </div>
                                  <button 
                                      onClick={() => {
                                          setEditingProcedure({
                                              ...editingProcedure,
                                              asst2BusyEnd: (editingProcedure.asst2BusyEnd || 0) > 0 ? 0 : editingProcedure.durationMinutes,
                                              asst2BusyStart: 0
                                          });
                                      }}
                                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${editingProcedure.asst2BusyEnd && editingProcedure.asst2BusyEnd > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                                  >
                                      {(editingProcedure.asst2BusyEnd || 0) > 0 ? 'Đang bật' : 'Đang tắt'}
                                  </button>
                              </div>
                              {(editingProcedure.asst2BusyEnd || 0) > 0 && (
                                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                      <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Bắt đầu bận (phút thứ)</label>
                                          <input 
                                              type="number" min="0" max={editingProcedure.durationMinutes}
                                              value={editingProcedure.asst2BusyStart ?? 0}
                                              onChange={(e) => setEditingProcedure({...editingProcedure, asst2BusyStart: Number(e.target.value)})}
                                              className="w-full p-3 border-2 border-white rounded-xl text-sm font-bold focus:border-emerald-400 outline-none"
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Kết thúc bận (phút thứ)</label>
                                          <input 
                                              type="number" min="0" max={editingProcedure.durationMinutes}
                                              value={editingProcedure.asst2BusyEnd ?? editingProcedure.durationMinutes}
                                              onChange={(e) => setEditingProcedure({...editingProcedure, asst2BusyEnd: Number(e.target.value)})}
                                              className="w-full p-3 border-2 border-white rounded-xl text-sm font-bold focus:border-emerald-400 outline-none"
                                          />
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>

                      <div className="space-y-4">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Sử dụng máy móc</h4>
                          <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 cursor-pointer group">
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${editingProcedure.requireMachine ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 group-hover:border-indigo-400'}`}>
                                      {editingProcedure.requireMachine && <Check size={12} className="text-white" strokeWidth={4} />}
                                  </div>
                                  <input type="checkbox" className="hidden" checked={editingProcedure.requireMachine || false} onChange={e => setEditingProcedure({...editingProcedure, requireMachine: e.target.checked})} />
                                  <span className="text-xs font-bold text-slate-700">Có sử dụng máy</span>
                              </label>
                          </div>

                          {editingProcedure.requireMachine && (
                              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                                  <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-slate-500 uppercase">Sức chứa (Số BN/máy cùng lúc)</label>
                                      <input 
                                          type="number" min="1"
                                          className="w-full p-3 border-2 border-white rounded-xl text-sm font-bold focus:border-indigo-400 outline-none transition-all"
                                          value={editingProcedure.machineCapacity || 1}
                                          onChange={e => setEditingProcedure({...editingProcedure, machineCapacity: Number(e.target.value)})}
                                      />
                                  </div>

                                  <div className="pt-4 border-t border-indigo-100">
                                      <h4 className="text-[10px] font-black text-slate-500 uppercase mb-3">Tạo hàng loạt mã máy</h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tiền tố</label>
                                              <input 
                                                  className="w-full border-2 border-white rounded-xl p-2 text-sm font-bold focus:border-indigo-400 outline-none" 
                                                  placeholder="VD: M"
                                                  value={machineGen.prefix}
                                                  onChange={e => setMachineGen({ ...machineGen, prefix: e.target.value })}
                                              />
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hậu tố</label>
                                              <input 
                                                  className="w-full border-2 border-white rounded-xl p-2 text-sm font-bold focus:border-indigo-400 outline-none" 
                                                  placeholder="VD: YDCT"
                                                  value={machineGen.suffix}
                                                  onChange={e => setMachineGen({ ...machineGen, suffix: e.target.value })}
                                              />
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Từ số</label>
                                              <input 
                                                  type="number"
                                                  className="w-full border-2 border-white rounded-xl p-2 text-sm font-bold focus:border-indigo-400 outline-none" 
                                                  value={machineGen.start}
                                                  onChange={e => setMachineGen({ ...machineGen, start: Number(e.target.value) })}
                                              />
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Đến số</label>
                                              <input 
                                                  type="number"
                                                  className="w-full border-2 border-white rounded-xl p-2 text-sm font-bold focus:border-indigo-400 outline-none" 
                                                  value={machineGen.end}
                                                  onChange={e => setMachineGen({ ...machineGen, end: Number(e.target.value) })}
                                              />
                                          </div>
                                      </div>
                                      <Button size="sm" onClick={handleGenerateMachines} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                                          Tạo danh sách máy
                                      </Button>
                                  </div>

                                  <div className="pt-4 border-t border-indigo-100">
                                      <h4 className="text-[10px] font-black text-slate-500 uppercase mb-3 flex justify-between items-center">
                                          Danh sách máy hiện có
                                          <span className="text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                                              {editingProcedure.availableMachines?.length || 0} máy
                                          </span>
                                      </h4>
                                      <div className="bg-white border-2 border-indigo-50 rounded-xl max-h-48 overflow-y-auto divide-y divide-indigo-50">
                                          {(!editingProcedure.availableMachines || editingProcedure.availableMachines.length === 0) && (
                                              <div className="p-4 text-center text-sm font-medium text-slate-400">Chưa có máy nào</div>
                                          )}
                                          {editingProcedure.availableMachines?.map((code, idx) => (
                                              <div key={idx} className="p-3 flex justify-between items-center hover:bg-indigo-50/50 transition-colors">
                                                  <span className="text-sm font-bold text-slate-700">{code}</span>
                                                  <button 
                                                      onClick={() => handleRemoveMachine(code)}
                                                      className="text-slate-400 hover:text-rose-500 transition-colors p-1 rounded-lg hover:bg-rose-50"
                                                  >
                                                      <X size={16} />
                                                  </button>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                      {procedures.some(p => p.id === editingProcedure.id) ? (
                          <button 
                              onClick={() => {
                                  if (confirm('Bạn có chắc muốn xóa thủ thuật này?')) {
                                      onUpdateProcedures(procedures.filter(p => p.id !== editingProcedure.id));
                                      setEditingProcedure(null);
                                  }
                              }}
                              className="px-4 py-3 text-rose-500 font-black text-xs uppercase tracking-widest hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-2"
                          >
                              <Trash2 size={16} /> Xóa thủ thuật
                          </button>
                      ) : <div></div>}
                      
                      <div className="flex gap-4">
                          <button onClick={() => setEditingProcedure(null)} className="px-6 py-3 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 rounded-xl transition-colors">HỦY BỎ</button>
                          <Button onClick={() => {
                              if (procedures.some(p => p.id === editingProcedure.id)) {
                                  onUpdateProcedures(procedures.map(p => p.id === editingProcedure.id ? editingProcedure : p));
                              } else {
                                  onUpdateProcedures([...procedures, editingProcedure]);
                              }
                              setEditingProcedure(null);
                          }} className="px-8 py-3 rounded-xl shadow-lg shadow-primary/30 text-sm">
                              <Save size={16} /> LƯU THỦ THUẬT
                          </Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
