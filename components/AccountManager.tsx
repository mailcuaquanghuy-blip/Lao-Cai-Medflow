
import React, { useState } from 'react';
import { UserAccount, UserRole, Department } from '../types';
import { DEPARTMENTS } from '../constants';
import { UserPlus, Shield, Key, Edit3, Trash2, CheckCircle2, Building2, User } from 'lucide-react';
import { Button } from './Button';

interface AccountManagerProps {
  users: UserAccount[];
  onSaveUser: (user: UserAccount) => void;
  onDeleteUser: (userId: string) => void;
}

export const AccountManager: React.FC<AccountManagerProps> = ({ users, onSaveUser, onDeleteUser }) => {
  const [editingUser, setEditingUser] = useState<Partial<UserAccount> | null>(null);

  const handleOpenModal = (user?: UserAccount) => {
    if (user) {
      setEditingUser({ ...user });
    } else {
      setEditingUser({
        username: '',
        password: '',
        fullName: '',
        role: UserRole.STAFF,
        viewableDeptIds: [],
        editableDeptIds: []
      });
    }
  };

  const handleToggleDeptPermission = (deptId: string, type: 'view' | 'edit') => {
    if (!editingUser) return;
    
    const field = type === 'view' ? 'viewableDeptIds' : 'editableDeptIds';
    const current = editingUser[field] || [];
    const updated = current.includes(deptId) 
      ? current.filter(id => id !== deptId)
      : [...current, deptId];

    // Nếu có quyền sửa thì tự động phải có quyền xem
    let finalUpdate = { [field]: updated };
    if (type === 'edit' && !current.includes(deptId) && !editingUser.viewableDeptIds?.includes(deptId)) {
      finalUpdate.viewableDeptIds = [...(editingUser.viewableDeptIds || []), deptId];
    }

    setEditingUser({ ...editingUser, ...finalUpdate });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Quản lý Tài khoản</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Phân quyền hệ thống & Truy cập khoa</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-primary/20">
          <UserPlus size={18} /> Tạo tài khoản mới
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map(u => (
          <div key={u.id} className="bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-xl hover:border-primary/20 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${u.role === UserRole.ADMIN ? 'bg-amber-50 text-amber-500' : 'bg-sky-50 text-sky-500'}`}>
                {u.fullName.charAt(0)}
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleOpenModal(u)} className="p-2 text-slate-300 hover:text-primary transition-colors"><Edit3 size={16} /></button>
                {u.username !== 'admin' && (
                  <button onClick={() => onDeleteUser(u.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-black text-slate-800 text-lg leading-tight">{u.fullName}</h3>
                <p className="text-xs text-slate-400 font-mono mt-1">@{u.username}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.role === UserRole.ADMIN ? 'bg-amber-100 text-amber-600' : 'bg-sky-100 text-sky-600'}`}>
                  {u.role}
                </span>
                <span className="text-[9px] font-black text-slate-300 uppercase">Quyền truy cập: {u.viewableDeptIds.length} khoa</span>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Quyền hạn khoa:</p>
                <div className="flex flex-wrap gap-1.5">
                  {DEPARTMENTS.map(d => {
                    const canEdit = u.editableDeptIds.includes(d.id);
                    const canView = u.viewableDeptIds.includes(d.id);
                    if (!canView) return null;
                    return (
                      <div key={d.id} className={`px-2 py-1 rounded-md text-[8px] font-black border uppercase flex items-center gap-1 ${canEdit ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                         {d.name.split(' ').pop()} {canEdit && <Shield size={8}/>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  <User size={24} /> {editingUser.id ? 'Cấu hình tài khoản' : 'Tạo tài khoản mới'}
                </h2>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-white/50 hover:text-white text-2xl">&times;</button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 space-y-6 scrollbar-thin">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tên hiển thị</label>
                  <input className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-sky-500 font-bold" value={editingUser.fullName} onChange={e => setEditingUser({...editingUser, fullName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Vai trò</label>
                  <select className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-sky-500 font-bold appearance-none" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}>
                    <option value={UserRole.STAFF}>Nhân viên (Staff)</option>
                    <option value={UserRole.ADMIN}>Quản trị viên (Admin)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tên đăng nhập</label>
                  <input className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-sky-500 font-bold" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} disabled={editingUser.username === 'admin'} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mật khẩu</label>
                  <input type="password" className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-sky-500 font-bold" value={editingUser.password} onChange={e => setEditingUser({...editingUser, password: e.target.value})} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <Building2 size={18} className="text-slate-400" />
                   <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Phân quyền Truy cập Khoa</h3>
                </div>
                
                <div className="bg-slate-50 rounded-3xl p-6 border-2 border-slate-100 overflow-hidden">
                   <table className="w-full text-xs">
                     <thead>
                       <tr className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200">
                         <th className="text-left py-3">Tên Khoa</th>
                         <th className="text-center py-3 w-20">Xem</th>
                         <th className="text-center py-3 w-20">Sửa</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {DEPARTMENTS.map(d => (
                         <tr key={d.id} className="hover:bg-white transition-colors">
                           <td className="py-3 font-bold text-slate-700">{d.name}</td>
                           <td className="py-3 text-center">
                              <input 
                                type="checkbox" 
                                className="w-5 h-5 rounded-lg border-2 border-slate-200 text-sky-500 focus:ring-sky-500"
                                checked={editingUser.viewableDeptIds?.includes(d.id)}
                                onChange={() => handleToggleDeptPermission(d.id, 'view')}
                              />
                           </td>
                           <td className="py-3 text-center">
                              <input 
                                type="checkbox" 
                                className="w-5 h-5 rounded-lg border-2 border-slate-200 text-emerald-500 focus:ring-emerald-500"
                                checked={editingUser.editableDeptIds?.includes(d.id)}
                                onChange={() => handleToggleDeptPermission(d.id, 'edit')}
                              />
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50 flex gap-4">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest text-xs">Hủy</button>
              <Button onClick={() => {
                const final = {
                  ...editingUser,
                  id: editingUser.id || `u_${Math.random().toString(36).substr(2, 9)}`
                } as UserAccount;
                onSaveUser(final);
                setEditingUser(null);
              }} className="flex-[2] py-4 h-auto shadow-xl shadow-primary/20">LƯU TÀI KHOẢN</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
