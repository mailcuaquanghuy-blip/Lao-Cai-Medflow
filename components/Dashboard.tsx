
import React from 'react';
import { Department, DepartmentType, UserAccount, UserRole } from '../types';
import { Activity, Stethoscope, FlaskConical, HeartPulse, ChevronRight, LayoutGrid, PlusCircle, ShieldCheck, LogOut, Users, Database } from 'lucide-react';

interface DeptCardProps {
  dept: Department;
  icon: React.ReactNode;
  onSelect: (dept: Department) => void;
  canEdit: boolean;
}

const DeptCard: React.FC<DeptCardProps> = ({ dept, icon, onSelect, canEdit }) => {
  const BgIcon = dept.type === DepartmentType.CLINICAL ? Stethoscope : (dept.id.includes('xetnghiem') ? FlaskConical : HeartPulse);

  return (
    <button
      onClick={() => onSelect(dept)}
      className="group relative bg-white p-7 rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(14,165,233,0.1)] hover:border-sky-100 hover:-translate-y-1.5 transition-all duration-500 text-left flex flex-col justify-between h-52 overflow-hidden"
    >
      <div className="absolute -bottom-6 -right-6 opacity-[0.03] text-slate-900 transition-all duration-700 group-hover:opacity-[0.07] group-hover:scale-110">
        <BgIcon size={180} />
      </div>
      
      <div className="z-10">
        <div className={`p-3.5 rounded-2xl w-fit mb-5 shadow-sm transition-transform duration-500 group-hover:scale-110 ${dept.type === DepartmentType.CLINICAL ? 'bg-sky-50 text-sky-500 ring-1 ring-sky-100' : 'bg-indigo-50 text-indigo-500 ring-1 ring-indigo-100'}`}>
            {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 24 }) : icon}
        </div>
        <h3 className="font-black text-lg text-slate-800 leading-tight mb-2 uppercase tracking-tight group-hover:text-sky-600 transition-colors">{dept.name}</h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${dept.type === DepartmentType.CLINICAL ? 'bg-sky-400' : 'bg-indigo-400'}`}></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {dept.type === DepartmentType.CLINICAL ? 'Khoa Lâm Sàng' : 'Khoa Hỗ Trợ'}
          </span>
          {canEdit && <span title="Có quyền sửa" className="flex items-center"><ShieldCheck size={12} className="text-emerald-500" /></span>}
        </div>
      </div>
      
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 group-hover:text-sky-600 transition-all uppercase tracking-wider">
          TRUY CẬP <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
        </div>
        <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center text-slate-200 group-hover:text-sky-400 group-hover:border-sky-100 transition-all">
          <PlusCircle size={18} />
        </div>
      </div>
    </button>
  );
}

interface DashboardProps {
  departments: Department[];
  onSelectDepartment: (dept: Department) => void;
  onLogout: () => void;
  currentUser: UserAccount;
  onManageAccounts: () => void;
  onManageBackups: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ departments, onSelectDepartment, onLogout, currentUser, onManageAccounts, onManageBackups }) => {
  const clinicalDepts = departments.filter(d => d.type === DepartmentType.CLINICAL);
  const supportDepts = departments.filter(d => d.type === DepartmentType.SUPPORT);

  return (
    <div className="min-h-screen bg-white p-8 md:p-16 overflow-y-auto selection:bg-sky-100 selection:text-sky-900">
      <div className="max-w-7xl mx-auto space-y-16">
        
        <div className="flex justify-between items-start">
           <div className="flex items-center gap-4">
              <div className="p-2 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm">
                 <img src="/LogoYDCTLC.jpg" alt="Logo YDCTLC" className="h-10 w-auto object-contain mix-blend-multiply" />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Hệ thống MedFlow</p>
                 <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Bệnh viện YHCT Lào Cai</h2>
              </div>
           </div>

           <div className="flex items-center gap-3">
              {currentUser.role === UserRole.ADMIN && (
                <div className="flex gap-2">
                  <button 
                    onClick={onManageBackups}
                    className="flex items-center gap-2 px-5 py-3 bg-sky-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-600 transition-all shadow-xl shadow-sky-100"
                  >
                    <Database size={16} /> Quản lý Sao lưu
                  </button>
                  <button 
                    onClick={onManageAccounts}
                    className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-100"
                  >
                    <Users size={16} /> Quản lý Tài khoản
                  </button>
                </div>
              )}
              <div className="h-10 w-px bg-slate-100 mx-2"></div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight leading-none mb-1">{currentUser.fullName}</p>
                <button onClick={onLogout} className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-600 flex items-center gap-1 justify-end">
                  <LogOut size={10} /> Đăng xuất
                </button>
              </div>
           </div>
        </div>

        <div className="text-center space-y-4 max-w-4xl mx-auto">
          <h1 className="text-[44px] md:text-[56px] font-black text-slate-900 tracking-tighter leading-none uppercase">
            Hệ thống Quản lý <br/>
            <span className="text-sky-500 relative inline-block">
              Lào Cai MedFlow
              <span className="absolute -bottom-2 left-0 w-full h-1.5 bg-sky-500 rounded-full"></span>
            </span>
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em] max-w-2xl mx-auto">
            QUẢN TRỊ QUY TRÌNH ĐIỀU TRỊ & PHỤC HỒI CHỨC NĂNG
          </p>
        </div>

        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">Khối Điều Trị Lâm Sàng</h2>
            <div className="h-px bg-slate-100 flex-1"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {clinicalDepts.map(dept => (
              <DeptCard 
                key={dept.id} 
                dept={dept} 
                icon={<Stethoscope size={28} />} 
                onSelect={onSelectDepartment}
                canEdit={currentUser.role === UserRole.ADMIN || currentUser.editableDeptIds.includes(dept.id)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-8 pb-20">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">Chuyên Khoa Hỗ Trợ</h2>
            <div className="h-px bg-slate-100 flex-1"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {supportDepts.map(dept => (
              <DeptCard 
                key={dept.id} 
                dept={dept} 
                icon={dept.id.includes('xetnghiem') ? <FlaskConical size={28} /> : <HeartPulse size={28} />} 
                onSelect={onSelectDepartment}
                canEdit={currentUser.role === UserRole.ADMIN || currentUser.editableDeptIds.includes(dept.id)}
              />
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};
