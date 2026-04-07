
import React, { useState } from 'react';
import { Patient, Appointment, Procedure, Staff } from '../types';
import { Button } from './Button';
import { Search, Plus, Calendar, Clock, MapPin, Bed, User, FileText, Edit3, Trash2 } from 'lucide-react';
import { calculateAge } from '../utils/timeUtils';

interface PatientManagerProps {
  patients: Patient[];
  appointments: Appointment[];
  procedures: Procedure[];
  staff: Staff[];
  currentDate: string;
  onAddPatient: () => void;
  onEditPatient: (p: Patient) => void;
  onBookAppointment: (patientId: string, appointment?: Appointment) => void;
  onDeleteAppointment: (apptId: string) => void; // Simplified for demo
}

export const PatientManager: React.FC<PatientManagerProps> = ({
  patients,
  appointments,
  procedures,
  staff,
  currentDate,
  onAddPatient,
  onEditPatient,
  onBookAppointment,
  onDeleteAppointment
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const filteredPatients = patients.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.bedNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPatientAppointments = (patientId: string) => {
    return appointments
      .filter(a => a.patientId === patientId)
      .sort((a, b) => new Date(a.date + 'T' + a.startTime).getTime() - new Date(b.date + 'T' + b.startTime).getTime());
  };

  return (
    <div className="flex h-full gap-6">
      {/* Left Column: Patient List */}
      <div className="w-2/3 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center gap-4 bg-slate-50/50">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition-all"
              placeholder="Tìm theo tên, mã BN, số giường..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={onAddPatient}>
            <Plus size={16} /> Thêm BN
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 z-10">
              <tr>
                <th className="p-4 w-16">STT</th>
                <th className="p-4">Họ và tên</th>
                <th className="p-4 w-20">Tuổi</th>
                <th className="p-4 w-24">Giới tính</th>
                <th className="p-4 w-24">Giường</th>
                <th className="p-4 w-24">Buồng</th>
                <th className="p-4 text-center w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.map((p, idx) => (
                <tr 
                  key={p.id} 
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`cursor-pointer transition-colors ${selectedPatientId === p.id ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                >
                  <td className="p-4 text-slate-500 text-center">{idx + 1}</td>
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{p.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{p.code}</div>
                  </td>
                  <td className="p-4 text-slate-600">{calculateAge(p.dob)}</td>
                  <td className="p-4 text-slate-600">{p.gender}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">
                        <Bed size={12} /> {p.bedNumber}
                    </span>
                  </td>
                  <td className="p-4">
                     <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">
                        <MapPin size={12} /> {p.roomNumber || '-'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onEditPatient(p); }}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-white rounded-full transition-all"
                    >
                      <Edit3 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Column: Appointment Schedule */}
      <div className="w-1/3 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {selectedPatientId ? (
          <>
            <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="text-primary" size={20} />
                    Lịch trình điều trị
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                    BN: <span className="font-bold">{filteredPatients.find(p => p.id === selectedPatientId)?.name}</span>
                </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
               <Button className="w-full mb-4" onClick={() => onBookAppointment(selectedPatientId)}>
                  <Plus size={16} /> Thêm thủ thuật mới
               </Button>

               {getPatientAppointments(selectedPatientId).length === 0 ? (
                   <div className="text-center text-slate-400 py-10">
                       <FileText size={40} className="mx-auto mb-2 opacity-20" />
                       <p className="text-sm">Chưa có lịch thủ thuật nào</p>
                   </div>
               ) : (
                   getPatientAppointments(selectedPatientId).map(appt => {
                       const proc = procedures.find(pr => pr.id === appt.procedureId);
                       const s = staff.find(st => st.id === appt.staffId);
                       const isToday = appt.date === currentDate;
                       
                       return (
                           <div key={appt.id} className={`p-3 rounded-xl border border-slate-100 shadow-sm relative group ${isToday ? 'bg-white ring-1 ring-primary/20' : 'bg-slate-50 opacity-70'}`}>
                               <div className="flex justify-between items-start mb-2">
                                   <div className="font-bold text-sm text-slate-800">{proc?.name}</div>
                                   {isToday && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Hôm nay</span>}
                               </div>
                               <div className="space-y-1 text-xs text-slate-500">
                                   <div className="flex items-center gap-2">
                                       <Calendar size={12} /> {new Date(appt.date).toLocaleDateString('vi-VN')}
                                   </div>
                                   <div className="flex items-center gap-2 font-bold text-slate-700">
                                       <Clock size={12} className="text-primary" /> {appt.startTime} - {appt.endTime}
                                   </div>
                                   <div className="flex flex-col gap-1">
                                       <div className="flex items-center gap-2">
                                           <User size={12} /> {s?.name}
                                       </div>
                                       {appt.assistant1Id && <div className="flex items-center gap-2 text-[10px] text-slate-400 ml-4">Phụ 1: {staff.find(st => st.id === appt.assistant1Id)?.name}</div>}
                                       {appt.assistant2Id && <div className="flex items-center gap-2 text-[10px] text-slate-400 ml-4">Phụ 2: {staff.find(st => st.id === appt.assistant2Id)?.name}</div>}
                                   </div>
                               </div>
                               
                               <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                   <button onClick={() => onBookAppointment(selectedPatientId, appt)} className="p-1.5 bg-sky-50 text-sky-600 rounded hover:bg-sky-100">
                                       <Edit3 size={14} />
                                   </button>
                                   {/* Ideally delete should have confirmation */}
                                   {/* <button className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100">
                                       <Trash2 size={14} />
                                   </button> */}
                               </div>
                           </div>
                       );
                   })
               )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
             <User size={48} className="mb-4 text-slate-200" />
             <p className="font-medium">Chọn bệnh nhân để xem lịch trình</p>
          </div>
        )}
      </div>
    </div>
  );
};
