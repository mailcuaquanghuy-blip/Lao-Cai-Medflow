import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Appointment, Procedure, Staff, Department, DepartmentType, Patient } from '../types';
import { timeStringToMinutes, getRoleLabel } from '../utils/timeUtils';
import { Clock, User, Zap, Filter, Building2 } from 'lucide-react';
import { MOCK_PROCEDURES } from '../constants';

interface DailyReportProps {
  appointments: Appointment[];
  procedures: Procedure[];
  staff: Staff[]; // All staff
  patients: Patient[];
  onNavigateToTimeline: (procedureId?: string, staffId?: string) => void;
  currentDept: Department;
  allDepts: Department[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];
const OVERTIME_COLOR = '#ef4444'; // red-500
const REMAINING_COLOR = '#e2e8f0'; // slate-200
const WORK_HOURS_MINUTES = 8 * 60; // 480 minutes

export const DailyReport: React.FC<DailyReportProps> = ({
  appointments,
  procedures,
  staff,
  patients,
  onNavigateToTimeline,
  currentDept,
  allDepts
}) => {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [filterDeptId, setFilterDeptId] = useState<string>(currentDept.id);

  // Lọc danh sách khoa để hiển thị trong bộ lọc
  const filterOptions = useMemo(() => {
    if (currentDept.type === DepartmentType.CLINICAL) {
      // Khoa lâm sàng: Có thể xem chính mình hoặc các khoa chuyên khoa (SUPPORT)
      return [
        currentDept,
        ...allDepts.filter(d => d.type === DepartmentType.SUPPORT)
      ];
    } else {
      // Khoa chuyên khoa: Có thể xem chính mình hoặc các khoa lâm sàng (CLINICAL)
      return [
        currentDept,
        ...allDepts.filter(d => d.type === DepartmentType.CLINICAL)
      ];
    }
  }, [currentDept, allDepts]);

  // Lọc appointments dựa trên bộ lọc khoa
  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      const patient = patients.find(p => p.id === a.patientId);
      const proc = procedures.find(p => p.id === a.procedureId);
      const mockProc = MOCK_PROCEDURES.find(p => p.id === a.procedureId);
      const procedureDeptId = proc?.deptId || mockProc?.deptId || a.deptId;
      
      if (currentDept.type === DepartmentType.CLINICAL) {
        // Khoa lâm sàng: Chỉ xem báo cáo các thủ thuật thực hiện trên bệnh nhân của khoa mình
        // Có thể là thủ thuật của chính khoa mình hoặc của khoa chuyên khoa được gửi khám
        return patient?.admittedByDeptId === currentDept.id && procedureDeptId === filterDeptId;
      } else {
        // Khoa chuyên khoa (SUPPORT)
        // Luôn chỉ xem báo cáo các thủ thuật thuộc về chuyên khoa mình
        if (filterDeptId === currentDept.id) {
          // Xem toàn bộ báo cáo của chuyên khoa mình (tất cả các khoa lâm sàng gửi đến)
          return procedureDeptId === currentDept.id;
        } else {
          // Xem báo cáo chuyên khoa mình thực hiện cho bệnh nhân của một khoa lâm sàng cụ thể
          return procedureDeptId === currentDept.id && patient?.admittedByDeptId === filterDeptId;
        }
      }
    });
  }, [appointments, filterDeptId, currentDept, patients, procedures]);

  // Lọc nhân sự tương ứng với khoa đang xem
  const relevantStaff = useMemo(() => {
    if (filterDeptId === currentDept.id) {
      return staff.filter(s => s.deptId === currentDept.id);
    } else {
      // Nếu đang xem báo cáo của khoa khác (đối với lâm sàng) hoặc cho khoa khác (đối với chuyên khoa)
      // thì nhân sự thực hiện vẫn là nhân sự của khoa thực hiện (SUPPORT)
      const targetDeptId = currentDept.type === DepartmentType.CLINICAL ? filterDeptId : currentDept.id;
      return staff.filter(s => s.deptId === targetDeptId);
    }
  }, [staff, filterDeptId, currentDept]);

  // 1. Thống kê số lượng thủ thuật
  const procedureStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredAppointments.forEach(appt => {
      stats[appt.procedureId] = (stats[appt.procedureId] || 0) + 1;
    });

    return Object.entries(stats)
      .map(([procedureId, count]) => {
        const proc = procedures.find(p => p.id === procedureId);
        const mockProc = MOCK_PROCEDURES.find(p => p.id === procedureId);
        return {
          procedureId,
          name: proc?.name || mockProc?.name || 'Không xác định',
          count
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredAppointments, procedures]);

  // 2. Thống kê giờ làm việc của nhân sự
  const staffStats = useMemo(() => {
    const stats = relevantStaff.map(s => {
      const staffAppts = filteredAppointments.filter(a => a.staffId === s.id || a.assistant1Id === s.id || a.assistant2Id === s.id);
      
      let totalMinutes = 0;
      const procCounts: Record<string, number> = {};
      const intervals: {start: number, end: number}[] = [];

      staffAppts.forEach(appt => {
        const start = timeStringToMinutes(appt.startTime);
        const end = timeStringToMinutes(appt.endTime);
        const proc = procedures.find(p => p.id === appt.procedureId) || MOCK_PROCEDURES.find(p => p.id === appt.procedureId);
        
        let busyStart = start;
        let busyEnd = end;

        if (appt.staffId === s.id) {
          const startOffset = appt.mainBusyStart ?? proc?.mainBusyStart ?? 0;
          const endOffset = appt.mainBusyEnd ?? proc?.mainBusyEnd ?? proc?.busyMinutes ?? proc?.durationMinutes ?? (end - start);
          busyStart = start + startOffset;
          busyEnd = start + endOffset;
        } else if (appt.assistant1Id === s.id) {
          const startOffset = appt.asst1BusyStart ?? proc?.asst1BusyStart ?? 0;
          const endOffset = appt.asst1BusyEnd ?? proc?.asst1BusyEnd ?? proc?.assistant1BusyMinutes ?? 0;
          busyStart = start + startOffset;
          busyEnd = start + endOffset;
        } else if (appt.assistant2Id === s.id) {
          const startOffset = appt.asst2BusyStart ?? proc?.asst2BusyStart ?? 0;
          const endOffset = appt.asst2BusyEnd ?? proc?.asst2BusyEnd ?? proc?.assistant2BusyMinutes ?? 0;
          busyStart = start + startOffset;
          busyEnd = start + endOffset;
        }

        if (busyEnd > busyStart) {
          intervals.push({ start: busyStart, end: busyEnd });
        }

        procCounts[appt.procedureId] = (procCounts[appt.procedureId] || 0) + 1;
      });

      // Merge overlapping intervals
      intervals.sort((a, b) => a.start - b.start);
      let mergedIntervals: {start: number, end: number}[] = [];
      if (intervals.length > 0) {
        let current = { ...intervals[0] };
        for (let i = 1; i < intervals.length; i++) {
          if (intervals[i].start <= current.end) {
            current.end = Math.max(current.end, intervals[i].end);
          } else {
            mergedIntervals.push(current);
            current = { ...intervals[i] };
          }
        }
        mergedIntervals.push(current);
      }

      totalMinutes = mergedIntervals.reduce((sum, interval) => sum + (interval.end - interval.start), 0);

      const procedureDetails = Object.entries(procCounts).map(([procedureId, count]) => {
        const proc = procedures.find(p => p.id === procedureId);
        const mockProc = MOCK_PROCEDURES.find(p => p.id === procedureId);
        return {
          procedureId,
          name: proc?.name || mockProc?.name || 'Không xác định',
          count
        };
      }).sort((a, b) => b.count - a.count);

      return {
        ...s,
        totalMinutes,
        procedureDetails
      };
    });

    return stats.sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [relevantStaff, filteredAppointments, procedures]);

  const selectedStaffData = useMemo(() => {
    if (!selectedStaffId) return null;
    return staffStats.find(s => s.id === selectedStaffId);
  }, [selectedStaffId, staffStats]);

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'Doctor': return 'Bác sĩ';
      case 'Technician': return 'Kỹ thuật viên';
      case 'Nurse': return 'Điều dưỡng';
      case 'PhysicianAssistant': return 'Y sĩ';
      case 'Pharmacist': return 'Dược sĩ';
      default: return role || 'Nhân viên';
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto bg-slate-50 p-2">
      {/* Bộ lọc khoa */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter size={18} />
          <span className="text-xs font-black uppercase tracking-wider">
            {currentDept.type === DepartmentType.CLINICAL ? 'Lọc theo khoa thực hiện:' : 'Lọc theo khoa chỉ định:'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {filterOptions.map(dept => (
            <button
              key={dept.id}
              onClick={() => {
                setFilterDeptId(dept.id);
                setSelectedStaffId(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                filterDeptId === dept.id
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Building2 size={14} />
              {dept.id === currentDept.id 
                ? (currentDept.type === DepartmentType.CLINICAL ? currentDept.name : 'Toàn bộ chuyên khoa')
                : dept.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Biểu đồ tổng quan thủ thuật */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Zap className="text-amber-500" size={20} />
            Thống kê thủ thuật thực hiện
          </h3>
          <p className="text-xs text-slate-500 mb-4 -mt-4">
            {currentDept.type === DepartmentType.CLINICAL ? 'Khoa thực hiện: ' : 'Khoa chỉ định: '}
            <span className="font-bold text-primary">
              {filterDeptId === currentDept.id 
                ? (currentDept.type === DepartmentType.CLINICAL ? currentDept.name : 'Tất cả các khoa')
                : allDepts.find(d => d.id === filterDeptId)?.name}
            </span>
          </p>
          <div className="flex-1 min-h-[300px]">
            {procedureStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={procedureStats} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    onClick={(data: any) => onNavigateToTimeline(data.procedureId, undefined)}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {procedureStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">Không có dữ liệu thủ thuật</div>
            )}
          </div>
        </div>

        {/* Chi tiết thủ thuật của nhân sự được chọn */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <User className="text-indigo-500" size={20} />
            {selectedStaffData ? `Chi tiết nhân sự: ${selectedStaffData.name}` : 'Chọn nhân sự để xem chi tiết'}
          </h3>
          <p className="text-xs text-slate-500 mb-4 -mt-4">
            {selectedStaffData 
              ? (currentDept.type === DepartmentType.CLINICAL
                  ? `Các thủ thuật thực hiện tại ${allDepts.find(d => d.id === filterDeptId)?.name}`
                  : `Các thủ thuật thực hiện cho bệnh nhân khoa ${filterDeptId === currentDept.id ? 'tất cả' : allDepts.find(d => d.id === filterDeptId)?.name}`)
              : 'Nhấn vào thẻ nhân sự bên dưới'}
          </p>
          <div className="flex-1 min-h-[300px]">
            {selectedStaffData ? (
              selectedStaffData.procedureDetails.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={selectedStaffData.procedureDetails} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#6366f1" 
                      radius={[4, 4, 0, 0]}
                      onClick={(data: any) => onNavigateToTimeline(data.procedureId, selectedStaffData.id)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">Nhân sự này chưa thực hiện thủ thuật nào</div>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Nhấn vào thẻ nhân sự bên dưới để xem biểu đồ
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Danh sách thẻ nhân sự */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Clock className="text-emerald-500" size={20} />
          Tiến độ công việc nhân sự
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {staffStats.map(staffMember => {
            const isOvertime = staffMember.totalMinutes > WORK_HOURS_MINUTES;
            
            const pieData = isOvertime 
              ? [
                  { name: 'Hành chính', value: WORK_HOURS_MINUTES, color: '#3b82f6' },
                  { name: 'Làm thêm', value: staffMember.totalMinutes - WORK_HOURS_MINUTES, color: OVERTIME_COLOR }
                ]
              : [
                  { name: 'Đã làm', value: staffMember.totalMinutes, color: '#3b82f6' },
                  { name: 'Còn lại', value: WORK_HOURS_MINUTES - staffMember.totalMinutes, color: REMAINING_COLOR }
                ];

            const hours = Math.floor(staffMember.totalMinutes / 60);
            const minutes = staffMember.totalMinutes % 60;
            const timeString = `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
            const percentage = Math.round((staffMember.totalMinutes / WORK_HOURS_MINUTES) * 100);

            return (
              <div 
                key={staffMember.id}
                onClick={() => setSelectedStaffId(staffMember.id)}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-4 ${
                  selectedStaffId === staffMember.id 
                    ? 'border-indigo-500 bg-indigo-50/30 shadow-md' 
                    : 'border-slate-100 hover:border-indigo-200 hover:shadow-sm bg-white'
                }`}
              >
                <div className="w-20 h-20 relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={35}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className={`text-xs font-bold ${isOvertime ? 'text-red-500' : 'text-slate-700'}`}>
                      {percentage}%
                    </span>
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 truncate" title={staffMember.name}>{staffMember.name}</h4>
                  <p className="text-xs text-slate-500 truncate mb-1">{getRoleDisplayName(staffMember.role)}</p>
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className={isOvertime ? 'text-red-500' : 'text-slate-400'} />
                    <span className={`text-sm font-medium ${isOvertime ? 'text-red-600' : 'text-slate-600'}`}>
                      {timeString}
                    </span>
                    <span className="text-xs text-slate-400">/ 8h</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
