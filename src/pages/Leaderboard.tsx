import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Card } from '../components/ui/card';
import { Trophy, Medal } from 'lucide-react';

type LeaderboardUser = {
    id: string;
    nickname: string;
    level: number;
    xp: number;
    coins: number;
    country: string;
}

export default function Leaderboard() {
    const { user } = useAuth();
    const [players, setPlayers] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;
        api.get('/leaderboard', user.id)
           .then(data => setPlayers(data.leaderboard))
           .catch(console.error)
           .finally(() => setLoading(false));
    }, [user?.id]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4 animate-pulse">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
                <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">Retrieving global standings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto pt-4 animate-in fade-in">
            <header className="text-center">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#10B981] flex items-center justify-center gap-1.5 mb-2">
                   <Trophy className="h-4 w-4 animate-bounce" /> GLOBAL CHAMPIONSHIPS STANDINGS
                </span>
                <h1 className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-yellow-200 to-amber-500 bg-clip-text text-transparent uppercase italic tracking-tight mb-3">Leaderboards</h1>
                <p className="text-sm text-slate-400 max-w-md mx-auto font-medium">Earn quiz points and redeem album packs to advance on the world champion ranks.</p>
            </header>

            <Card className="bg-slate-900/40 border border-white/10 rounded-[2rem] overflow-hidden backdrop-blur-md shadow-2xl">
                 <div className="divide-y divide-white/5">
                      <div className="px-6 py-4 bg-slate-950/40 flex items-center justify-between text-[11px] font-black tracking-widest text-slate-500 uppercase">
                          <div className="flex gap-12 items-center">
                              <span>Rank</span>
                              <span className="ml-[18px]">Player details</span>
                          </div>
                          <div className="flex gap-10 items-center text-right">
                              <span className="w-16">Player Level</span>
                              <span className="w-24">Experience points</span>
                          </div>
                      </div>
                      
                      {players.map((p, index) => {
                          const isMe = p.id === user?.id;
                          const isTop3 = index < 3;
                          
                          return (
                              <div key={p.id} className={`px-6 py-4.5 flex items-center justify-between transition-colors hover:bg-white/5 ${isMe ? 'bg-emerald-500/10 border-y border-emerald-500/20' : ''}`}>
                                  <div className="flex items-center gap-6">
                                      <div className={`w-8 font-black text-lg text-center ${
                                          index === 0 ? 'text-yellow-500 scale-110' : 
                                          index === 1 ? 'text-slate-300' : 
                                          index === 2 ? 'text-amber-700' : 'text-slate-500 font-mono'
                                      }`}>
                                          {isTop3 ? (
                                              <Medal className="h-5 w-5 mx-auto text-amber-400" />
                                          ) : (
                                              `#${index + 1}`
                                          )}
                                      </div>
                                      
                                      <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5">
                                             <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                                                {p.nickname.substring(0,2).toUpperCase()}
                                             </div>
                                          </div>
                                          <div>
                                             <div className="font-bold text-slate-100 flex items-center gap-2">
                                                 {p.nickname}
                                                 {isMe && <span className="text-[9px] bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold shadow-sm">You</span>}
                                             </div>
                                              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">{p.country ? `⚽ ${p.country}` : 'No team'}</div>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <div className="flex gap-10 items-center text-right font-mono text-sm font-bold">
                                      <div className="w-16 text-emerald-400 text-xs uppercase tracking-tight">LV {p.level}</div>
                                      <div className="w-24 text-slate-100">{p.xp.toLocaleString()} <span className="text-[10px] text-indigo-400">XP</span></div>
                                  </div>
                              </div>
                          )
                      })}
                 </div>
            </Card>
        </div>
    )
}
