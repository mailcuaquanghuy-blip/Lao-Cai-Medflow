
import React, { useState } from 'react';
import { Backup, Department, UserAccount } from '../types';
import { Button } from './Button';
import { formatDate } from '../utils/timeUtils';
import { Database, History, Download, RotateCcw, Trash2, Calendar, Building2, Info } from 'lucide-react';
import { DateInput } from './DateInput';

interface BackupManagerProps {
  backups: Backup[];
  departments: Department[];
  currentUser: UserAccount;
  onCreateBackup: (deptId: string, date: string, note: string) => Promise<void>;
  onRestoreBackup: (backup: Backup) => Promise<void>;
  onDeleteBackup: (backupId: string) => Promise<void>;
}

export const BackupManager: React.FC<BackupManagerProps> = ({ 
  backups, 
  departments, 
  currentUser,
  onRestoreBackup, 
  onDeleteBackup 
}) => {
  const [filterDeptId, setFilterDeptId] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');

  const handleRestore = async (backup: Backup) => {
    const dept = departments.find(d => d.id === backup.deptId);
    if (window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn khôi phục dữ liệu cho khoa ${dept?.name} ngày ${backup.backupDate}? Dữ liệu hiện tại của ngày này sẽ bị ghi đè.`)) {
      try {
        await onRestoreBackup(backup);
        alert('Khôi phục dữ liệu thành công!');
      } catch (error) {
        console.error(error);
        alert('Lỗi khi khôi phục dữ liệu.');
      }
    }
  };

  const filteredBackups = backups.filter(b => {
    const matchesDept = filterDeptId === 'ALL' || b.deptId === filterDeptId || b.deptId === 'SYSTEM';
    const matchesDate = !filterDate || b.backupDate === filterDate;
    return matchesDept && matchesDate;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
            <Database className="text-sky-500" /> Quản lý Sao lưu Dữ liệu
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Hệ thống tự động sao lưu sau 0h mỗi ngày (Lưu 5 ngày gần nhất)</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
              <Building2 size={12} /> Lọc theo Khoa
            </label>
            <select 
              className="w-full p-3 bg-slate-50 border-2 border-slate-50 rounded-xl outline-none focus:border-sky-500 font-bold text-sm appearance-none"
              value={filterDeptId}
              onChange={e => setFilterDeptId(e.target.value)}
            >
              <option value="ALL">Tất cả các khoa</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
              <Calendar size={12} /> Lọc theo Ngày sao lưu
            </label>
            <DateInput 
              className="w-full p-3 bg-slate-50 border-2 border-slate-50 rounded-xl outline-none focus:border-sky-500 font-bold text-sm"
              value={filterDate}
              onChange={val => setFilterDate(val)}
            />
          </div>

          {(filterDeptId !== 'ALL' || filterDate) && (
            <button 
              onClick={() => { setFilterDeptId('ALL'); setFilterDate(''); }}
              className="px-4 py-3 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 rounded-xl transition-all"
            >
              Xóa lọc
            </button>
          )}
        </div>

        {/* Backup History List */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
             <History size={18} className="text-slate-400" />
             <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Lịch sử sao lưu</h3>
          </div>

          <div className="space-y-4">
            {filteredBackups.length === 0 ? (
              <div className="bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 p-12 text-center">
                <Database size={48} className="text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Không tìm thấy bản sao lưu nào</p>
              </div>
            ) : (
              filteredBackups.map(backup => {
                const dept = departments.find(d => d.id === backup.deptId);
                const deptName = backup.deptId === 'SYSTEM' ? 'Toàn hệ thống' : (dept?.name || backup.deptId);
                return (
                  <div key={backup.id} className="bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-xl hover:border-sky-100 transition-all group">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-500">
                          <Calendar size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-slate-800 uppercase tracking-tight">{deptName}</h4>
                            <span className="px-2 py-0.5 bg-sky-100 text-sky-600 rounded text-[9px] font-black uppercase tracking-widest">
                              {backup.versionName}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest">
                              Ngày: {formatDate(backup.backupDate)}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">
                            Tạo lúc: {new Date(backup.createdAt).toLocaleString('vi-VN')}
                          </p>
                          {backup.note && (
                            <p className="text-xs text-slate-600 mt-2 italic">"{backup.note}"</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {currentUser.role === 'ADMIN' && (
                          <button 
                            onClick={() => handleRestore(backup)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all"
                            title="Khôi phục dữ liệu"
                          >
                            <RotateCcw size={14} /> Khôi phục
                          </button>
                        )}
                        <button 
                          onClick={() => onDeleteBackup(backup.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                          title="Xóa bản sao lưu"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PlusCircle = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);
