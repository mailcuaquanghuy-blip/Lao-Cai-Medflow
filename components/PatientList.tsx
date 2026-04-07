
import React, { useState, useEffect } from 'react';
import { Patient, PatientStatus, Department, DepartmentType } from '../types';
import { Button } from './Button';
import { DateTimePicker } from './DateTimePicker';
import { Search, Plus, User, MapPin, Bed, LogOut, FileText, Edit3, Printer, Send, Activity, FlaskConical, HeartPulse, CheckCircle2, Clock, Building2, Filter, Calendar, CheckSquare, Trash2, AlertTriangle, Power, CheckCircle, RotateCcw, X, XCircle, Pill, ChevronDown, DoorOpen } from 'lucide-react';
import { calculateAge, getAbbreviation } from '../utils/timeUtils';
import { DEPARTMENTS, MOCK_PROCEDURES } from '../constants';
import { Appointment, Procedure, Staff } from '../types';

type SortField = 'NAME' | 'ROOM' | 'BED' | 'ADMISSION';
type SortDirection = 'ASC' | 'DESC';
interface SortConfig { field: SortField; direction: SortDirection }

interface PatientListProps {
  patients: Patient[];
  activeDate: string;
  currentDept: Department;
  appointments: Appointment[];
  procedures: Procedure[];
  staff: Staff[];
  onAddPatient: () => void;
  onEditPatient: (p: Patient) => void;
  onDeletePatient: (patientId: string) => void;
  onUpdateStatus: (patient: Patient, status: PatientStatus, dischargeDate?: string) => void;
  onReferral: (patientId: string, specialty: string) => void;
  onFinishReferral: (patientId: string, specialty: string) => void;
  onCancelFinishReferral: (patientId: string, specialty: string) => void;
  onCancelReferral: (patientId: string, specialty: string) => void;
}

