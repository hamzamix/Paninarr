import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import confetti from 'canvas-confetti';
import { Button } from '../components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { getStickerPhotoUrl } from '../utils/stickerImages';
import { getFlagImgUrl } from '../utils/countryData';

type PackType = 'Bronze' | 'Silver' | 'Gold';

type Sticker = {
    id: string;
    name: string;
    category: string;
    rarity: string;
    country?: string;
    description?: string;
    image?: string;
}

const TEAM_FLAG_COLORS: { [key: string]: string[] } = {
    'United States': ['#3C3B6E', '#FFFFFF', '#B22234'], // Blue, White, Red
    'Mexico': ['#006847', '#FFFFFF', '#C8102E'], // Green, White, Red
    'Canada': ['#FF0000', '#FFFFFF', '#FF0000'], // Red, White, Red
    'Argentina': ['#75AADB', '#FFFFFF', '#75AADB'], // Sky Blue, White, Sky Blue
    'Brazil': ['#009739', '#FEDF00', '#002776'], // Green, Yellow, Blue
    'France': ['#002395', '#FFFFFF', '#ED2939'], // Blue, White, Red
    'England': ['#FFFFFF', '#CE1124', '#FFFFFF'], // White, Red, White
    'Spain': ['#C11B17', '#FBBF24', '#C11B17'], // Red, Gold, Red
    'Portugal': ['#046A38', '#DA291C'], // Green, Red
    'Germany': ['#000000', '#FF0000', '#FFCC00'], // Black, Red, Gold
    'Netherlands': ['#AE1C28', '#FFFFFF', '#21468B', '#F17300'], // Red, White, Blue, Orange
    'Norway': ['#BA0C2F', '#FFFFFF', '#003087'], // Red, White, Blue
    'Belgium': ['#000000', '#FDDA24', '#EF3340'], // Black, Yellow, Red
    'Uruguay': ['#0038A8', '#FFFFFF', '#FCD116'], // Blue, White, Yellow
    'Colombia': ['#FCD116', '#0038A8', '#CE1124'], // Yellow, Blue, Red
    'Morocco': ['#C1272D', '#006233', '#C1272D'], // Red, Green, Red
    'Senegal': ['#00853F', '#FDEF42', '#E31B23'], // Green, Yellow, Red
    'Japan': ['#FFFFFF', '#BC002D', '#FFFFFF'], // White, Red, White
    'South Korea': ['#FFFFFF', '#CD2E3A', '#0047A0'], // White, Red, Blue
    'Australia': ['#012169', '#FF0000', '#FFFFFF', '#00843D', '#FFCD00'], // Blue, Red, Green, Gold
    'Croatia': ['#FF0000', '#FFFFFF', '#171796'], // Red, White, Blue
    'Switzerland': ['#D52B1E', '#FFFFFF', '#D52B1E'], // Red, White
    'Sweden': ['#006AA7', '#FECC00'], // Blue, Yellow
    'Austria': ['#ED2939', '#FFFFFF', '#ED2939'], // Red, White, Red
    'Turkey': ['#E30A17', '#FFFFFF'], // Red, White
    'Scotland': ['#005EB8', '#FFFFFF'], // Blue, White
    'Ecuador': ['#FFD100', '#003F87', '#EF3340'], // Yellow, Blue, Red
    'Paraguay': ['#D52B1E', '#FFFFFF', '#0038A8'], // Red, White, Blue
    'Algeria': ['#006633', '#FFFFFF', '#D21034'], // Green, White, Red
    'Egypt': ['#C8102E', '#FFFFFF', '#000000'], // Red, White, Black
    'Ivory Coast': ['#F77F00', '#FFFFFF', '#009E60'], // Orange, White, Green
    'Ghana': ['#CE1124', '#FCD116', '#006B3F'], // Red, Yellow, Green
    'Saudi Arabia': ['#006C35', '#FFFFFF'], // Green, White
    'Iran': ['#239F40', '#FFFFFF', '#DA121A'], // Green, White, Red
    'New Zealand': ['#000000', '#FFFFFF', '#C8102E'], // Black, White, Red
    'Bosnia and Herzegovina': ['#001F3F', '#FECB00', '#FFFFFF'], // Blue, Gold, White
    'Cabo Verde': ['#003893', '#FFFFFF', '#CF2027', '#F7D116'], // Blue, White, Red, Yellow
    'Curaçao': ['#002B7F', '#FFFFFF', '#FED141'], // Blue, White, Yellow
    'Czechia': ['#11457E', '#FFFFFF', '#D7141A'], // Blue, White, Red
    'DR Congo': ['#007FFF', '#CE1126', '#F7D618'], // Blue, Red, Yellow
    'Haiti': ['#00209F', '#D21034', '#FFFFFF'], // Blue, Red, White
    'Iraq': ['#CE1126', '#FFFFFF', '#007A3D'], // Red, White, Green
    'Jordan': ['#CE1126', '#FFFFFF', '#007A3D', '#000000'], // Red, White, Green, Black
    'Panama': ['#FFFFFF', '#CE1126', '#005294'], // White, Red, Blue
    'Qatar': ['#8C1B1B', '#FFFFFF'], // Maroon, White
    'South Africa': ['#DE3831', '#FFFFFF', '#002395', '#FFB81C', '#007A4D'], // Red, White, Blue, Yellow, Green
    'Tunisia': ['#E70013', '#FFFFFF'], // Red, White
    'Uzbekistan': ['#0099B5', '#FFFFFF', '#1EB53A', '#CE1126'], // Blue, White, Green, Red
    'International': ['#10B981', '#6366F1'] // Default emerald to indigo
};

