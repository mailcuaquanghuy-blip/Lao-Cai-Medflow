
import React, { useState } from 'react';
import { UserAccount } from '../types';
import { DEFAULT_ADMIN } from '../constants';
import { Activity, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: UserAccount) => void;
  users: UserAccount[];
}

export const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Giả lập delay mạng
    setTimeout(() => {
      const allUsers = [DEFAULT_ADMIN, ...users];
      const user = allUsers.find(u => u.username === username && u.password === password);

      if (user) {
        onLogin(user);
      } else {
        setError('Tên đăng nhập hoặc mật khẩu không đúng!');
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 p-10 space-y-8 animate-in fade-in zoom-in duration-300">
          <div className="text-center space-y-4">
            <div className="inline-flex p-4 bg-sky-50 rounded-3xl text-sky-500 shadow-inner">
              <img src="/LogoYDCTLC.jpg" alt="Logo YDCTLC" className="h-20 w-auto object-contain mix-blend-multiply" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">MedFlow Login</h1>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Bệnh viện YHCT Lào Cai</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tên đăng nhập</label>
              <div className="relative">
                <input 
                  required
                  type="text" 
                  className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-sky-500 focus:bg-white transition-all font-bold text-slate-800"
                  placeholder="Tên đăng nhập..."
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mật khẩu</label>
              <div className="relative">
                <input 
                  required
                  type="password" 
                  className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-sky-500 focus:bg-white transition-all font-bold text-slate-800"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 animate-in slide-in-from-top-2">
                <AlertCircle size={18} />
                <span className="text-xs font-black uppercase tracking-tight">{error}</span>
              </div>
            )}

            <button 
              disabled={loading}
              className="w-full py-5 bg-sky-500 hover:bg-sky-600 text-white font-black rounded-2xl shadow-xl shadow-sky-100 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'ĐĂNG NHẬP HỆ THỐNG'}
            </button>
          </form>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 text-[10px] text-slate-400 font-black uppercase tracking-widest text-right space-y-1">
        <p>Tác giả: ĐD Nguyễn Quang Huy - ĐD Mùi Thị Huệ</p>
      </div>
    </div>
  );
};
