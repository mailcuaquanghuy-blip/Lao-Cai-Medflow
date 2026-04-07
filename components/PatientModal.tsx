
import React, { useState, useEffect } from 'react';
import { Patient, Department, PatientStatus } from '../types';
import { Button } from './Button';
import { DateTimePicker } from './DateTimePicker';
import { DateInput } from './DateInput';
import { X, User, Calendar, Bed, Building2, Save, Users, Clock, Info } from 'lucide-react';
import { generatePatientCode } from '../utils/timeUtils';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (patient: Patient) => void;
  initialData: Partial<Patient> | null;
  currentDept: Department;
}

export const PatientModal: React.FC<PatientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  currentDept,
}) => {
  const [formData, setFormData] = useState<Partial<Patient>>({
    name: '',
    dob: '',
    gender: 'Nam',
    bedNumber: '',
    roomNumber: '',
    status: 'TREATING',
    admissionDate: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
  });

  useEffect(() => {
    if (initialData) {
        setFormData({
            ...initialData,
            admissionDate: initialData.admissionDate ? new Date(new Date(initialData.admissionDate).getTime() - new Date(initialData.admissionDate).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
            dischargeDate: initialData.dischargeDate ? new Date(new Date(initialData.dischargeDate).getTime() - new Date(initialData.dischargeDate).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : undefined
        });
    } else {
        setFormData({
            name: '',
            dob: '',
            gender: 'Nam',
            bedNumber: '',
            roomNumber: '',
            status: 'TREATING',
            admissionDate: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
            dischargeDate: undefined
        });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.dob) return;

    // Giữ nguyên ID cũ nếu sửa, hoặc tạo ID mới nếu thêm
    const patientId = formData.id || `p_${Math.random().toString(36).substr(2, 9)}`;
    const admissionDateIso = new Date(formData.admissionDate || new Date()).toISOString();
    const dischargeDateIso = formData.dischargeDate ? new Date(formData.dischargeDate).toISOString() : undefined;
    
    // Mã bệnh nhân vẫn sinh ra để lưu trữ hệ thống, nhưng không hiển thị nặng nề
    const code = formData.code || generatePatientCode(formData.name, admissionDateIso, currentDept.id);

    const newPatient: Patient = {
      id: patientId,
      name: formData.name,
      dob: formData.dob!,
      gender: formData.gender as 'Nam' | 'Nữ',
      code: code,
      bedNumber: formData.bedNumber || '?',
      roomNumber: formData.roomNumber || '',
      admissionDate: admissionDateIso,
      dischargeDate: dischargeDateIso,
      status: formData.status as PatientStatus || 'TREATING',
      admittedByDeptId: formData.admittedByDeptId || currentDept.id,
      referrals: formData.referrals || []
    };

    onSave(newPatient);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="bg-primary p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              {initialData?.id ? <User /> : <Users />}
              {initialData?.id ? 'Cập nhật hồ sơ' : 'Tiếp nhận bệnh nhân'}
            </h2>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">Khoa: {currentDept.name}</p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
             <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[80vh]">
            <div className="space-y-4">
                {/* Họ tên & Giới tính */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Họ và tên</label>
                        <input 
                            required
                            className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-primary outline-none transition-colors"
                            placeholder="VD: Nguyễn Văn A"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giới tính</label>
                        <select 
                            className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-primary outline-none bg-white"
                            value={formData.gender}
                            onChange={e => setFormData({...formData, gender: e.target.value as any})}
                        >
                            <option value="Nam">Nam</option>
                            <option value="Nữ">Nữ</option>
                        </select>
                    </div>
                </div>

                {/* Ngày sinh & Ngày vào viện */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={12}/> Ngày sinh</label>
                         <DateInput 
                            className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-primary outline-none"
                            value={formData.dob}
                            onChange={val => setFormData({...formData, dob: val})}
                         />
                    </div>
                     <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Clock size={12}/> Giờ vào viện</label>
                         <DateTimePicker 
                            className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-primary outline-none"
                            value={formData.admissionDate}
                            onChange={val => setFormData({...formData, admissionDate: val})}
                         />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Clock size={12}/> Giờ ra viện</label>
                         <DateTimePicker 
                            className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-primary outline-none"
                            value={formData.dischargeDate || ''}
                            onChange={val => setFormData({...formData, dischargeDate: val})}
                         />
                    </div>
                </div>

                {/* Giường & Phòng */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Bed size={12}/> Số giường</label>
                         <input 
                            required
                            className="w-full p-3 border-2 border-white rounded-xl font-bold text-indigo-600 focus:border-indigo-400 outline-none shadow-sm placeholder:text-indigo-200"
                            placeholder="VD: 105"
                            value={formData.bedNumber}
                            onChange={e => setFormData({...formData, bedNumber: e.target.value})}
                         />
                    </div>
                    <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Building2 size={12}/> Số phòng</label>
                         <input 
                            className="w-full p-3 border-2 border-white rounded-xl font-bold text-slate-700 focus:border-slate-300 outline-none shadow-sm"
                            placeholder="VD: P.402"
                            value={formData.roomNumber}
                            onChange={e => setFormData({...formData, roomNumber: e.target.value})}
                         />
                    </div>
                </div>

                {initialData?.code && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-2 rounded-lg justify-center">
                        <Info size={14} /> Mã hồ sơ hệ thống: <span className="font-mono font-bold text-slate-500">{initialData.code}</span>
                    </div>
                )}
            </div>

            <div className="pt-4 flex gap-3">
                <Button type="button" variant="secondary" onClick={onClose} className="flex-1 h-12 rounded-xl">Hủy bỏ</Button>
                <Button type="submit" className="flex-[2] h-12 rounded-xl shadow-lg shadow-primary/20">
                    <Save size={18} /> Lưu hồ sơ
                </Button>
            </div>
        </form>
      </div>
    </div>
  );
};
