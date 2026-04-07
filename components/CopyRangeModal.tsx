
import React, { useState } from 'react';
import { Button } from './Button';
import { Calendar, X, Copy, Info, CheckCircle2 } from 'lucide-react';
import { DateInput } from './DateInput';

interface CopyRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (startDate: string, endDate: string) => void;
  sourceDate: string;
  patientName: string;
  procedureCount: number;
}

export const CopyRangeModal: React.FC<CopyRangeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  sourceDate,
  patientName,
  procedureCount,
}) => {
  const [startDate, setStartDate] = useState(new Date(sourceDate).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const nextDay = new Date(sourceDate);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay.toISOString().split('T')[0];
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(startDate) > new Date(endDate)) {
      alert("Ngày bắt đầu không được lớn hơn ngày kết thúc");
      return;
    }
    onConfirm(startDate, endDate);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
                <Copy size={20} />
            </div>
            <div>
                <h3 className="font-black uppercase tracking-tight text-lg">Sao chép lịch trình</h3>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Giai đoạn điều trị mới</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <p className="text-xs text-slate-500 font-bold">Bệnh nhân: <span className="text-slate-800">{patientName}</span></p>
            <p className="text-xs text-slate-500 font-bold">Nguồn: <span className="text-indigo-600">Ngày {new Date(sourceDate).toLocaleDateString('vi-VN')}</span> ({procedureCount} thủ thuật)</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} /> Từ ngày
              </label>
              <DateInput 
                className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all"
                value={startDate}
                onChange={val => setStartDate(val)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} /> Đến ngày
              </label>
              <DateInput 
                className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all"
                value={endDate}
                onChange={val => setEndDate(val)}
              />
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
             <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
             <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
               Hệ thống sẽ tự động quét nhân sự thay thế nếu nhân sự cũ nghỉ trong các ngày được chọn. Khung giờ và máy thực hiện sẽ được ưu tiên giữ nguyên.
             </p>
          </div>

          <div className="pt-2 flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 h-12 rounded-xl">HỦY</Button>
            <Button type="submit" className="flex-[2] h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                THỰC HIỆN COPY
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