export default function Packs() {
    const { user, refreshUser } = useAuth();
    const [opening, setOpening] = useState(false);
    const [unlocked, setUnlocked] = useState<Sticker[]>([]);

    const openPack = async (type: PackType) => {
        if (!user || opening) return;
        setOpening(true);
        setUnlocked([]);
        
        try {
            const data = await api.post('/packs/open', { type }, user.id);
            setUnlocked(data.unlocked);
            fireConfetti();
            await refreshUser();
        } catch(e: any) {
            console.error(e);
            const msg = e.message || "Couldn't open pack — not enough coins?";
            toast.error(msg, { style: { background: '#1e293b', color: '#fef3c7' } });
        } finally {
            setOpening(false);
        }
    }

    const claimDailyPack = async () => {
        if (!user) return;
        try {
            const data = await api.post('/user/claim-booster', {}, user.id);
            setUnlocked(data.unlocked || []);
            fireConfetti();
            toast.success("Daily Pack Claimed! +200 Coins & +50 XP 🎁");
            await refreshUser();
        } catch(e: any) {
            toast.error(e.message || "Daily pack already claimed.");
        }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const dailyClaimed = user?.last_daily_pack?.slice(0, 10) === todayStr;
    const nextDaily = dailyClaimed ? new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().slice(0, 10) : null;

    const fireConfetti = () => {
        var duration = 3 * 1000;
        var animationEnd = Date.now() + duration;
        var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

        var interval: any = setInterval(function() {
            var timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) { return clearInterval(interval); }
            var particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    }
    
    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    return (
        <div className="space-y-8 animate-in fade-in max-w-5xl mx-auto">
             <header className="text-center py-6">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center justify-center gap-1.5 mb-2">
                   <ShoppingBag className="h-4 w-4" /> Sticker store & loot
                </span>
                <h1 className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent mb-3 uppercase italic tracking-tight">Digital Sticker Packs</h1>
                <p className="text-slate-400 max-w-lg mx-auto text-sm font-medium">Use your earned game coins to unlock random player tiers and complete your World Cup digital collection binders.</p>
            </header>
            
            {user && (
                <div className={`bg-gradient-to-r ${dailyClaimed ? 'from-emerald-500/10 via-green-500/5' : 'from-purple-500/10 via-violet-500/5'} to-transparent border ${dailyClaimed ? 'border-emerald-500/20' : 'border-violet-500/20'} rounded-[2rem] p-6 flex flex-col sm:flex-row justify-between items-center gap-4 max-w-4xl mx-auto backdrop-blur-md`}>
                    <div className="space-y-1 text-center sm:text-left">
                         <span className={`text-xs font-black uppercase tracking-widest ${dailyClaimed ? 'text-emerald-400' : 'text-violet-400'} block`}>
                            {dailyClaimed ? 'Already Claimed Today' : 'Daily Free Pack'}
                         </span>
                         <h3 className="text-lg font-bold text-white uppercase italic tracking-tight">
                            {dailyClaimed ? 'Come back tomorrow for another pack!' : 'Free 5-card pack + 200 coins daily!'}
                         </h3>
                         <p className="text-xs text-slate-400">
                            {dailyClaimed ? 'Your daily pack has been claimed. Resets at midnight.' : '5 random stickers + 200 coins + 50 XP, once per day.'}
                         </p>
                    </div>
                    {!dailyClaimed && (
                        <Button 
                             onClick={claimDailyPack}
                             className="bg-violet-500 hover:bg-violet-400 text-white font-black rounded-2xl uppercase tracking-wider px-8 py-4 h-auto whitespace-nowrap shadow-[0_0_20px_rgba(139,92,246,0.25)] transition-all hover:scale-105"
                        >
                             Claim Free Pack 🎁
                        </Button>
                    )}
                </div>
            )}
            
            {unlocked.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                    {[
                        { type: 'Bronze', cost: 100, count: 3, color: 'from-orange-700/40 via-yellow-800/10 to-transparent', innerBg: 'from-orange-800 to-amber-900', border: 'border-orange-500/40' },
                        { type: 'Silver', cost: 250, count: 5, color: 'from-slate-400/40 via-zinc-600/10 to-transparent', innerBg: 'from-slate-500 to-zinc-700', border: 'border-slate-300/40' },
                        { type: 'Gold', cost: 500, count: 7, color: 'from-yellow-400/40 via-amber-600/15 to-transparent', innerBg: 'from-yellow-400 via-amber-200 to-yellow-500', border: 'border-yellow-300/50' },
                    ].map((pack) => (
                        <div 
                             key={pack.type} 
                             className={`relative overflow-hidden rounded-[2rem] border-2 ${pack.border} bg-slate-950 group flex flex-col items-center p-8 transition-all hover:scale-105 hover:-translate-y-1 hover:shadow-2xl cursor-pointer`} 
                             onClick={() => openPack(pack.type as PackType)}
                        >
                             <div className={`absolute inset-0 bg-gradient-to-b ${pack.color} opacity-20 group-hover:opacity-45 transition-opacity duration-300`} />
                             
                             <div className={`w-32 h-44 rounded-2xl bg-gradient-to-br ${pack.innerBg} mb-6 shadow-2xl flex items-center justify-center border border-white/20 transform group-hover:rotate-[-6deg] transition-transform duration-300`}>
                                 <div className="text-slate-900/40 font-black uppercase rotate-[-20deg] text-base tracking-widest font-mono">
                                    {pack.type}
                                 </div>
                             </div>
                             
                             <h3 className="text-2xl font-black text-white mb-1 uppercase tracking-tight italic">{pack.type} Pack</h3>
                             <p className="text-slate-400 mb-6 font-mono text-xs">{pack.count} Stickers Inside</p>
                             
                             <Button 
                                  disabled={opening} 
                                  className="w-full font-black uppercase tracking-wider bg-white text-slate-950 hover:bg-slate-200 rounded-full py-5 h-auto transition-colors"
                              >
                                  Unlock {pack.cost} 🪙
                              </Button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="max-w-5xl mx-auto text-center space-y-10 py-4">
                     <div className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center justify-center gap-1"><Sparkles className="h-4 w-4 animate-spin" /> Celebratory Reveal</span>
                        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Pack Claims Collected!</h2>
                        <p className="text-sm text-slate-400">Here are the stickers newly registered into your catalog collection.</p>
                     </div>
                     
                     <div className="flex flex-wrap justify-center gap-6">
                        <AnimatePresence>
                         {unlocked.map((sticker, i) => (
                              <motion.div 
                                 initial={{ scale: 0, rotateY: 180 }}
                                 animate={{ scale: 1, rotateY: 0 }}
                                 transition={{ duration: 0.6, delay: i * 0.15 }}
                                 key={i} 
                                 className={`w-48 aspect-[3/4] rounded-2xl border flex flex-col justify-end p-4 shadow-2xl transition-all duration-300 relative overflow-hidden group hover:scale-105 ${
                                 sticker.rarity === 'Legendary' ? 'border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.4)]' :
                                 sticker.rarity === 'Epic' ? 'border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.25)]' :
                                 sticker.rarity === 'Rare' ? 'border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.25)]' :
                                 'border-white/10'
                              }`}>
                                  {/* Flag colors strip under the top edge */}
                                  {sticker.country && sticker.country !== 'International' && TEAM_FLAG_COLORS[sticker.country] && (
                                      <div className="absolute top-0 left-0 right-0 h-1 flex overflow-hidden z-20">
                                          {TEAM_FLAG_COLORS[sticker.country].map((col, idx) => (
                                              <div key={idx} className="flex-1 h-full" style={{ backgroundColor: col }} />
                                          ))}
                                      </div>
                                  )}
                                  {/* Full bleed card background photo */}
                                  <div className="absolute inset-0 z-0">
                                      <img 
                                          src={getStickerPhotoUrl(sticker.id, sticker.category, sticker.image)} 
                                          alt={sticker.name} 
                                          referrerPolicy="no-referrer"
                                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                      />
                                      {/* Gradient overlay mask for layout text readability */}
                                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/20" />
                                  </div>

                                  {/* Metadata and naming info on top of mask */}
                                  <div className="relative z-10 space-y-2 text-left">
                                      <div className="flex justify-between items-center">
                                          <span className="text-[8px] font-mono text-slate-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/5 uppercase tracking-wider">
                                             {sticker.id}
                                          </span>
                                          <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow ${
                                               sticker.rarity === 'Legendary' ? 'bg-[#F59E0B] text-slate-950 font-black' :
                                               sticker.rarity === 'Epic' ? 'bg-purple-500 text-white font-bold' :
                                               sticker.rarity === 'Rare' ? 'bg-blue-500 text-white font-bold' :
                                               'bg-slate-800 text-slate-300'
                                          }`}>
                                              {sticker.rarity}
                                          </div>
                                      </div>
                                      
                                      <div>
                                          <h4 className="font-extrabold text-sm text-white line-clamp-1 leading-snug uppercase tracking-tight italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                              {sticker.name}
                                          </h4>
                                          <p className="text-[10px] text-slate-350 font-mono tracking-wide uppercase flex items-center justify-center gap-1">
                                              <span>{sticker.category}</span>
                                              {sticker.country && sticker.category !== 'Stadiums' && (
                                                  <>
                                                      <span>•</span>
                                                      {getFlagImgUrl(sticker.country) ? (
                                                          <img 
                                                              src={getFlagImgUrl(sticker.country)} 
                                                              alt={sticker.country} 
                                                              className="h-2.5 w-4 object-cover rounded-sm border border-white/5 inline-block" 
                                                              referrerPolicy="no-referrer"
                                                          />
                                                      ) : null}
                                                      <span>{sticker.country}</span>
                                                  </>
                                              )}
                                          </p>
                                      </div>
                                  </div>
                              </motion.div>
                          ))}
                         </AnimatePresence>
                     </div>
                     
                     <div className="pt-6">
                         <Button 
                             variant="default" 
                             className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-full px-10 py-6 h-auto font-black uppercase tracking-widest transition-transform hover:scale-105"
                             onClick={() => setUnlocked([])}
                         >
                             Return To Sticker Shop
                         </Button>
                     </div>
                </div>
            )}
        </div>
    )
}
