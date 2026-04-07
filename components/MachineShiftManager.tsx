import React, { useState, useMemo } from 'react';
import { MachineShift, Procedure, Staff, Department, Appointment, AttendanceRecord } from '../types';
import { Plus, Edit3, Trash2, Clock, Users, AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';
import { checkConflict } from '../utils/timeUtils';

interface MachineShiftManagerProps {
  shifts: MachineShift[];
  procedures: Procedure[];
  staff: Staff[];
  currentDept: Department;
  activeDate: string;
  appointments: Appointment[];
  attendanceRecords: AttendanceRecord[];
  onAddShift: (shift: Omit<MachineShift, 'id'>) => void;
  onUpdateShift: (id: string, shift: Partial<MachineShift>, updateLinkedAppointments: boolean) => void;
  onDeleteShift: (id: string) => void;
}

export const MachineShiftManager: React.FC<MachineShiftManagerProps> = ({
  shifts,
  procedures,
  staff,
  currentDept,
  activeDate,
  appointments,
  attendanceRecords,
  onAddShift,
  onUpdateShift,
  onDeleteShift
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<MachineShift | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  // Form state
  const [machineId, setMachineId] = useState('');
  const [procedureId, setProcedureId] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [staffId, setStaffId] = useState('');
  const [assistant1Id, setAssistant1Id] = useState('');
  const [assistant2Id, setAssistant2Id] = useState('');

  // Lấy các thủ thuật có máy sức chứa > 1
  const machineProcedures = useMemo(() => {
    return procedures.filter(p => p.deptId === currentDept.id && p.requireMachine && (p.machineCapacity || 1) > 1 && p.availableMachines && p.availableMachines.length > 0);
  }, [procedures, currentDept.id]);

  const availableMachines = useMemo(() => {
    const proc = machineProcedures.find(p => p.id === procedureId);
    return proc?.availableMachines || [];
  }, [procedureId, machineProcedures]);

  const deptShifts = useMemo(() => {
    return shifts.filter(s => s.deptId === currentDept.id && s.date === activeDate);
  }, [shifts, currentDept.id, activeDate]);

  const selectedProcedure = useMemo(() => {
    return machineProcedures.find(p => p.id === procedureId);
  }, [procedureId, machineProcedures]);

  const requiresAssistant1 = selectedProcedure ? (
    (selectedProcedure.asst1BusyEnd !== undefined && selectedProcedure.asst1BusyEnd > 0) || 
    (selectedProcedure.assistant1BusyMinutes !== undefined && selectedProcedure.assistant1BusyMinutes > 0)
  ) : false;

  const requiresAssistant2 = selectedProcedure ? (
    (selectedProcedure.asst2BusyEnd !== undefined && selectedProcedure.asst2BusyEnd > 0) || 
    (selectedProcedure.assistant2BusyMinutes !== undefined && selectedProcedure.assistant2BusyMinutes > 0)
  ) : false;

  const handleOpenModal = (shift?: MachineShift) => {
    if (shift) {
      setEditingShift(shift);
      setMachineId(shift.machineId);
      setProcedureId(shift.procedureId);
      setStartTime(shift.startTime);
      setEndTime(shift.endTime);
      setStaffId(shift.staffId);
      setAssistant1Id(shift.assistant1Id || '');
      setAssistant2Id(shift.assistant2Id || '');
    } else {
      setEditingShift(null);
      setProcedureId(machineProcedures[0]?.id || '');
      setMachineId(machineProcedures[0]?.availableMachines?.[0] || '');
      setStartTime('08:00');
      setEndTime('09:00');
      setStaffId('');
      setAssistant1Id('');
      setAssistant2Id('');
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!machineId || !procedureId || !startTime || !endTime || !staffId) {
      setAlertMsg('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    if (startTime >= endTime) {
      setAlertMsg('Thời gian kết thúc phải lớn hơn thời gian bắt đầu');
      return;
    }

    // Check staff availability
    const checkStaff = (sId: string, roleName: string) => {
      if (!sId) return null;
      const att = attendanceRecords.find(a => a.staffId === sId && a.date === activeDate);
      if (att && att.status !== 'PRESENT') {
        const isMorning = startTime < '12:00';
        if (att.status === 'OFF_FULL' || 
           (att.status === 'OFF_MORNING' && isMorning) || 
           (att.status === 'OFF_AFTERNOON' && !isMorning)) {
          return `${roleName} đang nghỉ vào thời gian này.`;
        }
      }
      return null;
    };

    const staffWarnings = [
      checkStaff(staffId, 'Người thực hiện chính'),
      requiresAssistant1 ? checkStaff(assistant1Id, 'Người phụ 1') : null,
      requiresAssistant2 ? checkStaff(assistant2Id, 'Người phụ 2') : null
    ].filter(Boolean);

    const shiftData = {
      machineId,
      procedureId,
      deptId: currentDept.id,
      date: activeDate,
      startTime,
      endTime,
      staffId,
      assistant1Id: requiresAssistant1 ? (assistant1Id || null) : null,
      assistant2Id: requiresAssistant2 ? (assistant2Id || null) : null
    };

    const proceedWithSave = () => {
      if (editingShift) {
        // Check if time changed and affects patients
        const linkedAppts = appointments.filter(a => a.machineShiftId === editingShift.id);
        
        if (linkedAppts.length > 0) {
          const timeChanged = editingShift.startTime !== startTime || editingShift.endTime !== endTime;
          const staffChanged = editingShift.staffId !== staffId || 
            (requiresAssistant1 ? editingShift.assistant1Id !== (assistant1Id || null) : editingShift.assistant1Id !== null) || 
            (requiresAssistant2 ? editingShift.assistant2Id !== (assistant2Id || null) : editingShift.assistant2Id !== null);
          
          if (timeChanged || staffChanged) {
            let warningMsg = `Ca máy này đang có ${linkedAppts.length} bệnh nhân thực hiện.\n`;
            if (timeChanged) warningMsg += `- Thay đổi thời gian có thể gây xung đột với lịch khác của bệnh nhân.\n`;
            if (staffChanged) warningMsg += `- Nhân sự sẽ được cập nhật cho tất cả bệnh nhân trong ca.\n`;
            warningMsg += `\nBạn có muốn cập nhật thay đổi này cho các bệnh nhân liên quan không?`;
            
            setConfirmModal({
              isOpen: true,
              message: warningMsg,
              confirmText: 'CÓ, CẬP NHẬT',
              cancelText: 'KHÔNG, CHỈ LƯU CA MÁY',
              onConfirm: () => {
                onUpdateShift(editingShift.id, shiftData, true);
                setIsModalOpen(false);
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
              },
              onCancel: () => {
                onUpdateShift(editingShift.id, shiftData, false);
                setIsModalOpen(false);
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
              }
            });
            return;
          }
        }
        
        onUpdateShift(editingShift.id, shiftData, false);
      } else {
        onAddShift(shiftData);
      }
      setIsModalOpen(false);
    };

    if (staffWarnings.length > 0) {
      setConfirmModal({
        isOpen: true,
        message: `Cảnh báo nhân sự:\n${staffWarnings.join('\n')}\n\nBạn có chắc chắn muốn lưu ca máy này?`,
        confirmText: 'VẪN LƯU',
        cancelText: 'HỦY',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          proceedWithSave();
        },
        onCancel: () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      });
      return;
    }

    proceedWithSave();
  };

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex justify-end items-center mb-4">
        <Button onClick={() => handleOpenModal()}>
          <Plus size={16} /> Thêm ca máy
        </Button>
      </div>

      {machineProcedures.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 font-bold">
        </div>
      ) : (
        <div className="flex-1 overflow-auto pr-2 scrollbar-thin">
          {deptShifts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 font-bold">
              Chưa có ca máy nào trong ngày {activeDate}
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 pb-4">
              {deptShifts.map((shift, idx) => {
                const proc = procedures.find(p => p.id === shift.procedureId);
                const mainStaff = staff.find(s => s.id === shift.staffId);
                const asst1 = staff.find(s => s.id === shift.assistant1Id);
                const asst2 = staff.find(s => s.id === shift.assistant2Id);

                return (
                  <div key={shift.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 w-full sm:w-[340px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Ca máy {idx + 1}</div>
                        <h3 className="font-bold text-slate-800">{proc?.name || 'Không rõ'}</h3>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleOpenModal(shift)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"><Edit3 size={14} /></button>
                        <button onClick={() => { 
                          setConfirmModal({
                            isOpen: true,
                            message: 'Bạn có chắc chắn muốn xóa ca máy này?',
                            confirmText: 'XÓA',
                            cancelText: 'HỦY',
                            onConfirm: () => {
                              onDeleteShift(shift.id);
                              setConfirmModal(prev => ({ ...prev, isOpen: false }));
                            },
                            onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                          });
                        }} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <div className="px-2.5 py-1 bg-primary/10 text-primary font-black rounded-lg">{shift.machineId}</div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-[11px] font-black text-slate-600">
                        <Clock size={12} />
                        {shift.startTime} - {shift.endTime}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-[11px] font-bold">
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="w-4 text-center text-slate-400">C</span>
                        <span>{mainStaff?.name || 'Không rõ'}</span>
                      </div>
                      {asst1 && (
                        <div className="flex items-center gap-2 text-slate-500">
                          <span className="w-4 text-center text-slate-300">P1</span>
                          <span>{asst1.name}</span>
                        </div>
                      )}
                      {asst2 && (
                        <div className="flex items-center gap-2 text-slate-500">
                          <span className="w-4 text-center text-slate-300">P2</span>
                          <span>{asst2.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-800">{editingShift ? 'Sửa Ca Máy' : 'Thêm Ca Máy Mới'}</h3>
              <button onClick={() => { setIsModalOpen(false); setAlertMsg(null); }} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
              {alertMsg && (
                <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium flex items-start gap-3">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <p>{alertMsg}</p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Thủ thuật</label>
                <select value={procedureId} onChange={e => { setProcedureId(e.target.value); setMachineId(''); setAssistant1Id(''); setAssistant2Id(''); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all">
                  {machineProcedures.map(p => <option key={p.id} value={p.id}>{p.name} (Sức chứa: {p.machineCapacity})</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Máy</label>
                <select value={machineId} onChange={e => setMachineId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all">
                  <option value="">-- Chọn máy --</option>
                  {availableMachines.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Giờ bắt đầu</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Giờ kết thúc</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Người thực hiện chính</label>
                <select value={staffId} onChange={e => setStaffId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all">
                  <option value="">-- Chọn nhân sự --</option>
                  {staff.filter(s => s.deptId === currentDept.id && s.mainCapabilityIds.includes(procedureId) && s.id !== assistant1Id && s.id !== assistant2Id).map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>

              {requiresAssistant1 && (
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Người phụ 1 (Tùy chọn)</label>
                  <select value={assistant1Id} onChange={e => setAssistant1Id(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all">
                    <option value="">-- Chọn người phụ 1 --</option>
                    {staff.filter(s => s.deptId === currentDept.id && s.assistantCapabilityIds.includes(procedureId) && s.id !== staffId && s.id !== assistant2Id).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
              )}

              {requiresAssistant2 && (
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Người phụ 2 (Tùy chọn)</label>
                  <select value={assistant2Id} onChange={e => setAssistant2Id(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all">
                    <option value="">-- Chọn người phụ 2 --</option>
                    {staff.filter(s => s.deptId === currentDept.id && s.assistantCapabilityIds.includes(procedureId) && s.id !== staffId && s.id !== assistant1Id).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => { setIsModalOpen(false); setAlertMsg(null); }} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all">Hủy</button>
              <Button onClick={handleSave}>Lưu Ca Máy</Button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-amber-50/50">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-800">Xác nhận</h3>
            </div>
            <div className="p-6">
              <p className="text-slate-600 whitespace-pre-line">{confirmModal.message}</p>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={confirmModal.onCancel} 
                className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all"
              >
                {confirmModal.cancelText || 'Hủy'}
              </button>
              <Button onClick={confirmModal.onConfirm} variant="primary">
                {confirmModal.confirmText || 'Xác nhận'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
