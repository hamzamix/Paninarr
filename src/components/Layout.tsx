import React from 'react';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookImage, BookOpen, PackageOpen, BrainCircuit, Trophy, ArrowRightLeft, LogOut, Sparkles, Swords, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [hasUltimateBadge, setHasUltimateBadge] = useState(false);
  const isSimRoute = location.pathname.startsWith('/simulation');

  useEffect(() => {
    if (!user?.id) return;
    fetch('/api/badges', { headers: { 'x-user-id': user.id } })
      .then(r => r.json())
      .then(d => {
        const badge = (d.badges || []).find((b: any) => b.id === 'ultimate_champion');
        setHasUltimateBadge(!!badge?.awarded_at);
      })
      .catch(() => {});
  }, [user?.id]);

  const nav = [
    { name: 'Home', path: '/dashboard', icon: Home },
    { name: 'Catalog', path: '/catalog', icon: BookOpen },
    { name: 'Packs', path: '/packs', icon: PackageOpen },
    { name: 'Quiz', path: '/quiz', icon: BrainCircuit },
    { name: 'Trades', path: '/trades', icon: ArrowRightLeft },
    { name: 'Simulation', path: '/simulation', icon: Swords },
    { name: 'Rank', path: '/leaderboard', icon: Trophy },
  ];

  const streakDays = Math.min(Math.max(user?.daily_streak || 0, 0), 7);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900/60 border-r border-white/10 backdrop-blur-md flex-shrink-0 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-black bg-gradient-to-tr from-emerald-400 to-indigo-500 bg-clip-text text-transparent tracking-tighter uppercase italic">World Cup 2026</h1>
          <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-0.5">Sticker Challenge</p>
        </div>
        
        <div className="px-4 py-3 border-y border-white/10 bg-slate-900/40 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5">
             <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm text-emerald-400">
                {user?.nickname.substring(0, 2).toUpperCase()}
             </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <h3 className="font-bold text-sm text-slate-100 truncate">{user?.nickname}</h3>
            <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="bg-emerald-500/10 text-[10px] text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20 font-bold px-1.5 py-0">
                    Lv {user?.level}
                </Badge>
                <span className="text-xs text-amber-400 font-black">🪙 {user?.coins}</span>
                {hasUltimateBadge && <Crown className="h-4 w-4 text-amber-400 ml-1" />}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link 
                key={item.name} 
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-bold tracking-tight ${active ? 'bg-gradient-to-r from-emerald-500/20 to-indigo-500/10 text-emerald-400 border border-white/5 shadow-inner' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <item.icon className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/10 m-2 rounded-xl bg-slate-950/40">
           <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-950/30 font-bold" onClick={() => logout()}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
           </Button>
        </div>
      </aside>

      {/* Main Content & Inner Header */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header Section from Vibrant Palette Theme */}
        <header className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-slate-900/40 border-b border-white/10 backdrop-blur-md gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5">
              <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center font-black text-lg text-emerald-400 italic">
                {user?.nickname.substring(0, 1).toUpperCase()}
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2 italic uppercase text-white">
                {user?.nickname} <span className="text-xs not-italic bg-emerald-500 text-slate-900 px-2.5 py-0.5 rounded-full uppercase font-black">Level {user?.level}</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
                {user?.recovery_code}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Daily Streak</span>
              <div className="flex gap-1 items-center">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`w-1.5 h-4 rounded-full ${idx < streakDays ? 'bg-emerald-500' : 'bg-slate-850'}`} 
                  />
                ))}
                <span className="ml-2 font-black text-emerald-400">{user?.daily_streak || 0}D</span>
              </div>
            </div>
            <div className="hidden sm:block h-10 w-px bg-white/10"></div>
            <div className="flex gap-6">
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-slate-500">Coins</p>
                <p className="text-xl font-black text-amber-400">🪙 {user?.coins?.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-slate-500">XP</p>
                <p className="text-xl font-black text-indigo-400">⚡ {user?.xp?.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </header>

        <div className={`flex-1 ${isSimRoute ? 'overflow-hidden p-0' : 'overflow-y-auto p-4 md:p-8'}`}>
            <div className={`${isSimRoute ? 'w-full h-full flex flex-col' : 'max-w-6xl mx-auto min-h-full w-full flex flex-col'}`}>
                {children}
            </div>
        </div>
      </main>
    </div>
  );
}
