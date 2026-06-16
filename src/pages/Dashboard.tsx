import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Trophy, Star, BookOpen, Clock, Gift, BrainCircuit, PackageOpen, ArrowUpRight, Award } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';

type UserStats = {
  totalStickers: number;
  uniqueOwned: number;
  totalOwned: number;
  duplicates: number;
  questionsAnswered: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    totalStickers: 24,
    uniqueOwned: 0,
    totalOwned: 0,
    duplicates: 0,
    questionsAnswered: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    api.get('/user/stats', user.id)
       .then(data => {
         if (data) {
           setStats(data);
         }
       })
       .catch(console.error)
       .finally(() => setLoading(false));
  }, [user?.id]);

  if (!user) return null;

  const currentLevelXp = user.xp % 1000;
  const xpPercentage = (currentLevelXp / 1000) * 100;
  const completionPercentage = stats.totalStickers > 0 
    ? Math.round((stats.uniqueOwned / stats.totalStickers) * 100) 
    : 0;

  // Real Dynamic Achievement based on SQLite DB State
  let achievementTitle = "Fresh Recruit";
  let achievementDesc = "Explore the shop or trivia to win cards.";
  if (stats.uniqueOwned >= 24) {
    achievementTitle = "Panini Grandmaster";
    achievementDesc = "Discovered 100% of the official collection!";
  } else if (stats.uniqueOwned >= 12) {
    achievementTitle = "Sticker Elite";
    achievementDesc = "Unlocked more than half of the binder";
  } else if (stats.questionsAnswered >= 10) {
    achievementTitle = "Football Historian";
    achievementDesc = `Successfully answered ${stats.questionsAnswered} trivia questions`;
  } else if (stats.uniqueOwned >= 1) {
    achievementTitle = "First Touchdown";
    achievementDesc = "Opened a pack and found your first sticker";
  }

  // Real Dynamic Daily Challenge items
  const dailyTasks = [
    { title: "Complete trivia quizzes", reward: "25 XP", done: stats.questionsAnswered >= 5, value: stats.questionsAnswered, total: 5 },
    { title: "Unbox rare stickers", reward: "200 Coins", done: stats.uniqueOwned >= 3, value: stats.uniqueOwned, total: 3 },
    { title: "Find duplicate listings", reward: "50 Coins", done: stats.duplicates >= 1, value: stats.duplicates, total: 1 },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4 animate-pulse">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
        <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">Loading stats board...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Intro Hero with glowing background elements */}
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 border border-white/10 p-8 sm:p-10 shadow-2xl">
         <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-80 h-80 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
         <div className="absolute bottom-0 left-0 translate-y-24 -translate-x-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
         
         <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
               <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">WC companion platform</span>
               <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase italic">Welcome back, {user.nickname}!</h1>
               <p className="text-sm text-slate-400 font-medium">
                  Challenge recovery code: <span className="font-mono text-emerald-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-white/5 select-all">{user.recovery_code}</span>
               </p>
            </div>
            
            <Link to="/packs">
               <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-full uppercase tracking-wider px-8 py-6 h-auto shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all transform hover:scale-105">
                  Open Pack <ArrowUpRight className="ml-2 h-5 w-5" />
               </Button>
            </Link>
         </div>
      </div>

      {/* Album completion visual with circular look or premium grid */}
      <h2 className="text-xs uppercase font-bold tracking-[0.2em] text-slate-400">Progress Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <Card className="bg-slate-900/50 border-white/5 backdrop-blur-sm rounded-3xl p-2">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-xs uppercase font-bold tracking-[0.1em] text-slate-500">Player level</CardTitle>
                 <Star className="h-4 w-4 text-emerald-400" />
             </CardHeader>
             <CardContent>
                 <div className="text-3xl font-black text-white italic mb-1">LV {user.level}</div>
                 <div className="space-y-1.5">
                    <Progress value={xpPercentage} className="h-1.5 bg-slate-800" />
                    <div className="flex justify-between text-[11px] font-mono text-slate-400">
                       <span>{currentLevelXp} XP</span>
                       <span>1000 XP</span>
                    </div>
                 </div>
             </CardContent>
         </Card>
         
         <Card className="bg-slate-900/50 border-white/5 backdrop-blur-sm rounded-3xl p-2">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-xs uppercase font-bold tracking-[0.1em] text-slate-500">Collection progress</CardTitle>
                 <BookOpen className="h-4 w-4 text-indigo-400" />
             </CardHeader>
             <CardContent>
                 <div className="text-3xl font-black text-indigo-400 italic mb-1">{completionPercentage}%</div>
                 <p className="text-[11px] font-mono text-slate-400">{stats.uniqueOwned} / {stats.totalStickers} stickers collected</p>
             </CardContent>
         </Card>

         <Card className="bg-slate-900/50 border-white/5 backdrop-blur-sm rounded-3xl p-2">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-xs uppercase font-bold tracking-[0.1em] text-slate-500">Streak details</CardTitle>
                 <Clock className="h-4 w-4 text-orange-400" />
             </CardHeader>
             <CardContent>
                 <div className="text-3xl font-black text-orange-400 italic mb-1">{user.daily_streak} Days</div>
                 <p className="text-[11px] font-mono text-slate-400">Keep compiling daily streak bonuses!</p>
             </CardContent>
         </Card>

         <Card className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-white/10 rounded-3xl p-2 flex flex-col justify-between">
             <CardHeader className="flex flex-row items-center justify-between pb-1">
                 <CardTitle className="text-xs uppercase font-bold tracking-[0.1em] text-white/50">Latest achievement</CardTitle>
                 <Award className="h-4 w-4 text-amber-400" />
             </CardHeader>
             <CardContent>
                 <div className="text-lg font-black text-white italic">{achievementTitle}</div>
                 <p className="text-[11px] text-white/60">{achievementDesc}</p>
             </CardContent>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Daily Challenges */}
          <div className="lg:col-span-5 space-y-4 bg-slate-900/40 rounded-3xl p-6 border border-white/5 backdrop-blur-sm">
              <h3 className="text-xs uppercase font-bold tracking-[0.2em] text-slate-400 mb-2">Daily Challenges</h3>
              <div className="space-y-4">
                  {dailyTasks.map((task, i) => (
                      <div key={i} className={`p-4 rounded-2xl border transition-all ${task.done ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/5'}`}>
                          <div className="flex justify-between items-center mb-2">
                              <span className={`text-sm font-bold ${task.done ? 'text-emerald-400 line-through' : 'text-slate-200'}`}>{task.title}</span>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">{task.done ? 'COMPLETED' : `${task.value}/${task.total}`}</span>
                          </div>
                          {!task.done && (
                             <Progress value={(task.value / task.total) * 100} className="h-1 bg-slate-800" />
                          )}
                          <div className="mt-2 flex justify-end">
                             <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#10B981]">{task.reward}</span>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
          
          {/* Quick Actions Grid */}
          <div className="lg:col-span-7 space-y-4">
              <h3 className="text-xs uppercase font-bold tracking-[0.2em] text-slate-400">Challenge Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Link to="/catalog" className="p-6 rounded-3xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/50 transition-all group hover:-translate-y-1">
                      <BookOpen className="h-8 w-8 text-slate-400 group-hover:text-indigo-400 mb-4 transition-colors" />
                      <h3 className="font-black text-lg text-white uppercase italic tracking-tight">Sticker Catalog</h3>
                      <p className="text-xs text-slate-400 mt-1">Check your sticker category binders</p>
                  </Link>
                  <Link to="/quiz" className="p-6 rounded-3xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/50 transition-all group hover:-translate-y-1">
                      <BrainCircuit className="h-8 w-8 text-slate-400 group-hover:text-amber-400 mb-4 transition-colors" />
                      <h3 className="font-black text-lg text-white uppercase italic tracking-tight">Play Quiz</h3>
                      <p className="text-xs text-slate-400 mt-1">Earn free coins & xp playing history trivia</p>
                  </Link>
                  <Link to="/packs" className="p-6 rounded-3xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/50 transition-all group hover:-translate-y-1">
                      <PackageOpen className="h-8 w-8 text-slate-400 group-hover:text-emerald-400 mb-4 transition-colors" />
                      <h3 className="font-black text-lg text-white uppercase italic tracking-tight">Sticker Shop</h3>
                      <p className="text-xs text-slate-400 mt-1">Open bronze, silver & gold packs</p>
                  </Link>
                  <Link to="/leaderboard" className="p-6 rounded-3xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/50 transition-all group hover:-translate-y-1">
                      <Trophy className="h-8 w-8 text-slate-400 group-hover:text-emerald-400 mb-4 transition-colors" />
                      <h3 className="font-black text-lg text-white uppercase italic tracking-tight">Global Ranks</h3>
                      <p className="text-xs text-slate-400 mt-1">Check the global high score leaderboards</p>
                  </Link>
              </div>
          </div>
      </div>
    </div>
  );
}