export const PatientList: React.FC<PatientListProps> = ({
  patients,
  activeDate,
  currentDept,
  appointments,
  procedures,
  staff,
  onAddPatient,
  onEditPatient,
  onDeletePatient,
  onUpdateStatus,
  onReferral,
  onFinishReferral,
  onCancelFinishReferral,
  onCancelReferral,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'TREATING' | 'DISCHARGED'>('TREATING');
  const [referringDeptFilter, setReferringDeptFilter] = useState<string>('ALL');
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([{ field: 'ADMISSION', direction: 'ASC' }]);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [dischargingPatient, setDischargingPatient] = useState<Patient | null>(null);
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);
  const [finishingReferral, setFinishingReferral] = useState<{patient: Patient, specialty: string} | null>(null);
  
  // States cho in chỉ định
  const [printingPatient, setPrintingPatient] = useState<Patient | null>(null);
  const [printFromDate, setPrintFromDate] = useState<string>(activeDate);
  const [printToDate, setPrintToDate] = useState<string>(activeDate);
  const [printDeptId, setPrintDeptId] = useState<string>('ALL');
  
  // States cho Modal kết thúc
  const [dischargeDateInput, setDischargeDateInput] = useState('');

  useEffect(() => {
    if (dischargingPatient) {
      const now = new Date();
      const localDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDischargeDateInput(localDatetime);
    }
  }, [dischargingPatient]);

  const isSupportDept = currentDept.type === DepartmentType.SUPPORT;

  const filteredPatients = patients.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.code || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;

    let isVisible = false;
    if (currentDept.type === DepartmentType.CLINICAL) {
        isVisible = p.admittedByDeptId === currentDept.id;
    } else {
        if (p.admittedByDeptId === currentDept.id) {
            isVisible = true;
        } else {
            isVisible = p.referrals?.some(r => {
                const s = (r.specialty || '').toLowerCase();
                const dId = currentDept.id.toLowerCase();
                const dName = currentDept.name.toLowerCase();
                
                // Unify matching logic
                const isMatch = s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                               (s.includes('phcn') && dId.includes('phcn')) ||
                               (s.includes('cdha') && dId.includes('cdha')) ||
                               (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                               (s.includes('duoc') && dId.includes('duoc')) ||
                               (dId === 'dept_phcn' && s === 'dept_phcn') ||
                               (dId === 'dept_cdha' && s === 'dept_cdha') ||
                               (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
                               
                if (!isMatch) return false;
                const refDate = r.referralDate || p.admissionDate.split('T')[0];
                if (activeDate < refDate) return false;
                if (r.status === 'FINISHED' && r.finishedDate && activeDate > r.finishedDate) return false;
                return true;
            }) ?? false;
        }
    }

    const matchesDeptFilter = referringDeptFilter === 'ALL' || p.admittedByDeptId === referringDeptFilter;

    return matchesSearch && matchesStatus && isVisible && matchesDeptFilter;
  }).sort((a, b) => {
    const getFirstName = (fullName: string) => {
      const parts = fullName.trim().split(' ');
      return parts[parts.length - 1] || '';
    };

    for (const config of sortConfigs) {
      let cmp = 0;
      if (config.field === 'NAME') {
        const firstNameA = getFirstName(a.name);
        const firstNameB = getFirstName(b.name);
        cmp = firstNameA.localeCompare(firstNameB);
        if (cmp === 0) {
          cmp = a.name.localeCompare(b.name);
        }
      } else if (config.field === 'ROOM') {
        const roomA = a.roomNumber || '';
        const roomB = b.roomNumber || '';
        cmp = roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
      } else if (config.field === 'BED') {
        const bedA = a.bedNumber || '';
        const bedB = b.bedNumber || '';
        cmp = bedA.localeCompare(bedB, undefined, { numeric: true, sensitivity: 'base' });
      } else if (config.field === 'ADMISSION') {
        cmp = new Date(a.admissionDate).getTime() - new Date(b.admissionDate).getTime();
      }
      if (cmp !== 0) {
        return config.direction === 'ASC' ? cmp : -cmp;
      }
    }
    return 0;
  });

  const handleConfirmDischarge = () => {
    if (dischargingPatient) {
      onUpdateStatus(dischargingPatient, 'DISCHARGED', dischargeDateInput);
      setDischargingPatient(null);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingPatient) {
      onDeletePatient(deletingPatient.id);
      setDeletingPatient(null);
    }
  };

  const handleConfirmFinishReferral = () => {
    if (finishingReferral) {
        onFinishReferral(finishingReferral.patient.id, finishingReferral.specialty);
        setFinishingReferral(null);
    }
  };

  const executePrint = () => {
    if (!printingPatient) return;
    
    let patientAppts = appointments.filter(a => a.patientId === printingPatient.id);
    
    // Filter by date
    if (printFromDate) {
      patientAppts = patientAppts.filter(a => a.date >= printFromDate);
    }
    if (printToDate) {
      patientAppts = patientAppts.filter(a => a.date <= printToDate);
    }
    
    // Filter by department
    if (printDeptId !== 'ALL') {
      patientAppts = patientAppts.filter(a => {
        const proc = procedures.find(p => p.id === a.procedureId);
        const mockProc = MOCK_PROCEDURES.find(p => p.id === a.procedureId);
        const procedureDeptId = proc?.deptId || mockProc?.deptId || a.deptId;
        return procedureDeptId === printDeptId;
      });
    }

    if (patientAppts.length === 0) {
      alert('Không có chỉ định nào thỏa mãn điều kiện.');
      return;
    }

    // Sort by date and time
    patientAppts.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Phiếu Chỉ Định - ${printingPatient.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; font-size: 24px; margin-bottom: 5px; }
            h2 { text-align: center; font-size: 18px; font-weight: normal; margin-top: 0; margin-bottom: 20px; }
            .info { margin-bottom: 20px; }
            .info p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>PHIẾU CHỈ ĐỊNH THỦ THUẬT</h1>
          <h2>Khoa: ${currentDept.name}</h2>
          
          <div class="info">
            <p><strong>Họ và tên người bệnh:</strong> ${printingPatient.name} - <strong>Tuổi:</strong> ${calculateAge(printingPatient.dob)} - <strong>Giới tính:</strong> ${printingPatient.gender}</p>
            <p><strong>Mã BN:</strong> ${printingPatient.code}</p>
            <p><strong>Phòng/Giường:</strong> P${printingPatient.roomNumber || '?'} - G${printingPatient.bedNumber}</p>
            <p><strong>Ngày vào viện:</strong> ${new Date(printingPatient.admissionDate).toLocaleDateString('vi-VN')}</p>
            <p><strong>Từ ngày:</strong> ${printFromDate ? new Date(printFromDate).toLocaleDateString('vi-VN') : '...'} - <strong>Đến ngày:</strong> ${printToDate ? new Date(printToDate).toLocaleDateString('vi-VN') : '...'}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>Ngày thực hiện</th>
                <th>Giờ thực hiện</th>
                <th>Tên thủ thuật</th>
                <th>Người thực hiện</th>
                <th>Khoa thực hiện</th>
              </tr>
            </thead>
            <tbody>
              ${patientAppts.map((appt, idx) => {
                const proc = procedures.find(p => p.id === appt.procedureId);
                const staffMember = staff.find(s => s.id === appt.staffId);
                const a1 = staff.find(s => s.id === appt.assistant1Id);
                const a2 = staff.find(s => s.id === appt.assistant2Id);
                const mockProc = MOCK_PROCEDURES.find(p => p.id === appt.procedureId);
                const procedureDeptId = proc?.deptId || mockProc?.deptId || appt.deptId;
                const performingDept = DEPARTMENTS.find(d => d.id === procedureDeptId);
                let staffStr = staffMember?.name || 'Chưa phân công';
                if (a1) staffStr += `<br><small>Phụ 1: ${a1.name}</small>`;
                if (a2) staffStr += `<br><small>Phụ 2: ${a2.name}</small>`;
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${new Date(appt.date).toLocaleDateString('vi-VN')}</td>
                    <td>${appt.startTime} - ${appt.endTime}</td>
                    <td>${proc?.name || 'Không rõ'}</td>
                    <td>${staffStr}</td>
                    <td>${performingDept?.name || 'Không rõ'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div style="margin-top: 40px; display: flex; justify-content: space-between;">
            <div></div>
            <div style="text-align: center;">
              <p><em>Ngày ..... tháng ..... năm .....</em></p>
              <p><strong>Người chỉ định</strong></p>
              <br/><br/><br/>
              <p>.........................................</p>
            </div>
          </div>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setPrintingPatient(null);
  };

  const referralSpecialties = [
    { id: 'dept_phcn', label: 'PHCN', icon: <Activity size={12} /> },
    { id: 'dept_xetnghiem', label: 'Xét nghiệm', icon: <FlaskConical size={12} /> },
    { id: 'dept_cdha', label: 'CDHA', icon: <HeartPulse size={12} /> },
    { id: 'dept_duoc', label: 'Dược', icon: <Pill size={12} /> }
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4 bg-slate-50/50">
        <div className="flex items-center gap-4">
           <div className="flex bg-slate-200 rounded-lg p-1 shrink-0">
              <button onClick={() => setFilterStatus('TREATING')} className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all uppercase tracking-wider ${filterStatus === 'TREATING' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Đang điều trị</button>
              <button onClick={() => setFilterStatus('DISCHARGED')} className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all uppercase tracking-wider ${filterStatus === 'DISCHARGED' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Ra viện</button>
           </div>
           
           {isSupportDept && (
             <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
               <Filter size={14} className="text-slate-400" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Từ khoa:</span>
               <select className="text-xs font-bold bg-transparent outline-none cursor-pointer" value={referringDeptFilter} onChange={e => setReferringDeptFilter(e.target.value)}>
                  <option value="ALL">Tất cả khoa lâm sàng</option>
                  <option value="dept_ngoai">Khoa Ngoại</option>
                  <option value="dept_noi">Khoa Nội</option>
                  <option value="dept_chamcuu">Khoa Châm cứu</option>
               </select>
             </div>
           )}
        </div>

        <div className="flex-1 max-md:hidden max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-100 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none text-sm font-bold transition-all" placeholder="Tìm tên, mã BN..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        <div className="relative">
          <button onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm hover:bg-slate-50 transition-all">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sắp xếp {sortConfigs.length > 0 ? `(${sortConfigs.length})` : ''}</span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>
          
          {isSortMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-[320px] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 flex flex-col gap-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Điều kiện sắp xếp</span>
                <button onClick={() => setIsSortMenuOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={16}/></button>
              </div>
              
              {sortConfigs.length === 0 && (
                <p className="text-xs text-slate-400 font-bold text-center py-2">Chưa có điều kiện sắp xếp (Mặc định)</p>
              )}

              {sortConfigs.map((config, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select 
                    className="flex-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 outline-none focus:border-primary"
                    value={config.field}
                    onChange={e => {
                      const newConfigs = [...sortConfigs];
                      newConfigs[idx].field = e.target.value as SortField;
                      setSortConfigs(newConfigs);
                    }}
                  >
                    <option value="NAME">Tên bệnh nhân</option>
                    <option value="ROOM">Phòng</option>
                    <option value="BED">Giường</option>
                    <option value="ADMISSION">Thời gian vào viện</option>
                  </select>
                  
                  <button 
                    onClick={() => {
                      const newConfigs = [...sortConfigs];
                      newConfigs[idx].direction = config.direction === 'ASC' ? 'DESC' : 'ASC';
                      setSortConfigs(newConfigs);
                    }}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-[10px] w-14 text-center uppercase"
                    title="Đổi chiều sắp xếp"
                  >
                    {config.direction === 'ASC' ? 'Tăng' : 'Giảm'}
                  </button>
                  
                  <button 
                    onClick={() => {
                      const newConfigs = sortConfigs.filter((_, i) => i !== idx);
                      setSortConfigs(newConfigs);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50"
                    title="Xóa điều kiện này"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              
              {sortConfigs.length < 4 && (
                <button 
                  onClick={() => {
                    const usedFields = sortConfigs.map(c => c.field);
                    const availableFields: SortField[] = ['NAME', 'ROOM', 'BED', 'ADMISSION'];
                    const nextField = availableFields.find(f => !usedFields.includes(f)) || 'NAME';
                    setSortConfigs([...sortConfigs, { field: nextField, direction: 'ASC' }]);
                  }}
                  className="flex items-center justify-center gap-1 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all mt-1"
                >
                  <Plus size={14} /> Thêm điều kiện
                </button>
              )}
            </div>
          )}
        </div>

        {!isSupportDept && (
          <Button onClick={onAddPatient} className="shadow-lg shadow-primary/10">
            <Plus size={18} /> BN vào khoa mới
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 font-black sticky top-0 z-20 text-[10px] uppercase tracking-[0.1em] border-b border-slate-200">
            <tr>
              <th className="p-4 w-12 text-center">STT</th>
              <th className="p-4 min-w-[200px]">THÔNG TIN BỆNH NHÂN</th>
              <th className="p-4 w-32 text-center">GIỚI TÍNH / TUỔI</th>
              <th className="p-4 w-48 text-center">{isSupportDept ? 'KHOA GỬI KHÁM' : 'KHOA ĐIỀU TRỊ'}</th>
              <th className="p-4 w-[320px] text-center">{isSupportDept ? 'CHỈ ĐỊNH' : 'TÌNH TRẠNG GỬI KHÁM'}</th>
              <th className="p-4 w-40">PHÒNG / GIƯỜNG</th>
              <th className="p-4 w-48 text-center">{isSupportDept ? 'GIỜ VÀO VIỆN' : 'THỜI GIAN'}</th>
              <th className="p-4 w-32 text-center">QUẢN LÝ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPatients.map((p, idx) => {
              const activeReferralForMe = p.referrals?.find(r => {
                const s = (r.specialty || '').toLowerCase();
                const dId = currentDept.id.toLowerCase();
                const dName = currentDept.name.toLowerCase();
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
              const isOwner = p.admittedByDeptId === currentDept.id;
              const referringDept = DEPARTMENTS.find(d => d.id === p.admittedByDeptId);
              
              return (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="p-4 text-slate-400 text-center font-mono text-xs">{idx + 1}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black shadow-sm ${p.gender === 'Nam' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                        {p.name.charAt(0)}
                      </div>
                      <div className="font-black text-slate-800 text-sm leading-tight uppercase">{p.name}</div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${p.gender === 'Nam' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                        {p.gender}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg whitespace-nowrap">
                        {calculateAge(p.dob)} tuổi
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap shadow-sm">
                       <Building2 size={14} className="text-primary/60" />
                       {referringDept?.name || 'Chưa rõ'}
                    </div>
                  </td>
                  <td className="p-4">
                    {isSupportDept ? (
                      <div className="flex flex-col gap-1.5 items-start">
                        {p.referrals?.filter(r => {
                          const s = (r.specialty || '').toLowerCase();
                          const dId = currentDept.id.toLowerCase();
                          const dName = currentDept.name.toLowerCase();
                          return s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                                 (s.includes('phcn') && dId.includes('phcn')) ||
                                 (s.includes('cdha') && dId.includes('cdha')) ||
                                 (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                                 (s.includes('duoc') && dId.includes('duoc')) ||
                                 (dId === 'dept_phcn' && s === 'dept_phcn') ||
                                 (dId === 'dept_cdha' && s === 'dept_cdha') ||
                                 (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
                        }).map(ref => (
                          ref.procedureIds?.map(pid => {
                            const proc = procedures.find(pr => pr.id === pid);
                            return (
                              <div key={pid} className="flex items-center gap-2.5 px-3 py-2 bg-blue-50/80 text-blue-700 border border-blue-100 rounded-xl text-xs font-bold w-fit shadow-sm hover:bg-blue-100 transition-all" title={proc?.name || pid}>
                                <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black bg-blue-100 text-blue-600 shrink-0">{getAbbreviation(proc?.name || pid)}</div>
                                <span className="truncate max-w-[300px]">{proc?.name || pid}</span>
                              </div>
                            );
                          })
                        ))}
                        {(!p.referrals?.some(r => {
                          const s = (r.specialty || '').toLowerCase();
                          const dId = currentDept.id.toLowerCase();
                          const dName = currentDept.name.toLowerCase();
                          return s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                                 (s.includes('phcn') && dId.includes('phcn')) ||
                                 (s.includes('cdha') && dId.includes('cdha')) ||
                                 (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                                 (s.includes('duoc') && dId.includes('duoc')) ||
                                 (dId === 'dept_phcn' && s === 'dept_phcn') ||
                                 (dId === 'dept_cdha' && s === 'dept_cdha') ||
                                 (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
                        }) || 
                          !p.referrals?.find(r => {
                            const s = (r.specialty || '').toLowerCase();
                            const dId = currentDept.id.toLowerCase();
                            const dName = currentDept.name.toLowerCase();
                            return s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                                   (s.includes('phcn') && dId.includes('phcn')) ||
                                   (s.includes('cdha') && dId.includes('cdha')) ||
                                   (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                                   (s.includes('duoc') && dId.includes('duoc')) ||
                                   (dId === 'dept_phcn' && s === 'dept_phcn') ||
                                   (dId === 'dept_cdha' && s === 'dept_cdha') ||
                                   (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
                          })?.procedureIds?.length) && (
                          <span className="text-[10px] text-slate-400 font-bold italic">Không có chỉ định</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2">
                        {p.referrals && p.referrals.length > 0 ? (
                          <div className="flex flex-wrap gap-2 items-center justify-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Đã gửi khám:</span>
                            {p.referrals.map((ref, rIdx) => (
                              <div key={rIdx} className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 border border-blue-100">
                                {referralSpecialties.find(s => s.id === ref.specialty)?.label || ref.specialty.replace('dept_', '')}
                                {p.admittedByDeptId === currentDept.id && (
                                  <button onClick={(e) => { e.stopPropagation(); onCancelReferral(p.id, ref.specialty); }} className="ml-1 hover:text-rose-500"><X size={10} /></button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Chưa gửi khám</span>
                        )}
                        
                        {p.status === 'TREATING' && p.admittedByDeptId === currentDept.id && (
                          <div className="flex justify-center gap-2 mt-1 w-full">
                            {referralSpecialties.filter(s => !p.referrals?.some(r => r.specialty === s.id)).map(s => (
                              <button key={s.id} onClick={() => onReferral(p.id, s.id)} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[8px] font-black text-slate-500 hover:text-primary hover:border-primary transition-all flex items-center gap-1">{s.icon} {s.label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                     <div className="flex flex-col gap-1.5">
                       <div className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-black border border-slate-200 shadow-sm w-fit whitespace-nowrap">
                         <Bed size={14} className="text-primary/60" /> 
                         <span>Giường: {p.bedNumber}</span>
                       </div>
                       <div className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-black border border-slate-200 shadow-sm w-fit whitespace-nowrap">
                         <DoorOpen size={14} className="text-primary/60" /> 
                         <span>Phòng: {p.roomNumber || '?'}</span>
                       </div>
                     </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col gap-1.5 text-[10px] font-bold items-center">
                      <div className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm whitespace-nowrap">
                        <Clock size={14} className="text-emerald-500" />
                        <span>Vào: {new Date(p.admissionDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                      </div>
                      {p.dischargeDate && (
                        <div className="inline-flex items-center gap-1.5 text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 shadow-sm whitespace-nowrap">
                          <Clock size={14} className="text-rose-500" />
                          <span>Ra: {new Date(p.dischargeDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      {isOwner ? (
                          <button onClick={() => onEditPatient(p)} className="p-2.5 bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-primary rounded-xl transition-all" title="Sửa hồ sơ"><Edit3 size={16} /></button>
                      ) : (
                          isSupportDept && activeReferralForMe && (
                            <button 
                                onClick={() => setFinishingReferral({ patient: p, specialty: activeReferralForMe.specialty })} 
                                className="p-2.5 bg-rose-50 border border-rose-100 shadow-sm text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all flex items-center gap-2" 
                                title="Kết thúc khám chuyên khoa"
                            >
                                <Power size={18} />
                                <span className="hidden group-hover:block text-[10px] font-black uppercase">Kết thúc</span>
                            </button>
                          )
                      )}
                      
                      {!isSupportDept && (
                        <>
                          <button onClick={() => setPrintingPatient(p)} className="p-2.5 bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-indigo-600 rounded-xl transition-all" title="In chỉ định"><Printer size={16} /></button>
                          {p.status === 'TREATING' && (
                              <button onClick={() => setDischargingPatient(p)} className="p-2.5 bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-rose-600 rounded-xl transition-all" title="Ra viện"><LogOut size={16} /></button>
                          )}
                          <button onClick={() => {
                            const hasAppointments = appointments.some(a => a.patientId === p.id);
                            if (hasAppointments) {
                              alert("Không thể xóa bệnh nhân này vì vẫn còn thủ thuật. Vui lòng xóa toàn bộ thủ thuật của bệnh nhân trước khi xóa hồ sơ.");
                            } else {
                              setDeletingPatient(p);
                            }
                          }} className="p-2.5 bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-rose-600 rounded-xl transition-all" title="Xóa hồ sơ"><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredPatients.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-4 text-slate-300">
             <Search size={48} className="opacity-10" />
             <p className="font-black text-xs uppercase tracking-widest">Không tìm thấy bệnh nhân nào</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingPatient && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">XÓA HỒ SƠ</h3>
                <p className="text-sm text-slate-500 font-bold">Bệnh nhân: <span className="text-slate-800">{deletingPatient.name}</span></p>
              </div>
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle size={20} className="text-rose-500 shrink-0" />
                <p className="text-[11px] text-rose-600 font-bold text-left leading-relaxed uppercase">Hành động này sẽ xóa vĩnh viễn hồ sơ và toàn bộ chỉ định liên quan. Không thể hoàn tác!</p>
              </div>
              <div className="flex gap-4 w-full pt-2">
                <button onClick={() => setDeletingPatient(null)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-2xl transition-all uppercase tracking-widest text-xs">HỦY</button>
                <button onClick={handleConfirmDelete} className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-rose-200 uppercase tracking-widest text-xs">XÓA NGAY</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discharge Confirmation Modal */}
      {dischargingPatient && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-2">
                <LogOut size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">XÁC NHẬN RA VIỆN</h3>
              <p className="text-sm text-slate-500 font-bold">Bệnh nhân: <span className="text-slate-800">{dischargingPatient.name}</span></p>
              
              <div className="w-full space-y-2 text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Calendar size={12} /> Chọn ngày giờ ra viện
                </label>
                <DateTimePicker 
                  className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-rose-400 outline-none"
                  value={dischargeDateInput}
                  onChange={val => setDischargeDateInput(val)}
                />
              </div>

              <div className="flex gap-3 w-full pt-4">
                <Button onClick={() => setDischargingPatient(null)} variant="secondary" className="flex-1">HỦY</Button>
                <Button onClick={handleConfirmDischarge} className="flex-1 bg-rose-600 hover:bg-rose-700">RA VIỆN</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finish Referral Modal */}
      {finishingReferral && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
                <CheckSquare size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">
                KẾT THÚC KHÁM<br/>
                <span className="text-primary">{finishingReferral.specialty}</span>
              </h3>
              <p className="text-xs text-slate-500 font-bold -mt-4">BN: {finishingReferral.patient.name}</p>

              <div className="flex gap-4 w-full pt-2">
                <button onClick={() => setFinishingReferral(null)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-2xl transition-all uppercase tracking-widest text-xs">HỦY</button>
                <button onClick={handleConfirmFinishReferral} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-200 uppercase tracking-widest text-xs">XÁC NHẬN</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Print Modal */}
      {printingPatient && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                <Printer size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">IN CHỈ ĐỊNH</h3>
                <p className="text-sm text-slate-500 font-bold">Bệnh nhân: <span className="text-slate-800">{printingPatient.name}</span></p>
              </div>
              
              <div className="w-full space-y-4 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Calendar size={12} /> Từ ngày
                    </label>
                    <input 
                      type="date"
                      className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-indigo-400 outline-none"
                      value={printFromDate}
                      onChange={e => setPrintFromDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Calendar size={12} /> Đến ngày
                    </label>
                    <input 
                      type="date"
                      className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-indigo-400 outline-none"
                      value={printToDate}
                      onChange={e => setPrintToDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Filter size={12} /> Khoa thực hiện
                  </label>
                  <select 
                    className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-indigo-400 outline-none"
                    value={printDeptId}
                    onChange={e => setPrintDeptId(e.target.value)}
                  >
                    <option value="ALL">Tất cả các khoa</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 w-full pt-4">
                <button onClick={() => setPrintingPatient(null)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-2xl transition-all uppercase tracking-widest text-xs">HỦY</button>
                <button onClick={executePrint} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-indigo-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                  <Printer size={16} /> IN NGAY
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
